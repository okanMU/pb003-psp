import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../redis/redis.service';
import { OnModuleInit } from '@nestjs/common';

/**
 * Admin WebSocket Gateway
 * Admin panel için real-time bildirimler
 */
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'admin',
})
export class AdminGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer()
  server: Server;

  private adminSockets = new Set<string>();

  constructor(private redis: RedisService) {}

  async onModuleInit() {
    await this.subscribeToRedisEvents();
    console.log('✅ Admin WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    // TODO: Auth kontrolü eklenebilir
    this.adminSockets.add(client.id);
    console.log(`🔌 Admin client connected: ${client.id}`);

    // İlk bağlantıda istatistikleri gönder
    this.sendDashboardStats(client);
  }

  handleDisconnect(client: Socket) {
    this.adminSockets.delete(client.id);
    console.log(`❌ Admin client disconnected: ${client.id}`);
  }

  /**
   * Redis eventlerini dinle
   */
  private async subscribeToRedisEvents() {
    // Yeni ödeme geldiğinde
    await this.redis.subscribe('payment:created', (message) => {
      this.server.emit('notification', {
        type: 'new_payment',
        message: `Yeni ödeme: ${message.code} - ${message.amount} TRY`,
        data: message,
        timestamp: new Date(),
      });

      // Dashboard stats güncelle
      this.broadcastDashboardUpdate();
    });

    // Ödeme onaylandığında
    await this.redis.subscribe('payment:approved', (message) => {
      this.server.emit('notification', {
        type: 'payment_approved',
        message: `Ödeme onaylandı: ${message.code}`,
        data: message,
        timestamp: new Date(),
      });

      this.broadcastDashboardUpdate();
    });

    // Ödeme reddedildiğinde
    await this.redis.subscribe('payment:rejected', (message) => {
      this.server.emit('notification', {
        type: 'payment_rejected',
        message: `Ödeme reddedildi: ${message.code}`,
        data: message,
        timestamp: new Date(),
      });

      this.broadcastDashboardUpdate();
    });
  }

  /**
   * Dashboard istatistiklerini gönder
   */
  private async sendDashboardStats(client: Socket) {
    // Stats hesaplama
    const stats = await this.calculateDashboardStats();
    client.emit('dashboard:stats', stats);
  }

  /**
   * Dashboard güncellemesi broadcast et
   */
  private async broadcastDashboardUpdate() {
    const stats = await this.calculateDashboardStats();
    this.server.emit('dashboard:update', stats);
  }

  /**
   * İstatistik hesaplama
   */
  private async calculateDashboardStats() {
    // Bu method gerçek uygulamada PaymentService'den çağrılır
    // Şimdilik mock data
    return {
      pendingCount: 0,
      pendingAmount: 0,
      todayVolume: 0,
      todayCount: 0,
      successRate: 0,
      timestamp: new Date(),
    };
  }

  /**
   * Manuel bildirim gönder
   */
  async sendNotification(type: string, message: string, data?: any) {
    this.server.emit('notification', {
      type,
      message,
      data,
      timestamp: new Date(),
    });
  }
}
