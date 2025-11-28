import { Injectable, Inject, GatewayTimeoutException } from '@nestjs/common';
import OpenAI from 'openai';
import { OPENAI_CLIENT } from '../providers/openai-client.provider';
import type { Videos } from 'openai/resources/videos';
import { LoggerService } from '../../common/services/logger.service';
import { calculateVideoCost } from '../../common/utils/cost-estimation.utils';
import { CreateVideoDto } from '../dto/create-video.dto';

/**
 * Service for interacting with OpenAI Videos API
 *
 * **Purpose**: Text-to-video generation using Sora models.
 * Uses async job management pattern (polling, not streaming).
 *
 * **Supported Operations**:
 * - Video Generation: Create videos from text prompts (4, 8, or 12 seconds)
 * - Video Remix: Generate variations based on existing videos
 * - Asset Download: Download video files, thumbnails, and spritesheets
 * - Job Management: Poll status, list videos, delete videos
 *
 * **Model Capabilities**:
 * - `sora-2`: Standard quality, cost-effective (~$0.10-$0.15/sec)
 * - `sora-2-pro`: Professional quality, higher fidelity (~$0.30-$0.50/sec)
 *
 * **Video Specifications**:
 * - Duration: 4, 8, or 12 seconds
 * - Resolution: 480p (854×480), 720p (1280×720), 1080p (1920×1080)
 * - Format: MP4 (H.264 video, AAC audio)
 *
 * @see {@link https://platform.openai.com/docs/api-reference/videos}
 */
@Injectable()
export class OpenAIVideosService {
  constructor(
    @Inject(OPENAI_CLIENT) private readonly client: OpenAI,
    private readonly loggerService: LoggerService,
  ) {}

  /**
   * Create a video generation job from text prompt
   *
   * **Model Options**:
   * - `sora-2`: Standard quality, faster generation
   * - `sora-2-pro`: Professional quality, enhanced details
   *
   * **Duration Options**: "4", "8", or "12" (seconds as strings)
   *
   * **Size Options**:
   * - "480p": 854×480 (landscape), 480×854 (portrait)
   * - "720p": 1280×720 (landscape), 720×1280 (portrait)
   * - "1080p": 1920×1080 (landscape), 1080×1920 (portrait)
   *
   * **Job Lifecycle**:
   * 1. Job created with status: 'queued'
   * 2. Processing begins: 'in_progress'
   * 3. Completes: 'completed' or 'failed'
   * 4. Use pollUntilComplete() to wait for completion
   *
   * @param dto - Video creation parameters
   * @returns OpenAI Video object with status: 'queued'
   *
   * @example
   * ```typescript
   * // Standard quality 8-second video
   * const video = await service.createVideo({
   *   prompt: 'A serene beach at sunset with gentle waves',
   *   model: 'sora-2',
   *   seconds: '8',
   *   size: '1080p'
   * });
   *
   * // Professional quality 12-second video
   * const video = await service.createVideo({
   *   prompt: 'Time-lapse of a blooming flower',
   *   model: 'sora-2-pro',
   *   seconds: '12'
   * });
   * ```
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

    // Calculate cost estimate
    const costEstimate = calculateVideoCost(
      dto.model || 'sora-2',
      parseInt(dto.seconds || '4', 10),
    );

    // Log interaction (no data modification)
    this.loggerService.logOpenAIInteraction({
      timestamp: new Date().toISOString(),
      api: 'videos',
      endpoint: '/v1/videos',
      request: params,
      response: video,
      metadata: {
        latency_ms: Date.now() - startTime,
        video_id: video.id,
        model: video.model,
        status: video.status,
        cost_estimate: costEstimate,
      },
    });

    return video; // Return OpenAI response as-is
  }

  /**
   * Retrieve current video generation status
   *
   * **Use Cases**:
   * - Check generation progress (0-100)
   * - Verify completion status before download
   * - Monitor for errors during generation
   *
   * **Status Values**:
   * - `queued`: Job waiting to start
   * - `in_progress`: Currently generating (check `progress` field)
   * - `completed`: Ready for download
   * - `failed`: Generation failed (check `error` field)
   *
   * @param videoId - Video ID (starts with "vid_")
   * @returns OpenAI Video object with current status
   *
   * @example
   * ```typescript
   * const video = await service.getVideoStatus('vid_abc123xyz789');
   * console.log(`Status: ${video.status}, Progress: ${video.progress}%`);
   * ```
   */
  async getVideoStatus(videoId: string): Promise<Videos.Video> {
    const startTime = Date.now();

    const video: Videos.Video = await this.client.videos.retrieve(videoId);

    this.loggerService.logOpenAIInteraction({
      timestamp: new Date().toISOString(),
      api: 'videos',
      endpoint: `/v1/videos/${videoId}`,
      request: {},
      response: video,
      metadata: {
        latency_ms: Date.now() - startTime,
        video_id: video.id,
        model: video.model,
        status: video.status,
      },
    });

    return video;
  }

  /**
   * Poll until video generation completes
   *
   * **Polling Strategy**:
   * - Uses exponential backoff: 5s → 10s → 15s → 20s (max interval)
   * - Default timeout: 10 minutes (600,000 ms)
   * - Polls every interval until status reaches terminal state
   *
   * **Terminal Statuses**:
   * - `completed`: Video ready for download
   * - `failed`: Generation failed (check `error` field)
   *
   * **Use Cases**:
   * - Wait for video generation after createVideo()
   * - Monitor remix jobs until completion
   * - Automated workflows requiring synchronous generation
   *
   * @param videoId - Video ID to poll
   * @param maxWaitMs - Maximum time to wait (default: 10 minutes)
   * @returns Final OpenAI Video object (status: 'completed' or 'failed')
   * @throws Error if timeout exceeded
   *
   * @example
   * ```typescript
   * // Poll with default 10-minute timeout
   * const video = await service.createVideo({ prompt: '...', model: 'sora-2' });
   * const completed = await service.pollUntilComplete(video.id);
   *
   * // Poll with custom timeout (5 minutes)
   * const completed = await service.pollUntilComplete(video.id, 300000);
   * if (completed.status === 'failed') {
   *   console.error('Generation failed:', completed.error);
   * }
   * ```
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
        this.loggerService.logOpenAIInteraction({
          timestamp: new Date().toISOString(),
          api: 'videos',
          endpoint: `/v1/videos/${videoId}/poll`,
          request: { max_wait_ms: maxWaitMs },
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

      // Wait before next poll (exponential backoff)
      await this.sleep(waitTime);
      waitTime = Math.min(waitTime + 5000, 20000); // Cap at 20 seconds
    }

    // Timeout exceeded
    throw new GatewayTimeoutException(
      `Video generation timeout: exceeded ${maxWaitMs}ms waiting for video ${videoId}`,
    );
  }

  /**
   * Download completed video file or asset as binary stream
   *
   * **Variant Options**:
   * - `video`: Full MP4 file (H.264 video, AAC audio)
   * - `thumbnail`: Single JPEG frame preview
   * - `spritesheet`: JPEG grid of video frames (for timeline preview)
   *
   * **Binary Streaming**:
   * - Returns native Response object from OpenAI SDK
   * - Use `response.arrayBuffer()` or `response.body` for streaming
   * - Content-Type header indicates file format
   *
   * **Requirements**:
   * - Video status must be 'completed' (use pollUntilComplete() first)
   *
   * @param videoId - Video ID
   * @param variant - Download type: 'video' (MP4), 'thumbnail' (JPEG), 'spritesheet' (JPEG)
   * @returns Response object from OpenAI (binary stream)
   *
   * @example
   * ```typescript
   * // Download video file
   * const completed = await service.pollUntilComplete('vid_abc123xyz789');
   * const response = await service.downloadVideo(completed.id, 'video');
   * const buffer = Buffer.from(await response.arrayBuffer());
   * fs.writeFileSync('output.mp4', buffer);
   *
   * // Download thumbnail
   * const thumbnailResponse = await service.downloadVideo(completed.id, 'thumbnail');
   * const thumbnailBuffer = Buffer.from(await thumbnailResponse.arrayBuffer());
   * fs.writeFileSync('thumbnail.jpg', thumbnailBuffer);
   * ```
   */
  async downloadVideo(
    videoId: string,
    variant: 'video' | 'thumbnail' | 'spritesheet' = 'video',
  ): Promise<Response> {
    const startTime = Date.now();

    const response: Response = await this.client.videos.downloadContent(
      videoId,
      { variant },
    );

    this.loggerService.logOpenAIInteraction({
      timestamp: new Date().toISOString(),
      api: 'videos',
      endpoint: `/v1/videos/${videoId}/content`,
      request: { variant },
      response: {
        content_type:
          response.headers?.get('content-type') || 'application/octet-stream',
      },
      metadata: {
        latency_ms: Date.now() - startTime,
        video_id: videoId,
      },
    });

    return response;
  }

  /**
   * List all generated videos with pagination
   *
   * **Pagination**:
   * - `limit`: Number of results per page (default: 10, max: 100)
   * - `order`: Sort by creation time ('asc' or 'desc', default: 'desc')
   *
   * **Returned Videos**:
   * - Includes all statuses: queued, in_progress, completed, failed
   * - Use `status` field to filter client-side if needed
   *
   * @param limit - Number of videos to return (default: 10)
   * @param order - Sort order by created_at: 'asc' or 'desc' (default: 'desc')
   * @returns Array of OpenAI Video objects
   *
   * @example
   * ```typescript
   * // List 10 most recent videos
   * const videos = await service.listVideos();
   *
   * // List 50 oldest videos
   * const oldVideos = await service.listVideos(50, 'asc');
   *
   * // Filter completed videos client-side
   * const completed = videos.filter(v => v.status === 'completed');
   * ```
   */
  async listVideos(
    limit: number = 10,
    order: 'asc' | 'desc' = 'desc',
  ): Promise<Videos.Video[]> {
    const startTime = Date.now();

    const page = await this.client.videos.list({ limit, order });

    this.loggerService.logOpenAIInteraction({
      timestamp: new Date().toISOString(),
      api: 'videos',
      endpoint: '/v1/videos',
      request: { limit, order },
      response: page.data,
      metadata: {
        latency_ms: Date.now() - startTime,
        result_count: page.data.length,
      },
    });

    return page.data; // Return data array as-is
  }

  /**
   * Delete video from OpenAI storage
   *
   * **Important Notes**:
   * - Deletion is immediate and permanent (no undo)
   * - Deletes video file and all associated assets (thumbnail, spritesheet)
   * - Videos expire automatically after a retention period (check `expires_at`)
   *
   * @param videoId - Video ID to delete
   * @returns OpenAI deletion confirmation response
   *
   * @example
   * ```typescript
   * const result = await service.deleteVideo('vid_abc123xyz789');
   * console.log(`Deleted: ${result.deleted}`); // true
   * ```
   */
  async deleteVideo(videoId: string): Promise<Videos.VideoDeleteResponse> {
    const startTime = Date.now();

    const result: Videos.VideoDeleteResponse =
      await this.client.videos.delete(videoId);

    this.loggerService.logOpenAIInteraction({
      timestamp: new Date().toISOString(),
      api: 'videos',
      endpoint: `/v1/videos/${videoId}`,
      request: {},
      response: result,
      metadata: {
        latency_ms: Date.now() - startTime,
        video_id: videoId,
        deleted: result.deleted,
      },
    });

    return result;
  }

  /**
   * Create video remix with new prompt
   *
   * **What is Remix?**
   * - Generate variations of existing videos with different prompts
   * - Maintains visual style and structure of source video
   * - Creates new job (separate video ID) with status: 'queued'
   *
   * **Use Cases**:
   * - Explore alternative storylines for same scene
   * - Adjust visual style while keeping composition
   * - Generate multiple variations from one base video
   *
   * **Limitations**:
   * - Source video must have status: 'completed'
   * - Remix inherits model/duration from source video
   * - Each remix creates a new billable video
   *
   * @param videoId - Source video ID (must be completed)
   * @param newPrompt - New prompt for remix
   * @returns New OpenAI Video object for remix job
   *
   * @example
   * ```typescript
   * // Create base video
   * const original = await service.createVideo({
   *   prompt: 'A sunny beach',
   *   model: 'sora-2'
   * });
   * await service.pollUntilComplete(original.id);
   *
   * // Remix with different weather
   * const remix1 = await service.remixVideo(original.id, 'A stormy beach');
   * const remix2 = await service.remixVideo(original.id, 'A beach at sunset');
   * ```
   */
  async remixVideo(videoId: string, newPrompt: string): Promise<Videos.Video> {
    const startTime = Date.now();

    const video: Videos.Video = await this.client.videos.remix(videoId, {
      prompt: newPrompt,
    });

    this.loggerService.logOpenAIInteraction({
      timestamp: new Date().toISOString(),
      api: 'videos',
      endpoint: `/v1/videos/${videoId}/remix`,
      request: { prompt: newPrompt },
      response: video,
      metadata: {
        latency_ms: Date.now() - startTime,
        video_id: video.id,
        model: video.model,
        status: video.status,
      },
    });

    return video;
  }

  /**
   * Extract video metadata from OpenAI response
   *
   * **Purpose**: Helper method to structure data for readability (no computation).
   * Useful for displaying video information in UI or logs.
   *
   * **Extracted Fields**:
   * - Basic: id, object, model, prompt, status, progress
   * - Specification: seconds, size (resolution)
   * - Timestamps: created_at, completed_at, expires_at (Unix timestamps)
   * - Relationships: remixed_from_video_id (if remix)
   * - Errors: error (if failed)
   *
   * @param video - OpenAI Video object
   * @returns Structured metadata view
   *
   * @example
   * ```typescript
   * const video = await service.getVideoStatus('vid_abc123xyz789');
   * const metadata = service.extractVideoMetadata(video);
   * console.log(`Video: ${metadata.id}, Status: ${metadata.status}, Progress: ${metadata.progress}%`);
   * ```
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
