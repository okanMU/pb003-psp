import { Module, Global } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsMiddleware } from './metrics.middleware';
import { MetricsScheduler } from './metrics.scheduler';

/**
 * Monitoring Module
 * Provides system-wide performance monitoring
 */
@Global()
@Module({
  providers: [MetricsService, MetricsMiddleware, MetricsScheduler],
  exports: [MetricsService, MetricsMiddleware],
})
export class MonitoringModule {}
