import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

export interface Alert {
  severity: AlertSeverity;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

/**
 * Alert Service
 * Handles system alerts and notifications
 * Can be extended to integrate with external services (email, Slack, PagerDuty, etc.)
 */
@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private alertHistory: Alert[] = [];
  private readonly MAX_HISTORY = 1000;

  constructor(private config: ConfigService) {}

  /**
   * Send an alert
   */
  async sendAlert(alert: Omit<Alert, 'timestamp'>): Promise<void> {
    const fullAlert: Alert = {
      ...alert,
      timestamp: new Date(),
    };

    // Log alert
    this.logAlert(fullAlert);

    // Store in history
    this.storeAlert(fullAlert);

    // Send to external services (if configured)
    await this.sendToExternalServices(fullAlert);
  }

  /**
   * Send info alert
   */
  info(title: string, message: string, metadata?: Record<string, any>): void {
    this.sendAlert({
      severity: AlertSeverity.INFO,
      title,
      message,
      metadata,
    });
  }

  /**
   * Send warning alert
   */
  warning(title: string, message: string, metadata?: Record<string, any>): void {
    this.sendAlert({
      severity: AlertSeverity.WARNING,
      title,
      message,
      metadata,
    });
  }

  /**
   * Send error alert
   */
  error(title: string, message: string, metadata?: Record<string, any>): void {
    this.sendAlert({
      severity: AlertSeverity.ERROR,
      title,
      message,
      metadata,
    });
  }

  /**
   * Send critical alert
   */
  critical(title: string, message: string, metadata?: Record<string, any>): void {
    this.sendAlert({
      severity: AlertSeverity.CRITICAL,
      title,
      message,
      metadata,
    });
  }

  /**
   * Get alert history
   */
  getHistory(limit: number = 100): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: AlertSeverity, limit: number = 100): Alert[] {
    return this.alertHistory.filter((a) => a.severity === severity).slice(-limit);
  }

  /**
   * Clear alert history
   */
  clearHistory(): void {
    this.alertHistory = [];
  }

  /**
   * Log alert to console
   */
  private logAlert(alert: Alert): void {
    const logMessage = `[${alert.severity}] ${alert.title}: ${alert.message}`;

    switch (alert.severity) {
      case AlertSeverity.INFO:
        this.logger.log(logMessage);
        break;
      case AlertSeverity.WARNING:
        this.logger.warn(logMessage);
        break;
      case AlertSeverity.ERROR:
      case AlertSeverity.CRITICAL:
        this.logger.error(logMessage, JSON.stringify(alert.metadata));
        break;
    }
  }

  /**
   * Store alert in memory
   */
  private storeAlert(alert: Alert): void {
    this.alertHistory.push(alert);

    // Keep only recent alerts
    if (this.alertHistory.length > this.MAX_HISTORY) {
      this.alertHistory = this.alertHistory.slice(-this.MAX_HISTORY);
    }
  }

  /**
   * Send to external services
   * Override this method to integrate with Slack, email, PagerDuty, etc.
   */
  private async sendToExternalServices(alert: Alert): Promise<void> {
    // Example: Only send ERROR and CRITICAL to external services
    if (
      alert.severity === AlertSeverity.ERROR ||
      alert.severity === AlertSeverity.CRITICAL
    ) {
      // TODO: Implement external service integrations
      // await this.sendToSlack(alert);
      // await this.sendToEmail(alert);
      // await this.sendToPagerDuty(alert);
    }
  }
}
