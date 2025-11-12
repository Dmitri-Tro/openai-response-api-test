import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../../common/services/logger.service';
import {
  StreamState,
  SSEEvent,
} from '../../interfaces/streaming-events.interface';

/**
 * Handler service for reasoning streaming events (o-series models)
 *
 * Processes 6 events specific to reasoning models (o1, o3, o-mini, and future o-series models).
 * These models generate explicit reasoning traces showing their thought process before
 * producing the final output. Reasoning tokens are billed separately and visible in usage stats.
 *
 * **Events Handled:**
 * - `response.reasoning_text.delta` - Incremental reasoning tokens streaming
 * - `response.reasoning_text.done` - Complete reasoning trace
 * - `response.reasoning_summary_text.delta` - Incremental reasoning summary
 * - `response.reasoning_summary_text.done` - Complete reasoning summary
 * - `response.reasoning_summary_part.added` - Structured reasoning parts (sections)
 * - `response.reasoning_summary_part.done` - Reasoning part completion
 *
 * Reasoning data is accumulated in state.reasoning and state.reasoningSummary for
 * tracking the model's internal thought process. Useful for debugging, transparency,
 * and understanding model decision-making.
 *
 * @see {@link https://platform.openai.com/docs/guides/reasoning}
 */
@Injectable()
export class ReasoningEventsHandler {
  constructor(private readonly loggerService: LoggerService) {}

  /**
   * Handle response.reasoning_text.delta - Reasoning token streaming
   *
   * Emitted by o-series models during reasoning phase. Streams incremental reasoning
   * tokens showing the model's internal thought process. These tokens are billed
   * separately from input/output tokens at a different rate.
   *
   * @param event - Raw event data with delta string (reasoning token)
   * @param state - Shared streaming state for accumulating reasoning text
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with reasoning delta
   * @yields SSEEvent with event='reasoning_delta' and reasoning token
   */
  *handleReasoningTextDelta(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData = (event as { delta?: string }) || {};
    const delta = eventData.delta || '';
    state.reasoning += delta;

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'reasoning_delta',
      sequence,
      delta,
    });

    yield {
      event: 'reasoning_delta',
      data: JSON.stringify({ delta, sequence }),
      sequence,
    };
  }

  /**
   * Handle response.reasoning_text.done - Reasoning complete
   *
   * Emitted when the model finishes its reasoning phase. Contains the complete
   * reasoning trace accumulated from all reasoning deltas. After this event,
   * the model proceeds to generate the final output text.
   *
   * @param event - Raw event data (reasoning text available in state)
   * @param state - Shared streaming state with complete reasoning text
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with complete reasoning_text
   * @yields SSEEvent with event='reasoning_done' and full reasoning trace
   */
  *handleReasoningTextDone(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'reasoning_done',
      sequence,
      response: { reasoning_text: state.reasoning },
    });

    yield {
      event: 'reasoning_done',
      data: JSON.stringify({ reasoning_text: state.reasoning, sequence }),
      sequence,
    };
  }

  /**
   * Handle response.reasoning_summary_text.delta - Reasoning summary streaming
   *
   * Emitted for summarized reasoning traces. Some o-series models provide condensed
   * summaries of their reasoning process instead of full traces, making the output
   * more concise while still showing the thought process.
   *
   * @param event - Raw event data with delta string (summary chunk)
   * @param state - Shared streaming state for accumulating reasoning summary
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with reasoning summary delta
   * @yields SSEEvent with event='reasoning_summary_delta' and summary chunk
   */
  *handleReasoningSummaryDelta(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData = (event as { delta?: string }) || {};
    const delta = eventData.delta || '';
    state.reasoningSummary += delta;

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'reasoning_summary_delta',
      sequence,
      delta,
    });

    yield {
      event: 'reasoning_summary_delta',
      data: JSON.stringify({ delta, sequence }),
      sequence,
    };
  }

  /**
   * Handle response.reasoning_summary_text.done - Reasoning summary complete
   *
   * Emitted when the reasoning summary is complete. Contains the full condensed
   * summary of the model's reasoning process accumulated from summary deltas.
   *
   * @param event - Raw event data (summary available in state)
   * @param state - Shared streaming state with complete reasoning summary
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with complete reasoning_summary
   * @yields SSEEvent with event='reasoning_summary_done' and full summary
   */
  *handleReasoningSummaryDone(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'reasoning_summary_done',
      sequence,
      response: { reasoning_summary: state.reasoningSummary },
    });

    yield {
      event: 'reasoning_summary_done',
      data: JSON.stringify({
        reasoning_summary: state.reasoningSummary,
        sequence,
      }),
      sequence,
    };
  }

  /**
   * Handle reasoning summary part events
   *
   * Emitted for structured reasoning summaries broken into logical parts or sections.
   * Each part represents a distinct phase of reasoning (e.g., problem analysis,
   * strategy formulation, solution verification). Enables more granular reasoning tracking.
   *
   * @param event - Raw event data with type and part object
   * @param state - Shared streaming state
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with reasoning summary part
   * @yields SSEEvent with part structure and metadata
   */
  *handleReasoningSummaryPart(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData = (event as { type: string; part?: unknown }) || {};
    const eventType = eventData.type || '';

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: eventType,
      sequence,
      response: { part: eventData.part },
    });

    yield {
      event: eventType.replace('response.', ''),
      data: JSON.stringify({ part: eventData.part, sequence }),
      sequence,
    };
  }
}
