import {
  Body,
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { streamBinaryResponse } from '../../common/mixins/binary-streaming.mixin';
import type { Response } from 'express';
import type { Videos } from 'openai/resources/videos';
import { OpenAIVideosService } from '../services/openai-videos.service';
import { CreateVideoDto } from '../dto/create-video.dto';

/**
 * Controller for OpenAI Videos API
 * Handles async video generation with polling workflow
 */
@ApiTags('Videos API')
@Controller('api/videos')
export class VideosController {
  constructor(private readonly videosService: OpenAIVideosService) {}

  /**
   * Create video generation job
   * POST /api/videos
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create video generation job',
    description:
      'Submit a video generation request to OpenAI Videos API. Returns immediately with status: queued. ' +
      'Use GET /api/videos/:id to check status or GET /api/videos/:id/poll to wait for completion.',
  })
  @ApiBody({
    description: 'Video generation parameters',
    schema: {
      type: 'object',
      required: ['prompt'],
      properties: {
        prompt: {
          type: 'string',
          description:
            'Text description of the video to generate. Max 500 chars.',
          example:
            'A serene mountain landscape at sunset with birds flying over a lake',
          maxLength: 500,
        },
        model: {
          type: 'string',
          enum: ['sora-2', 'sora-2-pro'],
          description:
            'Video generation model. sora-2 (standard), sora-2-pro (professional).',
          default: 'sora-2',
          example: 'sora-2',
        },
        seconds: {
          type: 'string',
          enum: ['4', '8', '12'],
          description:
            'Duration in seconds (as string). "4", "8", or "12". Cost scales with duration.',
          default: '4',
          example: '4',
        },
        size: {
          type: 'string',
          enum: ['720x1280', '1280x720', '1024x1792', '1792x1024'],
          description:
            'Output resolution. Portrait (9:16) or Landscape (16:9).',
          default: '720x1280',
          example: '720x1280',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Video generation job created successfully (status: queued)',
  })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  @ApiResponse({ status: 401, description: 'Invalid or missing API key' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async createVideo(@Body() dto: CreateVideoDto): Promise<Videos.Video> {
    return this.videosService.createVideo(dto);
  }

  /**
   * Get current video status
   * GET /api/videos/:id
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get current video status',
    description:
      'Retrieve the current status of a video generation job. Status can be: queued, in_progress, completed, or failed.',
  })
  @ApiParam({
    name: 'id',
    description: 'Video ID (starts with "vid_")',
    example: 'vid_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Video status retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Video not found' })
  async getVideoStatus(@Param('id') id: string): Promise<Videos.Video> {
    return this.videosService.getVideoStatus(id);
  }

  /**
   * Poll until video generation completes
   * GET /api/videos/:id/poll
   */
  @Get(':id/poll')
  @ApiOperation({
    summary: 'Poll until video generation completes',
    description:
      'Wait for video generation to complete (status: completed or failed). ' +
      'Uses exponential backoff polling (5s → 10s → 15s → 20s max). ' +
      'Default timeout: 10 minutes (600000ms).',
  })
  @ApiParam({
    name: 'id',
    description: 'Video ID to poll',
    example: 'vid_abc123',
  })
  @ApiQuery({
    name: 'maxWaitMs',
    required: false,
    type: Number,
    description: 'Maximum time to wait in milliseconds (default: 600000)',
    example: 600000,
  })
  @ApiResponse({
    status: 200,
    description: 'Video generation completed (status: completed or failed)',
  })
  @ApiResponse({ status: 404, description: 'Video not found' })
  @ApiResponse({ status: 504, description: 'Polling timeout exceeded' })
  async pollUntilComplete(
    @Param('id') id: string,
    @Query('maxWaitMs') maxWaitMs?: number,
  ): Promise<Videos.Video> {
    return this.videosService.pollUntilComplete(id, maxWaitMs);
  }

  /**
   * Download completed video file or asset
   * GET /api/videos/:id/download
   */
  @Get(':id/download')
  @ApiOperation({
    summary: 'Download completed video file or asset',
    description:
      'Download the generated video file (MP4) or associated assets (thumbnail, spritesheet). ' +
      'Video must be in completed status. Assets expire after a period (check expires_at).',
  })
  @ApiParam({
    name: 'id',
    description: 'Video ID',
    example: 'vid_abc123',
  })
  @ApiQuery({
    name: 'variant',
    required: false,
    enum: ['video', 'thumbnail', 'spritesheet'],
    description: 'Download type (default: video)',
    example: 'video',
  })
  @ApiResponse({
    status: 200,
    description: 'Binary file download (MP4 or JPEG)',
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Video not ready (status not completed)',
  })
  @ApiResponse({
    status: 410,
    description: 'Video expired (assets no longer available)',
  })
  async downloadVideo(
    @Param('id') id: string,
    @Query('variant') variant: 'video' | 'thumbnail' | 'spritesheet' = 'video',
    @Res() res: Response,
  ): Promise<void> {
    const response = await this.videosService.downloadVideo(id, variant);

    // Set content type based on variant
    const contentType = variant === 'video' ? 'video/mp4' : 'image/jpeg';
    const extension = variant === 'video' ? 'mp4' : 'jpg';

    // Stream OpenAI response body to client using shared mixin
    await streamBinaryResponse(
      response,
      res,
      contentType,
      `${id}.${extension}`,
    );
  }

  /**
   * List all generated videos
   * GET /api/videos
   */
  @Get()
  @ApiOperation({
    summary: 'List all generated videos',
    description:
      'Retrieve a paginated list of all video generation jobs sorted by creation time.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of videos to return (default: 10)',
    example: 10,
  })
  @ApiQuery({
    name: 'order',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Sort order by created_at (default: desc)',
    example: 'desc',
  })
  @ApiResponse({
    status: 200,
    description: 'List of videos retrieved successfully',
  })
  async listVideos(
    @Query('limit') limit?: number,
    @Query('order') order?: 'asc' | 'desc',
  ): Promise<Videos.Video[]> {
    return this.videosService.listVideos(limit, order);
  }

  /**
   * Delete video from OpenAI storage
   * DELETE /api/videos/:id
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete video from OpenAI storage',
    description:
      'Permanently delete a video and its associated assets from OpenAI storage.',
  })
  @ApiParam({
    name: 'id',
    description: 'Video ID to delete',
    example: 'vid_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Video deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Video not found' })
  async deleteVideo(
    @Param('id') id: string,
  ): Promise<Videos.VideoDeleteResponse> {
    return this.videosService.deleteVideo(id);
  }

  /**
   * Create video remix with new prompt
   * POST /api/videos/:id/remix
   */
  @Post(':id/remix')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create video remix with new prompt',
    description:
      'Create a variation of an existing video using a new prompt. ' +
      'Returns a new video job (different video ID) with status: queued.',
  })
  @ApiParam({
    name: 'id',
    description: 'Source video ID',
    example: 'vid_abc123',
  })
  @ApiResponse({
    status: 201,
    description: 'Remix video job created successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid remix source or prompt' })
  @ApiResponse({ status: 404, description: 'Source video not found' })
  async remixVideo(
    @Param('id') id: string,
    @Body() body: { prompt: string },
  ): Promise<Videos.Video> {
    return this.videosService.remixVideo(id, body.prompt);
  }
}
