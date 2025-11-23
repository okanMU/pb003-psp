import { Expose, Transform } from 'class-transformer';
import { PaymentStatus } from '@prisma/client';

export class PaymentResponseDto {
  @Expose()
  id: string;

  @Expose()
  code: string; // transaction_code

  @Expose()
  @Transform(({ value }) => parseFloat(value.toString()))
  amount: number;

  @Expose()
  currency: string;

  @Expose()
  status: PaymentStatus;

  @Expose()
  platformId: string;

  @Expose()
  platformName?: string;

  @Expose()
  bankId: string;

  @Expose()
  bankName?: string;

  @Expose()
  customerEmail?: string;

  @Expose()
  customerPhone?: string;

  @Expose()
  customerName?: string;

  @Expose()
  metadata?: any;

  @Expose()
  platformOrderId?: string;

  @Expose()
  @Transform(({ value }) => (value ? parseFloat(value.toString()) : null))
  platformCommission?: number;

  @Expose()
  @Transform(({ value }) => (value ? parseFloat(value.toString()) : null))
  pspCommission?: number;

  @Expose()
  @Transform(({ value }) => (value ? parseFloat(value.toString()) : null))
  netAmount?: number;

  @Expose()
  fraudScore?: number;

  @Expose()
  riskLevel?: string;

  @Expose()
  expiresAt: Date;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  static from(payment: any): PaymentResponseDto {
    return {
      id: payment.id,
      code: payment.transaction_code,
      amount: parseFloat(payment.amount.toString()),
      currency: payment.currency,
      status: payment.status,
      platformId: payment.platform_id,
      platformName: payment.platform?.name,
      bankId: payment.bank_id,
      bankName: payment.bank?.name,
      customerEmail: payment.customer_email,
      customerPhone: payment.customer_phone,
      customerName: payment.customer_name,
      metadata: payment.metadata,
      platformOrderId: payment.platform_order_id,
      platformCommission: payment.platform_commission
        ? parseFloat(payment.platform_commission.toString())
        : null,
      pspCommission: payment.psp_commission
        ? parseFloat(payment.psp_commission.toString())
        : null,
      netAmount: payment.net_amount ? parseFloat(payment.net_amount.toString()) : null,
      fraudScore: payment.fraud_score,
      riskLevel: payment.risk_level,
      expiresAt: payment.expires_at,
      createdAt: payment.created_at,
      updatedAt: payment.updated_at,
    };
  }
}
