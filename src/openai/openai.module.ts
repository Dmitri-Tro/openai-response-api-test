import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CommonModule } from '../common/common.module';
import { OpenAIResponsesService } from './services/openai-responses.service';
import { ResponsesController } from './controllers/responses.controller';

@Module({
  imports: [
    HttpModule.register({
      timeout: 60000,
      maxRedirects: 3,
    }),
    CommonModule,
  ],
  controllers: [ResponsesController],
  providers: [OpenAIResponsesService],
  exports: [OpenAIResponsesService],
})
export class OpenAIModule {}
