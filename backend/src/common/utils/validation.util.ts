/**
 * Common Validation Utilities
 */

import { BadRequestException } from '@nestjs/common';
import { PaymentConstants } from '../constants/payment.constants';
import { formatMessage } from './response.util';

export class ValidationUtil {
  /**
   * Validate payment amount
   */
  static validateAmount(amount: number): void {
    if (amount < PaymentConstants.LIMITS.MIN_PAYMENT_AMOUNT) {
      throw new BadRequestException(
        formatMessage(PaymentConstants.ERRORS.AMOUNT_TOO_LOW, {
          min: PaymentConstants.LIMITS.MIN_PAYMENT_AMOUNT,
        }),
      );
    }

    if (amount > PaymentConstants.LIMITS.MAX_PAYMENT_AMOUNT) {
      throw new BadRequestException(
        formatMessage(PaymentConstants.ERRORS.AMOUNT_TOO_HIGH, {
          max: PaymentConstants.LIMITS.MAX_PAYMENT_AMOUNT,
        }),
      );
    }
  }

  /**
   * Validate email format
   */
  static validateEmail(email?: string): void {
    if (!email) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException('Geçersiz e-posta formatı');
    }
  }

  /**
   * Validate phone format (Turkish)
   */
  static validatePhone(phone?: string): void {
    if (!phone) return;

    // Turkish phone: +90XXXXXXXXXX or 05XXXXXXXXX
    const phoneRegex = /^(\+90|0)?[5][0-9]{9}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      throw new BadRequestException('Geçersiz telefon formatı');
    }
  }

  /**
   * Validate UUID format
   */
  static validateUUID(id: string, fieldName: string = 'ID'): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new BadRequestException(`Geçersiz ${fieldName} formatı`);
    }
  }

  /**
   * Validate required field
   */
  static validateRequired<T>(value: T | undefined | null, fieldName: string): T {
    if (value === undefined || value === null || value === '') {
      throw new BadRequestException(`${fieldName} alanı zorunludur`);
    }
    return value;
  }

  /**
   * Validate positive number
   */
  static validatePositive(value: number, fieldName: string): void {
    if (value <= 0) {
      throw new BadRequestException(`${fieldName} pozitif bir sayı olmalıdır`);
    }
  }

  /**
   * Validate date range
   */
  static validateDateRange(startDate: Date, endDate: Date): void {
    if (startDate >= endDate) {
      throw new BadRequestException(
        'Başlangıç tarihi bitiş tarihinden önce olmalıdır',
      );
    }
  }

  /**
   * Validate pagination parameters
   */
  static validatePagination(limit?: number, offset?: number): {
    limit: number;
    offset: number;
  } {
    const validatedLimit = Math.min(Math.max(limit || 50, 1), 100);
    const validatedOffset = Math.max(offset || 0, 0);

    return { limit: validatedLimit, offset: validatedOffset };
  }

  /**
   * Sanitize string input
   */
  static sanitizeString(input: string): string {
    return input.trim().replace(/[<>]/g, '');
  }

  /**
   * Validate IBAN format (Turkish)
   */
  static validateIBAN(iban: string): void {
    const cleanIBAN = iban.replace(/\s/g, '').toUpperCase();

    // Turkish IBAN: TR + 24 digits
    if (!/^TR\d{24}$/.test(cleanIBAN)) {
      throw new BadRequestException('Geçersiz IBAN formatı');
    }
  }

  /**
   * Validate currency code
   */
  static validateCurrency(currency: string): void {
    const validCurrencies = ['TRY', 'USD', 'EUR'];
    if (!validCurrencies.includes(currency.toUpperCase())) {
      throw new BadRequestException(
        `Geçersiz para birimi. Desteklenenler: ${validCurrencies.join(', ')}`,
      );
    }
  }
}
