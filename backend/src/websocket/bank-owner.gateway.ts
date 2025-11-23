import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { OnModuleInit } from '@nestjs/common';

/**
 * Bank Owner WebSocket Gateway
 * Real-time notifications for bank owners:
 * - New payment confirmations
 * - Approval deadlines
 * - Collateral updates
 */
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'bank-owner',
})
export class BankOwnerGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer()
  server: Server;

  // Map: ownerId -> Set<socketId>
  private activeOwners = new Map<string, Set<string>>();

  constructor(
    private redis: RedisService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.subscribeToRedisEvents();
    console.log('✅ Bank Owner WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    console.log(`🔌 Bank Owner client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`❌ Bank Owner client disconnected: ${client.id}`);

    // Cleanup
    this.activeOwners.forEach((sockets, ownerId) => {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.activeOwners.delete(ownerId);
      }
    });
  }

  /**
   * Bank owner subscribes to their dashboard updates
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: { ownerId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { ownerId } = data;

    if (!this.activeOwners.has(ownerId)) {
      this.activeOwners.set(ownerId, new Set());
    }

    this.activeOwners.get(ownerId).add(client.id);
    client.join(`owner:${ownerId}`);

    console.log(`📡 Bank owner ${ownerId} subscribed (client: ${client.id})`);

    // Send initial dashboard data
    this.sendDashboardUpdate(ownerId);
  }

  /**
   * Bank owner unsubscribes
   */
  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: { ownerId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { ownerId } = data;

    client.leave(`owner:${ownerId}`);

    const sockets = this.activeOwners.get(ownerId);
    if (sockets) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.activeOwners.delete(ownerId);
      }
    }

    console.log(
      `📡 Bank owner ${ownerId} unsubscribed (client: ${client.id})`,
    );
  }

  /**
   * Redis Pub/Sub listeners
   */
  private async subscribeToRedisEvents() {
    // Customer confirmed payment - notify bank owner
    await this.redis.subscribe('payment:customer-confirmed', async (message) => {
      const { transactionId, ownerId, bankName, amount, deadline } = message;

      this.server.to(`owner:${ownerId}`).emit('payment:awaiting-approval', {
        transaction_id: transactionId,
        bank_name: bankName,
        amount,
        approval_deadline: deadline,
        countdown_seconds: 300,
      });

      console.log(
        `📤 Notified bank owner ${ownerId} about payment ${transactionId}`,
      );
    });

    // Payment approved by bank owner - update dashboard
    await this.redis.subscribe('payment:bank-owner-approved', async (message) => {
      const { ownerId } = message;
      await this.sendDashboardUpdate(ownerId);
    });

    // Payment rejected by bank owner - update dashboard
    await this.redis.subscribe('payment:bank-owner-rejected', async (message) => {
      const { ownerId } = message;
      await this.sendDashboardUpdate(ownerId);
    });

    // Payment timed out - update dashboard
    await this.redis.subscribe('payment:approval-timeout', async (message) => {
      const { ownerId } = message;
      await this.sendDashboardUpdate(ownerId);
    });

    // Collateral locked - update dashboard
    await this.redis.subscribe('collateral:locked', async (message) => {
      const { ownerId } = message;
      if (ownerId) {
        await this.sendCollateralUpdate(ownerId);
      }
    });

    // Collateral released - update dashboard
    await this.redis.subscribe('collateral:released', async (message) => {
      const { ownerId } = message;
      if (ownerId) {
        await this.sendCollateralUpdate(ownerId);
      }
    });
  }

  /**
   * Send full dashboard update to bank owner
   */
  private async sendDashboardUpdate(ownerId: string) {
    // Get owner with all bank accounts
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

    if (!owner) return;

    // Calculate real-time collateral
    const accounts = owner.owned_banks.map((bank) => {
      const lockedAmount = bank.collateral_locks.reduce(
        (sum, lock) => sum + Number(lock.locked_amount),
        0,
      );

      return {
        id: bank.id,
        bank_name: bank.name,
        iban: bank.iban,
        collateral_total: Number(bank.collateral_limit),
        collateral_locked: lockedAmount,
        collateral_available: Number(bank.collateral_limit) - lockedAmount,
      };
    });

    // Get pending transactions
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

    const data = {
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
              Math.floor((tx.approval_deadline.getTime() - Date.now()) / 1000),
            )
          : 0,
      })),
    };

    this.server.to(`owner:${ownerId}`).emit('dashboard:update', data);

    console.log(`📤 Dashboard update sent to bank owner ${ownerId}`);
  }

  /**
   * Send collateral update to bank owner
   */
  private async sendCollateralUpdate(ownerId: string) {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
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

    if (!owner) return;

    const collateralData = owner.owned_banks.map((bank) => {
      const lockedAmount = bank.collateral_locks.reduce(
        (sum, lock) => sum + Number(lock.locked_amount),
        0,
      );

      return {
        bank_id: bank.id,
        bank_name: bank.name,
        collateral_total: Number(bank.collateral_limit),
        collateral_locked: lockedAmount,
        collateral_available: Number(bank.collateral_limit) - lockedAmount,
      };
    });

    this.server.to(`owner:${ownerId}`).emit('collateral:update', collateralData);

    console.log(`📤 Collateral update sent to bank owner ${ownerId}`);
  }

  /**
   * Notify bank owner about countdown (called every second)
   */
  async sendCountdownUpdate(transactionId: string, secondsRemaining: number) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        bank: {
          select: {
            owner_id: true,
          },
        },
      },
    });

    if (!transaction?.bank?.owner_id) return;

    this.server.to(`owner:${transaction.bank.owner_id}`).emit('countdown:update', {
      transaction_id: transactionId,
      seconds_remaining: secondsRemaining,
    });
  }
}
