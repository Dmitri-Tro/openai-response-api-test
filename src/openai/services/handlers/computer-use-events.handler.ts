import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../../common/services/logger.service';
import {
  StreamState,
  SSEEvent,
} from '../../interfaces/streaming-events.interface';

/**
 * Handler service for computer use tool streaming events
 *
 * Processes computer_use tool events in the Responses API orchestrator pattern.
 * Handles UI automation capabilities including screenshots, mouse movements,
 * clicks, keyboard input, and screen interactions. Tracks computer actions
 * and visual outputs throughout the streaming lifecycle.
 *
 * **Events Handled:**
 * - **Action Deltas (4):** `action.delta` for mouse_move, click, type, key actions
 * - **Action Complete (1):** `action.done` when action finishes
 * - **Progress (1):** `in_progress` during action execution
 * - **Screenshots (2):** `output_item.added`, `output_item.done` for screen captures
 * - **Completion (1):** `completed` when tool execution finishes
 *
 * Computer actions are tracked in state.toolCalls Map with call_id as key, maintaining
 * execution status (in_progress, completed) and accumulated data (actions, screenshots).
 * Supports sequential action execution for complex UI automation workflows.
 *
 * @see {@link https://platform.openai.com/docs/guides/computer-use}
 */
@Injectable()
export class ComputerUseEventsHandler {
  constructor(private readonly loggerService: LoggerService) {}

  /**
   * Handle computer use action delta
   *
   * Emitted during computer action execution. Delivers incremental action data
   * as the model constructs computer use commands (mouse movements, clicks, typing).
   * Accumulates into state.toolCalls for complete action reconstruction.
   *
   * @param event - Raw event data with action delta, call_id, and action details
   * @param state - Shared streaming state tracking computer actions
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with action delta
   * @yields SSEEvent with event='computer_use_action_delta', call_id, action_type, and delta
   */
  *handleActionDelta(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData =
      (event as {
        call_id?: string;
        delta?: {
          action_type?: 'mouse_move' | 'click' | 'type' | 'key' | 'screenshot';
          coordinates?: { x: number; y: number };
          text?: string;
          key?: string;
        };
      }) || {};
    const callId = eventData.call_id || 'unknown';
    const delta = eventData.delta;

    if (!state.toolCalls.has(callId)) {
      state.toolCalls.set(callId, {
        type: 'computer_use',
        input: '',
        status: 'in_progress',
      });
    }

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'computer_use_action_delta',
      sequence,
    });

    yield {
      event: 'computer_use_action_delta',
      data: JSON.stringify({
        call_id: callId,
        action: delta,
        sequence,
      }),
      sequence,
    };
  }

  /**
   * Handle computer use action done
   *
   * Emitted when a computer action is complete. Contains the final action details
   * that were executed (e.g., mouse clicked at x,y or text typed). Marks the
   * specific action as completed while the tool call may continue.
   *
   * @param event - Raw event data with call_id and complete action
   * @param state - Shared streaming state
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with completed action
   * @yields SSEEvent with event='computer_use_action_done', call_id, and action
   */
  *handleActionDone(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData =
      (event as {
        call_id?: string;
        action?: {
          action_type?: string;
          coordinates?: { x: number; y: number };
          text?: string;
          key?: string;
        };
      }) || {};
    const callId = eventData.call_id || 'unknown';

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'computer_use_action_done',
      sequence,
      response: { action: eventData.action },
    });

    yield {
      event: 'computer_use_action_done',
      data: JSON.stringify({
        call_id: callId,
        action: eventData.action,
        sequence,
      }),
      sequence,
    };
  }

  /**
   * Handle computer use progress events
   *
   * Emitted during computer use lifecycle (in_progress phase).
   * Indicates the computer use tool is actively executing UI automation actions.
   * Used for showing progress indicators to users.
   *
   * @param event - Computer use progress event with type and call_id
   * @param state - Shared streaming state
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with progress status
   * @yields SSEEvent with event matching type (e.g., 'computer_use.in_progress')
   */
  *handleComputerUseProgress(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData = (event as { type?: string; call_id?: string }) || {};
    const eventType = eventData.type || '';
    const callId = eventData.call_id || 'unknown';

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: eventType,
      sequence,
    });

    yield {
      event: eventType.replace('response.', ''),
      data: JSON.stringify({ call_id: callId, sequence }),
      sequence,
    };
  }

  /**
   * Handle computer use output item (screenshot) added
   *
   * Emitted when a screenshot or visual output is being added. Indicates that
   * the computer use tool has captured screen content. The image data will be
   * provided in base64 format.
   *
   * @param event - Output item added event with call_id and output metadata
   * @param state - Shared streaming state
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event for screenshot start
   * @yields SSEEvent with event='computer_use_output_item_added', call_id
   */
  *handleOutputItemAdded(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData =
      (event as {
        call_id?: string;
        output_index?: number;
      }) || {};
    const callId = eventData.call_id || 'unknown';

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'computer_use_output_item_added',
      sequence,
    });

    yield {
      event: 'computer_use_output_item_added',
      data: JSON.stringify({
        call_id: callId,
        output_index: eventData.output_index,
        sequence,
      }),
      sequence,
    };
  }

  /**
   * Handle computer use output item (screenshot) done
   *
   * Emitted when screenshot output is complete. Contains the full base64-encoded
   * image data of the screen capture. Used for visual verification of computer
   * actions and UI state.
   *
   * @param event - Output item done event with call_id and image data
   * @param state - Shared streaming state
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with complete screenshot
   * @yields SSEEvent with event='computer_use_output_item_done', call_id, image
   */
  *handleOutputItemDone(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData =
      (event as {
        call_id?: string;
        output?: {
          type?: string;
          image_url?: string;
        };
      }) || {};
    const callId = eventData.call_id || 'unknown';

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'computer_use_output_item_done',
      sequence,
      response: {
        type: eventData.output?.type,
        has_image: !!eventData.output?.image_url,
      },
    });

    yield {
      event: 'computer_use_output_item_done',
      data: JSON.stringify({
        call_id: callId,
        output: eventData.output,
        sequence,
      }),
      sequence,
    };
  }

  /**
   * Handle computer use completed with results
   *
   * Emitted when computer use execution finishes. Contains the final results
   * including all actions performed and screenshots captured. Marks tool call
   * as completed with results stored in state.toolCalls[call_id].result.
   *
   * @param event - Computer use completed event with call_id and results
   * @param state - Shared streaming state tracking tool results
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with execution results
   * @yields SSEEvent with event='computer_use_completed', call_id, and results
   */
  *handleComputerUseCompleted(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData =
      (event as {
        call_id?: string;
        output?: unknown;
      }) || {};
    const callId = eventData.call_id || 'unknown';

    if (state.toolCalls.has(callId)) {
      const toolCall = state.toolCalls.get(callId)!;
      toolCall.status = 'completed';
      toolCall.result = eventData.output;
    }

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'computer_use_completed',
      sequence,
      response: { call_id: callId, output: eventData.output },
    });

    yield {
      event: 'computer_use_completed',
      data: JSON.stringify({
        call_id: callId,
        output: eventData.output,
        sequence,
      }),
      sequence,
    };
  }
}
