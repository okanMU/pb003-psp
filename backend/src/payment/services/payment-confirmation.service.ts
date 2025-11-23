import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LoggerService } from '../../common/logger/logger.service';
import { RedisService } from '../../redis/redis.service';
import { CollateralService } from '../../collateral/collateral.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

/**
 * Payment Confirmation Service
 * Handles customer confirmation "I've made the payment" flow
 * Starts 5-minute countdown and notifies bank owner
 */
@Injectable()
export class PaymentConfirmationService {
  constructor(
    private prisma: PrismaService,
    private logger: LoggerService,
    private redis: RedisService,
    private collateral: CollateralService,
    @InjectQueue('payment') private paymentQueue: Queue,
  ) {
    this.logger.setContext('PaymentConfirmationService');
  }

  /**
   * Customer confirms payment sent
   * Starts 5-minute countdown for bank owner approval
   */
  async confirmPaymentSent(transactionId: string) {
    // Get transaction
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        bank: {
          include: {
            owner: true,
          },
        },
        platform: true,
      },
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Check if already confirmed or expired
    if (transaction.status !== 'PENDING') {
      throw new Error(
        `Transaction status is ${transaction.status}, cannot confirm`,
      );
    }

    if (transaction.expires_at && new Date() > transaction.expires_at) {
      throw new Error('Transaction has expired');
    }

    // Calculate approval deadline (5 minutes from now)
    const approvalDeadline = new Date(Date.now() + 5 * 60 * 1000);

    // Update transaction status
    const updated = await this.prisma.transaction.updateMany({
      where: {
        id: transactionId,
        status: 'PENDING', // Race condition prevention
      },
      data: {
        status: 'WAITING_BANK_OWNER_APPROVAL',
        customer_confirmed_at: new Date(),
        approval_deadline: approvalDeadline,
      },
    });

    if (updated.count === 0) {
      throw new Error('Transaction status changed, cannot confirm');
    }

    this.logger.log(
      `Customer confirmed payment ${transactionId}, waiting for bank owner approval`,
    );

    // Schedule timeout job (5 minutes)
    // If bank owner doesn't approve in 5 minutes, auto-reject
    await this.paymentQueue.add(
      'payment-approval-timeout',
      {
        transactionId,
        deadline: approvalDeadline.toISOString(),
      },
      {
        delay: 5 * 60 * 1000, // 5 minutes
        jobId: `timeout-${transactionId}`, // Unique ID to prevent duplicates
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.log(
      `Timeout job scheduled for transaction ${transactionId} at ${approvalDeadline.toISOString()}`,
    );

    // Notify bank owner via WebSocket
    await this.redis.publish('payment:customer-confirmed', {
      transactionId,
      ownerId: transaction.bank.owner_id,
      bankName: transaction.bank.name,
      amount: Number(transaction.amount),
      customerEmail: transaction.customer_email,
      customerPhone: transaction.customer_phone,
      customerName: transaction.customer_name,
      deadline: approvalDeadline.toISOString(),
    });

    // Notify customer via WebSocket
    await this.redis.publish('payment:approved', {
      id: transactionId,
      status: 'WAITING_BANK_OWNER_APPROVAL',
    });

    // Return confirmation data
    return {
      transaction_id: transactionId,
      transaction_code: transaction.transaction_code,
      status: 'WAITING_BANK_OWNER_APPROVAL',
      approval_deadline: approvalDeadline,
      countdown_seconds: 300, // 5 minutes
      message: 'Payment confirmation received, waiting for bank owner approval',
      bank_owner: {
        name: transaction.bank.owner?.name || 'Bank Owner',
      },
    };
  }

  /**
   * Handle approval timeout (called by Bull queue after 5 minutes)
   */
  async handleApprovalTimeout(transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      this.logger.error(`Timeout: Transaction ${transactionId} not found`);
      return;
    }

    // If still waiting for approval, auto-reject
    if (transaction.status === 'WAITING_BANK_OWNER_APPROVAL') {
      await this.prisma.transaction.updateMany({
        where: {
          id: transactionId,
          status: 'WAITING_BANK_OWNER_APPROVAL',
        },
        data: {
          status: 'REJECTED',
          rejected_at: new Date(),
          rejection_reason:
            'Timeout: Bank owner did not approve within 5 minutes',
        },
      });

      this.logger.warn(
        `Transaction ${transactionId} auto-rejected due to timeout`,
      );

      // Notify customer via WebSocket
      await this.redis.publish('payment:rejected', {
        id: transactionId,
        reason: 'Timeout: Bank owner did not approve within 5 minutes',
      });

      // Notify bank owner to update dashboard
      const updatedTx = await this.prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          bank: {
            select: {
              owner_id: true,
            },
          },
        },
      });

      if (updatedTx?.bank?.owner_id) {
        await this.redis.publish('payment:approval-timeout', {
          transactionId,
          ownerId: updatedTx.bank.owner_id,
        });
      }

      // Release collateral
      if (transaction.bank_id) {
        try {
          await this.collateral.releaseCollateral(
            transaction.bank_id,
            transactionId,
          );
          this.logger.log(
            `Collateral released for timed-out transaction ${transactionId}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to release collateral for transaction ${transactionId}: ${error.message}`,
          );
        }
      }
    } else {
      this.logger.log(
        `Timeout job for ${transactionId} found status ${transaction.status}, no action needed`,
      );
    }
  }

  /**
   * Get real-time payment status for customer
   */
  async getPaymentStatus(transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        transaction_code: true,
        status: true,
        amount: true,
        customer_confirmed_at: true,
        approval_deadline: true,
        approved_at: true,
        rejected_at: true,
        rejection_reason: true,
      },
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Calculate time remaining if waiting for approval
    let timeRemaining = 0;
    if (
      transaction.status === 'WAITING_BANK_OWNER_APPROVAL' &&
      transaction.approval_deadline
    ) {
      timeRemaining = Math.max(
        0,
        Math.floor(
          (transaction.approval_deadline.getTime() - Date.now()) / 1000,
        ),
      );
    }

    return {
      ...transaction,
      time_remaining_seconds: timeRemaining,
    };
  }
}
