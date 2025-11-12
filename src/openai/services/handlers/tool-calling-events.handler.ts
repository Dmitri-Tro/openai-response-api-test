import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../../common/services/logger.service';
import {
  StreamState,
  SSEEvent,
} from '../../interfaces/streaming-events.interface';

/**
 * Handler service for tool calling streaming events in the orchestrator pattern
 *
 * Processes 15 events related to tool/function calling capabilities in the Responses API.
 * Handles streaming for built-in tools (code_interpreter, file_search, web_search),
 * custom function calls, and extensible custom tools. Tracks tool execution state
 * and results throughout the streaming lifecycle.
 *
 * **Events Handled:**
 * - **Function Calls (2):** `arguments.delta`, `arguments.done`
 * - **Code Interpreter (5):** `in_progress`, `generating`, `code.delta`, `code.done`, `completed`
 * - **File Search (3):** `in_progress`, `searching`, `completed`
 * - **Web Search (3):** `in_progress`, `searching`, `completed`
 * - **Custom Tools (2):** `input.delta`, `input.done`
 *
 * Tool calls are tracked in state.toolCalls Map with call_id as key, maintaining
 * execution status (in_progress, completed) and accumulated data (input, code, results).
 * Supports parallel tool execution with unique call IDs for each invocation.
 *
 * @see {@link https://platform.openai.com/docs/guides/function-calling}
 */
@Injectable()
export class ToolCallingEventsHandler {
  constructor(private readonly loggerService: LoggerService) {}

  // ===== FUNCTION CALL HANDLERS (2) =====

  /**
   * Handle function call arguments delta
   *
   * Emitted during function call argument streaming. Delivers incremental JSON argument
   * chunks as the model constructs function parameters. Accumulates into state.toolCalls
   * for complete argument reconstruction.
   *
   * @param event - Raw event data with delta (argument chunk), call_id, and optional snapshot
   * @param state - Shared streaming state tracking tool calls by ID
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with function argument delta
   * @yields SSEEvent with event='function_call_delta', call_id, delta, and snapshot
   */
  *handleFunctionCallDelta(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData =
      (event as {
        delta?: string;
        call_id?: string;
        snapshot?: string;
      }) || {};
    const callId = eventData.call_id || 'unknown';
    const delta = eventData.delta || '';

    if (!state.toolCalls.has(callId)) {
      state.toolCalls.set(callId, {
        type: 'function',
        input: '',
        status: 'in_progress',
      });
    }
    const toolCall = state.toolCalls.get(callId)!;
    toolCall.input += delta;

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'function_call_delta',
      sequence,
      delta,
    });

    yield {
      event: 'function_call_delta',
      data: JSON.stringify({
        call_id: callId,
        delta,
        snapshot: eventData.snapshot,
        sequence,
      }),
      sequence,
    };
  }

  /**
   * Handle function call arguments done
   *
   * Emitted when function call arguments are complete. Contains the complete JSON
   * argument string ready for function execution. Marks the tool call as completed
   * in state tracking.
   *
   * @param event - Raw event data with call_id and complete arguments JSON
   * @param state - Shared streaming state tracking tool calls
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with complete function arguments
   * @yields SSEEvent with event='function_call_done', call_id, and arguments
   */
  *handleFunctionCallDone(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData = (event as { call_id?: string; arguments?: string }) || {};
    const callId = eventData.call_id || 'unknown';

    if (state.toolCalls.has(callId)) {
      state.toolCalls.get(callId)!.status = 'completed';
    }

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'function_call_done',
      sequence,
      response: { call_id: callId, arguments: eventData.arguments },
    });

    yield {
      event: 'function_call_done',
      data: JSON.stringify({
        call_id: callId,
        arguments: eventData.arguments,
        sequence,
      }),
      sequence,
    };
  }

  // ===== CODE INTERPRETER HANDLERS (5) =====

  /**
   * Handle code interpreter progress events
   *
   * Emitted during code interpreter lifecycle (in_progress, generating phases).
   * Indicates the code interpreter tool is active and generating or executing code.
   * Used for showing progress indicators to users.
   *
   * @param event - Raw event data with type and call_id
   * @param state - Shared streaming state
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with progress status
   * @yields SSEEvent with event matching type (e.g., 'code_interpreter.in_progress')
   */
  *handleCodeInterpreterProgress(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData = (event as { type: string; call_id?: string }) || {};
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
   * Handle code interpreter code delta
   *
   * Emitted as the model generates Python code for the code interpreter. Streams
   * incremental code chunks showing the code being written in real-time.
   * Accumulated in state.toolCalls[call_id].code for complete reconstruction.
   *
   * @param event - Raw event data with delta (code chunk) and call_id
   * @param state - Shared streaming state tracking code generation
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with code delta
   * @yields SSEEvent with event='code_interpreter_code_delta', call_id, and code chunk
   */
  *handleCodeInterpreterCodeDelta(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData = (event as { delta?: string; call_id?: string }) || {};
    const callId = eventData.call_id || 'unknown';
    const delta = eventData.delta || '';

    if (!state.toolCalls.has(callId)) {
      state.toolCalls.set(callId, {
        type: 'code_interpreter',
        input: '',
        code: '',
        status: 'in_progress',
      });
    }
    const toolCall = state.toolCalls.get(callId)!;
    toolCall.code = (toolCall.code || '') + delta;

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'code_interpreter_code_delta',
      sequence,
      delta,
    });

    yield {
      event: 'code_interpreter_code_delta',
      data: JSON.stringify({ call_id: callId, delta, sequence }),
      sequence,
    };
  }

  /**
   * Handle code interpreter code done
   *
   * Emitted when code generation is complete. Contains the full Python code that
   * will be executed by the code interpreter. The code is ready for execution.
   *
   * @param event - Raw event data with call_id and complete code
   * @param state - Shared streaming state
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with complete code
   * @yields SSEEvent with event='code_interpreter_code_done', call_id, and full code
   */
  *handleCodeInterpreterCodeDone(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData = (event as { call_id?: string; code?: string }) || {};

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'code_interpreter_code_done',
      sequence,
      response: { code: eventData.code },
    });

    yield {
      event: 'code_interpreter_code_done',
      data: JSON.stringify({
        call_id: eventData.call_id,
        code: eventData.code,
        sequence,
      }),
      sequence,
    };
  }

  /**
   * Handle code interpreter completed with results
   *
   * Emitted when code execution finishes. Contains the execution output including
   * stdout, stderr, generated files, or plots. Marks tool call as completed with
   * results stored in state.toolCalls[call_id].result.
   *
   * @param event - Raw event data with call_id and output (execution results)
   * @param state - Shared streaming state tracking tool results
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with execution results
   * @yields SSEEvent with event='code_interpreter_completed', call_id, and output
   */
  *handleCodeInterpreterCompleted(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData = (event as { call_id?: string; output?: unknown }) || {};
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
      event_type: 'code_interpreter_completed',
      sequence,
      response: { call_id: callId, output: eventData.output },
    });

    yield {
      event: 'code_interpreter_completed',
      data: JSON.stringify({
        call_id: callId,
        output: eventData.output,
        sequence,
      }),
      sequence,
    };
  }

  // ===== FILE SEARCH HANDLERS (3) =====

  /**
   * Handle file search progress events
   *
   * Emitted during file search lifecycle (in_progress, searching phases).
   * Indicates the file search tool is actively searching through attached documents
   * or knowledge bases for relevant information.
   *
   * @param event - Raw event data with type and call_id
   * @param state - Shared streaming state
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with search progress status
   * @yields SSEEvent with event matching type (e.g., 'file_search.searching')
   */
  *handleFileSearchProgress(
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
   * Handle file search completed with results
   *
   * Emitted when file search finishes. Contains search results including matched
   * document excerpts, citations, and relevance scores. Used for generating
   * grounded responses with source attribution.
   *
   * @param event - Raw event data with call_id and results (matched documents)
   * @param state - Shared streaming state
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with search results
   * @yields SSEEvent with event='file_search_completed', call_id, and results
   */
  *handleFileSearchCompleted(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData = (event as { call_id?: string; results?: unknown }) || {};

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'file_search_completed',
      sequence,
      response: { results: eventData.results },
    });

    yield {
      event: 'file_search_completed',
      data: JSON.stringify({
        call_id: eventData.call_id,
        results: eventData.results,
        sequence,
      }),
      sequence,
    };
  }

  // ===== WEB SEARCH HANDLERS (3) =====

  /**
   * Handle web search progress events
   *
   * Emitted during web search lifecycle (in_progress, searching phases).
   * Indicates the web search tool is actively searching the internet for
   * relevant information to answer the user's query.
   *
   * @param event - Raw event data with type and call_id
   * @param state - Shared streaming state
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with web search progress
   * @yields SSEEvent with event matching type (e.g., 'web_search.searching')
   */
  *handleWebSearchProgress(
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
   * Handle web search completed with results
   *
   * Emitted when web search finishes. Contains search results including URLs,
   * page titles, snippets, and relevance scores. Used for generating responses
   * grounded in current web information with source attribution.
   *
   * @param event - Raw event data with call_id and results (web pages)
   * @param state - Shared streaming state
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with web search results
   * @yields SSEEvent with event='web_search_completed', call_id, and results
   */
  *handleWebSearchCompleted(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData = (event as { call_id?: string; results?: unknown }) || {};

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'web_search_completed',
      sequence,
      response: { results: eventData.results },
    });

    yield {
      event: 'web_search_completed',
      data: JSON.stringify({
        call_id: eventData.call_id,
        results: eventData.results,
        sequence,
      }),
      sequence,
    };
  }

  // ===== CUSTOM TOOL HANDLERS (2) =====

  /**
   * Handle custom tool input delta
   *
   * Emitted during custom tool input streaming for user-defined tools.
   * Delivers incremental input chunks as the model constructs tool parameters.
   * Supports extensible tool systems beyond built-in tools.
   *
   * @param event - Raw event data with delta (input chunk) and call_id
   * @param state - Shared streaming state
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with custom tool input delta
   * @yields SSEEvent with event='custom_tool_delta', call_id, and delta
   */
  *handleCustomToolDelta(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData = (event as { delta?: string; call_id?: string }) || {};

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'custom_tool_delta',
      sequence,
      delta: eventData.delta,
    });

    yield {
      event: 'custom_tool_delta',
      data: JSON.stringify({
        call_id: eventData.call_id,
        delta: eventData.delta,
        sequence,
      }),
      sequence,
    };
  }

  /**
   * Handle custom tool input done
   *
   * Emitted when custom tool input is complete. Contains the full input data
   * ready for custom tool execution. Enables integration with external systems,
   * APIs, or user-defined functions.
   *
   * @param event - Raw event data with call_id and complete input
   * @param state - Shared streaming state
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with complete custom tool input
   * @yields SSEEvent with event='custom_tool_done', call_id, and input
   */
  *handleCustomToolDone(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData = (event as { call_id?: string; input?: unknown }) || {};

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'custom_tool_done',
      sequence,
      response: { input: eventData.input },
    });

    yield {
      event: 'custom_tool_done',
      data: JSON.stringify({
        call_id: eventData.call_id,
        input: eventData.input,
        sequence,
      }),
      sequence,
    };
  }
}
