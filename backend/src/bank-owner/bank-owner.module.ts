import { Module } from '@nestjs/common';
import { BankOwnerController } from './bank-owner.controller';
import { BankOwnerService } from './bank-owner.service';
import { LoggerModule } from '../common/logger/logger.module';
import { CollateralModule } from '../collateral/collateral.module';

@Module({
  imports: [LoggerModule, CollateralModule],
  controllers: [BankOwnerController],
  providers: [BankOwnerService],
  exports: [BankOwnerService],
})
export class BankOwnerModule {}
