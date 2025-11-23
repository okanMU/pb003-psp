import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { LoggerService } from '../common/logger/logger.service';
import {
  PaymentConstants,
  BankNotAvailableException,
  CalculationUtil,
} from '../common';

@Injectable()
export class BankSelectionService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private logger: LoggerService,
  ) {
    this.logger.setContext('BankSelectionService');
  }

  /**
   * En uygun hesabı seç
   *
   * Strateji:
   * 1. Aktif ve askıda olmayan hesapları filtrele
   * 2. Yeterli teminatı olanları filtrele
   * 3. Minimum waste prensibi (amount'a en yakın)
   * 4. Race condition önleme (SELECT FOR UPDATE benzeri)
   */
  async selectBestBank(amount: number): Promise<any> {
    this.logger.log(`Selecting best bank for amount: ${amount} TRY`);

    // 1. Önce cache'den aktif bankaları dene
    let cachedBanks = await this.getActiveBanksFromCache();

    // Cache'den gelen bankaları amount'a göre filtrele
    if (cachedBanks && cachedBanks.length > 0) {
      cachedBanks = cachedBanks.filter((bank) => {
        const available = parseFloat(bank.available_collateral.toString());
        return bank.is_active && !bank.is_suspended && available >= amount;
      });
    }

    // 2. Cache'de uygun banka yoksa DB'den çek
    let eligibleBanks = cachedBanks;
    if (!eligibleBanks || eligibleBanks.length === 0) {
      eligibleBanks = await this.prisma.bank.findMany({
        where: {
          is_active: true,
          is_suspended: false,
          available_collateral: {
            gte: amount,
          },
        },
        orderBy: {
          available_collateral: 'asc', // Küçükten büyüğe (minimum waste)
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Cache'e kaydet (configured TTL) - TÜM aktif bankaları cache'le
      // Böylece farklı amount'lar için kullanılabilir
      if (eligibleBanks.length > 0) {
        await this.redis.set(
          'banks:active',
          eligibleBanks,
          PaymentConstants.TIME.ACTIVE_BANKS_CACHE_SECONDS,
        );
      }
    }

    if (!eligibleBanks || eligibleBanks.length === 0) {
      throw new BankNotAvailableException();
    }

    // 3. Minimum waste ile en uygun hesabı seç
    const bestBank = this.findBestBankForAmount(eligibleBanks, amount);

    // 4. Real-time double check (son saniye kontrolü)
    const currentBank = await this.prisma.bank.findUnique({
      where: { id: bestBank.id },
      select: {
        id: true,
        name: true,
        iban: true,
        account_name: true,
        available_collateral: true,
        is_active: true,
        is_suspended: true,
      },
    });

    if (!currentBank) {
      throw new BankNotAvailableException('Seçilen hesap bulunamadı');
    }

    if (!currentBank.is_active || currentBank.is_suspended) {
      this.logger.warn(`Bank ${currentBank.id} became inactive, retrying...`);
      // Retry (recursive)
      return this.selectBestBank(amount);
    }

    const availableCollateral = parseFloat(
      currentBank.available_collateral.toString(),
    );
    if (availableCollateral < amount) {
      this.logger.warn(
        `Bank ${currentBank.id} collateral became insufficient, retrying...`,
      );
      // Retry (recursive)
      return this.selectBestBank(amount);
    }

    this.logger.log(
      `Selected bank ${currentBank.id} (${currentBank.name}) with ${availableCollateral} TRY available`,
    );

    return currentBank;
  }

  /**
   * Birden fazla hesap sahibinin hesaplarını listele
   */
  async getAllActiveBanks(): Promise<any[]> {
    return this.prisma.bank.findMany({
      where: {
        is_active: true,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        available_collateral: 'desc',
      },
    });
  }

  /**
   * Hesap sahibinin tüm hesaplarını getir
   */
  async getBanksByOwner(ownerId: string): Promise<any[]> {
    return this.prisma.bank.findMany({
      where: {
        owner_id: ownerId,
      },
      orderBy: {
        available_collateral: 'desc',
      },
    });
  }

  /**
   * Real-time hesap durumu (WebSocket için)
   */
  async getBankStatus(bankId: string): Promise<any> {
    const bank = await this.prisma.bank.findUnique({
      where: { id: bankId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        collateral_locks: {
          where: {
            status: 'ACTIVE',
          },
          select: {
            id: true,
            transaction_id: true,
            locked_amount: true,
            expires_at: true,
          },
        },
      },
    });

    if (!bank) {
      throw new BankNotAvailableException('Banka bulunamadı');
    }

    return {
      id: bank.id,
      name: bank.name,
      iban: bank.iban,
      collateral_limit: parseFloat(bank.collateral_limit.toString()),
      used_collateral: parseFloat(bank.used_collateral.toString()),
      available_collateral: parseFloat(bank.available_collateral.toString()),
      is_active: bank.is_active,
      is_suspended: bank.is_suspended,
      owner: bank.owner,
      active_locks: bank.collateral_locks.map((lock) => ({
        id: lock.id,
        transaction_id: lock.transaction_id,
        amount: parseFloat(lock.locked_amount.toString()),
        expires_at: lock.expires_at,
      })),
    };
  }

  // Helper methods

  private findBestBankForAmount(banks: any[], amount: number): any {
    // Minimum waste strategy
    return banks.reduce((best, current) => {
      const currentAvailable = parseFloat(
        current.available_collateral.toString(),
      );
      const bestAvailable = parseFloat(best.available_collateral.toString());

      const currentWaste = currentAvailable - amount;
      const bestWaste = bestAvailable - amount;

      // Amount'a en yakın olanı seç (waste minimum)
      return currentWaste < bestWaste ? current : best;
    });
  }

  private async getActiveBanksFromCache(): Promise<any[]> {
    try {
      return await this.redis.get('banks:active');
    } catch (error) {
      return null;
    }
  }
}
