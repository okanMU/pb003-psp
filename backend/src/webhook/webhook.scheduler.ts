import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WebhookService } from './webhook.service';
import { LoggerService } from '../common/logger/logger.service';

/**
 * Webhook Scheduler
 * Handles scheduled webhook retry tasks
 */
@Injectable()
export class WebhookScheduler {
  constructor(
    private webhookService: WebhookService,
    private logger: LoggerService,
  ) {
    this.logger.setContext('WebhookScheduler');
  }

  /**
   * Retry pending webhooks
   * Runs every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleWebhookRetries() {
    try {
      this.logger.log('Running webhook retry job...');

      const retriedCount = await this.webhookService.retryPendingWebhooks();

      if (retriedCount > 0) {
        this.logger.log(`✅ Retried ${retriedCount} pending webhooks`);
      }
    } catch (error) {
      this.logger.error(`Webhook retry job failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Log webhook statistics
   * Runs every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async logWebhookStats() {
    try {
      const stats = await this.webhookService.getWebhookStats();

      this.logger.log(
        `📊 Webhook stats: ${stats.sent} sent, ${stats.failed} failed, ` +
        `${stats.pending} pending, ${stats.successRate}% success rate`
      );

      // Warn if too many failures
      if (stats.failed > 100 && parseFloat(stats.successRate) < 80) {
        this.logger.warn(
          `⚠️ High webhook failure rate detected: ${stats.successRate}% success, ${stats.failed} failed`
        );
      }
    } catch (error) {
      this.logger.error(`Failed to log webhook stats: ${error.message}`, error.stack);
    }
  }
}
