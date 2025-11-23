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
  InvalidPaymentStatusException,
} from '../../common';

/**
 * PaymentCancellationService
 * Handles payment rejection and cancellation logic
 * Extracted from PaymentService for better separation of concerns
 */
@Injectable()
export class PaymentCancellationService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private collateral: CollateralService,
    private logger: LoggerService,
  ) {
    this.logger.setContext('PaymentCancellationService');
  }

  /**
   * Reject a payment transaction
   */
  async rejectPayment(
    paymentId: string,
    adminId: string,
    reason?: string,
  ): Promise<PaymentResponseDto> {
    // Load and validate payment
    const payment = await this.loadPayment(paymentId);
    this.validatePaymentForRejection(payment);

    // Perform rejection with optimistic locking
    const updatedPayment = await this.updatePaymentStatus(
      paymentId,
      PaymentStatus.REJECTED,
      adminId,
      reason,
    );

    // Release collateral
    await this.releaseCollateral(payment.bank_id, paymentId, 'REJECTED');

    // Update cache
    await this.updateCache(updatedPayment);

    // Log event
    await this.logPaymentEvent(paymentId, 'REJECTED', {
      admin_id: adminId,
      reason,
    });

    this.logger.log(
      `Payment rejected: ${payment.transaction_code} by admin ${adminId} - Reason: ${reason || 'N/A'}`,
    );

    return PaymentResponseDto.from(updatedPayment);
  }

  /**
   * Cancel an expired payment
   */
  async cancelExpiredPayment(paymentId: string): Promise<void> {
    const payment = await this.loadPayment(paymentId);

    // Update status
    await this.prisma.transaction.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.EXPIRED,
      },
    });

    // Release collateral
    await this.releaseCollateral(payment.bank_id, paymentId, 'EXPIRED');

    // Clear cache
    await this.clearCache(paymentId);

    // Log event
    await this.logPaymentEvent(paymentId, 'EXPIRED');

    this.logger.log(`Payment expired and cancelled: ${payment.transaction_code}`);
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
   * Validate payment can be rejected
   */
  private validatePaymentForRejection(payment: any): void {
    // Check status
    if (payment.status !== PaymentStatus.PENDING) {
      throw new InvalidPaymentStatusException(
        payment.transaction_code,
        payment.status,
        'reject',
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
    reason?: string,
  ) {
    const updated = await this.prisma.transaction.updateMany({
      where: {
        id: paymentId,
        status: PaymentStatus.PENDING, // Optimistic lock
      },
      data: {
        status,
        rejected_by_id: adminId,
        rejected_at: new Date(),
        rejection_reason: reason,
      },
    });

    if (updated.count === 0) {
      throw new InvalidPaymentStatusException(paymentId, 'NOT_PENDING', 'reject');
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
   * Release collateral
   */
  private async releaseCollateral(
    bankId: string,
    paymentId: string,
    reason: string,
  ): Promise<void> {
    try {
      await this.collateral.releaseCollateral(bankId, paymentId);
      this.logger.log(`Collateral released for ${reason} payment ${paymentId}`);
    } catch (error) {
      this.logger.error(
        `Failed to release collateral for payment ${paymentId}: ${error.message}`,
      );
      // Continue - orphan cleanup will handle it
    }
  }

  /**
   * Update cache after rejection
   */
  private async updateCache(payment: any): Promise<void> {
    const cacheKey = TransactionHelper.getPaymentCacheKey(payment.id);
    await this.redis.set(cacheKey, JSON.stringify(payment), 3600);
  }

  /**
   * Clear cache
   */
  private async clearCache(paymentId: string): Promise<void> {
    const cacheKey = TransactionHelper.getPaymentCacheKey(paymentId);
    await this.redis.del(cacheKey);
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
