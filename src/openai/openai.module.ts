import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CommonModule } from '../common/common.module';
import { OpenAIClientProvider } from './providers/openai-client.provider';
import { OpenAIResponsesService } from './services/openai-responses.service';
import { OpenAIVideosService } from './services/openai-videos.service';
import { OpenAIFilesService } from './services/openai-files.service';
import { OpenAIVectorStoresService } from './services/openai-vector-stores.service';
import { OpenAIImagesService } from './services/openai-images.service';
import { OpenAIAudioService } from './services/openai-audio.service';
import { ResponsesController } from './controllers/responses.controller';
import { VideosController } from './controllers/videos.controller';
import { FilesController } from './controllers/files.controller';
import { VectorStoresController } from './controllers/vector-stores.controller';
import { ImagesController } from './controllers/images.controller';
import { AudioController } from './controllers/audio.controller';
import { LifecycleEventsHandler } from './services/handlers/lifecycle-events.handler';
import { TextEventsHandler } from './services/handlers/text-events.handler';
import { ReasoningEventsHandler } from './services/handlers/reasoning-events.handler';
import { ToolCallingEventsHandler } from './services/handlers/tool-calling-events.handler';
import { ImageEventsHandler } from './services/handlers/image-events.handler';
import { AudioEventsHandler } from './services/handlers/audio-events.handler';
import { MCPEventsHandler } from './services/handlers/mcp-events.handler';
import { RefusalEventsHandler } from './services/handlers/refusal-events.handler';
import { StructuralEventsHandler } from './services/handlers/structural-events.handler';
import { ComputerUseEventsHandler } from './services/handlers/computer-use-events.handler';

@Module({
  imports: [
    HttpModule.register({
      timeout: 60000,
      maxRedirects: 3,
    }),
    CommonModule,
  ],
  controllers: [
    ResponsesController,
    VideosController,
    FilesController,
    VectorStoresController,
    ImagesController,
    AudioController,
  ],
  providers: [
    OpenAIClientProvider,
    OpenAIResponsesService,
    OpenAIVideosService,
    OpenAIFilesService,
    OpenAIVectorStoresService,
    OpenAIImagesService,
    OpenAIAudioService,
    LifecycleEventsHandler,
    TextEventsHandler,
    ReasoningEventsHandler,
    ToolCallingEventsHandler,
    ImageEventsHandler,
    AudioEventsHandler,
    MCPEventsHandler,
    RefusalEventsHandler,
    StructuralEventsHandler,
    ComputerUseEventsHandler,
  ],
  exports: [
    OpenAIResponsesService,
    OpenAIVideosService,
    OpenAIFilesService,
    OpenAIVectorStoresService,
    OpenAIImagesService,
    OpenAIAudioService,
  ],
})
export class OpenAIModule {}
