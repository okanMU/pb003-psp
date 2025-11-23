import { Module } from '@nestjs/common';
import { PaymentGateway } from './payment.gateway';
import { AdminGateway } from './admin.gateway';
import { BankOwnerGateway } from './bank-owner.gateway';

@Module({
  providers: [PaymentGateway, AdminGateway, BankOwnerGateway],
  exports: [PaymentGateway, AdminGateway, BankOwnerGateway],
})
export class WebsocketModule {}
