import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PaymentModule } from '../payment/payment.module';
import { WebhookModule } from '../webhook/webhook.module';

@Module({
  imports: [PaymentModule, WebhookModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
