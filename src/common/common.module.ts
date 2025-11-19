import { Module, Global } from '@nestjs/common';
import { LoggerService } from './services/logger.service';
import { PricingService } from './services/pricing.service';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { OpenAIExceptionFilter } from './filters/openai-exception.filter';

@Global()
@Module({
  providers: [
    LoggerService,
    PricingService,
    LoggingInterceptor,
    OpenAIExceptionFilter,
  ],
  exports: [
    LoggerService,
    PricingService,
    LoggingInterceptor,
    OpenAIExceptionFilter,
  ],
})
export class CommonModule {}
