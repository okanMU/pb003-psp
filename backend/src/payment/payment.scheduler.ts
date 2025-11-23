import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentService } from './payment.service';
import { CollateralService } from '../collateral/collateral.service';
import { OrphanDetectionService } from './orphan-detection.service';
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
    private orphanDetection: OrphanDetectionService,
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
   * Detect and cleanup orphaned resources
   * Runs every hour
   *
   * Handles:
   * - Collateral locks for completed/expired transactions
   * - Very old PENDING payments that should have expired
   * - Inconsistent states between transactions and locks
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleOrphanCleanup() {
    try {
      this.logger.log('Running orphan detection and cleanup...');

      const result = await this.orphanDetection.detectAndCleanup();

      if (result.orphanedLocks > 0 || result.oldPendingPayments > 0 || result.inconsistentStates > 0) {
        this.logger.warn(
          `✅ Orphan cleanup: ${result.orphanedLocks} locks, ` +
          `${result.oldPendingPayments} old payments, ` +
          `${result.inconsistentStates} inconsistencies fixed`
        );
      } else {
        this.logger.log('✅ No orphans detected - system healthy');
      }
    } catch (error) {
      this.logger.error(`Orphan cleanup failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Log system health metrics
   * Runs every 10 minutes
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async logHealthMetrics() {
    try {
      // Get orphan statistics for monitoring
      const orphanStats = await this.orphanDetection.getOrphanStats();

      if (orphanStats.orphanedLocks > 0 || orphanStats.oldPendingPayments > 0 || orphanStats.pendingWithoutLocks > 0) {
        this.logger.warn(
          `⚠️ Orphan stats: ${orphanStats.orphanedLocks} orphaned locks, ` +
          `${orphanStats.oldPendingPayments} old pending payments, ` +
          `${orphanStats.pendingWithoutLocks} pending without locks`
        );
      } else {
        this.logger.log('✅ System health check completed - no orphans detected');
      }
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`, error.stack);
    }
  }
}
