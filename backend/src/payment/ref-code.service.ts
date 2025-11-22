import { Injectable } from '@nestjs/common';
import { customAlphabet } from 'nanoid';

@Injectable()
export class RefCodeService {
  private nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

  /**
   * Unique ref kod üret: PAY + 6 karakter
   * Örnek: PAYK3M9N2
   */
  generate(): string {
    return `PAY${this.nanoid()}`;
  }

  /**
   * Ref kod geçerli mi?
   */
  validate(code: string): boolean {
    return /^PAY[A-Z0-9]{6}$/.test(code);
  }
}
