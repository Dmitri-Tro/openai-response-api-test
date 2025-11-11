import {
  Body,
  Controller,
  Post,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OpenAIResponsesService } from '../services/openai-responses.service';
import { CreateTextResponseDto } from '../dto/create-text-response.dto';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { OpenAIExceptionFilter } from '../../common/filters/openai-exception.filter';

@ApiTags('Responses API')
@Controller('api/responses')
@UseInterceptors(LoggingInterceptor)
@UseFilters(OpenAIExceptionFilter)
export class ResponsesController {
  constructor(private readonly responsesService: OpenAIResponsesService) {}

  @Post('text')
  @ApiOperation({
    summary: 'Generate text response (non-streaming)',
    description:
      'Creates a text completion using OpenAI Responses API with full response logging',
  })
  @ApiResponse({
    status: 201,
    description: 'Text generation successful',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid OpenAI API key',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded',
  })
  async createTextResponse(@Body() dto: CreateTextResponseDto) {
    return this.responsesService.createTextResponse(dto);
  }
}
