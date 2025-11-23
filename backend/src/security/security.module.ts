import { Module, Global } from '@nestjs/common';
import { FraudDetectionServiceRefactored } from './fraud-detection-refactored.service';
import { FraudModule } from './fraud/fraud.module';
import { LoggerModule } from '../common/logger/logger.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

/**
 * Security Module
 * Provides fraud detection and security features
 * Using Strategy Pattern-based fraud detection with FraudRuleEngine
 */
@Global()
@Module({
  imports: [FraudModule, LoggerModule, PrismaModule, RedisModule],
  providers: [
    // Strategy Pattern-based fraud detection service
    FraudDetectionServiceRefactored,
    // Alias for convenience
    {
      provide: 'FraudDetection',
      useExisting: FraudDetectionServiceRefactored,
    },
  ],
  exports: [
    FraudDetectionServiceRefactored,
    'FraudDetection',
  ],
})
export class SecurityModule {}
