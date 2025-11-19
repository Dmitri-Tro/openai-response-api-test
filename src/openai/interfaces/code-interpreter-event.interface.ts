import type { CodeInterpreterOutput } from './code-interpreter-output.interface';

/**
 * Code Interpreter Streaming Event Types
 *
 * Defines strict TypeScript interfaces for all code interpreter streaming events
 * emitted by the OpenAI Responses API during streamed responses.
 *
 * Event Sequence:
 * 1. code_interpreter_call.in_progress - Tool activation
 * 2. code_interpreter_code.delta (multiple) - Code generation
 * 3. code_interpreter_code.done - Complete code ready
 * 4. code_interpreter_call.interpreting - Execution started
 * 5. code_interpreter_call.completed - Execution finished with results
 *
 * @see https://platform.openai.com/docs/api-reference/streaming
 */

/**
 * Base event properties shared by all code interpreter events
 */
interface BaseCodeInterpreterEvent {
  /**
   * Event type discriminator
   */
  type: string;

  /**
   * Unique identifier for this code interpreter call
   *
   * Format: "call_" followed by alphanumeric string
   * Consistent across all events for the same execution
   * Optional in SDK streaming events
   *
   * @example "call_abc123xyz789"
   */
  call_id?: string;

  /**
   * Event sequence number
   *
   * Incrementing number to maintain event order
   * Useful for handling out-of-order delivery
   */
  sequence?: number;
}

/**
 * Code Interpreter Call In Progress Event
 *
 * Emitted when code interpreter tool is activated.
 * First event in the code interpreter sequence.
 *
 * Event type: 'response.code_interpreter_call.in_progress'
 */
export interface CodeInterpreterCallInProgressEvent
  extends BaseCodeInterpreterEvent {
  type: 'response.code_interpreter_call.in_progress';

  /**
   * Container ID (if already assigned)
   *
   * May be available immediately if reusing active container
   * Format: "container_" followed by alphanumeric string
   *
   * @example "container_def456uvw012"
   */
  container_id?: string;
}

/**
 * Code Interpreter Call Generating Event
 *
 * Emitted when model is actively generating code.
 * Indicates code generation is in progress.
 *
 * Event type: 'response.code_interpreter_call.generating'
 */
export interface CodeInterpreterCallGeneratingEvent
  extends BaseCodeInterpreterEvent {
  type: 'response.code_interpreter_call.generating';

  /**
   * Container ID where code will execute
   *
   * @example "container_def456uvw012"
   */
  container_id?: string;
}

/**
 * Code Interpreter Code Delta Event
 *
 * Emitted during code generation with incremental code chunks.
 * Multiple delta events form the complete code.
 * Similar to text streaming deltas.
 *
 * Event type: 'response.code_interpreter_code.delta'
 */
export interface CodeInterpreterCodeDeltaEvent
  extends BaseCodeInterpreterEvent {
  type: 'response.code_interpreter_code.delta';

  /**
   * Incremental code chunk
   *
   * Append to previous deltas to build complete code
   * May be single character or multiple lines
   * Optional in SDK streaming events
   *
   * @example "import math\\n"
   * @example "result = "
   */
  delta?: string;

  /**
   * Current accumulated code (if provided by API)
   *
   * Some implementations include full code snapshot
   * Useful for recovery from missed events
   */
  snapshot?: string;

  /**
   * Index position in the code string (if provided)
   *
   * Helps with precise delta insertion
   */
  index?: number;
}

/**
 * Code Interpreter Code Done Event
 *
 * Emitted when code generation is complete.
 * Contains the full code ready for execution.
 *
 * Event type: 'response.code_interpreter_code.done'
 */
export interface CodeInterpreterCodeDoneEvent extends BaseCodeInterpreterEvent {
  type: 'response.code_interpreter_code.done';

  /**
   * Complete Python code generated
   *
   * Full code string ready for execution
   * Result of accumulating all delta events
   * Optional in SDK streaming events
   *
   * @example "import math\\nresult = math.factorial(5)\\nprint(result)"
   */
  code?: string;

  /**
   * Container ID where code will execute
   *
   * @example "container_def456uvw012"
   */
  container_id?: string;
}

/**
 * Code Interpreter Call Interpreting Event
 *
 * Emitted when code execution has started.
 * Indicates Python interpreter is running the code.
 *
 * Event type: 'response.code_interpreter_call.interpreting'
 */
export interface CodeInterpreterCallInterpretingEvent
  extends BaseCodeInterpreterEvent {
  type: 'response.code_interpreter_call.interpreting';

  /**
   * Container ID where code is executing
   *
   * @example "container_def456uvw012"
   */
  container_id: string;

  /**
   * Complete code being executed
   *
   * May be included in this event for reference
   */
  code?: string;
}

/**
 * Code Interpreter Call Completed Event
 *
 * Emitted when code execution finishes.
 * Contains all execution outputs (logs, images, files, errors).
 * Final event in the code interpreter sequence.
 *
 * Event type: 'response.code_interpreter_call.completed'
 */
export interface CodeInterpreterCallCompletedEvent
  extends BaseCodeInterpreterEvent {
  type: 'response.code_interpreter_call.completed';

  /**
   * Container ID where code was executed
   *
   * Optional in SDK streaming events
   *
   * @example "container_def456uvw012"
   */
  container_id?: string;

  /**
   * Complete code that was executed
   *
   * Full code string for reference
   * Optional in SDK streaming events
   */
  code?: string;

  /**
   * Array of execution outputs
   *
   * Contains logs, generated images/files, and errors
   * May be empty if code produced no output
   * Optional in SDK streaming events
   */
  output?: CodeInterpreterOutput[];

  /**
   * Execution duration in milliseconds (if available)
   *
   * Time taken to execute the Python code
   *
   * @example 1234
   */
  duration_ms?: number;

  /**
   * Whether execution completed successfully
   *
   * False if errors occurred during execution
   * True if code ran without exceptions (even if produced no output)
   */
  success?: boolean;
}

/**
 * Union type of all code interpreter streaming events
 *
 * Use for type-safe event handling with discriminated unions
 */
export type CodeInterpreterEvent =
  | CodeInterpreterCallInProgressEvent
  | CodeInterpreterCallGeneratingEvent
  | CodeInterpreterCodeDeltaEvent
  | CodeInterpreterCodeDoneEvent
  | CodeInterpreterCallInterpretingEvent
  | CodeInterpreterCallCompletedEvent;

/**
 * Type guard to check if event is a code interpreter event
 *
 * @param event - Event object to check
 * @returns True if event is a code interpreter event
 */
export function isCodeInterpreterEvent(
  event: unknown,
): event is CodeInterpreterEvent {
  if (typeof event !== 'object' || event === null) {
    return false;
  }

  const e = event as { type?: unknown };

  if (typeof e.type !== 'string') {
    return false;
  }

  return (
    e.type === 'response.code_interpreter_call.in_progress' ||
    e.type === 'response.code_interpreter_call.generating' ||
    e.type === 'response.code_interpreter_code.delta' ||
    e.type === 'response.code_interpreter_code.done' ||
    e.type === 'response.code_interpreter_call.interpreting' ||
    e.type === 'response.code_interpreter_call.completed'
  );
}

/**
 * Extract call_id from code interpreter event
 *
 * @param event - Code interpreter event
 * @returns Call ID or undefined if not present
 */
export function extractCallId(event: CodeInterpreterEvent): string | undefined {
  return event.call_id;
}

/**
 * Extract container_id from code interpreter event (if available)
 *
 * @param event - Code interpreter event
 * @returns Container ID or undefined if not present
 */
export function extractContainerId(
  event: CodeInterpreterEvent,
): string | undefined {
  if ('container_id' in event) {
    return event.container_id;
  }
  return undefined;
}
