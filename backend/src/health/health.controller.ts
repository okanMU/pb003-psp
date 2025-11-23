import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { Public } from '../auth/decorators/public.decorator';
import { HealthMetricsService } from '../common/monitoring/health-metrics.service';
import { AlertService } from '../common/monitoring/alert.service';

@Public() // Health endpoints should be public
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private prisma: PrismaService,
    private redis: RedisService,
    private healthMetrics: HealthMetricsService,
    private alertService: AlertService,
  ) {}

  @Get()
  @HealthCheck()
  async check() {
    return this.health.check([
      // Memory check (heap should not exceed 150MB)
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),

      // Database check
      async () => {
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return {
            database: {
              status: 'up',
            },
          };
        } catch (error) {
          return {
            database: {
              status: 'down',
              message: error.message,
            },
          };
        }
      },

      // Redis check
      async () => {
        try {
          await this.redis.getClient().ping();
          return {
            redis: {
              status: 'up',
            },
          };
        } catch (error) {
          return {
            redis: {
              status: 'down',
              message: error.message,
            },
          };
        }
      },
    ]);
  }

  @Get('live')
  live() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      await this.redis.getClient().ping();

      return {
        status: 'ready',
        database: 'connected',
        redis: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'not ready',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('metrics')
  async metrics() {
    const metrics = this.healthMetrics.getLatestMetrics();

    if (!metrics) {
      return {
        message: 'No metrics available yet. Metrics are collected every 5 minutes.',
        nextCollection: 'within 5 minutes',
      };
    }

    return {
      ...metrics,
      status: 'ok',
    };
  }

  @Get('alerts')
  async alerts() {
    return {
      recent: this.alertService.getHistory(50),
      bySeverity: {
        critical: this.alertService.getAlertsBySeverity('CRITICAL', 10),
        error: this.alertService.getAlertsBySeverity('ERROR', 10),
        warning: this.alertService.getAlertsBySeverity('WARNING', 10),
      },
    };
  }
}
