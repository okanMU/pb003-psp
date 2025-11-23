/**
 * Custom Payment-Specific Exceptions
 */

import {
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Payment not found exception
 */
export class PaymentNotFoundException extends NotFoundException {
  constructor(identifier: string) {
    super(`Ödeme bulunamadı: ${identifier}`);
  }
}

/**
 * Payment expired exception
 */
export class PaymentExpiredException extends BadRequestException {
  constructor(transactionCode: string) {
    super(`Ödeme süresi doldu: ${transactionCode}. Lütfen yeni bir ödeme oluşturun.`);
  }
}

/**
 * Invalid payment status exception
 */
export class InvalidPaymentStatusException extends BadRequestException {
  constructor(currentStatus: string, expectedStatus?: string) {
    const message = expectedStatus
      ? `Ödeme durumu geçersiz. Mevcut: ${currentStatus}, Beklenen: ${expectedStatus}`
      : `Ödeme durumu artık beklemede değil. Mevcut durum: ${currentStatus}`;
    super(message);
  }
}

/**
 * Insufficient collateral exception
 */
export class InsufficientCollateralException extends BadRequestException {
  constructor(available: number, required: number) {
    super(
      `Yetersiz teminat. Mevcut: ${available.toFixed(2)} TRY, Gerekli: ${required.toFixed(2)} TRY`,
    );
  }
}

/**
 * Bank not available exception
 */
export class BankNotAvailableException extends BadRequestException {
  constructor(reason?: string) {
    const message = reason
      ? `Banka hesabı kullanılamıyor: ${reason}`
      : 'Şu anda uygun banka hesabı bulunamamaktadır. Lütfen daha sonra tekrar deneyin.';
    super(message);
  }
}

/**
 * Bank suspended exception
 */
export class BankSuspendedException extends BadRequestException {
  constructor(bankName?: string) {
    const message = bankName
      ? `Banka hesabı askıda: ${bankName}`
      : 'Seçilen banka hesabı askıda. Lütfen farklı bir tutar deneyin.';
    super(message);
  }
}

/**
 * Collateral lock exception
 */
export class CollateralLockException extends ConflictException {
  constructor(reason: string) {
    super(`Teminat kilidi başarısız: ${reason}`);
  }
}

/**
 * Lock not found exception
 */
export class LockNotFoundException extends NotFoundException {
  constructor(transactionId: string) {
    super(
      `Teminat kilidi bulunamadı: ${transactionId}. İşlem zaten tamamlanmış olabilir.`,
    );
  }
}

/**
 * Lock in use exception
 */
export class LockInUseException extends ConflictException {
  constructor() {
    super(
      'Bu hesap şu anda başka bir işlemde kullanılıyor. Lütfen birkaç saniye bekleyip tekrar deneyin.',
    );
  }
}

/**
 * Platform not found exception
 */
export class PlatformNotFoundException extends NotFoundException {
  constructor(platformId: string) {
    super(`Platform bulunamadı: ${platformId}`);
  }
}

/**
 * Invalid API key exception
 */
export class InvalidApiKeyException extends ForbiddenException {
  constructor() {
    super('Geçersiz API anahtarı. Lütfen kimlik bilgilerinizi kontrol edin.');
  }
}

/**
 * Fraud detection exception
 */
export class FraudDetectedException extends ForbiddenException {
  constructor(riskLevel: string, reason?: string) {
    const message = reason
      ? `İşlem güvenlik nedeniyle engellenmiştir. Risk: ${riskLevel}. ${reason}`
      : `İşlem güvenlik nedeniyle engellenmiştir. Risk seviyesi: ${riskLevel}.`;
    super(message);
  }
}

/**
 * Webhook delivery exception
 */
export class WebhookDeliveryException extends BadRequestException {
  constructor(webhookId: string, reason: string) {
    super(`Webhook gönderimi başarısız: ${webhookId}. Sebep: ${reason}`);
  }
}

/**
 * Duplicate transaction exception
 */
export class DuplicateTransactionException extends ConflictException {
  constructor() {
    super('Aynı işlem kısa süre önce oluşturuldu. Lütfen birkaç dakika bekleyip tekrar deneyin.');
  }
}
