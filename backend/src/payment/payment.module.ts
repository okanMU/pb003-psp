import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { RefCodeService } from './ref-code.service';
import { CommissionService } from './commission.service';
import { PaymentProcessor } from './payment.processor';
import { PaymentScheduler } from './payment.scheduler';
import { OrphanDetectionService } from './orphan-detection.service';
import { CollateralModule } from '../collateral/collateral.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'payment',
    }),
    CollateralModule,
  ],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    RefCodeService,
    CommissionService,
    PaymentProcessor,
    PaymentScheduler,
    OrphanDetectionService,
  ],
  exports: [PaymentService, OrphanDetectionService],
})
export class PaymentModule {}
