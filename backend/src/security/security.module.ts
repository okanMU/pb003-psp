import { Module, Global } from '@nestjs/common';
import { FraudDetectionService } from './fraud-detection.service';
import { FraudDetectionServiceRefactored } from './fraud-detection-refactored.service';
import { FraudModule } from './fraud/fraud.module';
import { LoggerModule } from '../common/logger/logger.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

/**
 * Security Module
 * Provides fraud detection and security features
 * Now with refactored Strategy Pattern-based fraud detection
 */
@Global()
@Module({
  imports: [FraudModule, LoggerModule, PrismaModule, RedisModule],
  providers: [
    // Keep old service for backward compatibility
    FraudDetectionService,
    // New refactored service
    FraudDetectionServiceRefactored,
    // Alias for gradual migration
    {
      provide: 'FraudDetection',
      useExisting: FraudDetectionServiceRefactored,
    },
  ],
  exports: [
    FraudDetectionService,
    FraudDetectionServiceRefactored,
    'FraudDetection',
  ],
})
export class SecurityModule {}
