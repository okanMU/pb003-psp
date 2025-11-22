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
}
