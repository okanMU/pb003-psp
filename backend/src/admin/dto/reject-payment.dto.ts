import { IsString, IsOptional } from 'class-validator';

export class RejectPaymentDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
