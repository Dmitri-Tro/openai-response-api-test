import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../../common/services/logger.service';
import {
  StreamState,
  SSEEvent,
} from '../../interfaces/streaming-events.interface';

/**
 * Handler service for Model Context Protocol (MCP) streaming events
 *
 * Processes 8 events related to the Model Context Protocol, an extensible protocol
 * for connecting AI models to external context sources, tools, and systems.
 * MCP enables models to dynamically access data, invoke functions, and interact
 * with external services during response generation.
 *
 * **Events Handled:**
 * - `response.mcp_call.in_progress` - MCP tool invocation started
 * - `response.mcp_call.arguments.delta` - Incremental argument construction
 * - `response.mcp_call.arguments.done` - Arguments complete
 * - `response.mcp_call.completed` - MCP tool execution finished with results
 * - `response.mcp_call.failed` - MCP tool execution failed
 * - `response.mcp_list_tools.in_progress` - Tool discovery started
 * - `response.mcp_list_tools.completed` - Available tools listed
 * - `response.mcp_list_tools.failed` - Tool discovery failed
 *
 * MCP enables advanced integration patterns like database queries, API calls,
 * document retrieval, and custom business logic execution during inference.
 *
 * @see {@link https://modelcontextprotocol.io}
 */
@Injectable()
export class MCPEventsHandler {
  constructor(private readonly loggerService: LoggerService) {}

  /**
   * Handle MCP call progress
   *
   * Emitted when an MCP tool invocation starts. Indicates the model is calling
   * an external tool via the Model Context Protocol. Used for tracking tool
   * execution lifecycle and displaying progress to users.
   *
   * @param event - Raw event data with call_id
   * @param state - Shared streaming state
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with MCP call progress
   * @yields SSEEvent with event='mcp_call_in_progress' and call_id
   */
  *handleMCPCallProgress(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData = (event as { call_id?: string }) || {};

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'mcp_call_in_progress',
      sequence,
    });

    yield {
      event: 'mcp_call_in_progress',
      data: JSON.stringify({ call_id: eventData.call_id, sequence }),
      sequence,
    };
  }

  /**
   * Handle MCP call arguments delta
   *
   * Emitted during MCP tool argument construction. Delivers incremental argument
   * chunks as the model builds parameters for the external tool call. Arguments
   * are typically structured as JSON for tool input.
   *
   * @param event - Raw event data with delta (argument chunk) and call_id
   * @param state - Shared streaming state
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with MCP argument delta
   * @yields SSEEvent with event='mcp_call_delta', call_id, and argument chunk
   */
  *handleMCPCallDelta(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData = (event as { delta?: string; call_id?: string }) || {};

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'mcp_call_delta',
      sequence,
      delta: eventData.delta,
    });

    yield {
      event: 'mcp_call_delta',
      data: JSON.stringify({
        call_id: eventData.call_id,
        delta: eventData.delta,
        sequence,
      }),
      sequence,
    };
  }

  /**
   * Handle MCP call arguments done
   *
   * Emitted when MCP tool arguments are complete. Contains the full argument
   * structure ready for tool invocation. The external tool will be called with
   * these arguments via the MCP protocol.
   *
   * @param event - Raw event data with call_id and complete arguments
   * @param state - Shared streaming state
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with complete MCP arguments
   * @yields SSEEvent with event='mcp_call_done', call_id, and full arguments
   */
  *handleMCPCallDone(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData =
      (event as { call_id?: string; arguments?: unknown }) || {};

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'mcp_call_done',
      sequence,
      response: { arguments: eventData.arguments },
    });

    yield {
      event: 'mcp_call_done',
      data: JSON.stringify({
        call_id: eventData.call_id,
        arguments: eventData.arguments,
        sequence,
      }),
      sequence,
    };
  }

  /**
   * Handle MCP call completed
   *
   * Emitted when an MCP tool execution finishes successfully. Contains the result
   * returned by the external tool, which the model will use to continue generating
   * the response. Results can be any structured data returned by the tool.
   *
   * @param event - Raw event data with call_id and tool execution result
   * @param state - Shared streaming state
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with MCP tool results
   * @yields SSEEvent with event='mcp_call_completed', call_id, and result
   */
  *handleMCPCallCompleted(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData = (event as { call_id?: string; result?: unknown }) || {};

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'mcp_call_completed',
      sequence,
      response: { result: eventData.result },
    });

    yield {
      event: 'mcp_call_completed',
      data: JSON.stringify({
        call_id: eventData.call_id,
        result: eventData.result,
        sequence,
      }),
      sequence,
    };
  }

  /**
   * Handle MCP call failed
   *
   * Emitted when an MCP tool execution fails due to errors. Contains error details
   * explaining why the tool call failed (timeout, invalid args, tool error, etc.).
   * The model may attempt recovery or inform the user of the failure.
   *
   * @param event - Raw event data with call_id and error details
   * @param state - Shared streaming state
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with MCP error
   * @yields SSEEvent with event='mcp_call_failed', call_id, and error
   */
  *handleMCPCallFailed(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData = (event as { call_id?: string; error?: unknown }) || {};

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'mcp_call_failed',
      sequence,
      error: eventData.error,
    });

    yield {
      event: 'mcp_call_failed',
      data: JSON.stringify({
        call_id: eventData.call_id,
        error: eventData.error,
        sequence,
      }),
      sequence,
    };
  }

  /**
   * Handle MCP list tools events
   *
   * Emitted during MCP tool discovery. Lists available tools that the model can
   * invoke via the Model Context Protocol. Tool discovery happens dynamically
   * to enable runtime tool registration and capability negotiation.
   *
   * @param event - Raw event data with type, tools list, and optional error
   * @param state - Shared streaming state
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with available MCP tools
   * @yields SSEEvent with tools list or error from tool discovery
   */
  *handleMCPListTools(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData =
      (event as {
        type: string;
        tools?: unknown;
        error?: unknown;
      }) || {};

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: eventData.type,
      sequence,
      response: { tools: eventData.tools },
      error: eventData.error,
    });

    yield {
      event: eventData.type.replace('response.', ''),
      data: JSON.stringify({
        tools: eventData.tools,
        error: eventData.error,
        sequence,
      }),
      sequence,
    };
  }
}
