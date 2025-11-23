import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../redis/redis.service';
import { IFraudRule } from '../interfaces/fraud-rule.interface';
import { FraudContext, RuleCheckResult, FraudRuleType, RiskLevel } from '../types/fraud.types';

/**
 * Customer Risk Rule
 * Checks if customer has been manually marked as high risk
 */
@Injectable()
export class CustomerRiskRule implements IFraudRule {
  constructor(private redis: RedisService) {}

  getName(): string {
    return 'CustomerRiskRule';
  }

  getWeight(): number {
    return 9; // Very high priority
  }

  async check(context: FraudContext): Promise<RuleCheckResult> {
    const { customerEmail, customerPhone } = context;

    if (!customerEmail && !customerPhone) {
      return {
        passed: true,
        ruleType: FraudRuleType.HIGH_RISK_CUSTOMER,
        message: 'No customer identifiers to check risk',
        severity: 0,
      };
    }

    let riskLevel: string | null = null;

    // Check email risk
    if (customerEmail) {
      riskLevel = await this.redis.getClient().get(`customer:risk:email:${customerEmail}`);
    }

    // Check phone risk if email not flagged
    if (!riskLevel && customerPhone) {
      riskLevel = await this.redis.getClient().get(`customer:risk:phone:${customerPhone}`);
    }

    if (riskLevel) {
      const severity = this.getSeverityFromRiskLevel(riskLevel);

      return {
        passed: false,
        ruleType: FraudRuleType.HIGH_RISK_CUSTOMER,
        message: `Customer marked as ${riskLevel} risk`,
        severity,
        metadata: {
          riskLevel,
          customerEmail,
          customerPhone,
        },
      };
    }

    return {
      passed: true,
      ruleType: FraudRuleType.HIGH_RISK_CUSTOMER,
      message: 'Customer not flagged as high risk',
      severity: 0,
    };
  }

  private getSeverityFromRiskLevel(riskLevel: string): number {
    switch (riskLevel.toUpperCase()) {
      case RiskLevel.CRITICAL:
        return 10;
      case RiskLevel.HIGH:
        return 9;
      case RiskLevel.MEDIUM:
        return 6;
      case RiskLevel.LOW:
        return 3;
      default:
        return 5;
    }
  }
}
