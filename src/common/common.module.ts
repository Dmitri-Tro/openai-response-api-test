import { Module, Global } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerService } from './services/logger.service';
import { PricingService } from './services/pricing.service';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { RetryInterceptor } from './interceptors/retry.interceptor';
import { OpenAIExceptionFilter } from './filters/openai-exception.filter';

@Global()
@Module({
  providers: [
    LoggerService,
    PricingService,
    // Global interceptors (singleton instances)
    {
      provide: APP_INTERCEPTOR,
      useClass: RetryInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    // Global exception filter (singleton instance)
    {
      provide: APP_FILTER,
      useClass: OpenAIExceptionFilter,
    },
  ],
  exports: [LoggerService, PricingService],
})
export class CommonModule {}
