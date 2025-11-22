import { IsNumber, IsString, IsOptional, IsEmail, Min, Max, IsObject } from 'class-validator';

export class CreatePaymentDto {
  @IsNumber()
  @Min(10)
  @Max(50000)
  amount: number;

  @IsString()
  @IsOptional()
  currency?: string = 'TRY';

  @IsEmail()
  @IsOptional()
  customer_email?: string;

  @IsString()
  @IsOptional()
  customer_phone?: string;

  @IsString()
  @IsOptional()
  customer_name?: string;

  @IsString()
  @IsOptional()
  platform_order_id?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
