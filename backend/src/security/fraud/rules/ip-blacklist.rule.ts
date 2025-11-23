import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../redis/redis.service';
import { IFraudRule } from '../interfaces/fraud-rule.interface';
import { FraudContext, RuleCheckResult, FraudRuleType } from '../types/fraud.types';

/**
 * IP Blacklist Rule
 * Blocks transactions from blacklisted IP addresses
 */
@Injectable()
export class IpBlacklistRule implements IFraudRule {
  private readonly BLACKLIST_KEY = 'security:ip_blacklist';

  constructor(private redis: RedisService) {}

  getName(): string {
    return 'IpBlacklistRule';
  }

  getWeight(): number {
    return 10; // Highest priority - instant block
  }

  async check(context: FraudContext): Promise<RuleCheckResult> {
    const { customerIp } = context;

    if (!customerIp) {
      return {
        passed: true,
        ruleType: FraudRuleType.IP_BLACKLIST,
        message: 'No IP address to check',
        severity: 0,
      };
    }

    const isBlacklisted = await this.redis.getClient().sismember(this.BLACKLIST_KEY, customerIp);

    if (isBlacklisted) {
      return {
        passed: false,
        ruleType: FraudRuleType.IP_BLACKLIST,
        message: `IP address ${customerIp} is blacklisted`,
        severity: 10, // Critical - instant block
        metadata: { ip: customerIp },
      };
    }

    return {
      passed: true,
      ruleType: FraudRuleType.IP_BLACKLIST,
      message: 'IP address not blacklisted',
      severity: 0,
    };
  }
}
