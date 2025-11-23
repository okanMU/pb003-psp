import { Controller, Post, Get, Body, Param, Req, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { Public } from '../auth/decorators/public.decorator';

interface RequestWithPlatform extends Request {
  platformId?: string;
  platform?: any;
}

@Public() // Payment endpoints use API key authentication, not JWT
@Controller('payments')
export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  /**
   * POST /api/v1/payments
   * Yeni ödeme oluştur (SDK'dan çağrılır)
   */
  @Post()
  @UseGuards(ApiKeyGuard)
  async create(
    @Body() dto: CreatePaymentDto,
    @Req() req: RequestWithPlatform,
  ) {
    const platformId = req.platformId;
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
