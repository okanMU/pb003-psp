import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MetricsService } from './metrics.service';
import { LoggerService } from '../logger/logger.service';

/**
 * Metrics Scheduler
 * Handles metrics cleanup and aggregation tasks
 */
@Injectable()
export class MetricsScheduler {
  constructor(
    private metricsService: MetricsService,
    private logger: LoggerService,
  ) {
    this.logger.setContext('MetricsScheduler');
  }

  /**
   * Clean up old metrics data
   * Runs daily at 2 AM
   */
  @Cron('0 2 * * *')
  async cleanupOldMetrics() {
    try {
      this.logger.log('Running metrics cleanup...');

      const cleared = await this.metricsService.clearOldMetrics(7); // Keep 7 days

      this.logger.log(`✅ Cleaned up ${cleared} old metric keys`);
    } catch (error) {
      this.logger.error(`Metrics cleanup failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Log system health metrics
   * Runs every 30 minutes
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async logSystemHealth() {
    try {
      const health = await this.metricsService.getSystemHealth();

      this.logger.log(
        `🏥 System Health: DB=${health.database.status}(${health.database.latency}ms), ` +
        `Redis=${health.redis.status}(${health.redis.latency}ms), ` +
        `Active Payments=${health.metrics.activePayments}, ` +
        `Active Locks=${health.metrics.activeLocks}, ` +
        `Pending Webhooks=${health.metrics.pendingWebhooks}`
      );

      // Alert if unhealthy
      if (health.database.status === 'unhealthy' || health.redis.status === 'unhealthy') {
        this.logger.error(
          `⚠️ System health check failed! DB: ${health.database.status}, Redis: ${health.redis.status}`
        );
      }
    } catch (error) {
      this.logger.error(`System health check failed: ${error.message}`, error.stack);
    }
  }
}
