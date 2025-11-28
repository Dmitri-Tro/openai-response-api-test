import {
  Body,
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { OpenAIResponsesService } from '../services/openai-responses.service';
import { CreateTextResponseDto } from '../dto/create-text-response.dto';
import { CreateImageResponseDto } from '../dto/create-image-response.dto';

@ApiTags('Responses API')
@Controller('api/responses')
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

  @Post('text/stream')
  @ApiOperation({
    summary: 'Generate text response (streaming with SSE)',
    description:
      'Creates a streaming text completion using OpenAI Responses API with Server-Sent Events',
  })
  @ApiResponse({
    status: 201,
    description: 'Streaming started successfully',
    content: {
      'text/event-stream': {
        schema: {
          type: 'string',
          example:
            'event: text_delta\ndata: {"delta":"Hello","sequence":1}\n\nevent: done\ndata: {"sequence":2,"response":{"id":"resp_123","output_text":"Hello world"}}\n\n',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid OpenAI API key',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded',
  })
  async createTextResponseStream(
    @Body() dto: CreateTextResponseDto,
    @Res() res: Response,
  ) {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    try {
      // Get the streaming generator
      const stream = this.responsesService.createTextResponseStream(dto);

      // Process each event
      for await (const eventData of stream) {
        const sseMessage = `event: ${eventData.event}\ndata: ${eventData.data}\n\n`;
        res.write(sseMessage);
      }

      // End the stream
      res.end();
    } catch (error) {
      // Send error event and close connection
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      res.write(
        `event: error\ndata: ${JSON.stringify({ error: errorMessage })}\n\n`,
      );
      res.end();
    }
  }

  @Post('images')
  @ApiOperation({
    summary: 'Generate image using gpt-image-1',
    description:
      'Creates an image using OpenAI Responses API with gpt-image-1 model. Returns base64-encoded image data.',
  })
  @ApiResponse({
    status: 201,
    description: 'Image generation successful',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'resp_123456' },
        output_text: {
          type: 'string',
          example: 'data:image/png;base64,iVBORw0KGgoAAAANSU...',
        },
        usage: {
          type: 'object',
          properties: {
            input_tokens: { type: 'number', example: 50 },
            output_tokens: { type: 'number', example: 0 },
            total_tokens: { type: 'number', example: 50 },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid OpenAI API key',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded',
  })
  async createImageResponse(@Body() dto: CreateImageResponseDto) {
    return this.responsesService.createImageResponse(dto);
  }

  @Post('images/stream')
  @ApiOperation({
    summary: 'Generate image with streaming',
    description:
      'Creates an image using gpt-image-1 with progressive rendering. Streams partial images as they are generated for better user experience.',
  })
  @ApiResponse({
    status: 201,
    description: 'Streaming started successfully',
    content: {
      'text/event-stream': {
        schema: {
          type: 'string',
          example:
            'event: image_generation_call.in_progress\ndata: {"call_id":"img_123","sequence":1}\n\nevent: image_generation_call.partial_image\ndata: {"call_id":"img_123","image_data":"data:image/png;base64,iVBORw0...","partial_index":0,"sequence":2}\n\nevent: image_generation_call.completed\ndata: {"call_id":"img_123","sequence":3}\n\n',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid OpenAI API key',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded',
  })
  async createImageResponseStream(
    @Body() dto: CreateImageResponseDto,
    @Res() res: Response,
  ) {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    try {
      // Get the streaming generator
      const stream = this.responsesService.createImageResponseStream(dto);

      // Process each event
      for await (const eventData of stream) {
        const sseMessage = `event: ${eventData.event}\ndata: ${eventData.data}\n\n`;
        res.write(sseMessage);
      }

      // End the stream
      res.end();
    } catch (error) {
      // Send error event and close connection
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      res.write(
        `event: error\ndata: ${JSON.stringify({ error: errorMessage })}\n\n`,
      );
      res.end();
    }
  }

  @Get(':id/stream')
  @ApiOperation({
    summary: 'Resume streaming response by ID',
    description:
      'Resumes streaming a previously stored response from a specific sequence number. Useful when a streaming connection is interrupted and needs to be resumed from where it left off.',
  })
  @ApiResponse({
    status: 200,
    description: 'Streaming resumed successfully',
    content: {
      'text/event-stream': {
        schema: {
          type: 'string',
          example:
            'event: text_delta\ndata: {"delta":"continued text","sequence":15}\n\nevent: done\ndata: {"sequence":20,"response":{"id":"resp_123"}}\n\n',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Response not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid OpenAI API key',
  })
  async resumeResponseStream(@Param('id') id: string, @Res() res: Response) {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      // Get the streaming generator
      const stream = this.responsesService.resumeResponseStream(id);

      // Process each event
      for await (const eventData of stream) {
        const sseMessage = `event: ${eventData.event}\ndata: ${eventData.data}\n\n`;
        res.write(sseMessage);
      }

      // End the stream
      res.end();
    } catch (error) {
      // Send error event and close connection
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      res.write(
        `event: error\ndata: ${JSON.stringify({ error: errorMessage })}\n\n`,
      );
      res.end();
    }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Retrieve stored response by ID',
    description:
      'Retrieves a previously stored response by its ID. Responses are automatically stored for 30 days when created with store=true parameter.',
  })
  @ApiResponse({
    status: 200,
    description: 'Response retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'resp_abc123' },
        object: { type: 'string', example: 'response' },
        output_text: { type: 'string', example: 'The retrieved response text' },
        status: { type: 'string', example: 'completed' },
        usage: {
          type: 'object',
          properties: {
            input_tokens: { type: 'number', example: 15 },
            output_tokens: { type: 'number', example: 150 },
            total_tokens: { type: 'number', example: 165 },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Response not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid OpenAI API key',
  })
  async retrieveResponse(@Param('id') id: string) {
    return this.responsesService.retrieve(id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete stored response by ID',
    description:
      'Deletes a stored response permanently. This action cannot be undone. Only responses that belong to your account can be deleted.',
  })
  @ApiResponse({
    status: 200,
    description: 'Response deleted successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'resp_abc123' },
        deleted: { type: 'boolean', example: true },
        object: { type: 'string', example: 'response' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Response not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid OpenAI API key',
  })
  async deleteResponse(@Param('id') id: string) {
    return this.responsesService.delete(id);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancel background response by ID',
    description:
      'Cancels a response that is running in the background. Only works for responses created with background=true parameter. Once canceled, the response will have status="cancelled".',
  })
  @ApiResponse({
    status: 200,
    description: 'Response canceled successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'resp_abc123' },
        object: { type: 'string', example: 'response' },
        status: { type: 'string', example: 'cancelled' },
        output_text: {
          type: 'string',
          example: 'Partial output before cancel',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Not a background response or already completed',
  })
  @ApiResponse({
    status: 404,
    description: 'Response not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid OpenAI API key',
  })
  async cancelResponse(@Param('id') id: string) {
    return this.responsesService.cancel(id);
  }
}
