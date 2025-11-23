import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { RefCodeService } from '../ref-code.service';
import { CommissionService } from '../commission.service';
import { CollateralService } from '../../collateral/collateral.service';
import { BankSelectionService } from '../../collateral/bank-selection.service';
import { LoggerService } from '../../common/logger/logger.service';
import { FraudDetectionServiceRefactored } from '../../security/fraud-detection-refactored.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { PaymentResponseDto } from '../dto/payment-response.dto';
import {
  PaymentConstants,
  ValidationUtil,
  DateUtil,
  TransactionHelper,
  PlatformNotFoundException,
  FraudDetectedException,
} from '../../common';

/**
 * PaymentCreator Service
 * Responsible for creating new payment transactions
 * Extracted from PaymentService for better separation of concerns
 * Now using Strategy Pattern-based FraudDetectionServiceRefactored
 */
@Injectable()
export class PaymentCreatorService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private refCode: RefCodeService,
    private commission: CommissionService,
    private collateral: CollateralService,
    private bankSelection: BankSelectionService,
    private logger: LoggerService,
    private fraudDetection: FraudDetectionServiceRefactored,
  ) {
    this.logger.setContext('PaymentCreatorService');
  }

  /**
   * Create a new payment transaction
   */
  async createPayment(
    platformId: string,
    dto: CreatePaymentDto,
    customerIp?: string,
  ): Promise<PaymentResponseDto> {
    // Validate platform
    const platform = await this.validatePlatform(platformId);

    // Fraud detection
    await this.checkFraudDetection(
      platformId,
      dto.amount,
      dto.customer_email,
      dto.customer_phone,
      customerIp,
    );

    // Select bank with available collateral
    const bank = await this.selectBank(dto.amount);

    // Generate unique transaction code
    const transactionCode = await this.generateTransactionCode();

    // Calculate commissions
    const commissions = this.commission.calculate(dto.amount, platform.commission_rate);

    // Calculate expiration time
    const expiresAt = DateUtil.addMinutes(PaymentConstants.TIME.PAYMENT_EXPIRY_MINUTES);

    // Create transaction in database
    const payment = await this.prisma.transaction.create({
      data: {
        transaction_code: transactionCode,
        platform_id: platformId,
        bank_id: bank.id,
        amount: dto.amount,
        currency: dto.currency || 'TRY',
        customer_email: dto.customer_email,
        customer_phone: dto.customer_phone,
        customer_name: dto.customer_name,
        customer_ip: customerIp,
        metadata: dto.metadata,
        platform_order_id: dto.platform_order_id,
        platform_commission: commissions.platformCommission,
        psp_commission: commissions.pspCommission,
        net_amount: commissions.netAmount,
        expires_at: expiresAt,
        status: 'PENDING',
      },
      include: {
        bank: true,
        platform: true,
      },
    });

    // Lock collateral
    await this.lockCollateral(payment.id, bank.id, dto.amount, expiresAt);

    // Cache payment
    await this.cachePayment(payment);

    // Log payment event
    await this.logPaymentEvent(payment.id, 'CREATED');

    this.logger.log(
      `Payment created: ${transactionCode} - ${dto.amount} TRY - Bank: ${bank.name}`,
    );

    return PaymentResponseDto.from(payment);
  }

  /**
   * Validate platform exists and is active
   */
  private async validatePlatform(platformId: string) {
    const platform = await this.prisma.platform.findUnique({
      where: { id: platformId, is_active: true },
    });

    if (!platform) {
      throw new PlatformNotFoundException(platformId);
    }

    return platform;
  }

  /**
   * Check fraud detection
   */
  private async checkFraudDetection(
    platformId: string,
    amount: number,
    customerEmail?: string,
    customerPhone?: string,
    customerIp?: string,
  ): Promise<void> {
    const fraudAnalysis = await this.fraudDetection.analyzeTransaction(
      platformId,
      amount,
      customerEmail,
      customerPhone,
      customerIp,
    );

    this.logger.log(
      `Fraud analysis result - Risk: ${fraudAnalysis.riskLevel} (${fraudAnalysis.riskScore}/100)`,
    );

    if (fraudAnalysis.isBlocked) {
      const ruleMessages = fraudAnalysis.triggeredRules
        .map((r) => r.message)
        .join(', ');
      throw new FraudDetectedException(
        fraudAnalysis.riskLevel,
        `Transaction blocked: ${ruleMessages}`,
      );
    }
  }

  /**
   * Select bank with available collateral
   */
  private async selectBank(amount: number) {
    const bank = await this.bankSelection.selectBestBank(amount);

    if (!bank) {
      throw new Error('No bank available with sufficient collateral');
    }

    return bank;
  }

  /**
   * Generate unique transaction code
   */
  private async generateTransactionCode(): Promise<string> {
    return this.refCode.generate();
  }

  /**
   * Lock collateral for the transaction
   */
  private async lockCollateral(
    transactionId: string,
    bankId: string,
    amount: number,
    expiresAt: Date,
  ): Promise<void> {
    await this.collateral.lockCollateral(bankId, transactionId, amount);
  }

  /**
   * Cache payment in Redis for quick access
   */
  private async cachePayment(payment: any): Promise<void> {
    const cacheKey = TransactionHelper.getPaymentCacheKey(payment.id);
    const codeKey = `payment:code:${payment.transaction_code}`;

    await this.redis.set(
      cacheKey,
      JSON.stringify(payment),
      PaymentConstants.TIME.PAYMENT_CACHE_TTL_SECONDS,
    );

    await this.redis.set(codeKey, payment.id, PaymentConstants.CACHE_TTL_SECONDS);
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
