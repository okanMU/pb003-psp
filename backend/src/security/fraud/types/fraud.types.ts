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
 * Context for fraud analysis
 */
export interface FraudContext {
  platformId: string;
  amount: number;
  customerEmail?: string;
  customerPhone?: string;
  customerIp?: string;
  metadata?: Record<string, any>;
}

/**
 * Result of a single fraud rule check
 */
export interface RuleCheckResult {
  passed: boolean;
  ruleType: FraudRuleType;
  message: string;
  severity: number; // 1-10
  metadata?: Record<string, any>;
}

/**
 * Final fraud detection result
 */
export interface FraudDetectionResult {
  isBlocked: boolean;
  riskLevel: RiskLevel;
  riskScore: number; // 0-100
  triggeredRules: Array<{
    type: FraudRuleType;
    message: string;
    severity: number;
  }>;
  requiresManualReview: boolean;
}

/**
 * Configuration for fraud detection rules
 */
export interface FraudRuleConfig {
  enabled: boolean;
  weight: number; // How much this rule contributes to overall risk score
  blockingThreshold?: number; // Automatically block if severity exceeds this
}
