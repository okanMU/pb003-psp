import { Module } from '@nestjs/common';
import { PaymentGateway } from './payment.gateway';
import { AdminGateway } from './admin.gateway';

@Module({
  providers: [PaymentGateway, AdminGateway],
  exports: [PaymentGateway, AdminGateway],
})
export class WebsocketModule {}
