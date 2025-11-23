import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { LoggerService } from '../common/logger/logger.service';
import { WebhookStatus } from '@prisma/client';

/**
 * Webhook retry delays (exponential backoff)
 */
const WEBHOOK_RETRY_DELAYS = [
  60 * 1000,        // 1st retry: 1 minute
  5 * 60 * 1000,    // 2nd retry: 5 minutes
  30 * 60 * 1000,   // 3rd retry: 30 minutes
  2 * 60 * 60 * 1000, // 4th retry: 2 hours
  6 * 60 * 60 * 1000, // 5th retry: 6 hours
];

@Injectable()
export class WebhookService {
  constructor(
    @InjectQueue('webhook') private webhookQueue: Queue,
    private prisma: PrismaService,
    private logger: LoggerService,
  ) {
    this.logger.setContext('WebhookService');
  }

  /**
   * Webhook gönderme kuyruğuna ekle
   */
  async enqueue(
    platformId: string,
    eventType: string,
    payload: any,
    transactionId?: string,
  ) {
    // Platform webhook URL'ini al
    const platform = await this.prisma.platform.findUnique({
      where: { id: platformId },
    });

    if (!platform?.webhook_url) {
      this.logger.log(`Platform ${platformId} has no webhook URL, skipping`);
      return null;
    }

    // Webhook log oluştur
    const webhookLog = await this.prisma.webhookLog.create({
      data: {
        platform_id: platformId,
        transaction_id: transactionId,
        event_type: eventType,
        payload,
        status: WebhookStatus.PENDING,
      },
    });

    // Kuyruğa ekle with retry configuration
    await this.webhookQueue.add(
      'send',
      {
        webhookLogId: webhookLog.id,
        url: platform.webhook_url,
        secret: platform.webhook_secret,
        payload,
      },
      {
        attempts: 5, // Max 5 attempts
        backoff: {
          type: 'fixed',
          delay: 60000, // Start with 1 minute, processor handles custom delays
        },
        removeOnComplete: true,
        removeOnFail: false, // Keep failed jobs for inspection
      },
    );

    this.logger.log(`📬 Webhook enqueued: ${eventType} for platform ${platformId}`);

    return webhookLog.id;
  }

  /**
   * Retry a failed webhook manually
   */
  async retryWebhook(webhookLogId: string): Promise<void> {
    const webhookLog = await this.prisma.webhookLog.findUnique({
      where: { id: webhookLogId },
      include: { platform: true },
    });

    if (!webhookLog) {
      throw new Error('Webhook log not found');
    }

    if (webhookLog.status === WebhookStatus.SENT) {
      throw new Error('Webhook already sent successfully');
    }

    // Reset webhook log for retry
    await this.prisma.webhookLog.update({
      where: { id: webhookLogId },
      data: {
        status: WebhookStatus.PENDING,
        error_message: null,
        next_retry_at: null,
      },
    });

    // Re-enqueue
    await this.webhookQueue.add(
      'send',
      {
        webhookLogId: webhookLog.id,
        url: webhookLog.platform.webhook_url,
        secret: webhookLog.platform.webhook_secret,
        payload: webhookLog.payload,
      },
      {
        attempts: 5,
        backoff: { type: 'fixed', delay: 60000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.log(`🔄 Webhook ${webhookLogId} manually retried`);
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats() {
    const [sent, failed, pending] = await Promise.all([
      this.prisma.webhookLog.count({ where: { status: WebhookStatus.SENT } }),
      this.prisma.webhookLog.count({ where: { status: WebhookStatus.FAILED } }),
      this.prisma.webhookLog.count({ where: { status: WebhookStatus.PENDING } }),
    ]);

    return {
      sent,
      failed,
      pending,
      total: sent + failed + pending,
      successRate: sent + failed > 0 ? ((sent / (sent + failed)) * 100).toFixed(2) : '0.00',
    };
  }

  /**
   * Get failed webhooks
   */
  async getFailedWebhooks(limit: number = 50) {
    return this.prisma.webhookLog.findMany({
      where: { status: WebhookStatus.FAILED },
      include: {
        platform: {
          select: { name: true },
        },
        transaction: {
          select: { transaction_code: true },
        },
      },
      orderBy: { failed_at: 'desc' },
      take: limit,
    });
  }

  /**
   * Get pending webhooks that need retry
   */
  async getPendingWebhooks() {
    return this.prisma.webhookLog.findMany({
      where: {
        status: WebhookStatus.PENDING,
        next_retry_at: {
          lte: new Date(),
        },
      },
      include: {
        platform: true,
      },
      orderBy: { next_retry_at: 'asc' },
      take: 100,
    });
  }

  /**
   * Retry all pending webhooks (called by cron)
   */
  async retryPendingWebhooks(): Promise<number> {
    const pendingWebhooks = await this.getPendingWebhooks();

    if (pendingWebhooks.length === 0) {
      return 0;
    }

    this.logger.log(`Found ${pendingWebhooks.length} webhooks ready for retry`);

    let retried = 0;
    for (const webhook of pendingWebhooks) {
      try {
        await this.retryWebhook(webhook.id);
        retried++;
      } catch (error) {
        this.logger.error(`Failed to retry webhook ${webhook.id}: ${error.message}`);
      }
    }

    return retried;
  }
}
