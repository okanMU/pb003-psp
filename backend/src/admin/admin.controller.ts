import { Controller, Get, Post, Body, Param, Patch } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PaymentService } from '../payment/payment.service';

@Controller('admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private paymentService: PaymentService,
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
}
