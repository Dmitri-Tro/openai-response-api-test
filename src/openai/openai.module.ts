import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CommonModule } from '../common/common.module';
import { OpenAIResponsesService } from './services/openai-responses.service';
import { ResponsesController } from './controllers/responses.controller';
import { LifecycleEventsHandler } from './services/handlers/lifecycle-events.handler';
import { TextEventsHandler } from './services/handlers/text-events.handler';
import { ReasoningEventsHandler } from './services/handlers/reasoning-events.handler';
import { ToolCallingEventsHandler } from './services/handlers/tool-calling-events.handler';
import { ImageEventsHandler } from './services/handlers/image-events.handler';
import { AudioEventsHandler } from './services/handlers/audio-events.handler';
import { MCPEventsHandler } from './services/handlers/mcp-events.handler';
import { RefusalEventsHandler } from './services/handlers/refusal-events.handler';
import { StructuralEventsHandler } from './services/handlers/structural-events.handler';

@Module({
  imports: [
    HttpModule.register({
      timeout: 60000,
      maxRedirects: 3,
    }),
    CommonModule,
  ],
  controllers: [ResponsesController],
  providers: [
    OpenAIResponsesService,
    LifecycleEventsHandler,
    TextEventsHandler,
    ReasoningEventsHandler,
    ToolCallingEventsHandler,
    ImageEventsHandler,
    AudioEventsHandler,
    MCPEventsHandler,
    RefusalEventsHandler,
    StructuralEventsHandler,
  ],
  exports: [OpenAIResponsesService],
})
export class OpenAIModule {}
