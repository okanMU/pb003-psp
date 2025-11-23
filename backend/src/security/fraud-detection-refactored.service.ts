import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { LoggerService } from '../common/logger/logger.service';
import { FraudRuleEngine } from './fraud/fraud-rule-engine.service';
import { FraudDetectionResult, FraudContext } from './fraud/types/fraud.types';

// Import all rules
import { VelocityCheckRule } from './fraud/rules/velocity-check.rule';
import { IpBlacklistRule } from './fraud/rules/ip-blacklist.rule';
import { AmountAnomalyRule } from './fraud/rules/amount-anomaly.rule';
import { CustomerRiskRule } from './fraud/rules/customer-risk.rule';
import { DuplicateTransactionRule } from './fraud/rules/duplicate-transaction.rule';

/**
 * Fraud Detection Service (Refactored)
 * Now uses Strategy Pattern for fraud rules
 * Acts as a facade for FraudRuleEngine
 */
@Injectable()
export class FraudDetectionServiceRefactored implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private logger: LoggerService,
    private fraudEngine: FraudRuleEngine,
    // Inject all rules
    private velocityCheckRule: VelocityCheckRule,
    private ipBlacklistRule: IpBlacklistRule,
    private amountAnomalyRule: AmountAnomalyRule,
    private customerRiskRule: CustomerRiskRule,
    private duplicateTransactionRule: DuplicateTransactionRule,
  ) {
    this.logger.setContext('FraudDetectionService');
  }

  /**
   * Initialize and register all fraud detection rules
   */
  onModuleInit() {
    this.fraudEngine.registerRules([
      this.ipBlacklistRule,          // Highest priority - instant block
      this.customerRiskRule,         // Very high priority
      this.velocityCheckRule,        // High priority
      this.duplicateTransactionRule, // High priority
      this.amountAnomalyRule,        // Medium-high priority
    ]);

    this.logger.log('Fraud detection rules initialized successfully');
  }

  /**
   * Analyze transaction for fraud using Strategy Pattern
   */
  async analyzeTransaction(
    platformId: string,
    amount: number,
    customerEmail?: string,
    customerPhone?: string,
    customerIp?: string,
  ): Promise<FraudDetectionResult> {
    const context: FraudContext = {
      platformId,
      amount,
      customerEmail,
      customerPhone,
      customerIp,
    };

    const result = await this.fraudEngine.analyze(context);

    // Log result
    this.logger.log(
      `Fraud analysis result - Risk: ${result.riskLevel} (${result.riskScore}/100), ` +
        `Blocked: ${result.isBlocked}, Manual Review: ${result.requiresManualReview}`,
    );

    return result;
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
   * Get list of blacklisted IPs
   */
  async getBlacklistedIps(): Promise<string[]> {
    return this.redis.getClient().smembers('security:ip_blacklist');
  }

  /**
   * Mark customer as high risk
   */
  async markCustomerAsRisk(
    identifier: string,
    riskLevel: string,
    reason: string,
    adminId?: string,
  ): Promise<void> {
    const isEmail = identifier.includes('@');
    const key = isEmail ? `customer:risk:email:${identifier}` : `customer:risk:phone:${identifier}`;

    await this.redis.getClient().set(key, riskLevel, 'EX', 30 * 24 * 60 * 60); // 30 days

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
   * Mark customer as high risk (legacy method name)
   */
  async markCustomerHighRisk(
    email: string,
    phone: string,
    reason: string,
    adminId?: string,
  ): Promise<void> {
    const identifier = email || phone;
    return this.markCustomerAsRisk(identifier, 'HIGH', reason, adminId);
  }

  /**
   * Get fraud statistics for a date
   */
  async getFraudStats(date?: string): Promise<{
    totalFraudulent: number;
    blockedTransactions: number;
    manualReviewNeeded: number;
    riskDistribution: Record<string, number>;
  }> {
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    // Get all transactions for the day
    const transactions = await this.prisma.transaction.findMany({
      where: {
        created_at: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        fraud_score: true,
        risk_level: true,
        status: true,
      },
    });

    const totalFraudulent = transactions.filter(t => t.fraud_score && t.fraud_score > 50).length;
    const blockedTransactions = transactions.filter(t => t.status === 'REJECTED' && t.fraud_score && t.fraud_score >= 95).length;
    const manualReviewNeeded = transactions.filter(t => t.fraud_score && t.fraud_score >= 80 && t.fraud_score < 95).length;

    const riskDistribution = transactions.reduce((acc, t) => {
      const level = t.risk_level || 'UNKNOWN';
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalFraudulent,
      blockedTransactions,
      manualReviewNeeded,
      riskDistribution,
    };
  }
}
