import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis/redis.module';
import { FraudRuleEngine } from './fraud-rule-engine.service';

// Rules
import { VelocityCheckRule } from './rules/velocity-check.rule';
import { IpBlacklistRule } from './rules/ip-blacklist.rule';
import { AmountAnomalyRule } from './rules/amount-anomaly.rule';
import { CustomerRiskRule } from './rules/customer-risk.rule';
import { DuplicateTransactionRule } from './rules/duplicate-transaction.rule';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [
    FraudRuleEngine,
    VelocityCheckRule,
    IpBlacklistRule,
    AmountAnomalyRule,
    CustomerRiskRule,
    DuplicateTransactionRule,
  ],
  exports: [
    FraudRuleEngine,
    VelocityCheckRule,
    IpBlacklistRule,
    AmountAnomalyRule,
    CustomerRiskRule,
    DuplicateTransactionRule,
  ],
})
export class FraudModule {}
