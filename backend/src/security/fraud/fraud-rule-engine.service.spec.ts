import { Test, TestingModule } from '@nestjs/testing';
import { FraudRuleEngine } from './fraud-rule-engine.service';
import { IFraudRule } from './interfaces/fraud-rule.interface';
import { FraudContext, RuleCheckResult, FraudRuleType, RiskLevel } from './types/fraud.types';

// Mock rule for testing
class MockHighSeverityRule implements IFraudRule {
  getName(): string {
    return 'MockHighSeverityRule';
  }

  getWeight(): number {
    return 10;
  }

  async check(context: FraudContext): Promise<RuleCheckResult> {
    return {
      passed: false,
      ruleType: FraudRuleType.IP_BLACKLIST,
      message: 'Mock high severity violation',
      severity: 10,
    };
  }
}

class MockLowSeverityRule implements IFraudRule {
  getName(): string {
    return 'MockLowSeverityRule';
  }

  getWeight(): number {
    return 5;
  }

  async check(context: FraudContext): Promise<RuleCheckResult> {
    return {
      passed: false,
      ruleType: FraudRuleType.AMOUNT_ANOMALY,
      message: 'Mock low severity violation',
      severity: 3,
    };
  }
}

class MockPassingRule implements IFraudRule {
  getName(): string {
    return 'MockPassingRule';
  }

  getWeight(): number {
    return 7;
  }

  async check(context: FraudContext): Promise<RuleCheckResult> {
    return {
      passed: true,
      ruleType: FraudRuleType.VELOCITY_CHECK,
      message: 'Check passed',
      severity: 0,
    };
  }
}

describe('FraudRuleEngine', () => {
  let engine: FraudRuleEngine;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FraudRuleEngine],
    }).compile();

    engine = module.get<FraudRuleEngine>(FraudRuleEngine);
  });

  afterEach(() => {
    engine.clearRules();
  });

  it('should be defined', () => {
    expect(engine).toBeDefined();
  });

  describe('registerRule', () => {
    it('should register a single rule', () => {
      const rule = new MockPassingRule();
      engine.registerRule(rule);
      expect(engine.getRules()).toHaveLength(1);
    });

    it('should register multiple rules', () => {
      const rules = [new MockPassingRule(), new MockLowSeverityRule()];
      engine.registerRules(rules);
      expect(engine.getRules()).toHaveLength(2);
    });
  });

  describe('analyze', () => {
    it('should return default result when no rules registered', async () => {
      const context: FraudContext = {
        platformId: 'platform-1',
        amount: 100,
      };

      const result = await engine.analyze(context);

      expect(result.isBlocked).toBe(false);
      expect(result.riskLevel).toBe(RiskLevel.LOW);
      expect(result.riskScore).toBe(0);
      expect(result.triggeredRules).toHaveLength(0);
    });

    it('should block transaction with critical severity rule', async () => {
      engine.registerRule(new MockHighSeverityRule());

      const context: FraudContext = {
        platformId: 'platform-1',
        amount: 100,
      };

      const result = await engine.analyze(context);

      expect(result.isBlocked).toBe(true);
      expect(result.riskLevel).toBe(RiskLevel.CRITICAL);
      expect(result.triggeredRules).toHaveLength(1);
      expect(result.triggeredRules[0].severity).toBe(10);
    });

    it('should calculate weighted risk score correctly', async () => {
      // Register rules with different weights
      engine.registerRules([new MockLowSeverityRule(), new MockPassingRule()]);

      const context: FraudContext = {
        platformId: 'platform-1',
        amount: 100,
      };

      const result = await engine.analyze(context);

      // MockLowSeverityRule: severity 3, weight 5 -> score 30
      // MockPassingRule: severity 0, weight 7 -> score 0
      // Weighted average: (30*5 + 0*7) / (5+7) = 150/12 = 12.5 ≈ 13
      expect(result.riskScore).toBeGreaterThan(0);
      expect(result.riskScore).toBeLessThan(30);
    });

    it('should require manual review for high severity rules', async () => {
      const highSeverityRule = new MockLowSeverityRule();
      // Override to return severity 8
      highSeverityRule.check = async () => ({
        passed: false,
        ruleType: FraudRuleType.VELOCITY_CHECK,
        message: 'High severity',
        severity: 8,
      });

      engine.registerRule(highSeverityRule);

      const context: FraudContext = {
        platformId: 'platform-1',
        amount: 100,
      };

      const result = await engine.analyze(context);

      expect(result.requiresManualReview).toBe(true);
    });

    it('should handle rule execution errors gracefully', async () => {
      const errorRule: IFraudRule = {
        getName: () => 'ErrorRule',
        getWeight: () => 5,
        check: async () => {
          throw new Error('Rule execution failed');
        },
      };

      engine.registerRule(errorRule);

      const context: FraudContext = {
        platformId: 'platform-1',
        amount: 100,
      };

      const result = await engine.analyze(context);

      // Should not throw, should return safe result
      expect(result).toBeDefined();
      expect(result.isBlocked).toBe(false);
    });

    it('should trigger multiple rules and combine results', async () => {
      engine.registerRules([
        new MockHighSeverityRule(),
        new MockLowSeverityRule(),
        new MockPassingRule(),
      ]);

      const context: FraudContext = {
        platformId: 'platform-1',
        amount: 100,
      };

      const result = await engine.analyze(context);

      expect(result.triggeredRules).toHaveLength(2); // Only failed rules
      expect(result.isBlocked).toBe(true); // Due to high severity
    });
  });

  describe('risk level determination', () => {
    it('should classify as LOW risk for score < 30', async () => {
      const lowRule: IFraudRule = {
        getName: () => 'LowRisk',
        getWeight: () => 10,
        check: async () => ({
          passed: false,
          ruleType: FraudRuleType.AMOUNT_ANOMALY,
          message: 'Low risk',
          severity: 2, // 2 * 10 = 20
        }),
      };

      engine.registerRule(lowRule);

      const result = await engine.analyze({ platformId: 'test', amount: 100 });

      expect(result.riskLevel).toBe(RiskLevel.LOW);
    });

    it('should classify as MEDIUM risk for score 30-59', async () => {
      const mediumRule: IFraudRule = {
        getName: () => 'MediumRisk',
        getWeight: () => 10,
        check: async () => ({
          passed: false,
          ruleType: FraudRuleType.AMOUNT_ANOMALY,
          message: 'Medium risk',
          severity: 4, // 4 * 10 = 40
        }),
      };

      engine.registerRule(mediumRule);

      const result = await engine.analyze({ platformId: 'test', amount: 100 });

      expect(result.riskLevel).toBe(RiskLevel.MEDIUM);
    });

    it('should classify as HIGH risk for score 60-79', async () => {
      const highRule: IFraudRule = {
        getName: () => 'HighRisk',
        getWeight: () => 10,
        check: async () => ({
          passed: false,
          ruleType: FraudRuleType.VELOCITY_CHECK,
          message: 'High risk',
          severity: 7, // 7 * 10 = 70
        }),
      };

      engine.registerRule(highRule);

      const result = await engine.analyze({ platformId: 'test', amount: 100 });

      expect(result.riskLevel).toBe(RiskLevel.HIGH);
      expect(result.requiresManualReview).toBe(true);
    });

    it('should classify as CRITICAL risk for score >= 95', async () => {
      const criticalRule: IFraudRule = {
        getName: () => 'CriticalRisk',
        getWeight: () => 10,
        check: async () => ({
          passed: false,
          ruleType: FraudRuleType.IP_BLACKLIST,
          message: 'Critical risk',
          severity: 10, // 10 * 10 = 100
        }),
      };

      engine.registerRule(criticalRule);

      const result = await engine.analyze({ platformId: 'test', amount: 100 });

      expect(result.riskLevel).toBe(RiskLevel.CRITICAL);
      expect(result.isBlocked).toBe(true);
    });
  });
});
