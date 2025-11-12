import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../../common/services/logger.service';
import {
  StreamState,
  SSEEvent,
} from '../../interfaces/streaming-events.interface';

/**
 * Handler service for text output streaming events in the orchestrator pattern
 *
 * Processes 3 events related to text output generation, the primary content type
 * returned by the Responses API. Handles incremental text streaming (deltas),
 * completion signals, and text annotations (citations, warnings).
 *
 * **Events Handled:**
 * - `response.output_text.delta` - Incremental text chunks with optional logprobs
 * - `response.output_text.done` - Text generation complete with final text
 * - `response.output_text.annotation.added` - Text annotations (citations, warnings)
 *
 * Text deltas are accumulated in shared StreamState for reconstructing the full output.
 * Supports advanced features like logprobs (token probabilities), content_index
 * (multi-output tracking), and item_id/output_index for structured responses.
 *
 * @see {@link https://platform.openai.com/docs/api-reference/responses-streaming#text-events}
 */
@Injectable()
export class TextEventsHandler {
  constructor(private readonly loggerService: LoggerService) {}

  /**
   * Handle response.output_text.delta - Text chunk streaming
   *
   * Emitted continuously during text generation, delivering incremental text chunks
   * in real-time. Accumulates deltas into state.fullText for complete reconstruction.
   * May include logprobs (token probabilities), content_index (for parallel outputs),
   * and structural identifiers (item_id, output_index).
   *
   * @param event - Raw event data with delta string and optional metadata
   * @param state - Shared streaming state for accumulating fullText
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with text delta and metadata
   * @yields SSEEvent with event='text_delta', delta, and optional logprobs/indices
   */
  *handleTextDelta(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData =
      (event as {
        delta?: string;
        logprobs?: unknown[];
        content_index?: number;
        item_id?: string;
        output_index?: number;
      }) || {};
    const delta = eventData.delta || '';
    state.fullText += delta;

    const logData: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'text_delta',
      sequence,
      delta,
    };

    // Add metadata if present
    if (eventData.logprobs) logData.logprobs = eventData.logprobs;
    if (eventData.content_index !== undefined)
      logData.content_index = eventData.content_index;
    if (eventData.item_id) logData.item_id = eventData.item_id;
    if (eventData.output_index !== undefined)
      logData.output_index = eventData.output_index;

    this.loggerService.logStreamingEvent(
      logData as Parameters<typeof this.loggerService.logStreamingEvent>[0],
    );

    const sseData: Record<string, unknown> = { delta, sequence };
    if (eventData.logprobs) sseData.logprobs = eventData.logprobs;
    if (eventData.content_index !== undefined)
      sseData.content_index = eventData.content_index;
    if (eventData.item_id) sseData.item_id = eventData.item_id;
    if (eventData.output_index !== undefined)
      sseData.output_index = eventData.output_index;

    yield {
      event: 'text_delta',
      data: JSON.stringify(sseData),
      sequence,
    };
  }

  /**
   * Handle response.output_text.done - Text generation complete
   *
   * Emitted when text generation finishes. Contains the complete final text and
   * optional metadata. Signals that no more text_delta events will follow for this output.
   * The complete text is available in both event.text and accumulated state.fullText.
   *
   * @param event - Raw event data with complete text and optional metadata
   * @param state - Shared streaming state with accumulated fullText
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with complete output_text and metadata
   * @yields SSEEvent with event='text_done', output_text, and optional logprobs/indices
   */
  *handleTextDone(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData =
      (event as {
        text?: string;
        logprobs?: unknown[];
        content_index?: number;
        item_id?: string;
        output_index?: number;
      }) || {};
    const latency = Date.now() - state.startTime;

    const logData: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'text_done',
      sequence,
      response: { output_text: eventData.text || state.fullText },
      metadata: { latency_ms: latency },
    };

    // Add metadata if present
    if (eventData.logprobs) logData.logprobs = eventData.logprobs;
    if (eventData.content_index !== undefined)
      logData.content_index = eventData.content_index;
    if (eventData.item_id) logData.item_id = eventData.item_id;
    if (eventData.output_index !== undefined)
      logData.output_index = eventData.output_index;

    this.loggerService.logStreamingEvent(
      logData as Parameters<typeof this.loggerService.logStreamingEvent>[0],
    );

    const sseData: Record<string, unknown> = {
      output_text: eventData.text || state.fullText,
      sequence,
    };
    if (eventData.logprobs) sseData.logprobs = eventData.logprobs;
    if (eventData.content_index !== undefined)
      sseData.content_index = eventData.content_index;
    if (eventData.item_id) sseData.item_id = eventData.item_id;
    if (eventData.output_index !== undefined)
      sseData.output_index = eventData.output_index;

    yield {
      event: 'text_done',
      data: JSON.stringify(sseData),
      sequence,
    };
  }

  /**
   * Handle response.output_text.annotation.added - Text annotation
   *
   * Emitted when annotations are added to the text output. Annotations include citations
   * (for file_search tool), warnings, or metadata about specific text segments.
   * Used for tracking sources, references, or content moderation flags.
   *
   * @param event - Raw event data with annotation object
   * @param state - Shared streaming state
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with annotation data
   * @yields SSEEvent with event='text_annotation' and annotation object
   */
  *handleTextAnnotation(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData = (event as { annotation?: unknown }) || {};

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'text_annotation',
      sequence,
      response: { annotation: eventData.annotation },
    });

    yield {
      event: 'text_annotation',
      data: JSON.stringify({ annotation: eventData.annotation, sequence }),
      sequence,
    };
  }
}
