import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookStatus } from '@prisma/client';
import { LoggerService } from '../common/logger/logger.service';
import axios, { AxiosError } from 'axios';
import * as crypto from 'crypto';

/**
 * Webhook retry configuration with exponential backoff
 */
const WEBHOOK_RETRY_CONFIG = {
  maxAttempts: 5,
  retryDelays: [
    60 * 1000,        // 1st retry: 1 minute
    5 * 60 * 1000,    // 2nd retry: 5 minutes
    30 * 60 * 1000,   // 3rd retry: 30 minutes
    2 * 60 * 60 * 1000, // 4th retry: 2 hours
    6 * 60 * 60 * 1000, // 5th retry: 6 hours
  ],
  timeout: 30000, // 30 seconds
};

@Processor('webhook')
export class WebhookProcessor {
  constructor(
    private prisma: PrismaService,
    private logger: LoggerService,
  ) {
    this.logger.setContext('WebhookProcessor');
  }

  @Process('send')
  async handleSendWebhook(job: Job) {
    const { webhookLogId, url, secret, payload } = job.data;

    this.logger.log(`Processing webhook ${webhookLogId}, attempt: ${job.attemptsMade + 1}`);

    try {
      // Signature oluştur (HMAC SHA256)
      const signature = this.generateSignature(payload, secret);

      // HTTP POST gönder with timeout and retry configuration
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'User-Agent': 'PSPay-Webhook/1.0',
          'X-Webhook-Id': webhookLogId,
          'X-Webhook-Attempt': String(job.attemptsMade + 1),
        },
        timeout: WEBHOOK_RETRY_CONFIG.timeout,
        validateStatus: (status) => status >= 200 && status < 300,
      });

      // Başarılı - webhook teslim edildi
      await this.updateWebhookSuccess(webhookLogId, response.status, response.data);

      this.logger.log(`✅ Webhook delivered successfully: ${webhookLogId} (HTTP ${response.status})`);
    } catch (error) {
      await this.handleWebhookError(webhookLogId, error as AxiosError, job.attemptsMade + 1);

      // Throw error to trigger Bull's retry mechanism
      throw error;
    }
  }

  /**
   * Update webhook log on successful delivery
   */
  private async updateWebhookSuccess(webhookLogId: string, statusCode: number, responseData: any) {
    await this.prisma.webhookLog.update({
      where: { id: webhookLogId },
      data: {
        status: WebhookStatus.SENT,
        response_code: statusCode,
        response_body: JSON.stringify(responseData).substring(0, 1000),
        attempts: { increment: 1 },
        sent_at: new Date(),
      },
    });
  }

  /**
   * Handle webhook delivery error with smart retry logic
   */
  private async handleWebhookError(
    webhookLogId: string,
    error: AxiosError,
    attemptNumber: number,
  ) {
    const statusCode = error.response?.status;
    const errorMessage = error.message;
    const isRetryable = this.isRetryableError(error);
    const maxAttemptsReached = attemptNumber >= WEBHOOK_RETRY_CONFIG.maxAttempts;

    // Calculate next retry time with exponential backoff
    const nextRetryDelay = WEBHOOK_RETRY_CONFIG.retryDelays[attemptNumber] ||
                          WEBHOOK_RETRY_CONFIG.retryDelays[WEBHOOK_RETRY_CONFIG.retryDelays.length - 1];
    const nextRetryAt = new Date(Date.now() + nextRetryDelay);

    // Determine final status
    let status: WebhookStatus;
    if (maxAttemptsReached) {
      status = WebhookStatus.FAILED;
    } else if (isRetryable) {
      status = WebhookStatus.PENDING;
    } else {
      // Permanent failure (4xx errors except 429)
      status = WebhookStatus.FAILED;
    }

    await this.prisma.webhookLog.update({
      where: { id: webhookLogId },
      data: {
        status,
        response_code: statusCode,
        error_message: errorMessage,
        attempts: { increment: 1 },
        next_retry_at: status === WebhookStatus.PENDING ? nextRetryAt : null,
        failed_at: status === WebhookStatus.FAILED ? new Date() : null,
      },
    });

    if (maxAttemptsReached) {
      this.logger.error(
        `❌ Webhook permanently failed after ${attemptNumber} attempts: ${webhookLogId} - ${errorMessage}`
      );
    } else if (!isRetryable) {
      this.logger.error(
        `❌ Webhook failed with non-retryable error: ${webhookLogId} - HTTP ${statusCode}`
      );
    } else {
      this.logger.warn(
        `⚠️ Webhook failed, will retry in ${Math.round(nextRetryDelay / 1000 / 60)}min: ${webhookLogId} ` +
        `(attempt ${attemptNumber}/${WEBHOOK_RETRY_CONFIG.maxAttempts})`
      );
    }
  }

  /**
   * Determine if an error is retryable
   * - Network errors: retry
   * - Timeout: retry
   * - 5xx: retry (server error)
   * - 429: retry (rate limit)
   * - 408: retry (request timeout)
   * - 4xx: don't retry (client error - bad request, auth, etc.)
   */
  private isRetryableError(error: AxiosError): boolean {
    // Network error (no response)
    if (!error.response) {
      return true;
    }

    const status = error.response.status;

    // Server errors - retryable
    if (status >= 500 && status < 600) {
      return true;
    }

    // Rate limiting - retryable
    if (status === 429) {
      return true;
    }

    // Request timeout - retryable
    if (status === 408) {
      return true;
    }

    // Client errors (4xx except above) - not retryable
    if (status >= 400 && status < 500) {
      return false;
    }

    // Default: retry for unknown errors
    return true;
  }

  private generateSignature(payload: any, secret: string): string {
    if (!secret) {
      return '';
    }
    const data = JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }
}
