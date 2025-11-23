import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { IFraudRule } from '../interfaces/fraud-rule.interface';
import { FraudContext, RuleCheckResult, FraudRuleType } from '../types/fraud.types';

interface VelocityLimits {
  TRANSACTIONS_PER_HOUR: number;
  TRANSACTIONS_PER_DAY: number;
  AMOUNT_PER_HOUR: number;
  AMOUNT_PER_DAY: number;
}

/**
 * Velocity Check Rule
 * Detects suspicious transaction frequency and volume patterns
 */
@Injectable()
export class VelocityCheckRule implements IFraudRule {
  private readonly LIMITS: VelocityLimits = {
    TRANSACTIONS_PER_HOUR: 10,
    TRANSACTIONS_PER_DAY: 50,
    AMOUNT_PER_HOUR: 100000, // 100k TRY
    AMOUNT_PER_DAY: 500000, // 500k TRY
  };

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  getName(): string {
    return 'VelocityCheckRule';
  }

  getWeight(): number {
    return 8; // High priority
  }

  async check(context: FraudContext): Promise<RuleCheckResult> {
    const { platformId, amount, customerEmail, customerPhone, customerIp } = context;

    // Skip if no identifiers
    if (!customerEmail && !customerPhone && !customerIp) {
      return {
        passed: true,
        ruleType: FraudRuleType.VELOCITY_CHECK,
        message: 'No customer identifiers to check velocity',
        severity: 0,
      };
    }

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Build where clause for customer matching
    const customerWhere = {
      OR: [
        customerEmail ? { customer_email: customerEmail } : null,
        customerPhone ? { customer_phone: customerPhone } : null,
        customerIp ? { customer_ip: customerIp } : null,
      ].filter(Boolean),
    };

    // Check hourly transaction count
    const hourlyCount = await this.prisma.transaction.count({
      where: {
        platform_id: platformId,
        created_at: { gte: oneHourAgo },
        ...customerWhere,
      },
    });

    if (hourlyCount >= this.LIMITS.TRANSACTIONS_PER_HOUR) {
      return {
        passed: false,
        ruleType: FraudRuleType.VELOCITY_CHECK,
        message: `Velocity limit exceeded: ${hourlyCount} transactions in last hour (limit: ${this.LIMITS.TRANSACTIONS_PER_HOUR})`,
        severity: 9,
        metadata: { hourlyCount, limit: this.LIMITS.TRANSACTIONS_PER_HOUR },
      };
    }

    // Check daily transaction count
    const dailyCount = await this.prisma.transaction.count({
      where: {
        platform_id: platformId,
        created_at: { gte: oneDayAgo },
        ...customerWhere,
      },
    });

    if (dailyCount >= this.LIMITS.TRANSACTIONS_PER_DAY) {
      return {
        passed: false,
        ruleType: FraudRuleType.VELOCITY_CHECK,
        message: `Daily transaction limit exceeded: ${dailyCount} transactions (limit: ${this.LIMITS.TRANSACTIONS_PER_DAY})`,
        severity: 8,
        metadata: { dailyCount, limit: this.LIMITS.TRANSACTIONS_PER_DAY },
      };
    }

    // Check hourly amount
    const hourlyAmount = await this.prisma.transaction.aggregate({
      where: {
        platform_id: platformId,
        created_at: { gte: oneHourAgo },
        ...customerWhere,
      },
      _sum: { amount: true },
    });

    const totalHourlyAmount = Number(hourlyAmount._sum.amount || 0);
    if (totalHourlyAmount + amount > this.LIMITS.AMOUNT_PER_HOUR) {
      return {
        passed: false,
        ruleType: FraudRuleType.VELOCITY_CHECK,
        message: `Hourly amount limit exceeded: ${totalHourlyAmount + amount} TRY (limit: ${this.LIMITS.AMOUNT_PER_HOUR})`,
        severity: 9,
        metadata: { totalAmount: totalHourlyAmount + amount, limit: this.LIMITS.AMOUNT_PER_HOUR },
      };
    }

    // Check daily amount
    const dailyAmount = await this.prisma.transaction.aggregate({
      where: {
        platform_id: platformId,
        created_at: { gte: oneDayAgo },
        ...customerWhere,
      },
      _sum: { amount: true },
    });

    const totalDailyAmount = Number(dailyAmount._sum.amount || 0);
    if (totalDailyAmount + amount > this.LIMITS.AMOUNT_PER_DAY) {
      return {
        passed: false,
        ruleType: FraudRuleType.VELOCITY_CHECK,
        message: `Daily amount limit exceeded: ${totalDailyAmount + amount} TRY (limit: ${this.LIMITS.AMOUNT_PER_DAY})`,
        severity: 8,
        metadata: { totalAmount: totalDailyAmount + amount, limit: this.LIMITS.AMOUNT_PER_DAY },
      };
    }

    // All velocity checks passed
    return {
      passed: true,
      ruleType: FraudRuleType.VELOCITY_CHECK,
      message: 'Velocity check passed',
      severity: 0,
      metadata: { hourlyCount, dailyCount, totalHourlyAmount, totalDailyAmount },
    };
  }
}
