/**
 * Payment System Constants
 * Centralized configuration for timeouts, limits, and system parameters
 */

export const PaymentConstants = {
  /**
   * Time-based constants (in seconds unless specified)
   */
  TIME: {
    PAYMENT_EXPIRY_MINUTES: 5, // Ödeme süresi (dakika)
    COLLATERAL_LOCK_MINUTES: 5, // Teminat kilitleme süresi (dakika)
    REDIS_LOCK_TIMEOUT_SECONDS: 10, // Redis distributed lock timeout
    PAYMENT_CACHE_TTL_SECONDS: 300, // Payment cache (5 dakika)
    LONG_CACHE_TTL_SECONDS: 1800, // Uzun cache (30 dakika)
    BANK_CACHE_TTL_SECONDS: 3600, // Bank cache (1 saat)
    ACTIVE_BANKS_CACHE_SECONDS: 60, // Active banks list cache
  },

  /**
   * Amount limits (TRY)
   */
  LIMITS: {
    MIN_PAYMENT_AMOUNT: 10, // Minimum ödeme tutarı
    MAX_PAYMENT_AMOUNT: 1000000, // Maximum ödeme tutarı (1M TRY)
    MIN_COLLATERAL_LIMIT: 10000, // Minimum teminat limiti
  },

  /**
   * Commission rates (decimal)
   */
  COMMISSION: {
    DEFAULT_PLATFORM_RATE: 0.015, // 1.5%
    DEFAULT_PSP_RATE: 0.005, // 0.5%
  },

  /**
   * Retry and failure handling
   */
  RETRY: {
    MAX_WEBHOOK_ATTEMPTS: 3, // Webhook retry count
    WEBHOOK_RETRY_DELAY_MS: 5000, // Webhook retry delay (5 saniye)
    MAX_BANK_SELECTION_RETRIES: 3, // Bank selection retry limit
  },

  /**
   * Reference code configuration
   */
  REF_CODE: {
    PREFIX: 'PAY', // Ref kod prefix
    LENGTH: 9, // Total length including prefix (PAY123456)
  },

  /**
   * Error messages (Turkish)
   */
  ERRORS: {
    INVALID_PLATFORM: 'Geçersiz platform. Lütfen API anahtarınızı kontrol edin.',
    NO_ACTIVE_BANK: 'Şu anda uygun banka hesabı bulunamamaktadır. Lütfen daha sonra tekrar deneyin.',
    INSUFFICIENT_COLLATERAL: 'Yetersiz teminat. Mevcut: {available} TRY, Gerekli: {required} TRY',
    BANK_SUSPENDED: 'Seçilen banka hesabı askıda. Lütfen farklı bir tutar deneyin.',
    BANK_INACTIVE: 'Seçilen banka hesabı aktif değil.',
    PAYMENT_NOT_FOUND: 'Ödeme bulunamadı. Ref kod: {code}',
    PAYMENT_NOT_PENDING: 'Bu ödeme artık beklemede değil. Mevcut durum: {status}',
    LOCK_NOT_FOUND: 'Bu işlem için teminat kilidi bulunamadı. İşlem zaten tamamlanmış olabilir.',
    LOCK_IN_USE: 'Bu hesap şu anda başka bir işlemde kullanılıyor. Lütfen birkaç saniye bekleyip tekrar deneyin.',
    AMOUNT_TOO_LOW: 'Minimum ödeme tutarı {min} TRY olmalıdır.',
    AMOUNT_TOO_HIGH: 'Maximum ödeme tutarı {max} TRY olmalıdır.',
    PAYMENT_EXPIRED: 'Ödeme süresi doldu. Lütfen yeni bir ödeme oluşturun.',
  },

  /**
   * Success messages (Turkish)
   */
  SUCCESS: {
    PAYMENT_CREATED: 'Ödeme başarıyla oluşturuldu. Ref kod: {code}',
    PAYMENT_APPROVED: 'Ödeme onaylandı. İşlem tamamlandı.',
    PAYMENT_REJECTED: 'Ödeme reddedildi.',
    COLLATERAL_LOCKED: 'Teminat başarıyla kilitlendi.',
    COLLATERAL_RELEASED: 'Teminat serbest bırakıldı.',
  },
};

/**
 * Helper function to format error messages with dynamic values
 */
export function formatErrorMessage(
  template: string,
  values: Record<string, any>,
): string {
  let message = template;
  Object.keys(values).forEach((key) => {
    message = message.replace(`{${key}}`, String(values[key]));
  });
  return message;
}
