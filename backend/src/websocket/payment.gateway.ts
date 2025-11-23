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
 * Payment WebSocket Gateway
 * Müşterilerin ödeme durumlarını real-time takip etmesi için
 */
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'payment',
})
export class PaymentGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer()
  server: Server;

  private activeConnections = new Map<string, Set<string>>(); // paymentId -> socketIds

  constructor(
    private redis: RedisService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    // Redis Pub/Sub dinle
    await this.subscribeToRedisEvents();
    console.log('✅ Payment WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    console.log(`🔌 Payment client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`❌ Payment client disconnected: ${client.id}`);

    // Cleanup
    this.activeConnections.forEach((sockets, paymentId) => {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.activeConnections.delete(paymentId);
      }
    });
  }

  /**
   * Client bir ödemeyi dinlemeye başlar
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: { paymentId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { paymentId } = data;

    if (!this.activeConnections.has(paymentId)) {
      this.activeConnections.set(paymentId, new Set());
    }

    this.activeConnections.get(paymentId).add(client.id);
    client.join(`payment:${paymentId}`);

    console.log(`📡 Client ${client.id} subscribed to payment ${paymentId}`);

    // İlk durumu gönder
    this.sendPaymentStatus(paymentId);
  }

  /**
   * Client dinlemeyi bırakır
   */
  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: { paymentId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { paymentId } = data;

    client.leave(`payment:${paymentId}`);

    const sockets = this.activeConnections.get(paymentId);
    if (sockets) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.activeConnections.delete(paymentId);
      }
    }

    console.log(`📡 Client ${client.id} unsubscribed from payment ${paymentId}`);
  }

  /**
   * Redis Pub/Sub eventlerini dinle
   */
  private async subscribeToRedisEvents() {
    // payment:created
    await this.redis.subscribe('payment:created', (message) => {
      this.server.emit('payment:created', message);
    });

    // payment:approved
    await this.redis.subscribe('payment:approved', (message) => {
      this.broadcastPaymentUpdate(message.id, 'approved');
    });

    // payment:rejected
    await this.redis.subscribe('payment:rejected', (message) => {
      this.broadcastPaymentUpdate(message.id, 'rejected', {
        reason: message.reason,
      });
    });

    // payment:expired
    await this.redis.subscribe('payment:expired', (message) => {
      this.broadcastPaymentUpdate(message.id, 'expired');
    });

    // collateral:locked (for spinner state: processing)
    await this.redis.subscribe('collateral:locked', (message) => {
      if (message.transaction_id) {
        this.server.to(`payment:${message.transaction_id}`).emit('payment:processing', {
          transaction_id: message.transaction_id,
          bank_id: message.bank_id,
          amount: message.amount,
          status: 'processing',
        });
      }
    });

    // bank:suspended (might affect pending payments)
    await this.redis.subscribe('bank:suspended', (message) => {
      // Notify all payments using this bank
      this.broadcastBankStatusChange(message.bank_id, 'suspended');
    });

    // bank:reactivated
    await this.redis.subscribe('bank:reactivated', (message) => {
      this.broadcastBankStatusChange(message.bank_id, 'active');
    });
  }

  /**
   * Ödeme güncellemesini broadcast et
   */
  private async broadcastPaymentUpdate(
    paymentId: string,
    status: string,
    extra?: any,
  ) {
    // Ödeme detaylarını çek
    const payment = await this.prisma.transaction.findUnique({
      where: { id: paymentId },
      include: { bank: true },
    });

    if (!payment) return;

    const data = {
      id: payment.id,
      code: payment.transaction_code,
      status: payment.status,
      amount: parseFloat(payment.amount.toString()),
      ...extra,
    };

    // İlgili room'a gönder
    this.server.to(`payment:${paymentId}`).emit('payment:updated', data);

    console.log(`📤 Payment update broadcasted: ${paymentId} - ${status}`);
  }

  /**
   * Ödeme durumunu gönder
   */
  private async sendPaymentStatus(paymentId: string) {
    const payment = await this.prisma.transaction.findUnique({
      where: { id: paymentId },
      include: { bank: true },
    });

    if (!payment) return;

    const data = {
      id: payment.id,
      code: payment.transaction_code,
      status: payment.status,
      amount: parseFloat(payment.amount.toString()),
      expires_at: payment.expires_at,
    };

    this.server.to(`payment:${paymentId}`).emit('payment:status', data);
  }

  /**
   * Timer güncellemesi gönder (countdown)
   */
  async sendTimerUpdate(paymentId: string, secondsRemaining: number) {
    this.server.to(`payment:${paymentId}`).emit('timer:update', {
      paymentId,
      secondsRemaining,
    });
  }

  /**
   * Banka durumu değiştiğinde ilgili ödemelere bildir
   */
  private async broadcastBankStatusChange(bankId: string, status: string) {
    // Bu bankayı kullanan PENDING ödemeleri bul
    const affectedPayments = await this.prisma.transaction.findMany({
      where: {
        bank_id: bankId,
        status: 'PENDING',
      },
      select: {
        id: true,
        transaction_code: true,
      },
    });

    // Her bir ödemeye bildir
    for (const payment of affectedPayments) {
      this.server.to(`payment:${payment.id}`).emit('bank:status_changed', {
        payment_id: payment.id,
        bank_id: bankId,
        bank_status: status,
      });
    }

    console.log(
      `📤 Bank status change broadcasted: ${bankId} - ${status} (${affectedPayments.length} payments affected)`,
    );
  }
}
