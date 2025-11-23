import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { WebhookService } from './webhook.service';
import { WebhookProcessor } from './webhook.processor';
import { WebhookScheduler } from './webhook.scheduler';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'webhook',
    }),
  ],
  providers: [WebhookService, WebhookProcessor, WebhookScheduler],
  exports: [WebhookService],
})
export class WebhookModule {}
