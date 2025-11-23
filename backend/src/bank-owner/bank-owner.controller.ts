import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { BankOwnerService } from './bank-owner.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

/**
 * Bank Owner Controller
 * Endpoints for bank account owners to manage their accounts and approve payments
 */
@Controller('bank-owner')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BANK_OWNER)
export class BankOwnerController {
  constructor(private bankOwnerService: BankOwnerService) {}

  /**
   * GET /api/v1/bank-owner/dashboard
   * Get bank owner dashboard with real-time collateral data
   */
  @Get('dashboard')
  async getDashboard(@CurrentUser('id') ownerId: string) {
    return this.bankOwnerService.getDashboard(ownerId);
  }

  /**
   * GET /api/v1/bank-owner/account/:accountId
   * Get real-time status of a specific account
   */
  @Get('account/:accountId')
  async getAccountStatus(
    @Param('accountId') accountId: string,
    @CurrentUser('id') ownerId: string,
  ) {
    return this.bankOwnerService.getAccountStatus(accountId, ownerId);
  }

  /**
   * POST /api/v1/bank-owner/approve-payment
   * Approve payment (confirm money received)
   */
  @Post('approve-payment')
  async approvePayment(
    @Body() body: { transaction_id: string; notes?: string },
    @CurrentUser('id') ownerId: string,
  ) {
    return this.bankOwnerService.approvePayment(
      body.transaction_id,
      ownerId,
      body.notes,
    );
  }

  /**
   * POST /api/v1/bank-owner/reject-payment
   * Reject payment (confirm money NOT received)
   */
  @Post('reject-payment')
  async rejectPayment(
    @Body() body: { transaction_id: string; reason?: string },
    @CurrentUser('id') ownerId: string,
  ) {
    return this.bankOwnerService.rejectPayment(
      body.transaction_id,
      ownerId,
      body.reason,
    );
  }
}
