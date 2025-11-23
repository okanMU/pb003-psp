import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RefCodeService } from './ref-code.service';
import { CommissionService } from './commission.service';
import { CollateralService } from '../collateral/collateral.service';
import { BankSelectionService } from '../collateral/bank-selection.service';
import { LoggerService } from '../common/logger/logger.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentStatus } from '@prisma/client';
import { PaymentConstants, formatErrorMessage } from '../common/constants/payment.constants';
import * as dayjs from 'dayjs';

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
  ) {
    this.logger.setContext('PaymentService');
  }

  /**
   * Yeni ödeme oluştur
   */
  async createPayment(
    platformId: string,
    dto: CreatePaymentDto,
    customerIp?: string,
  ) {
    this.logger.log(`Creating payment for platform ${platformId}, amount: ${dto.amount}`);

    // Validation: Amount limits
    this.validatePaymentAmount(dto.amount);

    // Platform kontrolü
    const platform = await this.prisma.platform.findUnique({
      where: { id: platformId, is_active: true },
    });

    if (!platform) {
      throw new BadRequestException(PaymentConstants.ERRORS.INVALID_PLATFORM);
    }

    // Akıllı hesap seçimi (minimum waste strategy + collateral check)
    const bank = await this.bankSelection.selectBestBank(dto.amount);
    this.logger.log(`Selected bank ${bank.id} (${bank.name}) for payment`);

    // Ref kod üret
    const transactionCode = this.refCode.generate();

    // Expiry hesapla (configured timeout)
    const expiresAt = dayjs()
      .add(PaymentConstants.TIME.PAYMENT_EXPIRY_MINUTES, 'minute')
      .toDate();

    // Transaction oluştur
    const transaction = await this.prisma.transaction.create({
      data: {
        transaction_code: transactionCode,
        platform_id: platformId,
        bank_id: bank.id,
        amount: dto.amount,
        currency: dto.currency || 'TRY',
        status: PaymentStatus.PENDING,
        customer_email: dto.customer_email,
        customer_phone: dto.customer_phone,
        customer_name: dto.customer_name,
        customer_ip: customerIp,
        platform_order_id: dto.platform_order_id,
        metadata: dto.metadata || {},
        expires_at: expiresAt,
        lock_expires_at: expiresAt, // Collateral lock expires with payment
      },
      include: {
        bank: true,
        platform: true,
      },
    });

    this.logger.log(`Transaction created: ${transaction.id} (${transactionCode})`);

    // Teminat kilitle (atomic operation with race condition prevention)
    try {
      await this.collateral.lockCollateral(
        bank.id,
        transaction.id,
        dto.amount,
      );
      this.logger.log(`Collateral locked for transaction ${transaction.id}`);
    } catch (error) {
      // Collateral locking failed - rollback transaction
      await this.prisma.transaction.delete({ where: { id: transaction.id } });
      this.logger.error(`Failed to lock collateral, transaction rolled back: ${error.message}`);
      throw error;
    }

    // Event log
    await this.createEvent(transaction.id, 'created', {
      amount: dto.amount,
      bank: bank.name,
      collateral_locked: true,
    });

    // Redis cache (hızlı erişim için)
    await this.redis.set(
      `payment:${transaction.id}`,
      transaction,
      PaymentConstants.TIME.PAYMENT_CACHE_TTL_SECONDS,
    );
    await this.redis.set(
      `payment:code:${transactionCode}`,
      transaction.id,
      PaymentConstants.TIME.PAYMENT_CACHE_TTL_SECONDS,
    );

    // Pub/Sub - Real-time notification
    await this.redis.publish('payment:created', {
      id: transaction.id,
      code: transactionCode,
      amount: transaction.amount,
      bank_id: bank.id,
    });

    return this.formatPaymentResponse(transaction);
  }

  /**
   * Ödeme durumu sorgula
   */
  async getPayment(id: string) {
    // Önce cache'den bak
    let payment = await this.redis.get(`payment:${id}`);

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
        throw new NotFoundException('Payment not found');
      }

      // Cache'e kaydet
      await this.redis.set(`payment:${id}`, payment, 1800);
    }

    return this.formatPaymentResponse(payment);
  }

  /**
   * Ref kod ile ödeme bul
   */
  async getPaymentByCode(code: string) {
    // Önce cache'den ID bul
    const paymentId = await this.redis.get(`payment:code:${code}`);

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
      throw new NotFoundException('Payment not found');
    }

    return this.formatPaymentResponse(payment);
  }

  /**
   * Ödeme onayla (Admin)
   */
  async approvePayment(id: string, adminId: string) {
    const payment = await this.prisma.transaction.findUnique({
      where: { id },
      include: { platform: true, bank: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(
        formatErrorMessage(PaymentConstants.ERRORS.PAYMENT_NOT_PENDING, {
          status: payment.status,
        }),
      );
    }

    this.logger.log(`Approving payment ${id} by admin ${adminId}`);

    // Komisyon hesapla
    const commissions = this.commission.calculate(
      payment.amount,
      payment.platform.commission_rate,
    );

    // Güncelle with optimistic locking (race condition prevention)
    // Only update if status is still PENDING
    const updated = await this.prisma.transaction.updateMany({
      where: {
        id,
        status: PaymentStatus.PENDING, // Race condition check
      },
      data: {
        status: PaymentStatus.APPROVED,
        approved_by_id: adminId,
        approved_at: new Date(),
        platform_commission: commissions.platformCommission,
        psp_commission: commissions.pspCommission,
        net_amount: commissions.netAmount,
      },
    });

    // Check if update succeeded (status was still PENDING)
    if (updated.count === 0) {
      // Payment status changed while we were processing
      const currentPayment = await this.prisma.transaction.findUnique({
        where: { id },
        select: { status: true },
      });

      throw new BadRequestException(
        `Payment status changed during approval. Current status: ${currentPayment?.status || 'UNKNOWN'}`
      );
    }

    // Fetch the updated transaction with relations
    const approvedPayment = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        bank: true,
        platform: true,
      },
    });

    // Teminat serbest bırak (collateral release with retry)
    try {
      await this.releaseCollateralWithRetry(payment.bank_id, id, 'APPROVED');
      this.logger.log(`Collateral released for approved payment ${id}`);
    } catch (error) {
      this.logger.error(
        `Failed to release collateral for payment ${id} after retries: ${error.message}. ` +
        `Orphan cleanup job will handle this.`
      );
      // Don't rollback approval - orphan cleanup job will fix this later
    }

    // Event log
    await this.createEvent(id, 'approved', {
      admin_id: adminId,
      commissions,
      collateral_released: true,
    });

    // Cache güncelle
    await this.redis.set(`payment:${id}`, approvedPayment, PaymentConstants.TIME.LONG_CACHE_TTL_SECONDS);

    // Pub/Sub
    await this.redis.publish('payment:approved', {
      id: approvedPayment.id,
      code: approvedPayment.transaction_code,
      bank_id: payment.bank_id,
    });

    return this.formatPaymentResponse(approvedPayment);
  }

  /**
   * Ödeme reddet
   */
  async rejectPayment(id: string, adminId: string, reason?: string) {
    const payment = await this.prisma.transaction.findUnique({
      where: { id },
      include: { bank: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(
        formatErrorMessage(PaymentConstants.ERRORS.PAYMENT_NOT_PENDING, {
          status: payment.status,
        }),
      );
    }

    this.logger.log(`Rejecting payment ${id} by admin ${adminId}`);

    // Update with optimistic locking (race condition prevention)
    const updated = await this.prisma.transaction.updateMany({
      where: {
        id,
        status: PaymentStatus.PENDING, // Race condition check
      },
      data: {
        status: PaymentStatus.REJECTED,
        rejected_by_id: adminId,
        rejected_at: new Date(),
        rejection_reason: reason,
      },
    });

    // Check if update succeeded
    if (updated.count === 0) {
      const currentPayment = await this.prisma.transaction.findUnique({
        where: { id },
        select: { status: true },
      });

      throw new BadRequestException(
        `Payment status changed during rejection. Current status: ${currentPayment?.status || 'UNKNOWN'}`
      );
    }

    // Fetch the updated transaction with relations
    const rejectedPayment = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        bank: true,
        platform: true,
      },
    });

    // Teminat serbest bırak (collateral release with retry)
    try {
      await this.releaseCollateralWithRetry(payment.bank_id, id, 'REJECTED');
      this.logger.log(`Collateral released for rejected payment ${id}`);
    } catch (error) {
      this.logger.error(
        `Failed to release collateral for payment ${id} after retries: ${error.message}. ` +
        `Orphan cleanup job will handle this.`
      );
      // Don't rollback rejection - orphan cleanup job will fix this later
    }

    // Event log
    await this.createEvent(id, 'rejected', {
      admin_id: adminId,
      reason,
      collateral_released: true,
    });

    // Cache güncelle
    await this.redis.set(`payment:${id}`, rejectedPayment, PaymentConstants.TIME.LONG_CACHE_TTL_SECONDS);

    // Pub/Sub
    await this.redis.publish('payment:rejected', {
      id: rejectedPayment.id,
      code: rejectedPayment.transaction_code,
      reason,
      bank_id: payment.bank_id,
    });

    return this.formatPaymentResponse(rejectedPayment);
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
   * Validate payment amount against limits
   */
  private validatePaymentAmount(amount: number): void {
    if (amount < PaymentConstants.LIMITS.MIN_PAYMENT_AMOUNT) {
      throw new BadRequestException(
        formatErrorMessage(PaymentConstants.ERRORS.AMOUNT_TOO_LOW, {
          min: PaymentConstants.LIMITS.MIN_PAYMENT_AMOUNT,
        }),
      );
    }

    if (amount > PaymentConstants.LIMITS.MAX_PAYMENT_AMOUNT) {
      throw new BadRequestException(
        formatErrorMessage(PaymentConstants.ERRORS.AMOUNT_TOO_HIGH, {
          max: PaymentConstants.LIMITS.MAX_PAYMENT_AMOUNT,
        }),
      );
    }
  }

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

  private formatPaymentResponse(payment: any) {
    return {
      id: payment.id,
      code: payment.transaction_code,
      amount: parseFloat(payment.amount),
      currency: payment.currency,
      status: payment.status,
      bank: payment.bank
        ? {
            name: payment.bank.name,
            iban: payment.bank.iban,
            account_name: payment.bank.account_name,
          }
        : null,
      customer: {
        email: payment.customer_email,
        phone: payment.customer_phone,
        name: payment.customer_name,
      },
      platform_order_id: payment.platform_order_id,
      metadata: payment.metadata,
      expires_at: payment.expires_at,
      created_at: payment.created_at,
      approved_at: payment.approved_at,
      rejected_at: payment.rejected_at,
      rejection_reason: payment.rejection_reason,
    };
  }
}
