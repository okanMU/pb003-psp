import { IsArray, ArrayMinSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsString } from 'class-validator';

export class ApprovalItemDto {
  @IsString()
  refCode: string;

  @IsString()
  adminId: string;
}

export class BatchApproveDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ApprovalItemDto)
  approvals: ApprovalItemDto[];
}
