import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { RefCodeService } from './ref-code.service';
import { CommissionService } from './commission.service';
import { PaymentProcessor } from './payment.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'payment',
    }),
  ],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    RefCodeService,
    CommissionService,
    PaymentProcessor,
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
