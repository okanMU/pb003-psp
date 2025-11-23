import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AlertService, AlertSeverity } from './alert.service';

interface SystemMetrics {
  database: {
    connected: boolean;
    responseTime: number;
  };
  redis: {
    connected: boolean;
    responseTime: number;
  };
  payments: {
    pendingCount: number;
    expiredCount: number;
    approvalRate: number; // last hour
  };
  collateral: {
    totalAvailable: number;
    utilizationRate: number;
  };
  timestamp: Date;
}

/**
 * Health Metrics Service
 * Monitors system health and sends alerts for anomalies
 */
@Injectable()
export class HealthMetricsService {
  private readonly logger = new Logger(HealthMetricsService.name);
  private latestMetrics: SystemMetrics | null = null;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private alertService: AlertService,
  ) {}

  /**
   * Collect system metrics every 5 minutes
   */
  @Cron('*/5 * * * *')
  async collectMetrics(): Promise<void> {
    try {
      this.logger.log('Collecting system health metrics...');

      const metrics = await this.gatherMetrics();
      this.latestMetrics = metrics;

      // Check for anomalies
      await this.checkAnomalies(metrics);

      this.logger.log('Health metrics collected successfully');
    } catch (error) {
      this.logger.error(`Failed to collect metrics: ${error.message}`, error.stack);
      this.alertService.error('Metrics Collection Failed', error.message);
    }
  }

  /**
   * Get latest metrics
   */
  getLatestMetrics(): SystemMetrics | null {
    return this.latestMetrics;
  }

  /**
   * Gather all system metrics
   */
  private async gatherMetrics(): Promise<SystemMetrics> {
    const [database, redis, payments, collateral] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkPayments(),
      this.checkCollateral(),
    ]);

    return {
      database,
      redis,
      payments,
      collateral,
      timestamp: new Date(),
    };
  }

  /**
   * Check database health
   */
  private async checkDatabase() {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        connected: true,
        responseTime: Date.now() - start,
      };
    } catch (error) {
      return {
        connected: false,
        responseTime: -1,
      };
    }
  }

  /**
   * Check Redis health
   */
  private async checkRedis() {
    const start = Date.now();
    try {
      await this.redis.getClient().ping();
      return {
        connected: true,
        responseTime: Date.now() - start,
      };
    } catch (error) {
      return {
        connected: false,
        responseTime: -1,
      };
    }
  }

  /**
   * Check payment metrics
   */
  private async checkPayments() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const [pendingCount, expiredCount, lastHourStats] = await Promise.all([
      this.prisma.transaction.count({
        where: { status: 'PENDING' },
      }),
      this.prisma.transaction.count({
        where: {
          status: 'PENDING',
          expires_at: { lt: now },
        },
      }),
      this.prisma.transaction.groupBy({
        by: ['status'],
        where: {
          created_at: { gte: oneHourAgo },
        },
        _count: true,
      }),
    ]);

    const approved = lastHourStats.find((s) => s.status === 'APPROVED')?._count || 0;
    const total = lastHourStats.reduce((sum, s) => sum + s._count, 0);
    const approvalRate = total > 0 ? (approved / total) * 100 : 0;

    return {
      pendingCount,
      expiredCount,
      approvalRate: parseFloat(approvalRate.toFixed(2)),
    };
  }

  /**
   * Check collateral metrics
   */
  private async checkCollateral() {
    const banks = await this.prisma.bank.findMany({
      where: { is_active: true },
      select: {
        collateral_limit: true,
        used_collateral: true,
        available_collateral: true,
      },
    });

    const totalLimit = banks.reduce(
      (sum, b) => sum + Number(b.collateral_limit),
      0,
    );
    const totalUsed = banks.reduce((sum, b) => sum + Number(b.used_collateral), 0);
    const totalAvailable = banks.reduce(
      (sum, b) => sum + Number(b.available_collateral),
      0,
    );

    const utilizationRate =
      totalLimit > 0 ? (totalUsed / totalLimit) * 100 : 0;

    return {
      totalAvailable,
      utilizationRate: parseFloat(utilizationRate.toFixed(2)),
    };
  }

  /**
   * Check for anomalies and send alerts
   */
  private async checkAnomalies(metrics: SystemMetrics): Promise<void> {
    // Database connection
    if (!metrics.database.connected) {
      this.alertService.critical(
        'Database Connection Lost',
        'Unable to connect to PostgreSQL database',
      );
    } else if (metrics.database.responseTime > 1000) {
      this.alertService.warning(
        'Slow Database Response',
        `Database response time: ${metrics.database.responseTime}ms`,
        { responseTime: metrics.database.responseTime },
      );
    }

    // Redis connection
    if (!metrics.redis.connected) {
      this.alertService.critical(
        'Redis Connection Lost',
        'Unable to connect to Redis',
      );
    }

    // Expired payments
    if (metrics.payments.expiredCount > 50) {
      this.alertService.warning(
        'High Expired Payments',
        `${metrics.payments.expiredCount} expired pending payments detected`,
        { expiredCount: metrics.payments.expiredCount },
      );
    }

    // Low approval rate
    if (metrics.payments.approvalRate < 20 && metrics.payments.approvalRate > 0) {
      this.alertService.warning(
        'Low Approval Rate',
        `Approval rate in last hour: ${metrics.payments.approvalRate}%`,
        { approvalRate: metrics.payments.approvalRate },
      );
    }

    // High collateral utilization
    if (metrics.collateral.utilizationRate > 90) {
      this.alertService.critical(
        'Critical Collateral Utilization',
        `Collateral utilization: ${metrics.collateral.utilizationRate}%`,
        { utilizationRate: metrics.collateral.utilizationRate },
      );
    } else if (metrics.collateral.utilizationRate > 75) {
      this.alertService.warning(
        'High Collateral Utilization',
        `Collateral utilization: ${metrics.collateral.utilizationRate}%`,
        { utilizationRate: metrics.collateral.utilizationRate },
      );
    }

    // Low available collateral
    if (metrics.collateral.totalAvailable < 10000) {
      this.alertService.error(
        'Low Available Collateral',
        `Only ${metrics.collateral.totalAvailable} TRY available`,
        { totalAvailable: metrics.collateral.totalAvailable },
      );
    }
  }
}
