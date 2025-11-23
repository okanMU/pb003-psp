import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { LoggerService } from '../logger/logger.service';

/**
 * Performance Metrics Service
 * Tracks and aggregates system performance metrics
 */
@Injectable()
export class MetricsService {
  private readonly METRICS_TTL = 86400; // 24 hours in seconds

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private logger: LoggerService,
  ) {
    this.logger.setContext('MetricsService');
  }

  /**
   * Track API request metrics
   */
  async trackRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
  ): Promise<void> {
    try {
      const timestamp = Date.now();
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // Store in Redis for real-time metrics
      const key = `metrics:requests:${date}`;

      await this.redis.getClient().zincrby(key, 1, `${method}:${path}`);
      await this.redis.getClient().expire(key, this.METRICS_TTL);

      // Track response times
      const timeKey = `metrics:response_times:${date}`;
      await this.redis.getClient().zadd(
        timeKey,
        timestamp,
        `${method}:${path}:${duration}`,
      );
      await this.redis.getClient().expire(timeKey, this.METRICS_TTL);

      // Track errors
      if (statusCode >= 400) {
        const errorKey = `metrics:errors:${date}`;
        await this.redis.getClient().zincrby(errorKey, 1, `${statusCode}:${method}:${path}`);
        await this.redis.getClient().expire(errorKey, this.METRICS_TTL);
      }
    } catch (error) {
      this.logger.error(`Failed to track request metrics: ${error.message}`);
    }
  }

  /**
   * Track payment operation metrics
   */
  async trackPaymentOperation(
    operation: 'create' | 'approve' | 'reject' | 'expire',
    duration: number,
    success: boolean,
  ): Promise<void> {
    try {
      const date = new Date().toISOString().split('T')[0];

      // Track operation count
      const countKey = `metrics:payments:${operation}:${date}`;
      await this.redis.getClient().incr(countKey);
      await this.redis.getClient().expire(countKey, this.METRICS_TTL);

      // Track operation duration
      const timeKey = `metrics:payments:${operation}:times:${date}`;
      await this.redis.getClient().lpush(timeKey, duration);
      await this.redis.getClient().ltrim(timeKey, 0, 999); // Keep last 1000
      await this.redis.getClient().expire(timeKey, this.METRICS_TTL);

      // Track success/failure
      const statusKey = `metrics:payments:${operation}:${success ? 'success' : 'failed'}:${date}`;
      await this.redis.getClient().incr(statusKey);
      await this.redis.getClient().expire(statusKey, this.METRICS_TTL);
    } catch (error) {
      this.logger.error(`Failed to track payment operation: ${error.message}`);
    }
  }

  /**
   * Get API request statistics
   */
  async getRequestStats(date?: string): Promise<any> {
    const targetDate = date || new Date().toISOString().split('T')[0];

    try {
      const key = `metrics:requests:${targetDate}`;
      const requests = await this.redis.getClient().zrange(key, 0, -1, 'WITHSCORES');

      const stats = [];
      for (let i = 0; i < requests.length; i += 2) {
        const endpoint = requests[i];
        const count = parseInt(requests[i + 1], 10);
        stats.push({ endpoint, count });
      }

      return {
        date: targetDate,
        totalRequests: stats.reduce((sum, s) => sum + s.count, 0),
        endpoints: stats.sort((a, b) => b.count - a.count),
      };
    } catch (error) {
      this.logger.error(`Failed to get request stats: ${error.message}`);
      return { date: targetDate, totalRequests: 0, endpoints: [] };
    }
  }

  /**
   * Get error statistics
   */
  async getErrorStats(date?: string): Promise<any> {
    const targetDate = date || new Date().toISOString().split('T')[0];

    try {
      const key = `metrics:errors:${targetDate}`;
      const errors = await this.redis.getClient().zrange(key, 0, -1, 'WITHSCORES');

      const stats = [];
      for (let i = 0; i < errors.length; i += 2) {
        const errorInfo = errors[i];
        const count = parseInt(errors[i + 1], 10);
        const [statusCode, method, path] = errorInfo.split(':');
        stats.push({ statusCode, method, path, count });
      }

      return {
        date: targetDate,
        totalErrors: stats.reduce((sum, s) => sum + s.count, 0),
        errors: stats.sort((a, b) => b.count - a.count),
      };
    } catch (error) {
      this.logger.error(`Failed to get error stats: ${error.message}`);
      return { date: targetDate, totalErrors: 0, errors: [] };
    }
  }

  /**
   * Get payment operation statistics
   */
  async getPaymentStats(date?: string): Promise<any> {
    const targetDate = date || new Date().toISOString().split('T')[0];

    try {
      const operations = ['create', 'approve', 'reject', 'expire'];
      const stats = {};

      for (const op of operations) {
        const countKey = `metrics:payments:${op}:${targetDate}`;
        const successKey = `metrics:payments:${op}:success:${targetDate}`;
        const failedKey = `metrics:payments:${op}:failed:${targetDate}`;
        const timeKey = `metrics:payments:${op}:times:${targetDate}`;

        const [count, success, failed, times] = await Promise.all([
          this.redis.getClient().get(countKey),
          this.redis.getClient().get(successKey),
          this.redis.getClient().get(failedKey),
          this.redis.getClient().lrange(timeKey, 0, -1),
        ]);

        const durations = times.map((t) => parseFloat(t));
        const avgDuration = durations.length > 0
          ? durations.reduce((sum, d) => sum + d, 0) / durations.length
          : 0;
        const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
        const minDuration = durations.length > 0 ? Math.min(...durations) : 0;

        stats[op] = {
          total: parseInt(count || '0', 10),
          success: parseInt(success || '0', 10),
          failed: parseInt(failed || '0', 10),
          avgDuration: Math.round(avgDuration * 100) / 100,
          maxDuration: Math.round(maxDuration * 100) / 100,
          minDuration: Math.round(minDuration * 100) / 100,
        };
      }

      return { date: targetDate, operations: stats };
    } catch (error) {
      this.logger.error(`Failed to get payment stats: ${error.message}`);
      return { date: targetDate, operations: {} };
    }
  }

  /**
   * Get response time percentiles
   */
  async getResponseTimePercentiles(date?: string): Promise<any> {
    const targetDate = date || new Date().toISOString().split('T')[0];

    try {
      const key = `metrics:response_times:${targetDate}`;
      const times = await this.redis.getClient().zrange(key, 0, -1);

      const durations = times
        .map((t) => {
          const parts = t.split(':');
          return parseFloat(parts[parts.length - 1]);
        })
        .sort((a, b) => a - b);

      if (durations.length === 0) {
        return {
          date: targetDate,
          count: 0,
          p50: 0,
          p75: 0,
          p90: 0,
          p95: 0,
          p99: 0,
        };
      }

      const getPercentile = (arr: number[], p: number) => {
        const index = Math.ceil((arr.length * p) / 100) - 1;
        return arr[index] || 0;
      };

      return {
        date: targetDate,
        count: durations.length,
        p50: Math.round(getPercentile(durations, 50) * 100) / 100,
        p75: Math.round(getPercentile(durations, 75) * 100) / 100,
        p90: Math.round(getPercentile(durations, 90) * 100) / 100,
        p95: Math.round(getPercentile(durations, 95) * 100) / 100,
        p99: Math.round(getPercentile(durations, 99) * 100) / 100,
      };
    } catch (error) {
      this.logger.error(`Failed to get response time percentiles: ${error.message}`);
      return { date: targetDate, count: 0, p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 };
    }
  }

  /**
   * Get system health metrics
   */
  async getSystemHealth(): Promise<any> {
    try {
      const [
        dbHealth,
        redisHealth,
        activePayments,
        activeLocks,
        pendingWebhooks,
      ] = await Promise.all([
        this.checkDatabaseHealth(),
        this.checkRedisHealth(),
        this.getActivePaymentsCount(),
        this.getActiveLocksCount(),
        this.getPendingWebhooksCount(),
      ]);

      return {
        timestamp: new Date().toISOString(),
        database: dbHealth,
        redis: redisHealth,
        metrics: {
          activePayments,
          activeLocks,
          pendingWebhooks,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get system health: ${error.message}`);
      return {
        timestamp: new Date().toISOString(),
        database: { status: 'error', message: error.message },
        redis: { status: 'error' },
        metrics: {},
      };
    }
  }

  private async checkDatabaseHealth(): Promise<any> {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const duration = Date.now() - start;

      return {
        status: 'healthy',
        latency: duration,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  private async checkRedisHealth(): Promise<any> {
    try {
      const start = Date.now();
      await this.redis.getClient().ping();
      const duration = Date.now() - start;

      return {
        status: 'healthy',
        latency: duration,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  private async getActivePaymentsCount(): Promise<number> {
    return this.prisma.transaction.count({
      where: { status: 'PENDING' },
    });
  }

  private async getActiveLocksCount(): Promise<number> {
    return this.prisma.collateralLock.count({
      where: { status: 'ACTIVE' },
    });
  }

  private async getPendingWebhooksCount(): Promise<number> {
    return this.prisma.webhookLog.count({
      where: { status: 'PENDING' },
    });
  }

  /**
   * Clear old metrics (cleanup job)
   */
  async clearOldMetrics(daysToKeep: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    let cleared = 0;

    for (let i = 0; i < daysToKeep + 1; i++) {
      const date = new Date(cutoffDate);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const patterns = [
        `metrics:requests:${dateStr}`,
        `metrics:response_times:${dateStr}`,
        `metrics:errors:${dateStr}`,
        `metrics:payments:*:${dateStr}`,
      ];

      for (const pattern of patterns) {
        const keys = await this.redis.getClient().keys(pattern);
        if (keys.length > 0) {
          await this.redis.getClient().del(...keys);
          cleared += keys.length;
        }
      }
    }

    this.logger.log(`Cleared ${cleared} old metric keys`);
    return cleared;
  }
}
