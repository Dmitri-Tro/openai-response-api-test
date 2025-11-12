import type { Responses } from 'openai/resources/responses';

/**
 * Streaming state tracker for accumulating data across events
 */
export interface StreamState {
  fullText: string;
  reasoning: string;
  reasoningSummary: string;
  refusal: string;
  toolCalls: Map<
    string,
    {
      type: string;
      input: string;
      code?: string;
      status: string;
      result?: unknown;
    }
  >;
  audio: string;
  audioTranscript: string;
  responseId?: string;
  model?: string;
  startTime: number;
  finalResponse?: Responses.Response;
}

/**
 * SSE event data structure for client consumption
 */
export interface SSEEvent {
  event: string;
  data: string;
  sequence: number;
}

/**
 * Event categories for better organization
 */
export enum EventCategory {
  LIFECYCLE = 'lifecycle',
  TEXT = 'text',
  REASONING = 'reasoning',
  TOOL_CALLING = 'tool_calling',
  IMAGE = 'image',
  AUDIO = 'audio',
  MCP = 'mcp',
  REFUSAL = 'refusal',
  STRUCTURAL = 'structural',
  UNKNOWN = 'unknown',
}

/**
 * Comprehensive list of all 51 streaming event types
 */
export const STREAMING_EVENT_TYPES = {
  // Lifecycle Events (7)
  RESPONSE_CREATED: 'response.created',
  RESPONSE_QUEUED: 'response.queued',
  RESPONSE_IN_PROGRESS: 'response.in_progress',
  RESPONSE_COMPLETED: 'response.completed',
  RESPONSE_INCOMPLETE: 'response.incomplete',
  RESPONSE_FAILED: 'response.failed',
  ERROR: 'error',

  // Text Output Events (3)
  TEXT_DELTA: 'response.output_text.delta',
  TEXT_DONE: 'response.output_text.done',
  TEXT_ANNOTATION_ADDED: 'response.output_text.annotation.added',

  // Reasoning Events (6)
  REASONING_TEXT_DELTA: 'response.reasoning_text.delta',
  REASONING_TEXT_DONE: 'response.reasoning_text.done',
  REASONING_SUMMARY_PART_ADDED: 'response.reasoning_summary_part.added',
  REASONING_SUMMARY_PART_DONE: 'response.reasoning_summary_part.done',
  REASONING_SUMMARY_TEXT_DELTA: 'response.reasoning_summary_text.delta',
  REASONING_SUMMARY_TEXT_DONE: 'response.reasoning_summary_text.done',

  // Tool Calling Events (15)
  // Function Calls
  FUNCTION_CALL_ARGUMENTS_DELTA: 'response.function_call_arguments.delta',
  FUNCTION_CALL_ARGUMENTS_DONE: 'response.function_call_arguments.done',

  // Code Interpreter
  CODE_INTERPRETER_IN_PROGRESS: 'response.code_interpreter_call.in_progress',
  CODE_INTERPRETER_CODE_DELTA: 'response.code_interpreter_call_code.delta',
  CODE_INTERPRETER_CODE_DONE: 'response.code_interpreter_call_code.done',
  CODE_INTERPRETER_INTERPRETING: 'response.code_interpreter_call.interpreting',
  CODE_INTERPRETER_COMPLETED: 'response.code_interpreter_call.completed',

  // File Search
  FILE_SEARCH_IN_PROGRESS: 'response.file_search_call.in_progress',
  FILE_SEARCH_SEARCHING: 'response.file_search_call.searching',
  FILE_SEARCH_COMPLETED: 'response.file_search_call.completed',

  // Web Search
  WEB_SEARCH_IN_PROGRESS: 'response.web_search_call.in_progress',
  WEB_SEARCH_SEARCHING: 'response.web_search_call.searching',
  WEB_SEARCH_COMPLETED: 'response.web_search_call.completed',

  // Custom Tools
  CUSTOM_TOOL_INPUT_DELTA: 'response.custom_tool_call_input.delta',
  CUSTOM_TOOL_INPUT_DONE: 'response.custom_tool_call_input.done',

  // MCP Events (8)
  MCP_CALL_IN_PROGRESS: 'response.mcp_call.in_progress',
  MCP_CALL_ARGUMENTS_DELTA: 'response.mcp_call_arguments.delta',
  MCP_CALL_ARGUMENTS_DONE: 'response.mcp_call_arguments.done',
  MCP_CALL_COMPLETED: 'response.mcp_call.completed',
  MCP_CALL_FAILED: 'response.mcp_call.failed',
  MCP_LIST_TOOLS_IN_PROGRESS: 'response.mcp_list_tools.in_progress',
  MCP_LIST_TOOLS_COMPLETED: 'response.mcp_list_tools.completed',
  MCP_LIST_TOOLS_FAILED: 'response.mcp_list_tools.failed',

  // Image Generation Events (4)
  IMAGE_GEN_IN_PROGRESS: 'response.image_generation_call.in_progress',
  IMAGE_GEN_GENERATING: 'response.image_generation_call.generating',
  IMAGE_GEN_PARTIAL: 'response.image_generation_call.partial_image',
  IMAGE_GEN_COMPLETED: 'response.image_generation_call.completed',

  // Audio Events (4)
  AUDIO_DELTA: 'response.audio.delta',
  AUDIO_DONE: 'response.audio.done',
  AUDIO_TRANSCRIPT_DELTA: 'response.audio.transcript.delta',
  AUDIO_TRANSCRIPT_DONE: 'response.audio.transcript.done',

  // Refusal Events (2)
  REFUSAL_DELTA: 'response.refusal.delta',
  REFUSAL_DONE: 'response.refusal.done',

  // Structural Events (2)
  OUTPUT_ITEM_ADDED: 'response.output_item.added',
  OUTPUT_ITEM_DONE: 'response.output_item.done',
  CONTENT_PART_ADDED: 'response.content_part.added',
  CONTENT_PART_DONE: 'response.content_part.done',
} as const;

/**
 * Helper function to categorize event types
 */
export function getEventCategory(eventType: string): EventCategory {
  if (eventType.startsWith('response.output_text')) {
    return EventCategory.TEXT;
  }
  if (eventType.startsWith('response.reasoning')) {
    return EventCategory.REASONING;
  }
  if (
    eventType.includes('function_call') ||
    eventType.includes('code_interpreter') ||
    eventType.includes('file_search') ||
    eventType.includes('web_search') ||
    eventType.includes('custom_tool')
  ) {
    return EventCategory.TOOL_CALLING;
  }
  if (eventType.includes('image_generation')) {
    return EventCategory.IMAGE;
  }
  if (eventType.startsWith('response.audio')) {
    return EventCategory.AUDIO;
  }
  if (eventType.startsWith('response.mcp')) {
    return EventCategory.MCP;
  }
  if (eventType.includes('refusal')) {
    return EventCategory.REFUSAL;
  }
  if (eventType.includes('output_item') || eventType.includes('content_part')) {
    return EventCategory.STRUCTURAL;
  }
  if (
    eventType === 'response.created' ||
    eventType === 'response.completed' ||
    eventType === 'response.failed' ||
    eventType === 'response.incomplete' ||
    eventType === 'response.in_progress' ||
    eventType === 'response.queued' ||
    eventType === 'error'
  ) {
    return EventCategory.LIFECYCLE;
  }
  return EventCategory.UNKNOWN;
}
