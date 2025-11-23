import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IFraudRule } from '../interfaces/fraud-rule.interface';
import { FraudContext, RuleCheckResult, FraudRuleType } from '../types/fraud.types';

/**
 * Duplicate Transaction Rule
 * Detects potential duplicate transactions (same amount + customer within short time)
 */
@Injectable()
export class DuplicateTransactionRule implements IFraudRule {
  private readonly DUPLICATE_WINDOW_MINUTES = 5; // Check last 5 minutes

  constructor(private prisma: PrismaService) {}

  getName(): string {
    return 'DuplicateTransactionRule';
  }

  getWeight(): number {
    return 7; // High priority
  }

  async check(context: FraudContext): Promise<RuleCheckResult> {
    const { platformId, amount, customerEmail, customerPhone } = context;

    if (!customerEmail && !customerPhone) {
      return {
        passed: true,
        ruleType: FraudRuleType.DUPLICATE_TRANSACTION,
        message: 'No customer identifiers for duplicate check',
        severity: 0,
      };
    }

    const timeWindow = new Date(Date.now() - this.DUPLICATE_WINDOW_MINUTES * 60 * 1000);

    const customerWhere = {
      OR: [
        customerEmail ? { customer_email: customerEmail } : null,
        customerPhone ? { customer_phone: customerPhone } : null,
      ].filter(Boolean),
    };

    // Find similar transactions
    const duplicates = await this.prisma.transaction.findMany({
      where: {
        platform_id: platformId,
        amount: amount,
        created_at: { gte: timeWindow },
        status: { in: ['PENDING', 'APPROVED'] },
        ...customerWhere,
      },
      select: {
        id: true,
        transaction_code: true,
        created_at: true,
        amount: true,
      },
      take: 5,
    });

    if (duplicates.length > 0) {
      return {
        passed: false,
        ruleType: FraudRuleType.DUPLICATE_TRANSACTION,
        message: `Potential duplicate: ${duplicates.length} similar transaction(s) found in last ${this.DUPLICATE_WINDOW_MINUTES} minutes`,
        severity: 8,
        metadata: {
          duplicateCount: duplicates.length,
          duplicates: duplicates.map(d => ({
            code: d.transaction_code,
            amount: Number(d.amount),
            createdAt: d.created_at,
          })),
        },
      };
    }

    return {
      passed: true,
      ruleType: FraudRuleType.DUPLICATE_TRANSACTION,
      message: 'No duplicates detected',
      severity: 0,
    };
  }
}
