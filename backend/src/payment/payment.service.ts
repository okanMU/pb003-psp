import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RefCodeService } from './ref-code.service';
import { CommissionService } from './commission.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentStatus } from '@prisma/client';
import * as dayjs from 'dayjs';

@Injectable()
export class PaymentService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private refCode: RefCodeService,
    private commission: CommissionService,
  ) {}

  /**
   * Yeni ödeme oluştur
   */
  async createPayment(
    platformId: string,
    dto: CreatePaymentDto,
    customerIp?: string,
  ) {
    // Platform kontrolü
    const platform = await this.prisma.platform.findUnique({
      where: { id: platformId, is_active: true },
    });

    if (!platform) {
      throw new BadRequestException('Invalid platform');
    }

    // Aktif banka seç (round-robin veya random)
    const bank = await this.selectBank();
    if (!bank) {
      throw new BadRequestException('No active bank available');
    }

    // Ref kod üret
    const transactionCode = this.refCode.generate();

    // Expiry hesapla (30 dakika)
    const expiresAt = dayjs()
      .add(parseInt(process.env.PAYMENT_EXPIRY_MINUTES) || 30, 'minute')
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
      },
      include: {
        bank: true,
        platform: true,
      },
    });

    // Event log
    await this.createEvent(transaction.id, 'created', {
      amount: dto.amount,
      bank: bank.name,
    });

    // Redis cache (hızlı erişim için)
    await this.redis.set(
      `payment:${transaction.id}`,
      transaction,
      1800, // 30 dakika
    );
    await this.redis.set(
      `payment:code:${transactionCode}`,
      transaction.id,
      1800,
    );

    // Pub/Sub - Real-time notification
    await this.redis.publish('payment:created', {
      id: transaction.id,
      code: transactionCode,
      amount: transaction.amount,
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
      include: { platform: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Payment is not pending');
    }

    // Komisyon hesapla
    const commissions = this.commission.calculate(
      payment.amount,
      payment.platform.commission_rate,
    );

    // Güncelle
    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        status: PaymentStatus.APPROVED,
        approved_by_id: adminId,
        approved_at: new Date(),
        platform_commission: commissions.platformCommission,
        psp_commission: commissions.pspCommission,
        net_amount: commissions.netAmount,
      },
      include: {
        bank: true,
        platform: true,
      },
    });

    // Event log
    await this.createEvent(id, 'approved', {
      admin_id: adminId,
      commissions,
    });

    // Cache güncelle
    await this.redis.set(`payment:${id}`, updated, 1800);

    // Pub/Sub
    await this.redis.publish('payment:approved', {
      id: updated.id,
      code: updated.transaction_code,
    });

    return this.formatPaymentResponse(updated);
  }

  /**
   * Ödeme reddet
   */
  async rejectPayment(id: string, adminId: string, reason?: string) {
    const payment = await this.prisma.transaction.findUnique({
      where: { id },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Payment is not pending');
    }

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        status: PaymentStatus.REJECTED,
        rejected_by_id: adminId,
        rejected_at: new Date(),
        rejection_reason: reason,
      },
      include: {
        bank: true,
        platform: true,
      },
    });

    // Event log
    await this.createEvent(id, 'rejected', {
      admin_id: adminId,
      reason,
    });

    // Cache güncelle
    await this.redis.set(`payment:${id}`, updated, 1800);

    // Pub/Sub
    await this.redis.publish('payment:rejected', {
      id: updated.id,
      code: updated.transaction_code,
      reason,
    });

    return this.formatPaymentResponse(updated);
  }

  /**
   * Süresi dolan ödemeleri işaretle
   */
  async expirePayments() {
    const expired = await this.prisma.transaction.updateMany({
      where: {
        status: PaymentStatus.PENDING,
        expires_at: {
          lt: new Date(),
        },
      },
      data: {
        status: PaymentStatus.EXPIRED,
      },
    });

    if (expired.count > 0) {
      console.log(`⏰ ${expired.count} payments expired`);
    }

    return expired;
  }

  // Helper Methods

  private async selectBank() {
    const banks = await this.prisma.bank.findMany({
      where: { is_active: true },
    });

    if (banks.length === 0) return null;

    // Simple random selection
    return banks[Math.floor(Math.random() * banks.length)];
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
