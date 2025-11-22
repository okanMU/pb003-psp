import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { PaymentService } from './payment.service';

@Processor('payment')
export class PaymentProcessor {
  constructor(private paymentService: PaymentService) {}

  @Process('expire-check')
  async handleExpireCheck(job: Job) {
    console.log('⏰ Checking expired payments...');
    await this.paymentService.expirePayments();
  }
}
