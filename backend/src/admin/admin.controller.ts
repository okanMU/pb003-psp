import { Controller, Get, Post, Body, Param, Patch, Query, Delete } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PaymentService } from '../payment/payment.service';
import { OrphanDetectionService } from '../payment/orphan-detection.service';
import { WebhookService } from '../webhook/webhook.service';
import { MetricsService } from '../common/monitoring/metrics.service';
import { FraudDetectionService } from '../security/fraud-detection.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

// Admin endpoints require authentication - PSP_ADMIN or OPERATOR roles
@Roles(UserRole.PSP_ADMIN, UserRole.OPERATOR, UserRole.BANK_OWNER)
@Controller('admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private paymentService: PaymentService,
    private orphanDetection: OrphanDetectionService,
    private webhookService: WebhookService,
    private metricsService: MetricsService,
    private fraudDetection: FraudDetectionService,
  ) {}

  /**
   * GET /api/v1/admin/dashboard/stats
   */
  @Get('dashboard/stats')
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  /**
   * GET /api/v1/admin/payments/pending
   */
  @Get('payments/pending')
  async getPendingPayments() {
    return this.adminService.getPendingPayments();
  }

  /**
   * POST /api/v1/admin/payments/:id/approve
   */
  @Post('payments/:id/approve')
  async approvePayment(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.paymentService.approvePayment(id, adminId);
  }

  /**
   * POST /api/v1/admin/payments/:id/reject
   */
  @Post('payments/:id/reject')
  async rejectPayment(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser('id') adminId: string,
  ) {
    return this.paymentService.rejectPayment(id, adminId, body.reason);
  }

  /**
   * POST /api/v1/admin/payments/batch-approve
   */
  @Post('payments/batch-approve')
  async batchApprove(
    @Body() body: { approvals: Array<{ refCode: string }> },
    @CurrentUser('id') adminId: string,
  ) {
    // Add adminId to each approval
    const approvalsWithAdmin = body.approvals.map(approval => ({
      ...approval,
      adminId,
    }));
    return this.adminService.batchApprove(approvalsWithAdmin);
  }

  /**
   * GET /api/v1/admin/search/ref-code/:code
   */
  @Get('search/ref-code/:code')
  async searchByRefCode(@Param('code') code: string) {
    return this.adminService.searchByRefCode(code);
  }

  /**
   * GET /api/v1/admin/system/orphan-stats
   * Get statistics about orphaned resources
   */
  @Get('system/orphan-stats')
  async getOrphanStats() {
    return this.orphanDetection.getOrphanStats();
  }

  /**
   * POST /api/v1/admin/system/cleanup-orphans
   * Manually trigger orphan cleanup (also runs automatically every hour)
   */
  @Post('system/cleanup-orphans')
  async cleanupOrphans() {
    return this.orphanDetection.detectAndCleanup();
  }

  /**
   * GET /api/v1/admin/webhooks/stats
   * Get webhook delivery statistics
   */
  @Get('webhooks/stats')
  async getWebhookStats() {
    return this.webhookService.getWebhookStats();
  }

  /**
   * GET /api/v1/admin/webhooks/failed
   * Get failed webhooks
   */
  @Get('webhooks/failed')
  async getFailedWebhooks(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.webhookService.getFailedWebhooks(limitNum);
  }

  /**
   * GET /api/v1/admin/webhooks/pending
   * Get pending webhooks waiting for retry
   */
  @Get('webhooks/pending')
  async getPendingWebhooks() {
    return this.webhookService.getPendingWebhooks();
  }

  /**
   * POST /api/v1/admin/webhooks/:id/retry
   * Manually retry a failed webhook
   */
  @Post('webhooks/:id/retry')
  async retryWebhook(@Param('id') id: string) {
    await this.webhookService.retryWebhook(id);
    return { success: true, message: 'Webhook retry initiated' };
  }

  /**
   * POST /api/v1/admin/webhooks/retry-all-pending
   * Manually retry all pending webhooks
   */
  @Post('webhooks/retry-all-pending')
  async retryAllPendingWebhooks() {
    const count = await this.webhookService.retryPendingWebhooks();
    return { success: true, retriedCount: count };
  }

  /**
   * GET /api/v1/admin/metrics/requests?date=YYYY-MM-DD
   * Get API request statistics
   */
  @Get('metrics/requests')
  async getRequestMetrics(@Query('date') date?: string) {
    return this.metricsService.getRequestStats(date);
  }

  /**
   * GET /api/v1/admin/metrics/errors?date=YYYY-MM-DD
   * Get error statistics
   */
  @Get('metrics/errors')
  async getErrorMetrics(@Query('date') date?: string) {
    return this.metricsService.getErrorStats(date);
  }

  /**
   * GET /api/v1/admin/metrics/payments?date=YYYY-MM-DD
   * Get payment operation statistics
   */
  @Get('metrics/payments')
  async getPaymentMetrics(@Query('date') date?: string) {
    return this.metricsService.getPaymentStats(date);
  }

  /**
   * GET /api/v1/admin/metrics/response-times?date=YYYY-MM-DD
   * Get response time percentiles
   */
  @Get('metrics/response-times')
  async getResponseTimeMetrics(@Query('date') date?: string) {
    return this.metricsService.getResponseTimePercentiles(date);
  }

  /**
   * GET /api/v1/admin/metrics/system-health
   * Get real-time system health
   */
  @Get('metrics/system-health')
  async getSystemHealth() {
    return this.metricsService.getSystemHealth();
  }

  // ================== SECURITY & FRAUD MANAGEMENT ==================

  /**
   * GET /api/v1/admin/security/fraud-stats
   * Get fraud detection statistics
   */
  @Get('security/fraud-stats')
  async getFraudStats(@Query('date') date?: string) {
    return this.fraudDetection.getFraudStats(date);
  }

  /**
   * GET /api/v1/admin/security/events
   * Get security event logs with pagination
   */
  @Get('security/events')
  async getSecurityEvents(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('platform_id') platformId?: string,
    @Query('risk_level') riskLevel?: string,
  ) {
    return this.fraudDetection.getSecurityEvents({
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
      platformId,
      riskLevel,
    });
  }

  /**
   * GET /api/v1/admin/security/high-risk-transactions
   * Get transactions that require manual review
   */
  @Get('security/high-risk-transactions')
  async getHighRiskTransactions() {
    return this.fraudDetection.getHighRiskTransactions();
  }

  /**
   * POST /api/v1/admin/security/ip-blacklist
   * Add IP address to blacklist
   */
  @Post('security/ip-blacklist')
  async blacklistIp(
    @Body() body: { ip: string; reason: string; adminId?: string },
  ) {
    await this.fraudDetection.blacklistIp(body.ip, body.reason, body.adminId);
    return {
      success: true,
      message: `IP ${body.ip} has been blacklisted`,
    };
  }

  /**
   * DELETE /api/v1/admin/security/ip-blacklist/:ip
   * Remove IP address from blacklist
   */
  @Delete('security/ip-blacklist/:ip')
  async removeIpFromBlacklist(
    @Param('ip') ip: string,
    @Body() body: { adminId?: string },
  ) {
    await this.fraudDetection.removeIpFromBlacklist(ip, body.adminId);
    return {
      success: true,
      message: `IP ${ip} has been removed from blacklist`,
    };
  }

  /**
   * GET /api/v1/admin/security/ip-blacklist
   * Get all blacklisted IPs
   */
  @Get('security/ip-blacklist')
  async getBlacklistedIps() {
    return this.fraudDetection.getBlacklistedIps();
  }

  /**
   * POST /api/v1/admin/security/customer-risk
   * Mark customer as high risk
   */
  @Post('security/customer-risk')
  async markCustomerHighRisk(
    @Body() body: { email?: string; phone?: string; reason: string; adminId?: string },
  ) {
    if (!body.email && !body.phone) {
      throw new Error('Either email or phone must be provided');
    }
    await this.fraudDetection.markCustomerHighRisk(
      body.email,
      body.phone,
      body.reason,
      body.adminId,
    );
    return {
      success: true,
      message: 'Customer has been marked as high risk',
    };
  }

  /**
   * DELETE /api/v1/admin/security/customer-risk
   * Remove high risk flag from customer
   */
  @Delete('security/customer-risk')
  async removeCustomerHighRisk(
    @Body() body: { email?: string; phone?: string; adminId?: string },
  ) {
    if (!body.email && !body.phone) {
      throw new Error('Either email or phone must be provided');
    }
    await this.fraudDetection.removeCustomerHighRisk(
      body.email,
      body.phone,
      body.adminId,
    );
    return {
      success: true,
      message: 'High risk flag removed from customer',
    };
  }

  /**
   * GET /api/v1/admin/security/high-risk-customers
   * Get all high risk customers
   */
  @Get('security/high-risk-customers')
  async getHighRiskCustomers() {
    return this.fraudDetection.getHighRiskCustomers();
  }
}
