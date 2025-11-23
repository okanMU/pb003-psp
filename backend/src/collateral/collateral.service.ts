import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { LoggerService } from '../common/logger/logger.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class CollateralService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private logger: LoggerService,
  ) {
    this.logger.setContext('CollateralService');
  }

  /**
   * Teminatı kilitle (5 dakika)
   * Race condition önleme ile atomik işlem
   */
  async lockCollateral(
    bankId: string,
    transactionId: string,
    amount: number,
  ): Promise<any> {
    this.logger.log(
      `Locking collateral: ${amount} TRY for transaction ${transactionId} on bank ${bankId}`,
    );

    // Redis distributed lock (race condition önleme)
    const lockKey = `bank:lock:${bankId}`;
    const lockAcquired = await this.redis.getClient().set(
      lockKey,
      transactionId,
      'EX',
      10, // 10 saniye timeout
      'NX', // Only if not exists
    );

    if (!lockAcquired) {
      this.logger.warn(`Failed to acquire lock for bank ${bankId}`);
      throw new BadRequestException(
        'Bu hesap şu anda başka bir işlemde kullanılıyor, lütfen bekleyin',
      );
    }

    try {
      // Atomik transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Banka durumunu kontrol et
        const bank = await tx.bank.findUnique({
          where: { id: bankId },
        });

        if (!bank) {
          throw new BadRequestException('Banka hesabı bulunamadı');
        }

        if (!bank.is_active) {
          throw new BadRequestException('Banka hesabı aktif değil');
        }

        if (bank.is_suspended) {
          throw new BadRequestException('Banka hesabı askıda');
        }

        // 2. Yeterli teminat var mı?
        const availableCollateral = parseFloat(
          bank.available_collateral.toString(),
        );
        if (availableCollateral < amount) {
          throw new BadRequestException(
            `Yetersiz teminat. Mevcut: ${availableCollateral} TRY, Gerekli: ${amount} TRY`,
          );
        }

        // 3. Kilit oluştur
        const lock = await tx.collateralLock.create({
          data: {
            bank_id: bankId,
            transaction_id: transactionId,
            locked_amount: amount,
            expires_at: new Date(Date.now() + 5 * 60 * 1000), // 5 dakika
            status: 'ACTIVE',
          },
        });

        // 4. Banka teminatını güncelle
        const updatedBank = await tx.bank.update({
          where: { id: bankId },
          data: {
            used_collateral: {
              increment: amount,
            },
            available_collateral: {
              decrement: amount,
            },
          },
        });

        // 5. Teminat doldu mu? Askıya al
        const newAvailable = parseFloat(
          updatedBank.available_collateral.toString(),
        );
        if (newAvailable <= 0) {
          await tx.bank.update({
            where: { id: bankId },
            data: { is_suspended: true },
          });

          this.logger.warn(`Bank ${bankId} suspended - collateral full`);

          // WebSocket bildirimi (async)
          setImmediate(() => {
            this.notifyCollateralFull(updatedBank);
          });
        }

        return { lock, bank: updatedBank };
      });

      // Redis cache güncelle (real-time)
      await this.updateBankCache(result.bank);

      // Pub/Sub bildir (real-time)
      await this.redis.publish('collateral:locked', {
        transaction_id: transactionId,
        bank_id: bankId,
        bank_name: result.bank.name,
        amount,
        available_collateral: parseFloat(
          result.bank.available_collateral.toString(),
        ),
        is_suspended: result.bank.is_suspended,
      });

      this.logger.log(`Collateral locked successfully for transaction ${transactionId}`);

      return result.lock;
    } finally {
      // Redis lock'u serbest bırak
      await this.redis.getClient().del(lockKey);
    }
  }

  /**
   * Teminatı serbest bırak (transaction ID ile)
   */
  async releaseCollateral(bankId: string, transactionId: string): Promise<void> {
    this.logger.log(`Releasing collateral for transaction ${transactionId}`);

    await this.prisma.$transaction(async (tx) => {
      // 1. Kilidi bul
      const lock = await tx.collateralLock.findUnique({
        where: { transaction_id: transactionId },
        include: { bank: true },
      });

      if (!lock) {
        throw new BadRequestException('Kilit bulunamadı');
      }

      if (lock.status !== 'ACTIVE') {
        this.logger.warn(`Lock ${lockId} already released or expired`);
        return;
      }

      // 2. Kilidi güncelle
      await tx.collateralLock.update({
        where: { transaction_id: transactionId },
        data: {
          status: 'RELEASED',
          released_at: new Date(),
        },
      });

      // 3. Teminatı geri ver
      const updatedBank = await tx.bank.update({
        where: { id: lock.bank_id },
        data: {
          used_collateral: {
            decrement: lock.locked_amount,
          },
          available_collateral: {
            increment: lock.locked_amount,
          },
        },
      });

      // 4. Askı kaldır (eğer teminat yeterli olduysa)
      const newAvailable = parseFloat(
        updatedBank.available_collateral.toString(),
      );
      if (lock.bank.is_suspended && newAvailable > 0) {
        await tx.bank.update({
          where: { id: lock.bank_id },
          data: { is_suspended: false },
        });

        this.logger.log(`Bank ${lock.bank_id} reactivated`);

        // Bildirim
        setImmediate(() => {
          this.notifyBankReactivated(updatedBank);
        });
      }

      // Redis cache güncelle
      await this.updateBankCache(updatedBank);

      // Pub/Sub bildir
      await this.redis.publish('collateral:released', {
        transaction_id: lock.transaction_id,
        bank_id: lock.bank_id,
        bank_name: lock.bank.name,
        amount: parseFloat(lock.locked_amount.toString()),
        available_collateral: newAvailable,
        is_suspended: updatedBank.is_suspended,
      });

      this.logger.log(`Collateral released successfully for transaction ${lock.transaction_id}`);
    });
  }

  /**
   * Süresi dolan kilitleri temizle
   */
  async releaseExpiredLocks(): Promise<{ count: number }> {
    const expiredLocks = await this.prisma.collateralLock.findMany({
      where: {
        status: 'ACTIVE',
        expires_at: {
          lt: new Date(),
        },
      },
      select: {
        id: true,
        transaction_id: true,
        bank_id: true,
      },
    });

    let released = 0;
    for (const lock of expiredLocks) {
      try {
        // Mark as expired first
        await this.prisma.collateralLock.update({
          where: { id: lock.id },
          data: { status: 'EXPIRED' },
        });

        // Release collateral
        await this.releaseCollateral(lock.bank_id, lock.transaction_id);
        released++;
      } catch (error) {
        this.logger.error(
          `Failed to release expired lock ${lock.id}: ${error.message}`,
        );
      }
    }

    if (released > 0) {
      this.logger.log(`✅ Released ${released} expired collateral locks`);
    }

    return { count: released };
  }

  // Helper methods

  private async updateBankCache(bank: any): Promise<void> {
    await this.redis.set(`bank:${bank.id}`, bank, 3600); // 1 saat
  }

  private async notifyCollateralFull(bank: any): Promise<void> {
    await this.redis.publish('bank:suspended', {
      bank_id: bank.id,
      bank_name: bank.name,
      reason: 'Teminat limiti doldu',
    });
  }

  private async notifyBankReactivated(bank: any): Promise<void> {
    await this.redis.publish('bank:reactivated', {
      bank_id: bank.id,
      bank_name: bank.name,
      available_collateral: parseFloat(bank.available_collateral.toString()),
    });
  }
}
