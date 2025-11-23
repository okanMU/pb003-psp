import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentService } from './payment.service';
import { CollateralService } from '../collateral/collateral.service';
import { LoggerService } from '../common/logger/logger.service';

/**
 * Payment Scheduler
 * Handles scheduled tasks for payment and collateral management
 */
@Injectable()
export class PaymentScheduler {
  constructor(
    private paymentService: PaymentService,
    private collateralService: CollateralService,
    private logger: LoggerService,
  ) {
    this.logger.setContext('PaymentScheduler');
  }

  /**
   * Expire old payments and release their collateral
   * Runs every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredPayments() {
    try {
      this.logger.log('Running expired payments cleanup...');

      // Expire old payments (also releases collateral in the service)
      const result = await this.paymentService.expirePayments();

      if (result.count > 0) {
        this.logger.log(`✅ Expired ${result.count} payments and released collateral`);
      }
    } catch (error) {
      this.logger.error(`Failed to expire payments: ${error.message}`, error.stack);
    }
  }

  /**
   * Release expired collateral locks (fallback cleanup)
   * Runs every 5 minutes
   *
   * This is a safety measure in case some locks weren't properly released
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleExpiredCollateralLocks() {
    try {
      this.logger.log('Running expired collateral locks cleanup...');

      const result = await this.collateralService.releaseExpiredLocks();

      if (result.count > 0) {
        this.logger.log(`✅ Released ${result.count} expired collateral locks`);
      }
    } catch (error) {
      this.logger.error(`Failed to release expired locks: ${error.message}`, error.stack);
    }
  }

  /**
   * Log system health metrics
   * Runs every 10 minutes
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async logHealthMetrics() {
    try {
      // This is optional - could log stats about active locks, pending payments, etc.
      this.logger.log('System health check completed');
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`, error.stack);
    }
  }
}
