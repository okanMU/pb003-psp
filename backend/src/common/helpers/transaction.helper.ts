/**
 * Transaction Helper Functions
 */

import { DateUtil } from '../utils/date.util';
import { CalculationUtil } from '../utils/calculation.util';
import { PaymentConstants } from '../constants/payment.constants';

export class TransactionHelper {
  /**
   * Calculate payment expiry date
   */
  static calculateExpiryDate(): Date {
    return DateUtil.addMinutes(PaymentConstants.TIME.PAYMENT_EXPIRY_MINUTES);
  }

  /**
   * Calculate lock expiry date
   */
  static calculateLockExpiry(): Date {
    return DateUtil.addMinutes(PaymentConstants.TIME.COLLATERAL_LOCK_MINUTES);
  }

  /**
   * Check if payment is expired
   */
  static isPaymentExpired(expiresAt: Date): boolean {
    return DateUtil.isExpired(expiresAt);
  }

  /**
   * Calculate commission breakdown
   */
  static calculateCommissionBreakdown(
    amount: number,
    platformRate: number,
    pspRate: number,
  ): {
    platform_commission: number;
    psp_commission: number;
    total_commission: number;
    net_amount: number;
  } {
    const platform_commission = CalculationUtil.calculateCommission(amount, platformRate);
    const psp_commission = CalculationUtil.calculateCommission(amount, pspRate);
    const total_commission = CalculationUtil.roundToTwo(
      platform_commission + psp_commission,
    );
    const net_amount = CalculationUtil.calculateNetAmount(amount, total_commission);

    return {
      platform_commission,
      psp_commission,
      total_commission,
      net_amount,
    };
  }

  /**
   * Format transaction for response
   */
  static formatTransactionResponse(transaction: any): any {
    return {
      id: transaction.id,
      transaction_code: transaction.transaction_code,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status,
      bank_account: transaction.bank
        ? {
            name: transaction.bank.name,
            iban: transaction.bank.iban,
            holder_name: transaction.bank.holder_name,
          }
        : null,
      customer_info: {
        email: transaction.customer_email,
        phone: transaction.customer_phone,
        name: transaction.customer_name,
      },
      expires_at: transaction.expires_at,
      created_at: transaction.created_at,
      updated_at: transaction.updated_at,
    };
  }

  /**
   * Generate cache key for payment
   */
  static getPaymentCacheKey(paymentId: string): string {
    return `payment:${paymentId}`;
  }

  /**
   * Generate cache key for payment by code
   */
  static getPaymentCodeCacheKey(code: string): string {
    return `payment:code:${code}`;
  }

  /**
   * Generate cache key for bank
   */
  static getBankCacheKey(bankId: string): string {
    return `bank:${bankId}`;
  }

  /**
   * Generate lock key for distributed locking
   */
  static getLockKey(resource: string, identifier: string): string {
    return `lock:${resource}:${identifier}`;
  }

  /**
   * Check if payment status allows transition
   */
  static canTransitionTo(currentStatus: string, newStatus: string): boolean {
    const transitions: Record<string, string[]> = {
      PENDING: ['APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'],
      APPROVED: [],
      REJECTED: [],
      EXPIRED: [],
      CANCELLED: [],
    };

    return transitions[currentStatus]?.includes(newStatus) || false;
  }

  /**
   * Get payment status display text
   */
  static getStatusDisplayText(status: string): string {
    const statusTexts: Record<string, string> = {
      PENDING: 'Bekliyor',
      APPROVED: 'Onaylandı',
      REJECTED: 'Reddedildi',
      EXPIRED: 'Süresi Doldu',
      CANCELLED: 'İptal Edildi',
    };

    return statusTexts[status] || status;
  }

  /**
   * Get webhook status display text
   */
  static getWebhookStatusText(status: string): string {
    const statusTexts: Record<string, string> = {
      PENDING: 'Bekliyor',
      SENT: 'Gönderildi',
      FAILED: 'Başarısız',
      CANCELLED: 'İptal Edildi',
    };

    return statusTexts[status] || status;
  }

  /**
   * Sanitize customer data
   */
  static sanitizeCustomerData(data: {
    email?: string;
    phone?: string;
    name?: string;
  }): {
    email?: string;
    phone?: string;
    name?: string;
  } {
    return {
      email: data.email?.trim().toLowerCase(),
      phone: data.phone?.replace(/\s/g, ''),
      name: data.name?.trim(),
    };
  }

  /**
   * Mask sensitive data for logging
   */
  static maskSensitiveData(data: string, visibleChars: number = 4): string {
    if (!data || data.length <= visibleChars) return '***';

    const visible = data.slice(-visibleChars);
    const masked = '*'.repeat(data.length - visibleChars);

    return masked + visible;
  }

  /**
   * Mask email
   */
  static maskEmail(email?: string): string {
    if (!email) return '***';

    const [username, domain] = email.split('@');
    if (!domain) return '***';

    const maskedUsername =
      username.length > 2
        ? username[0] + '*'.repeat(username.length - 2) + username.slice(-1)
        : '***';

    return `${maskedUsername}@${domain}`;
  }

  /**
   * Mask phone number
   */
  static maskPhone(phone?: string): string {
    if (!phone) return '***';

    if (phone.length > 4) {
      return '*'.repeat(phone.length - 4) + phone.slice(-4);
    }

    return '***';
  }

  /**
   * Generate transaction metadata
   */
  static generateMetadata(customData?: any): any {
    return {
      created_at: new Date().toISOString(),
      version: '1.0',
      ...customData,
    };
  }
}
