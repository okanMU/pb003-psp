import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { RefCodeService } from './ref-code.service';
import { CommissionService } from './commission.service';
import { PaymentProcessor } from './payment.processor';
import { PaymentScheduler } from './payment.scheduler';
import { OrphanDetectionService } from './orphan-detection.service';
import { PaymentCreatorService } from './services/payment-creator.service';
import { PaymentApprovalService } from './services/payment-approval.service';
import { PaymentCancellationService } from './services/payment-cancellation.service';
import { CollateralModule } from '../collateral/collateral.module';
import { LoggerModule } from '../common/logger/logger.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'payment',
    }),
    CollateralModule,
    LoggerModule,
    SecurityModule,
  ],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    RefCodeService,
    CommissionService,
    PaymentProcessor,
    PaymentScheduler,
    OrphanDetectionService,
    PaymentCreatorService,
    PaymentApprovalService,
    PaymentCancellationService,
  ],
  exports: [PaymentService, OrphanDetectionService],
})
export class PaymentModule {}
