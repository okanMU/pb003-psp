import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CollateralService } from '../collateral/collateral.service';
import { LoggerService } from '../common/logger/logger.service';
import { PaymentStatus } from '@prisma/client';
import { PaymentConstants } from '../common/constants/payment.constants';

/**
 * Orphan Detection and Cleanup Service
 *
 * Detects and fixes orphaned resources:
 * 1. Collateral locks for completed/expired payments
 * 2. Very old PENDING payments that should have expired
 * 3. Inconsistent states between transaction and locks
 */
@Injectable()
export class OrphanDetectionService {
  constructor(
    private prisma: PrismaService,
    private collateral: CollateralService,
    private logger: LoggerService,
  ) {
    this.logger.setContext('OrphanDetectionService');
  }

  /**
   * Detect and clean up all types of orphans
   * Called by cron job every hour
   */
  async detectAndCleanup(): Promise<{
    orphanedLocks: number;
    oldPendingPayments: number;
    inconsistentStates: number;
  }> {
    this.logger.log('🔍 Starting orphan detection and cleanup...');

    const results = {
      orphanedLocks: 0,
      oldPendingPayments: 0,
      inconsistentStates: 0,
    };

    // 1. Find and release orphaned collateral locks
    results.orphanedLocks = await this.cleanupOrphanedLocks();

    // 2. Find and expire very old PENDING payments
    results.oldPendingPayments = await this.cleanupOldPendingPayments();

    // 3. Find and fix inconsistent states
    results.inconsistentStates = await this.fixInconsistentStates();

    this.logger.log(
      `✅ Orphan cleanup completed: ${results.orphanedLocks} locks, ` +
      `${results.oldPendingPayments} old payments, ${results.inconsistentStates} inconsistencies`,
    );

    return results;
  }

  /**
   * Find collateral locks for transactions in terminal states
   * These locks should have been released but weren't (due to errors)
   */
  private async cleanupOrphanedLocks(): Promise<number> {
    const orphanedLocks = await this.prisma.collateralLock.findMany({
      where: {
        status: 'ACTIVE',
        transaction: {
          status: {
            in: [
              PaymentStatus.APPROVED,
              PaymentStatus.REJECTED,
              PaymentStatus.EXPIRED,
            ],
          },
        },
      },
      include: {
        transaction: {
          select: {
            id: true,
            transaction_code: true,
            status: true,
            bank_id: true,
          },
        },
      },
    });

    if (orphanedLocks.length === 0) {
      return 0;
    }

    this.logger.warn(
      `Found ${orphanedLocks.length} orphaned collateral locks for completed transactions`,
    );

    let cleaned = 0;
    for (const lock of orphanedLocks) {
      try {
        await this.collateral.releaseCollateral(
          lock.transaction.bank_id,
          lock.transaction_id,
        );
        cleaned++;

        this.logger.log(
          `Released orphaned lock for ${lock.transaction.status} transaction: ${lock.transaction.transaction_code}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to release orphaned lock ${lock.id}: ${error.message}`,
        );
      }
    }

    return cleaned;
  }

  /**
   * Find PENDING payments that are much older than the expiry time
   * These should have been expired but weren't (system downtime, cron failure, etc.)
   */
  private async cleanupOldPendingPayments(): Promise<number> {
    // Look for PENDING payments older than 2x the normal expiry time
    const cutoffTime = new Date(
      Date.now() -
        PaymentConstants.TIME.PAYMENT_EXPIRY_MINUTES * 2 * 60 * 1000,
    );

    const oldPayments = await this.prisma.transaction.findMany({
      where: {
        status: PaymentStatus.PENDING,
        created_at: {
          lt: cutoffTime,
        },
      },
      select: {
        id: true,
        transaction_code: true,
        bank_id: true,
        created_at: true,
      },
    });

    if (oldPayments.length === 0) {
      return 0;
    }

    this.logger.warn(
      `Found ${oldPayments.length} very old PENDING payments that should have expired`,
    );

    let expired = 0;
    for (const payment of oldPayments) {
      try {
        // Mark as expired
        await this.prisma.transaction.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.EXPIRED },
        });

        // Release collateral
        await this.collateral.releaseCollateral(payment.bank_id, payment.id);

        // Log event
        await this.prisma.paymentEvent.create({
          data: {
            transaction_id: payment.id,
            event_type: 'expired_by_orphan_cleanup',
            data: {
              reason: 'Very old PENDING payment detected by orphan cleanup',
              age_minutes: Math.floor(
                (Date.now() - payment.created_at.getTime()) / 1000 / 60,
              ),
            },
          },
        });

        expired++;

        this.logger.log(
          `Expired old PENDING payment: ${payment.transaction_code}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to expire old payment ${payment.id}: ${error.message}`,
        );
      }
    }

    return expired;
  }

  /**
   * Find and fix inconsistent states
   * Example: Transaction is PENDING but has no active collateral lock
   */
  private async fixInconsistentStates(): Promise<number> {
    // Find PENDING transactions without active locks
    const pendingWithoutLocks = await this.prisma.transaction.findMany({
      where: {
        status: PaymentStatus.PENDING,
        expires_at: {
          gt: new Date(), // Not yet expired
        },
        collateral_locks: {
          none: {
            status: 'ACTIVE',
          },
        },
      },
      select: {
        id: true,
        transaction_code: true,
        bank_id: true,
        created_at: true,
      },
    });

    if (pendingWithoutLocks.length === 0) {
      return 0;
    }

    this.logger.warn(
      `Found ${pendingWithoutLocks.length} PENDING transactions without active collateral locks`,
    );

    let fixed = 0;
    for (const payment of pendingWithoutLocks) {
      try {
        // This is a critical inconsistency - mark as EXPIRED
        // We can't create a new lock because we don't know the original amount
        await this.prisma.transaction.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.EXPIRED },
        });

        // Log event
        await this.prisma.paymentEvent.create({
          data: {
            transaction_id: payment.id,
            event_type: 'expired_by_inconsistency_fix',
            data: {
              reason: 'PENDING transaction without active collateral lock',
              age_minutes: Math.floor(
                (Date.now() - payment.created_at.getTime()) / 1000 / 60,
              ),
            },
          },
        });

        fixed++;

        this.logger.warn(
          `Fixed inconsistent state for ${payment.transaction_code}: ` +
          `PENDING without lock → EXPIRED`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to fix inconsistent payment ${payment.id}: ${error.message}`,
        );
      }
    }

    return fixed;
  }

  /**
   * Get orphan statistics for monitoring
   */
  async getOrphanStats(): Promise<{
    orphanedLocks: number;
    oldPendingPayments: number;
    pendingWithoutLocks: number;
  }> {
    // Count orphaned locks
    const orphanedLocks = await this.prisma.collateralLock.count({
      where: {
        status: 'ACTIVE',
        transaction: {
          status: {
            in: [
              PaymentStatus.APPROVED,
              PaymentStatus.REJECTED,
              PaymentStatus.EXPIRED,
            ],
          },
        },
      },
    });

    // Count old PENDING payments
    const cutoffTime = new Date(
      Date.now() -
        PaymentConstants.TIME.PAYMENT_EXPIRY_MINUTES * 2 * 60 * 1000,
    );
    const oldPendingPayments = await this.prisma.transaction.count({
      where: {
        status: PaymentStatus.PENDING,
        created_at: {
          lt: cutoffTime,
        },
      },
    });

    // Count PENDING without locks
    const pendingWithoutLocks = await this.prisma.transaction.count({
      where: {
        status: PaymentStatus.PENDING,
        expires_at: {
          gt: new Date(),
        },
        collateral_locks: {
          none: {
            status: 'ACTIVE',
          },
        },
      },
    });

    return {
      orphanedLocks,
      oldPendingPayments,
      pendingWithoutLocks,
    };
  }
}
