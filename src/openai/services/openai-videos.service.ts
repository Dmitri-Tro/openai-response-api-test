import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { Videos } from 'openai/resources/videos';
import { LoggerService } from '../../common/services/logger.service';
import { CreateVideoDto } from '../dto/create-video.dto';

/**
 * Service for interacting with OpenAI Videos API
 * Uses async job management pattern (polling, not streaming)
 */
@Injectable()
export class OpenAIVideosService {
  private client: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly loggerService: LoggerService,
  ) {
    const apiKey = this.configService.get<string>('openai.apiKey');
    const baseURL = this.configService.get<string>('openai.baseUrl');

    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL,
      timeout: this.configService.get<number>('openai.timeout'),
      maxRetries: this.configService.get<number>('openai.maxRetries'),
    });
  }

  /**
   * Create a video generation job
   * @param dto - Video creation parameters
   * @returns OpenAI Video object with status: 'queued'
   */
  async createVideo(dto: CreateVideoDto): Promise<Videos.Video> {
    const startTime = Date.now();

    const params: Videos.VideoCreateParams = {
      prompt: dto.prompt,
      ...(dto.model && { model: dto.model }),
      ...(dto.seconds && { seconds: dto.seconds }),
      ...(dto.size && { size: dto.size }),
    };

    const video: Videos.Video = await this.client.videos.create(params);

    // Log interaction (no data modification)
    this.loggerService.logOpenAIInteraction({
      timestamp: new Date().toISOString(),
      api: 'videos',
      endpoint: '/v1/videos',
      request: params as unknown as Record<string, unknown>,
      response: video,
      metadata: {
        latency_ms: Date.now() - startTime,
        video_id: video.id,
        model: video.model,
        status: video.status,
      },
    });

    return video; // Return OpenAI response as-is
  }

  /**
   * Retrieve current video status
   * @param videoId - Video ID (starts with "vid_")
   * @returns OpenAI Video object with current status
   */
  async getVideoStatus(videoId: string): Promise<Videos.Video> {
    return await this.client.videos.retrieve(videoId);
  }

  /**
   * Poll until video generation completes
   * Uses exponential backoff: 5s → 10s → 15s → 20s (max)
   * @param videoId - Video ID to poll
   * @param maxWaitMs - Maximum time to wait (default: 10 minutes)
   * @returns Final OpenAI Video object (status: 'completed' or 'failed')
   * @throws Error if timeout exceeded
   */
  async pollUntilComplete(
    videoId: string,
    maxWaitMs: number = 600000,
  ): Promise<Videos.Video> {
    const startTime = Date.now();
    let waitTime = 5000; // Start with 5 seconds

    while (Date.now() - startTime < maxWaitMs) {
      const video: Videos.Video = await this.getVideoStatus(videoId);

      // Return when generation completes or fails
      if (video.status === 'completed' || video.status === 'failed') {
        return video; // Return OpenAI response as-is
      }

      // Wait before next poll (exponential backoff)
      await this.sleep(waitTime);
      waitTime = Math.min(waitTime + 5000, 20000); // Cap at 20 seconds
    }

    // Timeout exceeded
    throw new Error(
      `Video generation timeout: exceeded ${maxWaitMs}ms waiting for video ${videoId}`,
    );
  }

  /**
   * Download completed video file or asset
   * @param videoId - Video ID
   * @param variant - Download type: 'video' (MP4), 'thumbnail' (JPEG), 'spritesheet' (JPEG)
   * @returns Response object from OpenAI (binary stream)
   */
  async downloadVideo(
    videoId: string,
    variant: 'video' | 'thumbnail' | 'spritesheet' = 'video',
  ): Promise<Response> {
    return await this.client.videos.downloadContent(videoId, { variant });
  }

  /**
   * List all generated videos with pagination
   * @param limit - Number of videos to return (default: 10)
   * @param order - Sort order by created_at: 'asc' or 'desc' (default: 'desc')
   * @returns Array of OpenAI Video objects
   */
  async listVideos(
    limit: number = 10,
    order: 'asc' | 'desc' = 'desc',
  ): Promise<Videos.Video[]> {
    const page = await this.client.videos.list({ limit, order });
    return page.data; // Return data array as-is
  }

  /**
   * Delete video from OpenAI storage
   * @param videoId - Video ID to delete
   * @returns OpenAI deletion confirmation response
   */
  async deleteVideo(videoId: string): Promise<Videos.VideoDeleteResponse> {
    return await this.client.videos.delete(videoId);
  }

  /**
   * Create video remix with new prompt
   * @param videoId - Source video ID
   * @param newPrompt - New prompt for remix
   * @returns New OpenAI Video object for remix job
   */
  async remixVideo(videoId: string, newPrompt: string): Promise<Videos.Video> {
    return await this.client.videos.remix(videoId, { prompt: newPrompt });
  }

  /**
   * Extract video metadata from OpenAI response
   * Helper method to structure data for readability (no computation)
   * @param video - OpenAI Video object
   * @returns Structured metadata view
   */
  extractVideoMetadata(video: Videos.Video): VideoMetadata {
    return {
      id: video.id,
      object: video.object,
      status: video.status,
      progress: video.progress,
      model: video.model,
      seconds: video.seconds,
      size: video.size,
      prompt: video.prompt,
      created_at: video.created_at,
      completed_at: video.completed_at,
      expires_at: video.expires_at,
      remixed_from_video_id: video.remixed_from_video_id,
      error: video.error,
    };
  }

  /**
   * Sleep helper for polling
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Structured view of OpenAI Video metadata
 * Contains only fields from OpenAI response (no computed data)
 */
export interface VideoMetadata {
  id: string;
  object: 'video';
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  model: string;
  seconds: string;
  size: string;
  prompt: string | null;
  created_at: number;
  completed_at: number | null;
  expires_at: number | null;
  remixed_from_video_id: string | null;
  error: Videos.VideoCreateError | null;
}
