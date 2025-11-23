import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RefCodeService } from './ref-code.service';
import { CommissionService } from './commission.service';
import { CollateralService } from '../collateral/collateral.service';
import { BankSelectionService } from '../collateral/bank-selection.service';
import { LoggerService } from '../common/logger/logger.service';
import { FraudDetectionService } from '../security/fraud-detection.service';
import { PaymentCreatorService } from './services/payment-creator.service';
import { PaymentApprovalService } from './services/payment-approval.service';
import { PaymentCancellationService } from './services/payment-cancellation.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { PaymentStatus, Transaction } from '@prisma/client';
import {
  PaymentConstants,
  ValidationUtil,
  DateUtil,
  TransactionHelper,
  PaymentNotFoundException,
  PaymentExpiredException,
  InvalidPaymentStatusException,
  PlatformNotFoundException,
  FraudDetectedException,
} from '../common';

@Injectable()
export class PaymentService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private refCode: RefCodeService,
    private commission: CommissionService,
    private collateral: CollateralService,
    private bankSelection: BankSelectionService,
    private logger: LoggerService,
    private fraudDetection: FraudDetectionService,
    private paymentCreator: PaymentCreatorService,
    private paymentApproval: PaymentApprovalService,
    private paymentCancellation: PaymentCancellationService,
  ) {
    this.logger.setContext('PaymentService');
  }

  /**
   * Yeni ödeme oluştur
   * Delegated to PaymentCreatorService for better separation of concerns
   */
  async createPayment(
    platformId: string,
    dto: CreatePaymentDto,
    customerIp?: string,
  ): Promise<PaymentResponseDto> {
    // Validation: Amount limits
    ValidationUtil.validateAmount(dto.amount);

    // Delegate to specialized service
    return this.paymentCreator.createPayment(platformId, dto, customerIp);
  }

  /**
   * Ödeme durumu sorgula
   */
  async getPayment(id: string) {
    // Önce cache'den bak
    let payment = await this.redis.get(TransactionHelper.getPaymentCacheKey(id));

    if (!payment) {
      // Cache'de yoksa DB'den çek
      payment = await this.prisma.transaction.findUnique({
        where: { id },
        include: {
          bank: true,
          platform: true,
        },
      });

      if (!payment) {
        throw new PaymentNotFoundException(id);
      }

      // Cache'e kaydet
      await this.redis.set(
        TransactionHelper.getPaymentCacheKey(id),
        payment,
        PaymentConstants.TIME.LONG_CACHE_TTL_SECONDS,
      );
    }

    return this.formatPaymentResponse(payment);
  }

  /**
   * Ref kod ile ödeme bul
   */
  async getPaymentByCode(code: string) {
    // Önce cache'den ID bul
    const paymentId = await this.redis.get(
      TransactionHelper.getPaymentCodeCacheKey(code),
    );

    if (paymentId) {
      return this.getPayment(paymentId);
    }

    // Cache'de yoksa DB'den bul
    const payment = await this.prisma.transaction.findUnique({
      where: { transaction_code: code },
      include: {
        bank: true,
        platform: true,
      },
    });

    if (!payment) {
      throw new PaymentNotFoundException(code);
    }

    return this.formatPaymentResponse(payment);
  }

  /**
   * Ödeme onayla (Admin)
   * Delegated to PaymentApprovalService for better separation of concerns
   */
  async approvePayment(id: string, adminId: string): Promise<PaymentResponseDto> {
    return this.paymentApproval.approvePayment(id, adminId);
  }

  /**
   * Ödeme reddet
   * Delegated to PaymentCancellationService for better separation of concerns
   */
  async rejectPayment(id: string, adminId: string, reason?: string): Promise<PaymentResponseDto> {
    return this.paymentCancellation.rejectPayment(id, adminId, reason);
  }

  /**
   * Süresi dolan ödemeleri işaretle ve teminatları serbest bırak
   */
  async expirePayments() {
    // Süresi dolmuş PENDING ödemeleri bul
    const expiredPayments = await this.prisma.transaction.findMany({
      where: {
        status: PaymentStatus.PENDING,
        expires_at: {
          lt: new Date(),
        },
      },
      select: {
        id: true,
        transaction_code: true,
        bank_id: true,
      },
    });

    if (expiredPayments.length === 0) {
      return { count: 0 };
    }

    this.logger.log(`Processing ${expiredPayments.length} expired payments`);

    // Her bir ödeme için: status güncelle + collateral release
    for (const payment of expiredPayments) {
      try {
        // Status güncelle
        await this.prisma.transaction.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.EXPIRED },
        });

        // Teminat serbest bırak
        await this.collateral.releaseCollateral(payment.bank_id, payment.id);

        // Event log
        await this.createEvent(payment.id, 'expired', {
          collateral_released: true,
        });

        // Cache temizle
        await this.redis.del(`payment:${payment.id}`);
        await this.redis.del(`payment:code:${payment.transaction_code}`);

        // Pub/Sub
        await this.redis.publish('payment:expired', {
          id: payment.id,
          code: payment.transaction_code,
          bank_id: payment.bank_id,
        });

        this.logger.log(`Payment ${payment.id} expired and collateral released`);
      } catch (error) {
        this.logger.error(`Failed to expire payment ${payment.id}: ${error.message}`);
      }
    }

    this.logger.log(`⏰ ${expiredPayments.length} payments expired`);

    return { count: expiredPayments.length };
  }

  // Helper Methods

  /**
   * Release collateral with retry logic (exponential backoff)
   * Prevents orphaned locks due to temporary failures
   */
  private async releaseCollateralWithRetry(
    bankId: string,
    transactionId: string,
    context: string,
    retryCount: number = 0,
    maxRetries: number = 3,
  ): Promise<void> {
    try {
      await this.collateral.releaseCollateral(bankId, transactionId);
    } catch (error) {
      if (retryCount >= maxRetries) {
        // Max retries reached - log error for orphan cleanup
        this.logger.error(
          `Failed to release collateral for ${context} payment ${transactionId} ` +
          `after ${retryCount} retries: ${error.message}`
        );
        throw error;
      }

      // Calculate exponential backoff delay (1s, 2s, 4s)
      const delay = Math.pow(2, retryCount) * 1000;
      this.logger.warn(
        `Collateral release failed for ${context} payment ${transactionId}, ` +
        `retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries}): ${error.message}`
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Retry
      return this.releaseCollateralWithRetry(
        bankId,
        transactionId,
        context,
        retryCount + 1,
        maxRetries,
      );
    }
  }

  private async createEvent(
    transactionId: string,
    eventType: string,
    data?: any,
  ) {
    await this.prisma.paymentEvent.create({
      data: {
        transaction_id: transactionId,
        event_type: eventType,
        data: data || {},
      },
    });
  }

  private formatPaymentResponse(payment: any): PaymentResponseDto {
    return PaymentResponseDto.from(payment);
  }
}
