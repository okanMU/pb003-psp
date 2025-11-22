import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookStatus } from '@prisma/client';

@Injectable()
export class WebhookService {
  constructor(
    @InjectQueue('webhook') private webhookQueue: Queue,
    private prisma: PrismaService,
  ) {}

  /**
   * Webhook gönderme kuyruğuna ekle
   */
  async enqueue(
    platformId: string,
    eventType: string,
    payload: any,
    transactionId?: string,
  ) {
    // Platform webhook URL'ini al
    const platform = await this.prisma.platform.findUnique({
      where: { id: platformId },
    });

    if (!platform?.webhook_url) {
      console.log(`Platform ${platformId} has no webhook URL`);
      return;
    }

    // Webhook log oluştur
    const webhookLog = await this.prisma.webhookLog.create({
      data: {
        platform_id: platformId,
        transaction_id: transactionId,
        event_type: eventType,
        payload,
        status: WebhookStatus.PENDING,
      },
    });

    // Kuyruğa ekle
    await this.webhookQueue.add('send', {
      webhookLogId: webhookLog.id,
      url: platform.webhook_url,
      secret: platform.webhook_secret,
      payload,
    });

    console.log(`📬 Webhook enqueued: ${eventType} for platform ${platformId}`);
  }
}
