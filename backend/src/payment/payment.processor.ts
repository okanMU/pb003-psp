import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { PaymentService } from './payment.service';
import { PaymentConfirmationService } from './services/payment-confirmation.service';
import { LoggerService } from '../common/logger/logger.service';

@Processor('payment')
export class PaymentProcessor {
  constructor(
    private paymentService: PaymentService,
    private paymentConfirmation: PaymentConfirmationService,
    private logger: LoggerService,
  ) {
    this.logger.setContext('PaymentProcessor');
  }

  @Process('expire-check')
  async handleExpireCheck(job: Job) {
    this.logger.log('⏰ Checking expired payments...');
    await this.paymentService.expirePayments();
  }

  /**
   * Handle payment approval timeout
   * Auto-rejects if bank owner doesn't approve within 5 minutes
   */
  @Process('payment-approval-timeout')
  async handleApprovalTimeout(job: Job<{ transactionId: string; deadline: string }>) {
    const { transactionId, deadline } = job.data;
    this.logger.log(
      `⏰ Processing approval timeout for transaction ${transactionId} (deadline: ${deadline})`,
    );

    await this.paymentConfirmation.handleApprovalTimeout(transactionId);
  }
}
