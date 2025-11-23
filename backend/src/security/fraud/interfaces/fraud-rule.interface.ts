import { FraudContext, RuleCheckResult } from '../types/fraud.types';

/**
 * Base interface for all fraud detection rules
 * Using Strategy Pattern to allow flexible rule composition
 */
export interface IFraudRule {
  /**
   * Check if the transaction violates this fraud rule
   * @param context - Transaction context to analyze
   * @returns Promise<RuleCheckResult>
   */
  check(context: FraudContext): Promise<RuleCheckResult>;

  /**
   * Get the name of this rule
   */
  getName(): string;

  /**
   * Get the weight/priority of this rule (1-10)
   */
  getWeight(): number;
}
