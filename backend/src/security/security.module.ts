import { Module, Global } from '@nestjs/common';
import { FraudDetectionService } from './fraud-detection.service';

/**
 * Security Module
 * Provides fraud detection and security features
 */
@Global()
@Module({
  providers: [FraudDetectionService],
  exports: [FraudDetectionService],
})
export class SecurityModule {}
