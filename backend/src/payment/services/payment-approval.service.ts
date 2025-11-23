import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CollateralService } from '../../collateral/collateral.service';
import { LoggerService } from '../../common/logger/logger.service';
import { PaymentResponseDto } from '../dto/payment-response.dto';
import { PaymentStatus } from '@prisma/client';
import {
  TransactionHelper,
  PaymentNotFoundException,
  PaymentExpiredException,
  InvalidPaymentStatusException,
} from '../../common';

/**
 * PaymentApprovalService
 * Handles payment approval logic
 * Extracted from PaymentService for better separation of concerns
 */
@Injectable()
export class PaymentApprovalService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private collateral: CollateralService,
    private logger: LoggerService,
  ) {
    this.logger.setContext('PaymentApprovalService');
  }

  /**
   * Approve a payment transaction
   */
  async approvePayment(paymentId: string, adminId: string): Promise<PaymentResponseDto> {
    // Load and validate payment
    const payment = await this.loadPayment(paymentId);
    this.validatePaymentForApproval(payment);

    // Perform approval with optimistic locking
    const updatedPayment = await this.updatePaymentStatus(
      paymentId,
      PaymentStatus.APPROVED,
      adminId,
    );

    // Release collateral
    await this.releaseCollateral(payment.bank_id, paymentId, 'APPROVED');

    // Update cache
    await this.updateCache(updatedPayment);

    // Log event
    await this.logPaymentEvent(paymentId, 'APPROVED', { admin_id: adminId });

    this.logger.log(
      `Payment approved: ${payment.transaction_code} by admin ${adminId}`,
    );

    return PaymentResponseDto.from(updatedPayment);
  }

  /**
   * Load payment from database
   */
  private async loadPayment(paymentId: string) {
    const payment = await this.prisma.transaction.findUnique({
      where: { id: paymentId },
      include: {
        bank: true,
        platform: true,
      },
    });

    if (!payment) {
      throw new PaymentNotFoundException(paymentId);
    }

    return payment;
  }

  /**
   * Validate payment can be approved
   */
  private validatePaymentForApproval(payment: any): void {
    // Check expiration
    if (new Date() > payment.expires_at) {
      throw new PaymentExpiredException(payment.transaction_code);
    }

    // Check status
    if (payment.status !== PaymentStatus.PENDING) {
      throw new InvalidPaymentStatusException(
        payment.transaction_code,
        payment.status,
        'approve',
      );
    }
  }

  /**
   * Update payment status with optimistic locking
   */
  private async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    adminId: string,
  ) {
    const updated = await this.prisma.transaction.updateMany({
      where: {
        id: paymentId,
        status: PaymentStatus.PENDING, // Optimistic lock: only update if still PENDING
      },
      data: {
        status,
        approved_by_id: adminId,
        approved_at: new Date(),
      },
    });

    if (updated.count === 0) {
      throw new InvalidPaymentStatusException(paymentId, 'NOT_PENDING', 'approve');
    }

    // Fetch updated payment
    return this.prisma.transaction.findUnique({
      where: { id: paymentId },
      include: {
        bank: true,
        platform: true,
      },
    });
  }

  /**
   * Release collateral with retry
   */
  private async releaseCollateral(
    bankId: string,
    paymentId: string,
    reason: string,
  ): Promise<void> {
    try {
      await this.releaseCollateralWithRetry(bankId, paymentId, reason);
      this.logger.log(`Collateral released for approved payment ${paymentId}`);
    } catch (error) {
      this.logger.error(
        `Failed to release collateral for payment ${paymentId} after retries: ${error.message}. ` +
          `Orphan cleanup job will handle this.`,
      );
      // Don't rollback approval - orphan cleanup job will fix this later
    }
  }

  /**
   * Release collateral with retry logic
   */
  private async releaseCollateralWithRetry(
    bankId: string,
    paymentId: string,
    reason: string,
    maxRetries: number = 3,
  ): Promise<void> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.collateral.releaseCollateral(paymentId, reason);
        return; // Success
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Collateral release attempt ${attempt}/${maxRetries} failed: ${error.message}`,
        );

        if (attempt < maxRetries) {
          await this.delay(1000 * attempt); // Exponential backoff
        }
      }
    }

    throw lastError;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Update cache after approval
   */
  private async updateCache(payment: any): Promise<void> {
    const cacheKey = TransactionHelper.getPaymentCacheKey(payment.id);
    await this.redis.set(cacheKey, JSON.stringify(payment), 3600);
  }

  /**
   * Log payment event
   */
  private async logPaymentEvent(
    transactionId: string,
    eventType: string,
    data?: any,
  ): Promise<void> {
    await this.prisma.paymentEvent.create({
      data: {
        transaction_id: transactionId,
        event_type: eventType,
        data: data || {},
      },
    });
  }
}
