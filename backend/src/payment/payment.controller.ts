import { Controller, Post, Get, Body, Param, Req, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentConfirmationService } from './services/payment-confirmation.service';
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
  constructor(
    private paymentService: PaymentService,
    private paymentConfirmation: PaymentConfirmationService,
  ) {}

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

  /**
   * POST /api/v1/payments/confirm/:id
   * Customer confirms "I've made the payment"
   * Starts 5-minute countdown for bank owner approval
   */
  @Post('confirm/:id')
  async confirmPayment(@Param('id') transactionId: string) {
    return this.paymentConfirmation.confirmPaymentSent(transactionId);
  }

  /**
   * GET /api/v1/payments/status/:id
   * Get real-time payment status with countdown
   */
  @Get('status/:id')
  async getPaymentStatus(@Param('id') transactionId: string) {
    return this.paymentConfirmation.getPaymentStatus(transactionId);
  }
}
