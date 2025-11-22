import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';

// Core Modules
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

// Feature Modules
import { AuthModule } from './auth/auth.module';
import { PaymentModule } from './payment/payment.module';
import { AdminModule } from './admin/admin.module';
import { WebhookModule } from './webhook/webhook.module';
import { WebsocketModule } from './websocket/websocket.module';
import { BankModule } from './bank/bank.module';
import { PlatformModule } from './platform/platform.module';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Schedule (Cron jobs)
    ScheduleModule.forRoot(),

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

    // Features
    AuthModule,
    PaymentModule,
    AdminModule,
    WebhookModule,
    WebsocketModule,
    BankModule,
    PlatformModule,
  ],
})
export class AppModule {}
