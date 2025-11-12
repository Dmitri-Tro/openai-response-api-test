import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../../common/services/logger.service';
import {
  StreamState,
  SSEEvent,
} from '../../interfaces/streaming-events.interface';

/**
 * Handler service for content refusal streaming events
 *
 * Processes 2 events related to content policy refusals. Emitted when the model
 * declines to generate content due to safety, policy, or ethical concerns.
 * Refusals provide explanations for why the request was declined, helping users
 * understand content moderation boundaries.
 *
 * **Events Handled:**
 * - `response.output_refusal.delta` - Incremental refusal message streaming
 * - `response.output_refusal.done` - Complete refusal message
 *
 * Refusal messages are accumulated in state.refusal for complete reconstruction.
 * Common refusal scenarios include: harmful content requests, illegal activities,
 * privacy violations, impersonation, or NSFW content generation.
 *
 * When a refusal occurs, no output_text is generated; instead, the refusal
 * explains why the request couldn't be fulfilled and may suggest alternatives.
 *
 * @see {@link https://platform.openai.com/docs/guides/safety-best-practices}
 */
@Injectable()
export class RefusalEventsHandler {
  constructor(private readonly loggerService: LoggerService) {}

  /**
   * Handle refusal delta - Refusal message streaming
   *
   * Emitted when the model begins refusing a request. Delivers incremental chunks
   * of the refusal explanation as it's generated. Indicates the model determined
   * the request violates content policies or safety guidelines.
   *
   * @param event - Raw event data with delta (refusal message chunk)
   * @param state - Shared streaming state for accumulating refusal text
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with refusal chunk
   * @yields SSEEvent with event='refusal_delta' and explanation text
   */
  *handleRefusalDelta(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData = (event as { delta?: string }) || {};
    const delta = eventData.delta || '';
    state.refusal += delta;

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'refusal_delta',
      sequence,
      delta,
    });

    yield {
      event: 'refusal_delta',
      data: JSON.stringify({ delta, sequence }),
      sequence,
    };
  }

  /**
   * Handle refusal done - Refusal message complete
   *
   * Emitted when the refusal explanation is complete. Contains the full refusal
   * message explaining why the request was declined. This message should be
   * displayed to the user with appropriate UI treatment (e.g., warning styling).
   *
   * @param event - Raw event data (refusal available in state)
   * @param state - Shared streaming state with complete refusal message
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with complete refusal
   * @yields SSEEvent with event='refusal_done' and full refusal explanation
   */
  *handleRefusalDone(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'refusal_done',
      sequence,
      response: { refusal: state.refusal },
    });

    yield {
      event: 'refusal_done',
      data: JSON.stringify({ refusal: state.refusal, sequence }),
      sequence,
    };
  }
}
