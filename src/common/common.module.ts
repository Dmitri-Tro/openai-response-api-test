import { Module, Global } from '@nestjs/common';
import { LoggerService } from './services/logger.service';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { OpenAIExceptionFilter } from './filters/openai-exception.filter';

@Global()
@Module({
  providers: [LoggerService, LoggingInterceptor, OpenAIExceptionFilter],
  exports: [LoggerService, LoggingInterceptor, OpenAIExceptionFilter],
})
export class CommonModule {}
