import { Controller, Post, Get, Body, Param, Req, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Request } from 'express';

@Controller('payments')
export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  /**
   * POST /api/v1/payments
   * Yeni ödeme oluştur (SDK'dan çağrılır)
   */
  @Post()
  async create(
    @Body() dto: CreatePaymentDto,
    @Req() req: Request,
  ) {
    // API key'den platform ID'yi al (gerçek uygulamada middleware)
    const platformId = req.headers['x-api-key'] as string;
    const customerIp = req.ip;

    return this.paymentService.createPayment(platformId, dto, customerIp);
  }

  /**
   * GET /api/v1/payments/:id
   * Ödeme durumu sorgula
   */
  @Get(':id')
  async get(@Param('id') id: string) {
    return this.paymentService.getPayment(id);
  }

  /**
   * GET /api/v1/payments/code/:code
   * Ref kod ile sorgula
   */
  @Get('code/:code')
  async getByCode(@Param('code') code: string) {
    return this.paymentService.getPaymentByCode(code);
  }
}
