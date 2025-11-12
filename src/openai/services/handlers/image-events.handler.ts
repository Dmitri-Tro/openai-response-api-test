import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../../common/services/logger.service';
import {
  StreamState,
  SSEEvent,
} from '../../interfaces/streaming-events.interface';

/**
 * Handler service for image generation streaming events (gpt-image-1)
 *
 * Processes 4 events related to image generation using the gpt-image-1 model
 * integrated into the Responses API. Supports progressive rendering with partial
 * images (0-3) for improved user experience during generation.
 *
 * **Events Handled:**
 * - `response.image_generation_call.in_progress` - Image generation started
 * - `response.image_generation_call.generating` - Generation in progress
 * - `response.image_generation_call.partial_image` - Progressive partial image (base64)
 * - `response.image_generation_call.completed` - Final image ready (base64)
 *
 * Images are delivered as base64-encoded data in format: `data:image/[format];base64,...`
 * Supports multiple formats (png, jpeg, webp) and quality levels (low, high, ultra).
 * Partial images enable progressive rendering for better UX on slower connections.
 *
 * @see {@link https://platform.openai.com/docs/api-reference/responses#image-generation}
 */
@Injectable()
export class ImageEventsHandler {
  constructor(private readonly loggerService: LoggerService) {}

  /**
   * Handle image generation progress events
   *
   * Emitted during image generation lifecycle (in_progress, generating phases).
   * Indicates the gpt-image-1 model is actively generating the image. Useful
   * for displaying progress indicators or estimated time remaining.
   *
   * @param event - Raw event data with type and call_id
   * @param state - Shared streaming state
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with generation progress
   * @yields SSEEvent with event matching type (e.g., 'image_generation_call.generating')
   */
  *handleImageGenProgress(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData = (event as { type: string; call_id?: string }) || {};
    const eventType = eventData.type || '';

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: eventType,
      sequence,
    });

    yield {
      event: eventType.replace('response.', ''),
      data: JSON.stringify({ call_id: eventData.call_id, sequence }),
      sequence,
    };
  }

  /**
   * Handle partial image for progressive rendering
   *
   * Emitted during generation when partial_images parameter is enabled (1-3).
   * Contains base64-encoded partial image showing incremental progress.
   * Enables progressive image display for better UX, similar to progressive JPEG loading.
   *
   * @param event - Raw event data with image_data (base64) and call_id
   * @param state - Shared streaming state
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with partial image data
   * @yields SSEEvent with event='image_gen_partial', call_id, and base64 image_data
   */
  *handleImageGenPartial(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData =
      (event as { image_data?: string; call_id?: string }) || {};

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'image_gen_partial',
      sequence,
    });

    yield {
      event: 'image_gen_partial',
      data: JSON.stringify({
        call_id: eventData.call_id,
        image_data: eventData.image_data,
        sequence,
      }),
      sequence,
    };
  }

  /**
   * Handle image generation completed
   *
   * Emitted when image generation finishes successfully. Contains the final
   * base64-encoded image in full quality. Image data is in format:
   * `data:image/[png|jpeg|webp];base64,...` and can be directly used in HTML
   * img tags or saved to disk.
   *
   * @param event - Raw event data with image_data (base64) and call_id
   * @param state - Shared streaming state
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with final image
   * @yields SSEEvent with event='image_gen_completed', call_id, and base64 image_data
   */
  *handleImageGenCompleted(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData =
      (event as { image_data?: string; call_id?: string }) || {};

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'image_gen_completed',
      sequence,
    });

    yield {
      event: 'image_gen_completed',
      data: JSON.stringify({
        call_id: eventData.call_id,
        image_data: eventData.image_data,
        sequence,
      }),
      sequence,
    };
  }
}
