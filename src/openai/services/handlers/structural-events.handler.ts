import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../../common/services/logger.service';
import {
  StreamState,
  SSEEvent,
} from '../../interfaces/streaming-events.interface';

/**
 * Handler service for structural and unknown streaming events
 *
 * Processes 3 categories of events: structural events that define response boundaries
 * and composition, plus unknown event types for forward compatibility.
 *
 * **Events Handled:**
 * - `response.output_item.added` - New output item added to response
 * - `response.output_item.done` - Output item completed
 * - `response.content_part.added` - New content part added
 * - `response.content_part.done` - Content part completed
 * - **Unknown events** - Future/unrecognized event types
 *
 * **Structural Events:**
 * Output items represent top-level response components (e.g., text, images, audio).
 * Content parts represent subdivisions within items (e.g., paragraphs, sections).
 * These events enable structured response composition and parsing.
 *
 * **Unknown Event Handling:**
 * Gracefully handles unrecognized event types to maintain forward compatibility
 * as the Responses API evolves. Unknown events are logged and passed through
 * without breaking the streaming pipeline.
 *
 * @see {@link https://platform.openai.com/docs/api-reference/responses-streaming#structural-events}
 */
@Injectable()
export class StructuralEventsHandler {
  constructor(private readonly loggerService: LoggerService) {}

  /**
   * Handle structural events (output_item, content_part)
   *
   * Emitted to signal structural boundaries in the response. Output items represent
   * major components (text, image, audio), while content parts represent logical
   * subdivisions. Used for building structured response representations and
   * implementing sophisticated UI rendering.
   *
   * @param event - Raw event data with type, item, and part information
   * @param state - Shared streaming state
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with structural boundary information
   * @yields SSEEvent with item/part data and metadata
   */
  *handleStructuralEvent(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData =
      (event as { type: string; item?: unknown; part?: unknown }) || {};
    const eventType = eventData.type || '';

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: eventType,
      sequence,
      response: { item: eventData.item, part: eventData.part },
    });

    yield {
      event: eventType.replace('response.', ''),
      data: JSON.stringify({
        item: eventData.item,
        part: eventData.part,
        sequence,
      }),
      sequence,
    };
  }

  /**
   * Handle unknown/future event types for future-proofing
   *
   * Emitted when an unrecognized event type is received. Provides forward
   * compatibility as OpenAI adds new event types to the Responses API.
   * Unknown events are logged with full data for debugging and passed through
   * to clients without interrupting the stream.
   *
   * This handler ensures the streaming pipeline remains operational even when
   * encountering new event types from API updates, preventing breaking changes.
   *
   * @param event - Raw event data with type and full event object
   * @param state - Shared streaming state
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with unknown event data
   * @yields SSEEvent with event='unknown_event', type, and raw event data
   */
  *handleUnknownEvent(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData = (event as { type: string }) || {};

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'unknown_event',
      sequence,
      response: { unknown_type: eventData.type, event },
    });

    yield {
      event: 'unknown_event',
      data: JSON.stringify({ type: eventData.type, sequence }),
      sequence,
    };
  }
}
