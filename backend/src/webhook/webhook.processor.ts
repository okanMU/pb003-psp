import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookStatus } from '@prisma/client';
import axios from 'axios';
import * as crypto from 'crypto';

@Processor('webhook')
export class WebhookProcessor {
  constructor(private prisma: PrismaService) {}

  @Process('send')
  async handleSendWebhook(job: Job) {
    const { webhookLogId, url, secret, payload } = job.data;

    try {
      // Signature oluştur (HMAC SHA256)
      const signature = this.generateSignature(payload, secret);

      // HTTP POST gönder
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'User-Agent': 'PSPay-Webhook/1.0',
        },
        timeout: 10000, // 10 saniye
      });

      // Başarılı
      await this.prisma.webhookLog.update({
        where: { id: webhookLogId },
        data: {
          status: WebhookStatus.SENT,
          response_code: response.status,
          response_body: JSON.stringify(response.data).substring(0, 1000),
          attempts: { increment: 1 },
        },
      });

      console.log(`✅ Webhook sent successfully: ${webhookLogId}`);
    } catch (error) {
      // Hata
      await this.prisma.webhookLog.update({
        where: { id: webhookLogId },
        data: {
          status: WebhookStatus.FAILED,
          response_code: error.response?.status,
          error_message: error.message,
          attempts: { increment: 1 },
          next_retry_at: new Date(Date.now() + 5 * 60 * 1000), // 5 dakika sonra
        },
      });

      console.error(`❌ Webhook failed: ${webhookLogId} - ${error.message}`);

      // Retry (max 3 deneme)
      const log = await this.prisma.webhookLog.findUnique({
        where: { id: webhookLogId },
      });

      if (log.attempts < 3) {
        // Tekrar kuyruğa ekle (5 dakika delay)
        throw new Error('Retry webhook'); // Bull otomatik retry yapar
      }
    }
  }

  private generateSignature(payload: any, secret: string): string {
    const data = JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }
}
