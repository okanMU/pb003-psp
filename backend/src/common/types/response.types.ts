/**
 * Standardized API Response Types
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface ErrorResponse extends ApiResponse<never> {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Payment-specific response types
 */
export interface PaymentResponse {
  id: string;
  transaction_code: string;
  amount: number;
  currency: string;
  status: string;
  bank_account: {
    name: string;
    iban: string;
    holder_name: string;
  };
  customer_info?: {
    email?: string;
    phone?: string;
    name?: string;
  };
  expires_at: string;
  created_at: string;
}

export interface PaymentStatusResponse {
  id: string;
  transaction_code: string;
  status: string;
  amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

/**
 * Dashboard & Stats response types
 */
export interface DashboardStats {
  pending_count: number;
  total_pending_amount: number;
  approved_today: number;
  rejected_today: number;
  total_volume_today: number;
  active_banks: number;
  locked_collateral: number;
}

export interface FraudStats {
  period: string;
  blocked_transactions: number;
  flagged_transactions: number;
  total_security_events: number;
  blacklisted_ips: number;
}

/**
 * Webhook response types
 */
export interface WebhookStats {
  sent: number;
  failed: number;
  pending: number;
  total: number;
  success_rate: string;
}

/**
 * Metrics response types
 */
export interface MetricsResponse {
  requests_by_endpoint: Record<string, number>;
  errors_by_type: Record<string, number>;
  response_time_percentiles: {
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  };
  payment_stats: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    expired: number;
  };
  system_health: {
    status: 'healthy' | 'degraded' | 'down';
    uptime_seconds: number;
    memory_usage_mb: number;
    active_connections: number;
  };
}
