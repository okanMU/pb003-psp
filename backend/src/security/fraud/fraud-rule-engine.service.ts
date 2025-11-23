import { Injectable, Logger } from '@nestjs/common';
import { IFraudRule } from './interfaces/fraud-rule.interface';
import {
  FraudContext,
  FraudDetectionResult,
  RiskLevel,
  RuleCheckResult,
} from './types/fraud.types';

/**
 * Fraud Rule Engine
 * Orchestrates multiple fraud detection rules using Strategy Pattern
 * Combines results to calculate overall risk score
 */
@Injectable()
export class FraudRuleEngine {
  private readonly logger = new Logger(FraudRuleEngine.name);

  private readonly RISK_THRESHOLDS = {
    LOW: 30,
    MEDIUM: 60,
    HIGH: 80,
    CRITICAL: 95,
  };

  private rules: IFraudRule[] = [];

  /**
   * Register a fraud detection rule
   */
  registerRule(rule: IFraudRule): void {
    this.rules.push(rule);
    this.logger.log(`Registered fraud rule: ${rule.getName()} (weight: ${rule.getWeight()})`);
  }

  /**
   * Register multiple fraud detection rules
   */
  registerRules(rules: IFraudRule[]): void {
    rules.forEach(rule => this.registerRule(rule));
  }

  /**
   * Analyze transaction using all registered rules
   */
  async analyze(context: FraudContext): Promise<FraudDetectionResult> {
    if (this.rules.length === 0) {
      this.logger.warn('No fraud rules registered! Allowing transaction by default.');
      return this.createDefaultResult();
    }

    // Execute all rules in parallel
    const ruleResults = await Promise.all(
      this.rules.map(rule => this.executeRule(rule, context)),
    );

    // Filter failed rules
    const failedRules = ruleResults.filter(result => !result.passed);

    // Calculate overall risk score
    const riskScore = this.calculateRiskScore(ruleResults);

    // Determine risk level
    const riskLevel = this.getRiskLevel(riskScore);

    // Determine if transaction should be blocked
    const isBlocked = this.shouldBlock(riskScore, failedRules);

    // Determine if manual review is needed
    const requiresManualReview = this.requiresManualReview(riskScore, failedRules);

    this.logger.log(
      `Fraud analysis complete - Risk: ${riskLevel} (${riskScore}/100), ` +
        `Failed rules: ${failedRules.length}/${this.rules.length}, ` +
        `Blocked: ${isBlocked}`,
    );

    return {
      isBlocked,
      riskLevel,
      riskScore,
      triggeredRules: failedRules.map(result => ({
        type: result.ruleType,
        message: result.message,
        severity: result.severity,
      })),
      requiresManualReview,
    };
  }

  /**
   * Execute a single rule with error handling
   */
  private async executeRule(rule: IFraudRule, context: FraudContext): Promise<RuleCheckResult> {
    try {
      return await rule.check(context);
    } catch (error) {
      this.logger.error(
        `Error executing fraud rule ${rule.getName()}: ${error.message}`,
        error.stack,
      );

      // Return a safe result on error
      return {
        passed: true, // Don't block on errors
        ruleType: null,
        message: `Rule ${rule.getName()} failed to execute`,
        severity: 0,
      };
    }
  }

  /**
   * Calculate overall risk score from all rule results
   * Uses weighted average based on rule weights
   */
  private calculateRiskScore(results: RuleCheckResult[]): number {
    if (results.length === 0) return 0;

    let totalWeightedScore = 0;
    let totalWeight = 0;

    results.forEach((result, index) => {
      const rule = this.rules[index];
      const weight = rule.getWeight();

      // Convert severity (0-10) to score (0-100)
      const score = result.severity * 10;

      totalWeightedScore += score * weight;
      totalWeight += weight;
    });

    const finalScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

    return Math.min(100, Math.round(finalScore));
  }

  /**
   * Determine risk level from score
   */
  private getRiskLevel(score: number): RiskLevel {
    if (score >= this.RISK_THRESHOLDS.CRITICAL) return RiskLevel.CRITICAL;
    if (score >= this.RISK_THRESHOLDS.HIGH) return RiskLevel.HIGH;
    if (score >= this.RISK_THRESHOLDS.MEDIUM) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  /**
   * Determine if transaction should be blocked
   */
  private shouldBlock(score: number, failedRules: RuleCheckResult[]): boolean {
    // Block if any rule has severity 10 (critical)
    if (failedRules.some(rule => rule.severity === 10)) {
      return true;
    }

    // Block if risk score is critical
    if (score >= this.RISK_THRESHOLDS.CRITICAL) {
      return true;
    }

    return false;
  }

  /**
   * Determine if manual review is required
   */
  private requiresManualReview(score: number, failedRules: RuleCheckResult[]): boolean {
    // High severity rules require manual review
    if (failedRules.some(rule => rule.severity >= 8)) {
      return true;
    }

    // High or critical risk requires review
    if (score >= this.RISK_THRESHOLDS.HIGH) {
      return true;
    }

    return false;
  }

  /**
   * Create a default safe result when no rules are registered
   */
  private createDefaultResult(): FraudDetectionResult {
    return {
      isBlocked: false,
      riskLevel: RiskLevel.LOW,
      riskScore: 0,
      triggeredRules: [],
      requiresManualReview: false,
    };
  }

  /**
   * Get all registered rules
   */
  getRules(): IFraudRule[] {
    return [...this.rules];
  }

  /**
   * Clear all registered rules (useful for testing)
   */
  clearRules(): void {
    this.rules = [];
  }
}
