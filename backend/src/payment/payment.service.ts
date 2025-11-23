import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RefCodeService } from './ref-code.service';
import { CommissionService } from './commission.service';
import { CollateralService } from '../collateral/collateral.service';
import { BankSelectionService } from '../collateral/bank-selection.service';
import { LoggerService } from '../common/logger/logger.service';
import { FraudDetectionService } from '../security/fraud-detection.service';
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
    ValidationUtil.validateAmount(dto.amount);

    // Platform kontrolü
    const platform = await this.prisma.platform.findUnique({
      where: { id: platformId, is_active: true },
    });

    if (!platform) {
      throw new PlatformNotFoundException(platformId);
    }

    // Fraud Detection - Analyze transaction for security risks
    const fraudAnalysis = await this.fraudDetection.analyzeTransaction(
      platformId,
      dto.amount,
      dto.customer_email,
      dto.customer_phone,
      customerIp,
    );

    this.logger.log(
      `Fraud analysis result - Risk: ${fraudAnalysis.riskLevel} (${fraudAnalysis.riskScore}/100), ` +
      `Blocked: ${fraudAnalysis.isBlocked}, Manual Review: ${fraudAnalysis.requiresManualReview}, ` +
      `Triggered Rules: ${fraudAnalysis.triggeredRules.length}`,
    );

    // Block transaction if CRITICAL risk detected
    if (fraudAnalysis.isBlocked) {
      const ruleMessages = fraudAnalysis.triggeredRules
        .map((rule) => rule.message)
        .join(', ');

      this.logger.warn(
        `Transaction blocked due to high fraud risk. Platform: ${platformId}, ` +
        `Amount: ${dto.amount}, IP: ${customerIp}, Rules: ${ruleMessages}`,
      );

      // Log security event
      await this.fraudDetection.logSecurityEvent(
        platformId,
        'transaction_blocked',
        fraudAnalysis.riskLevel,
        {
          amount: dto.amount,
          customer_email: dto.customer_email,
          customer_phone: dto.customer_phone,
          customer_ip: customerIp,
          triggered_rules: fraudAnalysis.triggeredRules,
          risk_score: fraudAnalysis.riskScore,
        },
      );

      throw new FraudDetectedException(
        fraudAnalysis.riskLevel,
        `${fraudAnalysis.triggeredRules.length} güvenlik kuralı ihlal edildi`,
      );
    }

    // Akıllı hesap seçimi (minimum waste strategy + collateral check)
    const bank = await this.bankSelection.selectBestBank(dto.amount);
    this.logger.log(`Selected bank ${bank.id} (${bank.name}) for payment`);

    // Ref kod üret
    const transactionCode = this.refCode.generate();

    // Expiry hesapla (configured timeout)
    const expiresAt = TransactionHelper.calculateExpiryDate();

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
        // Fraud Detection fields
        fraud_score: fraudAnalysis.riskScore,
        risk_level: fraudAnalysis.riskLevel,
        fraud_rules: {
          requires_manual_review: fraudAnalysis.requiresManualReview,
          triggered_rules: fraudAnalysis.triggeredRules.map((r) => ({
            type: r.type,
            message: r.message,
            severity: r.severity,
          })),
          analyzed_at: new Date().toISOString(),
        },
        metadata: {
          ...(dto.metadata || {}),
          fraud_analysis: {
            risk_level: fraudAnalysis.riskLevel,
            risk_score: fraudAnalysis.riskScore,
            requires_manual_review: fraudAnalysis.requiresManualReview,
            triggered_rules: fraudAnalysis.triggeredRules.map((r) => ({
              type: r.type,
              message: r.message,
              severity: r.severity,
            })),
            analyzed_at: new Date().toISOString(),
          },
        },
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

    // Security event logging for flagged transactions
    if (fraudAnalysis.requiresManualReview || fraudAnalysis.riskLevel !== 'LOW') {
      await this.fraudDetection.logSecurityEvent(
        platformId,
        'transaction_flagged',
        fraudAnalysis.riskLevel,
        {
          transaction_id: transaction.id,
          transaction_code: transactionCode,
          amount: dto.amount,
          customer_email: dto.customer_email,
          customer_phone: dto.customer_phone,
          customer_ip: customerIp,
          triggered_rules: fraudAnalysis.triggeredRules,
          risk_score: fraudAnalysis.riskScore,
          requires_manual_review: fraudAnalysis.requiresManualReview,
        },
      );

      if (fraudAnalysis.requiresManualReview) {
        this.logger.warn(
          `Transaction ${transaction.id} requires manual review. ` +
          `Risk: ${fraudAnalysis.riskLevel}, Score: ${fraudAnalysis.riskScore}`,
        );
      }
    }

    // Redis cache (hızlı erişim için)
    await this.redis.set(
      TransactionHelper.getPaymentCacheKey(transaction.id),
      transaction,
      PaymentConstants.TIME.PAYMENT_CACHE_TTL_SECONDS,
    );
    await this.redis.set(
      TransactionHelper.getPaymentCodeCacheKey(transactionCode),
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
   */
  async approvePayment(id: string, adminId: string) {
    const payment = await this.prisma.transaction.findUnique({
      where: { id },
      include: { platform: true, bank: true },
    });

    if (!payment) {
      throw new PaymentNotFoundException(id);
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new InvalidPaymentStatusException(payment.status, 'PENDING');
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

      throw new InvalidPaymentStatusException(
        currentPayment?.status || 'UNKNOWN',
        'PENDING',
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
      throw new PaymentNotFoundException(id);
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new InvalidPaymentStatusException(payment.status, 'PENDING');
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

      throw new InvalidPaymentStatusException(
        currentPayment?.status || 'UNKNOWN',
        'PENDING',
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
