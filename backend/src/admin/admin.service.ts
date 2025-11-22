import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentService } from '../payment/payment.service';
import { PaymentStatus } from '@prisma/client';
import * as dayjs from 'dayjs';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private paymentService: PaymentService,
  ) {}

  /**
   * Dashboard istatistikleri
   */
  async getDashboardStats() {
    const today = dayjs().startOf('day').toDate();
    const weekAgo = dayjs().subtract(7, 'day').toDate();

    // Bugünkü işlemler
    const todayTransactions = await this.prisma.transaction.aggregate({
      where: {
        created_at: { gte: today },
        status: PaymentStatus.APPROVED,
      },
      _sum: { amount: true },
      _count: true,
    });

    // Haftalık işlemler
    const weeklyTransactions = await this.prisma.transaction.aggregate({
      where: {
        created_at: { gte: weekAgo },
        status: PaymentStatus.APPROVED,
      },
      _sum: { amount: true },
      _count: true,
    });

    // Bekleyen işlemler
    const pending = await this.prisma.transaction.aggregate({
      where: {
        status: PaymentStatus.PENDING,
        expires_at: { gt: new Date() },
      },
      _sum: { amount: true },
      _count: true,
    });

    // Başarı oranı (bugün)
    const todayTotal = await this.prisma.transaction.count({
      where: { created_at: { gte: today } },
    });

    const successRate = todayTotal > 0
      ? ((todayTransactions._count / todayTotal) * 100).toFixed(1)
      : 0;

    // Toplam komisyon (bugün)
    const commissionData = await this.prisma.transaction.aggregate({
      where: {
        created_at: { gte: today },
        status: PaymentStatus.APPROVED,
      },
      _sum: {
        psp_commission: true,
      },
    });

    return {
      todayVolume: parseFloat(todayTransactions._sum.amount?.toString() || '0'),
      todayCount: todayTransactions._count,
      weeklyVolume: parseFloat(weeklyTransactions._sum.amount?.toString() || '0'),
      weeklyCount: weeklyTransactions._count,
      pendingCount: pending._count,
      pendingAmount: parseFloat(pending._sum.amount?.toString() || '0'),
      successRate: parseFloat(successRate.toString()),
      commissionEarned: parseFloat(commissionData._sum.psp_commission?.toString() || '0'),
    };
  }

  /**
   * Bekleyen ödemeleri banka bazlı grupla
   */
  async getPendingPayments() {
    const payments = await this.prisma.transaction.findMany({
      where: {
        status: PaymentStatus.PENDING,
        expires_at: { gt: new Date() },
      },
      include: {
        bank: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Banka bazlı grupla
    const grouped = payments.reduce((acc, payment) => {
      const bankId = payment.bank.id;

      if (!acc[bankId]) {
        acc[bankId] = {
          bankId: payment.bank.id,
          bankName: payment.bank.name,
          iban: payment.bank.iban,
          accountName: payment.bank.account_name,
          transactions: [],
          totalExpectedAmount: 0,
          transactionCount: 0,
        };
      }

      acc[bankId].transactions.push({
        id: payment.id,
        refCode: payment.transaction_code,
        amount: parseFloat(payment.amount.toString()),
        customerEmail: payment.customer_email,
        customerPhone: payment.customer_phone,
        createdAt: payment.created_at,
        expiresAt: payment.expires_at,
        remainingMinutes: this.calculateRemainingMinutes(payment.expires_at),
      });

      acc[bankId].totalExpectedAmount += parseFloat(payment.amount.toString());
      acc[bankId].transactionCount += 1;

      return acc;
    }, {});

    return Object.values(grouped);
  }

  /**
   * Toplu onaylama
   */
  async batchApprove(approvals: Array<{ refCode: string; adminId: string }>) {
    const results = [];

    for (const approval of approvals) {
      try {
        const transaction = await this.prisma.transaction.findFirst({
          where: {
            transaction_code: approval.refCode,
            status: PaymentStatus.PENDING,
          },
        });

        if (transaction) {
          await this.paymentService.approvePayment(
            transaction.id,
            approval.adminId,
          );

          results.push({
            refCode: approval.refCode,
            status: 'approved',
            message: 'Onaylandı',
          });
        } else {
          results.push({
            refCode: approval.refCode,
            status: 'error',
            message: 'İşlem bulunamadı veya zaten işlem görmüş',
          });
        }
      } catch (error) {
        results.push({
          refCode: approval.refCode,
          status: 'error',
          message: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Ref kod ile arama
   */
  async searchByRefCode(code: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { transaction_code: code },
      include: {
        bank: true,
        platform: true,
        approved_by: true,
        rejected_by: true,
      },
    });

    if (!transaction) {
      return null;
    }

    return {
      id: transaction.id,
      refCode: transaction.transaction_code,
      status: transaction.status,
      amount: parseFloat(transaction.amount.toString()),
      customerEmail: transaction.customer_email,
      customerPhone: transaction.customer_phone,
      bankName: transaction.bank.name,
      platformName: transaction.platform.name,
      createdAt: transaction.created_at,
      approvedAt: transaction.approved_at,
      approvedBy: transaction.approved_by?.email,
      rejectedAt: transaction.rejected_at,
      rejectedBy: transaction.rejected_by?.email,
      rejectionReason: transaction.rejection_reason,
    };
  }

  // Helper
  private calculateRemainingMinutes(expiresAt: Date): number {
    const now = dayjs();
    const expires = dayjs(expiresAt);
    const diff = expires.diff(now, 'minute');
    return diff > 0 ? diff : 0;
  }
}
