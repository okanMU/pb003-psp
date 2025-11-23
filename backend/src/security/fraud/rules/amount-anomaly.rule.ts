import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IFraudRule } from '../interfaces/fraud-rule.interface';
import { FraudContext, RuleCheckResult, FraudRuleType } from '../types/fraud.types';

/**
 * Amount Anomaly Rule
 * Detects unusually large transactions compared to user's history
 */
@Injectable()
export class AmountAnomalyRule implements IFraudRule {
  private readonly ANOMALY_MULTIPLIER = 5; // Flag if amount is 5x average
  private readonly MIN_HISTORY_COUNT = 3; // Need at least 3 transactions for comparison

  constructor(private prisma: PrismaService) {}

  getName(): string {
    return 'AmountAnomalyRule';
  }

  getWeight(): number {
    return 6; // Medium-high priority
  }

  async check(context: FraudContext): Promise<RuleCheckResult> {
    const { platformId, amount, customerEmail, customerPhone } = context;

    // Skip if no customer identifiers
    if (!customerEmail && !customerPhone) {
      return {
        passed: true,
        ruleType: FraudRuleType.AMOUNT_ANOMALY,
        message: 'No customer identifiers for anomaly check',
        severity: 0,
      };
    }

    // Get customer's transaction history
    const customerWhere = {
      OR: [
        customerEmail ? { customer_email: customerEmail } : null,
        customerPhone ? { customer_phone: customerPhone } : null,
      ].filter(Boolean),
    };

    const history = await this.prisma.transaction.findMany({
      where: {
        platform_id: platformId,
        status: { in: ['APPROVED', 'PENDING'] },
        ...customerWhere,
      },
      select: { amount: true },
      orderBy: { created_at: 'desc' },
      take: 50, // Last 50 transactions
    });

    // Need minimum history for comparison
    if (history.length < this.MIN_HISTORY_COUNT) {
      return {
        passed: true,
        ruleType: FraudRuleType.AMOUNT_ANOMALY,
        message: 'Insufficient transaction history for anomaly detection',
        severity: 0,
        metadata: { historyCount: history.length },
      };
    }

    // Calculate average amount
    const totalAmount = history.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const averageAmount = totalAmount / history.length;

    // Check if current amount is anomalously high
    if (amount > averageAmount * this.ANOMALY_MULTIPLIER) {
      const severity = this.calculateSeverity(amount, averageAmount);

      return {
        passed: false,
        ruleType: FraudRuleType.AMOUNT_ANOMALY,
        message: `Amount anomaly detected: ${amount} TRY is ${(amount / averageAmount).toFixed(1)}x higher than average (${averageAmount.toFixed(2)} TRY)`,
        severity,
        metadata: {
          currentAmount: amount,
          averageAmount: averageAmount.toFixed(2),
          multiplier: (amount / averageAmount).toFixed(1),
          historyCount: history.length,
        },
      };
    }

    return {
      passed: true,
      ruleType: FraudRuleType.AMOUNT_ANOMALY,
      message: 'Amount within normal range',
      severity: 0,
      metadata: {
        currentAmount: amount,
        averageAmount: averageAmount.toFixed(2),
        historyCount: history.length,
      },
    };
  }

  private calculateSeverity(amount: number, averageAmount: number): number {
    const multiplier = amount / averageAmount;

    if (multiplier >= 10) return 9; // 10x or more
    if (multiplier >= 8) return 8;
    if (multiplier >= 6) return 7;
    if (multiplier >= 5) return 6;

    return 5;
  }
}
