import { ApiProperty } from '@nestjs/swagger';

/**
 * Server-Sent Events (SSE) event types for streaming responses
 *
 * Defines the primary event types emitted during streaming response generation.
 * These represent the high-level event categories that clients should handle
 * for real-time updates. The actual OpenAI Responses API emits 51 detailed
 * event types, which are processed by specialized handlers and mapped to
 * these simplified client-facing events.
 *
 * **Event Types:**
 * - `TEXT_DELTA` - Incremental text chunk streamed during generation
 * - `DONE` - Response generation completed successfully
 * - `ERROR` - Error occurred during generation
 *
 * Additional event types not included here but emitted by the system:
 * - lifecycle events (created, queued, in_progress, completed, failed)
 * - reasoning events (reasoning_delta, reasoning_summary)
 * - tool events (function_call, code_interpreter, file_search, web_search)
 * - image events (image_gen_progress, partial_image, completed)
 * - audio events (audio_delta, audio_transcript)
 * - refusal events (refusal_delta, refusal_done)
 * - structural events (output_item, content_part)
 * - MCP events (mcp_call, mcp_list_tools)
 *
 * @see {@link https://platform.openai.com/docs/api-reference/responses-streaming}
 */
export enum StreamEventType {
  TEXT_DELTA = 'text_delta',
  DONE = 'done',
  ERROR = 'error',
}

/**
 * Data Transfer Object for Server-Sent Events (SSE) streaming response
 *
 * Represents the standardized structure of SSE events emitted during streaming
 * response generation. Used by the OpenAI Responses API to deliver real-time
 * updates as the model generates text, invokes tools, or produces other outputs.
 *
 * **SSE Format:**
 * Events are sent as text/event-stream with format:
 * ```
 * event: text_delta
 * data: {"delta":"Hello","sequence":0}
 *
 * event: done
 * data: {"response":{...},"sequence":5}
 * ```
 *
 * **Event Flow:**
 * 1. `response.created` - Response initialized with ID
 * 2. `response.in_progress` - Generation started
 * 3. `text_delta` events - Incremental text chunks
 * 4. `response.completed` - Generation finished
 * 5. `done` event - Final response with usage stats
 *
 * **Event Processing:**
 * The orchestrator service (OpenAIResponsesService) routes OpenAI events to
 * 9 specialized handlers that process 51 event types:
 * - LifecycleEventsHandler (7 events)
 * - TextEventsHandler (3 events)
 * - ReasoningEventsHandler (6 events)
 * - ToolCallingEventsHandler (15 events)
 * - ImageEventsHandler (4 events)
 * - AudioEventsHandler (4 events)
 * - MCPEventsHandler (8 events)
 * - RefusalEventsHandler (2 events)
 * - StructuralEventsHandler (3 events)
 *
 * Handlers transform detailed OpenAI events into simplified client-facing
 * StreamEventDto instances for easier consumption.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events}
 * @see {@link https://platform.openai.com/docs/api-reference/responses-streaming}
 */
export class StreamEventDto {
  @ApiProperty({
    description: 'Event type',
    enum: StreamEventType,
    example: StreamEventType.TEXT_DELTA,
  })
  event!: StreamEventType;

  @ApiProperty({
    description: 'Event data payload',
    example: { delta: 'Hello', sequence: 0 },
  })
  data!: StreamEventData;
}

/**
 * Data payload for streaming events
 *
 * Contains the actual data transmitted in each SSE event. The structure varies
 * by event type, supporting incremental updates (delta), complete responses,
 * and error information.
 *
 * **Field Usage by Event Type:**
 *
 * **text_delta events:**
 * - `delta` - Incremental text chunk (e.g., "Hello")
 * - `sequence` - Event ordering number (e.g., 0, 1, 2...)
 *
 * **done events:**
 * - `sequence` - Final sequence number
 * - `response` - Complete response object with:
 *   - `id` - Response ID (e.g., "resp_abc123")
 *   - `output_text` - Full generated text
 *   - `usage` - Token consumption stats (input_tokens, output_tokens, total_tokens)
 *
 * **error events:**
 * - `sequence` - Sequence number where error occurred
 * - `error` - Error message string describing the failure
 *
 * **Sequence Numbers:**
 * Used for ordering events in correct sequence, especially important for
 * handling out-of-order delivery in network conditions. Clients should
 * buffer and reorder events by sequence to reconstruct the stream correctly.
 *
 * **Usage Statistics:**
 * The `usage` field in done events provides token consumption metrics:
 * - `input_tokens` - Prompt + system tokens consumed
 * - `output_tokens` - Generated text tokens
 * - `total_tokens` - Sum of input + output tokens
 * - (reasoning tokens tracked separately for o-series models)
 *
 * @see {@link StreamEventDto}
 */
export interface StreamEventData {
  /**
   * Text delta for incremental updates
   */
  delta?: string;

  /**
   * Sequence number for ordering events
   */
  sequence: number;

  /**
   * Complete response when stream is done
   */
  response?: {
    id: string;
    output_text: string;
    usage?: {
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
    };
  };

  /**
   * Error message if stream failed
   */
  error?: string;
}
