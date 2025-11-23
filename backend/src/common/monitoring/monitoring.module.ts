import { Module, Global } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsMiddleware } from './metrics.middleware';
import { MetricsScheduler } from './metrics.scheduler';
import { AlertService } from './alert.service';
import { HealthMetricsService } from './health-metrics.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis/redis.module';

/**
 * Monitoring Module
 * Provides system-wide performance monitoring, alerting, and health checks
 */
@Global()
@Module({
  imports: [PrismaModule, RedisModule],
  providers: [
    MetricsService,
    MetricsMiddleware,
    MetricsScheduler,
    AlertService,
    HealthMetricsService,
  ],
  exports: [MetricsService, MetricsMiddleware, AlertService, HealthMetricsService],
})
export class MonitoringModule {}
