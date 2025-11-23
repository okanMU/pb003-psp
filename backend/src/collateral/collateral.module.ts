import { Module } from '@nestjs/common';
import { CollateralService } from './collateral.service';
import { BankSelectionService } from './bank-selection.service';

@Module({
  providers: [CollateralService, BankSelectionService],
  exports: [CollateralService, BankSelectionService],
})
export class CollateralModule {}
