import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class CommissionService {
  private pspRate: number;

  constructor(private config: ConfigService) {
    this.pspRate = parseFloat(
      this.config.get('PSP_COMMISSION_RATE', '0.005'),
    );
  }

  /**
   * Komisyon hesaplama
   *
   * Örnek: 1000 TRY ödeme, platform komisyonu %1.5
   * - Platform komisyonu: 15 TRY
   * - PSP komisyonu: 5 TRY (1000 * 0.005)
   * - Net tutar: 980 TRY (1000 - 15 - 5)
   */
  calculate(amount: number | Decimal, platformRate: number | Decimal) {
    const amt = typeof amount === 'number' ? amount : parseFloat(amount.toString());
    const rate = typeof platformRate === 'number' ? platformRate : parseFloat(platformRate.toString());

    const platformCommission = amt * rate;
    const pspCommission = amt * this.pspRate;
    const netAmount = amt - platformCommission - pspCommission;

    return {
      amount: amt,
      platformCommission: parseFloat(platformCommission.toFixed(2)),
      pspCommission: parseFloat(pspCommission.toFixed(2)),
      netAmount: parseFloat(netAmount.toFixed(2)),
      totalCommission: parseFloat((platformCommission + pspCommission).toFixed(2)),
    };
  }
}
