import { Controller, Get, Post, Body, Param, Patch, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PaymentService } from '../payment/payment.service';
import { OrphanDetectionService } from '../payment/orphan-detection.service';
import { WebhookService } from '../webhook/webhook.service';
import { MetricsService } from '../common/monitoring/metrics.service';

@Controller('admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private paymentService: PaymentService,
    private orphanDetection: OrphanDetectionService,
    private webhookService: WebhookService,
    private metricsService: MetricsService,
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
    @Body() body: { adminId: string },
  ) {
    return this.paymentService.approvePayment(id, body.adminId);
  }

  /**
   * POST /api/v1/admin/payments/:id/reject
   */
  @Post('payments/:id/reject')
  async rejectPayment(
    @Param('id') id: string,
    @Body() body: { adminId: string; reason?: string },
  ) {
    return this.paymentService.rejectPayment(id, body.adminId, body.reason);
  }

  /**
   * POST /api/v1/admin/payments/batch-approve
   */
  @Post('payments/batch-approve')
  async batchApprove(
    @Body() body: { approvals: Array<{ refCode: string; adminId: string }> },
  ) {
    return this.adminService.batchApprove(body.approvals);
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
}
