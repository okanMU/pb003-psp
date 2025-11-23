import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LoggerService } from '../common/logger/logger.service';
import { RedisService } from '../redis/redis.service';
import { CollateralService } from '../collateral/collateral.service';

/**
 * Bank Owner Service
 * Manages bank account owners and their accounts
 * Provides real-time dashboard data and approval functionality
 */
@Injectable()
export class BankOwnerService {
  constructor(
    private prisma: PrismaService,
    private logger: LoggerService,
    private redis: RedisService,
    private collateral: CollateralService,
  ) {
    this.logger.setContext('BankOwnerService');
  }

  /**
   * Get bank owner dashboard with real-time collateral data
   */
  async getDashboard(ownerId: string) {
    // Get owner with all their bank accounts
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId, role: 'BANK_OWNER' },
      include: {
        owned_banks: {
          where: { is_active: true },
          include: {
            collateral_locks: {
              where: { status: 'ACTIVE' },
            },
          },
        },
      },
    });

    if (!owner) {
      throw new Error('Bank owner not found');
    }

    // Calculate real-time collateral for each account
    const accounts = owner.owned_banks.map((bank) => {
      const lockedAmount = bank.collateral_locks.reduce(
        (sum, lock) => sum + Number(lock.locked_amount),
        0,
      );

      return {
        id: bank.id,
        bank_name: bank.name,
        iban: bank.iban,
        account_holder: bank.account_name,
        collateral_total: Number(bank.collateral_limit),
        collateral_locked: lockedAmount,
        collateral_available: Number(bank.collateral_limit) - lockedAmount,
        is_active: bank.is_active,
      };
    });

    // Calculate totals
    const totals = accounts.reduce(
      (acc, account) => ({
        total_collateral: acc.total_collateral + account.collateral_total,
        total_locked: acc.total_locked + account.collateral_locked,
        total_available: acc.total_available + account.collateral_available,
      }),
      { total_collateral: 0, total_locked: 0, total_available: 0 },
    );

    // Get pending approvals
    const pendingTransactions = await this.prisma.transaction.findMany({
      where: {
        bank: {
          owner_id: ownerId,
        },
        status: 'WAITING_BANK_OWNER_APPROVAL',
      },
      include: {
        bank: {
          select: {
            name: true,
            iban: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return {
      owner: {
        id: owner.id,
        name: owner.name,
        email: owner.email,
        total_accounts: accounts.length,
        ...totals,
      },
      accounts,
      pending_transactions: pendingTransactions.map((tx) => ({
        id: tx.id,
        transaction_code: tx.transaction_code,
        amount: Number(tx.amount),
        customer_email: tx.customer_email,
        customer_phone: tx.customer_phone,
        customer_name: tx.customer_name,
        bank_name: tx.bank.name,
        created_at: tx.created_at,
        approval_deadline: tx.approval_deadline,
        time_remaining: tx.approval_deadline
          ? Math.max(
              0,
              Math.floor(
                (tx.approval_deadline.getTime() - Date.now()) / 1000,
              ),
            )
          : 0,
      })),
    };
  }

  /**
   * Approve payment (Bank owner confirms money received)
   */
  async approvePayment(
    transactionId: string,
    ownerId: string,
    notes?: string,
  ) {
    // Get transaction and verify ownership
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        bank: { owner_id: ownerId },
        status: 'WAITING_BANK_OWNER_APPROVAL',
      },
      include: {
        bank: true,
        platform: true,
      },
    });

    if (!transaction) {
      throw new Error(
        'Transaction not found or not waiting for your approval',
      );
    }

    // Check if deadline passed
    if (
      transaction.approval_deadline &&
      new Date() > transaction.approval_deadline
    ) {
      throw new Error('Approval deadline has passed');
    }

    // Update transaction with optimistic locking
    const updated = await this.prisma.transaction.updateMany({
      where: {
        id: transactionId,
        status: 'WAITING_BANK_OWNER_APPROVAL', // Race condition prevention
      },
      data: {
        status: 'APPROVED',
        approved_by_id: ownerId,
        approved_at: new Date(),
        approval_notes: notes,
      },
    });

    if (updated.count === 0) {
      throw new Error('Transaction status changed, cannot approve');
    }

    this.logger.log(
      `Payment ${transactionId} approved by bank owner ${ownerId}`,
    );

    // Notify customer via WebSocket
    await this.redis.publish('payment:approved', {
      id: transactionId,
      status: 'APPROVED',
    });

    // Notify bank owner to update dashboard
    await this.redis.publish('payment:bank-owner-approved', {
      transactionId,
      ownerId,
    });

    // Release collateral
    try {
      await this.collateral.releaseCollateral(transaction.bank_id, transactionId);
      this.logger.log(`Collateral released for transaction ${transactionId}`);
    } catch (error) {
      this.logger.error(
        `Failed to release collateral for transaction ${transactionId}: ${error.message}`,
      );
    }

    // Return updated transaction
    return this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        bank: true,
        platform: true,
      },
    });
  }

  /**
   * Reject payment (Bank owner confirms money NOT received)
   */
  async rejectPayment(
    transactionId: string,
    ownerId: string,
    reason?: string,
  ) {
    // Get transaction and verify ownership
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        bank: { owner_id: ownerId },
        status: 'WAITING_BANK_OWNER_APPROVAL',
      },
    });

    if (!transaction) {
      throw new Error(
        'Transaction not found or not waiting for your approval',
      );
    }

    // Update transaction
    const updated = await this.prisma.transaction.updateMany({
      where: {
        id: transactionId,
        status: 'WAITING_BANK_OWNER_APPROVAL',
      },
      data: {
        status: 'REJECTED',
        rejected_by_id: ownerId,
        rejected_at: new Date(),
        rejection_reason: reason || 'Bank owner rejected: Money not received',
      },
    });

    if (updated.count === 0) {
      throw new Error('Transaction status changed, cannot reject');
    }

    this.logger.log(
      `Payment ${transactionId} rejected by bank owner ${ownerId}`,
    );

    // Notify customer via WebSocket
    await this.redis.publish('payment:rejected', {
      id: transactionId,
      reason: reason || 'Bank owner rejected: Money not received',
    });

    // Notify bank owner to update dashboard
    await this.redis.publish('payment:bank-owner-rejected', {
      transactionId,
      ownerId,
    });

    // Release collateral
    try {
      await this.collateral.releaseCollateral(transaction.bank_id, transactionId);
      this.logger.log(`Collateral released for rejected transaction ${transactionId}`);
    } catch (error) {
      this.logger.error(
        `Failed to release collateral for transaction ${transactionId}: ${error.message}`,
      );
    }

    return this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });
  }

  /**
   * Get real-time account status
   */
  async getAccountStatus(accountId: string, ownerId: string) {
    const account = await this.prisma.bank.findFirst({
      where: {
        id: accountId,
        owner_id: ownerId,
      },
      include: {
        collateral_locks: {
          where: { status: 'ACTIVE' },
        },
        _count: {
          select: {
            transactions: {
              where: {
                status: 'WAITING_BANK_OWNER_APPROVAL',
              },
            },
          },
        },
      },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    const lockedAmount = account.collateral_locks.reduce(
      (sum, lock) => sum + Number(lock.locked_amount),
      0,
    );

    return {
      id: account.id,
      bank_name: account.name,
      iban: account.iban,
      collateral_total: Number(account.collateral_limit),
      collateral_locked: lockedAmount,
      collateral_available: Number(account.collateral_limit) - lockedAmount,
      pending_approvals: account._count.transactions,
    };
  }
}
