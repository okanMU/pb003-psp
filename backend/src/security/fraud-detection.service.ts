import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { LoggerService } from '../common/logger/logger.service';

/**
 * Risk levels for transactions
 */
export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * Fraud rule types
 */
export enum FraudRuleType {
  VELOCITY_CHECK = 'VELOCITY_CHECK',
  AMOUNT_ANOMALY = 'AMOUNT_ANOMALY',
  IP_BLACKLIST = 'IP_BLACKLIST',
  SUSPICIOUS_PATTERN = 'SUSPICIOUS_PATTERN',
  DUPLICATE_TRANSACTION = 'DUPLICATE_TRANSACTION',
  HIGH_RISK_CUSTOMER = 'HIGH_RISK_CUSTOMER',
}

/**
 * Fraud Detection Result
 */
export interface FraudDetectionResult {
  isBlocked: boolean;
  riskLevel: RiskLevel;
  riskScore: number; // 0-100
  triggeredRules: Array<{
    type: FraudRuleType;
    message: string;
    severity: number; // 1-10
  }>;
  requiresManualReview: boolean;
}

/**
 * Fraud Detection Service
 * Detects and prevents fraudulent transactions
 */
@Injectable()
export class FraudDetectionService {
  private readonly RISK_THRESHOLDS = {
    LOW: 30,
    MEDIUM: 60,
    HIGH: 80,
    CRITICAL: 95,
  };

  private readonly VELOCITY_LIMITS = {
    TRANSACTIONS_PER_HOUR: 10,
    TRANSACTIONS_PER_DAY: 50,
    AMOUNT_PER_HOUR: 100000, // 100k TRY
    AMOUNT_PER_DAY: 500000, // 500k TRY
  };

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private logger: LoggerService,
  ) {
    this.logger.setContext('FraudDetectionService');
  }

  /**
   * Analyze transaction for fraud
   */
  async analyzeTransaction(
    platformId: string,
    amount: number,
    customerEmail?: string,
    customerPhone?: string,
    customerIp?: string,
  ): Promise<FraudDetectionResult> {
    const triggeredRules: FraudDetectionResult['triggeredRules'] = [];

    // 1. Check IP blacklist
    if (customerIp) {
      const ipBlacklisted = await this.isIpBlacklisted(customerIp);
      if (ipBlacklisted) {
        triggeredRules.push({
          type: FraudRuleType.IP_BLACKLIST,
          message: `IP ${customerIp} is blacklisted`,
          severity: 10,
        });
      }
    }

    // 2. Check velocity (transaction frequency)
    if (customerEmail || customerPhone || customerIp) {
      const velocityCheck = await this.checkVelocity(
        platformId,
        amount,
        customerEmail,
        customerPhone,
        customerIp,
      );
      if (velocityCheck.violated) {
        triggeredRules.push({
          type: FraudRuleType.VELOCITY_CHECK,
          message: velocityCheck.message,
          severity: velocityCheck.severity,
        });
      }
    }

    // 3. Check amount anomaly
    const amountAnomaly = await this.checkAmountAnomaly(platformId, amount);
    if (amountAnomaly.isAnomaly) {
      triggeredRules.push({
        type: FraudRuleType.AMOUNT_ANOMALY,
        message: amountAnomaly.message,
        severity: amountAnomaly.severity,
      });
    }

    // 4. Check duplicate transactions
    if (customerEmail || customerPhone) {
      const duplicateCheck = await this.checkDuplicateTransaction(
        amount,
        customerEmail,
        customerPhone,
      );
      if (duplicateCheck.isDuplicate) {
        triggeredRules.push({
          type: FraudRuleType.DUPLICATE_TRANSACTION,
          message: duplicateCheck.message,
          severity: 7,
        });
      }
    }

    // 5. Check customer risk level
    if (customerEmail || customerPhone) {
      const customerRisk = await this.checkCustomerRisk(customerEmail, customerPhone);
      if (customerRisk.isHighRisk) {
        triggeredRules.push({
          type: FraudRuleType.HIGH_RISK_CUSTOMER,
          message: customerRisk.message,
          severity: customerRisk.severity,
        });
      }
    }

    // Calculate total risk score
    const riskScore = this.calculateRiskScore(triggeredRules);
    const riskLevel = this.determineRiskLevel(riskScore);
    const isBlocked = riskScore >= this.RISK_THRESHOLDS.CRITICAL;
    const requiresManualReview = riskScore >= this.RISK_THRESHOLDS.HIGH && !isBlocked;

    // Log fraud detection result
    if (triggeredRules.length > 0) {
      this.logger.warn(
        `Fraud detection: ${triggeredRules.length} rules triggered, ` +
        `risk=${riskLevel}(${riskScore}), blocked=${isBlocked}`
      );
    }

    return {
      isBlocked,
      riskLevel,
      riskScore,
      triggeredRules,
      requiresManualReview,
    };
  }

  /**
   * Check if IP is blacklisted
   */
  async isIpBlacklisted(ip: string): Promise<boolean> {
    const blacklisted = await this.redis.getClient().sismember('security:ip_blacklist', ip);
    return blacklisted === 1;
  }

  /**
   * Add IP to blacklist
   */
  async blacklistIp(ip: string, reason: string, adminId?: string): Promise<void> {
    await this.redis.getClient().sadd('security:ip_blacklist', ip);

    // Log blacklist action
    await this.prisma.securityEvent.create({
      data: {
        event_type: 'IP_BLACKLISTED',
        ip_address: ip,
        data: { reason, admin_id: adminId },
      },
    });

    this.logger.warn(`IP blacklisted: ${ip} - ${reason}`);
  }

  /**
   * Remove IP from blacklist
   */
  async removeIpFromBlacklist(ip: string, adminId?: string): Promise<void> {
    await this.redis.getClient().srem('security:ip_blacklist', ip);

    await this.prisma.securityEvent.create({
      data: {
        event_type: 'IP_WHITELISTED',
        ip_address: ip,
        data: { admin_id: adminId },
      },
    });

    this.logger.log(`IP removed from blacklist: ${ip}`);
  }

  /**
   * Check velocity (transaction frequency limits)
   */
  private async checkVelocity(
    platformId: string,
    amount: number,
    email?: string,
    phone?: string,
    ip?: string,
  ): Promise<{ violated: boolean; message: string; severity: number }> {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const dayAgo = now - 24 * 60 * 60 * 1000;

    // Check by email/phone/IP
    const identifiers = [email, phone, ip].filter(Boolean);

    for (const identifier of identifiers) {
      // Count transactions in last hour
      const hourKey = `velocity:hour:${identifier}`;
      const hourCount = await this.redis.getClient().zcount(hourKey, hourAgo, now);

      if (hourCount >= this.VELOCITY_LIMITS.TRANSACTIONS_PER_HOUR) {
        return {
          violated: true,
          message: `Too many transactions in 1 hour (${hourCount}/${this.VELOCITY_LIMITS.TRANSACTIONS_PER_HOUR})`,
          severity: 9,
        };
      }

      // Count transactions in last day
      const dayKey = `velocity:day:${identifier}`;
      const dayCount = await this.redis.getClient().zcount(dayKey, dayAgo, now);

      if (dayCount >= this.VELOCITY_LIMITS.TRANSACTIONS_PER_DAY) {
        return {
          violated: true,
          message: `Too many transactions in 24 hours (${dayCount}/${this.VELOCITY_LIMITS.TRANSACTIONS_PER_DAY})`,
          severity: 8,
        };
      }

      // Check total amount in last hour
      const hourAmountKey = `velocity:amount:hour:${identifier}`;
      const hourAmountStr = await this.redis.getClient().get(hourAmountKey);
      const hourAmount = parseFloat(hourAmountStr || '0') + amount;

      if (hourAmount > this.VELOCITY_LIMITS.AMOUNT_PER_HOUR) {
        return {
          violated: true,
          message: `Amount limit exceeded in 1 hour (${hourAmount}/${this.VELOCITY_LIMITS.AMOUNT_PER_HOUR} TRY)`,
          severity: 9,
        };
      }

      // Check total amount in last day
      const dayAmountKey = `velocity:amount:day:${identifier}`;
      const dayAmountStr = await this.redis.getClient().get(dayAmountKey);
      const dayAmount = parseFloat(dayAmountStr || '0') + amount;

      if (dayAmount > this.VELOCITY_LIMITS.AMOUNT_PER_DAY) {
        return {
          violated: true,
          message: `Amount limit exceeded in 24 hours (${dayAmount}/${this.VELOCITY_LIMITS.AMOUNT_PER_DAY} TRY)`,
          severity: 8,
        };
      }
    }

    return { violated: false, message: '', severity: 0 };
  }

  /**
   * Track transaction for velocity checks
   */
  async trackTransaction(
    amount: number,
    email?: string,
    phone?: string,
    ip?: string,
  ): Promise<void> {
    const now = Date.now();
    const identifiers = [email, phone, ip].filter(Boolean);

    for (const identifier of identifiers) {
      // Track transaction count
      await this.redis.getClient().zadd(`velocity:hour:${identifier}`, now, `${now}`);
      await this.redis.getClient().zadd(`velocity:day:${identifier}`, now, `${now}`);

      // Expire old entries
      await this.redis.getClient().zremrangebyscore(
        `velocity:hour:${identifier}`,
        0,
        now - 60 * 60 * 1000,
      );
      await this.redis.getClient().zremrangebyscore(
        `velocity:day:${identifier}`,
        0,
        now - 24 * 60 * 60 * 1000,
      );

      // Track amount
      await this.redis.getClient().incrby(`velocity:amount:hour:${identifier}`, amount);
      await this.redis.getClient().incrby(`velocity:amount:day:${identifier}`, amount);
      await this.redis.getClient().expire(`velocity:amount:hour:${identifier}`, 3600);
      await this.redis.getClient().expire(`velocity:amount:day:${identifier}`, 86400);
    }
  }

  /**
   * Check for amount anomalies
   */
  private async checkAmountAnomaly(
    platformId: string,
    amount: number,
  ): Promise<{ isAnomaly: boolean; message: string; severity: number }> {
    // Get platform's average transaction amount
    const stats = await this.prisma.transaction.aggregate({
      where: {
        platform_id: platformId,
        status: 'APPROVED',
        created_at: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      _avg: { amount: true },
      _max: { amount: true },
    });

    const avgAmount = stats._avg.amount || 0;
    const maxAmount = stats._max.amount || 0;

    // If amount is 10x average or 2x max, flag as anomaly
    if (amount > avgAmount * 10 && avgAmount > 0) {
      return {
        isAnomaly: true,
        message: `Amount is 10x higher than average (${amount} vs avg ${avgAmount.toFixed(2)})`,
        severity: 7,
      };
    }

    if (amount > maxAmount * 2 && maxAmount > 0) {
      return {
        isAnomaly: true,
        message: `Amount is 2x higher than historical max (${amount} vs max ${maxAmount})`,
        severity: 8,
      };
    }

    return { isAnomaly: false, message: '', severity: 0 };
  }

  /**
   * Check for duplicate transactions
   */
  private async checkDuplicateTransaction(
    amount: number,
    email?: string,
    phone?: string,
  ): Promise<{ isDuplicate: boolean; message: string }> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const whereClause: any = {
      amount,
      created_at: { gte: fiveMinutesAgo },
      status: { in: ['PENDING', 'APPROVED'] },
    };

    if (email) whereClause.customer_email = email;
    if (phone) whereClause.customer_phone = phone;

    if (!email && !phone) {
      return { isDuplicate: false, message: '' };
    }

    const duplicateCount = await this.prisma.transaction.count({ where: whereClause });

    if (duplicateCount > 0) {
      return {
        isDuplicate: true,
        message: `Duplicate transaction detected (${duplicateCount} similar transactions in last 5 minutes)`,
      };
    }

    return { isDuplicate: false, message: '' };
  }

  /**
   * Check customer risk level
   */
  private async checkCustomerRisk(
    email?: string,
    phone?: string,
  ): Promise<{ isHighRisk: boolean; message: string; severity: number }> {
    if (!email && !phone) {
      return { isHighRisk: false, message: '', severity: 0 };
    }

    // Check if customer has been marked as high risk
    const riskKey = `customer:risk:${email || phone}`;
    const riskLevel = await this.redis.getClient().get(riskKey);

    if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
      return {
        isHighRisk: true,
        message: `Customer marked as ${riskLevel} risk`,
        severity: riskLevel === 'CRITICAL' ? 10 : 8,
      };
    }

    // Check for high rejection rate
    const whereClause: any = {};
    if (email) whereClause.customer_email = email;
    if (phone) whereClause.customer_phone = phone;

    const [totalTxns, rejectedTxns] = await Promise.all([
      this.prisma.transaction.count({ where: whereClause }),
      this.prisma.transaction.count({
        where: { ...whereClause, status: 'REJECTED' },
      }),
    ]);

    if (totalTxns >= 5 && rejectedTxns / totalTxns > 0.5) {
      return {
        isHighRisk: true,
        message: `High rejection rate: ${rejectedTxns}/${totalTxns} transactions rejected`,
        severity: 7,
      };
    }

    return { isHighRisk: false, message: '', severity: 0 };
  }

  /**
   * Calculate total risk score from triggered rules
   */
  private calculateRiskScore(rules: FraudDetectionResult['triggeredRules']): number {
    if (rules.length === 0) return 0;

    // Sum severities and normalize to 0-100
    const totalSeverity = rules.reduce((sum, rule) => sum + rule.severity, 0);
    const maxPossibleSeverity = rules.length * 10;

    return Math.min(100, (totalSeverity / maxPossibleSeverity) * 100);
  }

  /**
   * Determine risk level from score
   */
  private determineRiskLevel(score: number): RiskLevel {
    if (score >= this.RISK_THRESHOLDS.CRITICAL) return RiskLevel.CRITICAL;
    if (score >= this.RISK_THRESHOLDS.HIGH) return RiskLevel.HIGH;
    if (score >= this.RISK_THRESHOLDS.MEDIUM) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  /**
   * Mark customer as high risk
   */
  async markCustomerAsRisk(
    identifier: string,
    riskLevel: RiskLevel,
    reason: string,
    adminId?: string,
  ): Promise<void> {
    const riskKey = `customer:risk:${identifier}`;
    await this.redis.getClient().set(riskKey, riskLevel, 'EX', 30 * 24 * 60 * 60); // 30 days

    await this.prisma.securityEvent.create({
      data: {
        event_type: 'CUSTOMER_RISK_MARKED',
        data: {
          identifier,
          risk_level: riskLevel,
          reason,
          admin_id: adminId,
        },
      },
    });

    this.logger.warn(`Customer marked as ${riskLevel} risk: ${identifier} - ${reason}`);
  }

  /**
   * Get fraud statistics
   */
  async getFraudStats(date?: string): Promise<any> {
    const days = date ? parseInt(date) : 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [blockedCount, flaggedCount, totalSecurityEvents] = await Promise.all([
      this.prisma.securityEvent.count({
        where: {
          event_type: 'TRANSACTION_BLOCKED',
          created_at: { gte: since },
        },
      }),
      this.prisma.securityEvent.count({
        where: {
          event_type: 'TRANSACTION_FLAGGED',
          created_at: { gte: since },
        },
      }),
      this.prisma.securityEvent.count({
        where: { created_at: { gte: since } },
      }),
    ]);

    const blacklistedIps = await this.redis.getClient().scard('security:ip_blacklist');

    return {
      period: `${days} days`,
      blockedTransactions: blockedCount,
      flaggedTransactions: flaggedCount,
      totalSecurityEvents,
      blacklistedIps,
    };
  }

  /**
   * Get security event logs with pagination
   */
  async getSecurityEvents(options: {
    limit?: number;
    offset?: number;
    platformId?: string;
    riskLevel?: string;
  }): Promise<any> {
    const { limit = 50, offset = 0, platformId, riskLevel } = options;

    const where: any = {};
    if (platformId) where.platform_id = platformId;
    if (riskLevel) where.risk_level = riskLevel;

    const [events, total] = await Promise.all([
      this.prisma.securityEvent.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.securityEvent.count({ where }),
    ]);

    return {
      events,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Get transactions that require manual review
   */
  async getHighRiskTransactions(): Promise<any[]> {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        metadata: {
          path: ['fraud_analysis', 'requires_manual_review'],
          equals: true,
        },
      },
      orderBy: { created_at: 'desc' },
      take: 100,
      include: {
        platform: {
          select: {
            id: true,
            name: true,
          },
        },
        bank: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return transactions.map((txn) => ({
      id: txn.id,
      transaction_code: txn.transaction_code,
      amount: txn.amount,
      status: txn.status,
      created_at: txn.created_at,
      platform: txn.platform,
      bank: txn.bank,
      customer_email: txn.customer_email,
      customer_phone: txn.customer_phone,
      customer_ip: txn.customer_ip,
      fraud_analysis: txn.metadata['fraud_analysis'] || null,
    }));
  }

  /**
   * Get all blacklisted IPs
   */
  async getBlacklistedIps(): Promise<any[]> {
    const ips = await this.redis.getClient().smembers('security:ip_blacklist');

    const ipData = await Promise.all(
      ips.map(async (ip) => {
        const data = await this.redis.get(`security:ip_blacklist:${ip}`);
        return {
          ip,
          reason: data?.reason || 'Unknown',
          blacklisted_at: data?.blacklisted_at || null,
          blacklisted_by: data?.blacklisted_by || null,
        };
      }),
    );

    return ipData;
  }

  /**
   * Remove high risk flag from customer
   */
  async removeCustomerHighRisk(
    email?: string,
    phone?: string,
    adminId?: string,
  ): Promise<void> {
    if (email) {
      await this.redis.getClient().srem('security:high_risk_customers:email', email);
      await this.redis.getClient().del(`security:high_risk:email:${email}`);
    }

    if (phone) {
      await this.redis.getClient().srem('security:high_risk_customers:phone', phone);
      await this.redis.getClient().del(`security:high_risk:phone:${phone}`);
    }

    this.logger.log(
      `High risk flag removed for customer - Email: ${email}, Phone: ${phone}, Admin: ${adminId}`,
    );
  }

  /**
   * Get all high risk customers
   */
  async getHighRiskCustomers(): Promise<any[]> {
    const [emails, phones] = await Promise.all([
      this.redis.getClient().smembers('security:high_risk_customers:email'),
      this.redis.getClient().smembers('security:high_risk_customers:phone'),
    ]);

    const emailData = await Promise.all(
      emails.map(async (email) => {
        const data = await this.redis.get(`security:high_risk:email:${email}`);
        return {
          type: 'email',
          identifier: email,
          reason: data?.reason || 'Unknown',
          marked_at: data?.marked_at || null,
          marked_by: data?.marked_by || null,
        };
      }),
    );

    const phoneData = await Promise.all(
      phones.map(async (phone) => {
        const data = await this.redis.get(`security:high_risk:phone:${phone}`);
        return {
          type: 'phone',
          identifier: phone,
          reason: data?.reason || 'Unknown',
          marked_at: data?.marked_at || null,
          marked_by: data?.marked_by || null,
        };
      }),
    );

    return [...emailData, ...phoneData];
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    platformId: string,
    eventType: string,
    riskLevel: RiskLevel,
    metadata: any,
  ): Promise<void> {
    await this.prisma.securityEvent.create({
      data: {
        platform_id: platformId,
        event_type: eventType.toUpperCase(),
        risk_level: riskLevel,
        metadata,
      },
    });

    this.logger.log(
      `Security event logged - Type: ${eventType}, Risk: ${riskLevel}, Platform: ${platformId}`,
    );
  }

  /**
   * Mark customer as high risk (alias for markCustomerAsRisk)
   */
  async markCustomerHighRisk(
    email?: string,
    phone?: string,
    reason?: string,
    adminId?: string,
  ): Promise<void> {
    return this.markCustomerAsRisk(email, phone, reason, adminId);
  }
}
