import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule } from '@nestjs/throttler';

// Core Modules
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { LoggerModule } from './common/logger/logger.module';
import { MonitoringModule } from './common/monitoring/monitoring.module';
import { MetricsMiddleware } from './common/monitoring/metrics.middleware';

// Feature Modules
import { AuthModule } from './auth/auth.module';
import { PaymentModule } from './payment/payment.module';
import { AdminModule } from './admin/admin.module';
import { WebhookModule } from './webhook/webhook.module';
import { WebsocketModule } from './websocket/websocket.module';
import { BankModule } from './bank/bank.module';
import { PlatformModule } from './platform/platform.module';
import { HealthModule } from './health/health.module';
import { CollateralModule } from './collateral/collateral.module';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Schedule (Cron jobs)
    ScheduleModule.forRoot(),

    // Rate Limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 100, // 100 requests per minute
      },
    ]),

    // Bull Queue
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
      },
    }),

    // Core
    PrismaModule,
    RedisModule,
    LoggerModule,
    MonitoringModule,

    // Features
    AuthModule,
    PaymentModule,
    AdminModule,
    WebhookModule,
    WebsocketModule,
    BankModule,
    PlatformModule,
    HealthModule,
    CollateralModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
