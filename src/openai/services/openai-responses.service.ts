import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { Responses } from 'openai/resources/responses';
import { LoggerService } from '../../common/services/logger.service';
import { PricingService } from '../../common/services/pricing.service';
import { CreateTextResponseDto } from '../dto/create-text-response.dto';
import { CreateImageResponseDto } from '../dto/create-image-response.dto';
import {
  StreamState,
  SSEEvent,
  STREAMING_EVENT_TYPES,
} from '../interfaces/streaming-events.interface';
import {
  ExtendedResponseCreateParamsNonStreaming,
  ExtendedResponseCreateParamsStreaming,
} from '../interfaces/extended-response-params.interface';
import { LifecycleEventsHandler } from './handlers/lifecycle-events.handler';
import { TextEventsHandler } from './handlers/text-events.handler';
import { ReasoningEventsHandler } from './handlers/reasoning-events.handler';
import { ToolCallingEventsHandler } from './handlers/tool-calling-events.handler';
import { ImageEventsHandler } from './handlers/image-events.handler';
import { AudioEventsHandler } from './handlers/audio-events.handler';
import { MCPEventsHandler } from './handlers/mcp-events.handler';
import { RefusalEventsHandler } from './handlers/refusal-events.handler';
import { StructuralEventsHandler } from './handlers/structural-events.handler';

/**
 * Orchestrator service for interacting with OpenAI Responses API (SDK 6.2+)
 * Uses client.responses.create() instead of chat.completions
 * Handles both text generation and image generation with gpt-image-1
 * Delegates streaming event handling to specialized handler services
 */
@Injectable()
export class OpenAIResponsesService {
  private client: OpenAI;
  private defaultModel: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly loggerService: LoggerService,
    private readonly pricingService: PricingService,
    private readonly lifecycleHandler: LifecycleEventsHandler,
    private readonly textHandler: TextEventsHandler,
    private readonly reasoningHandler: ReasoningEventsHandler,
    private readonly toolCallingHandler: ToolCallingEventsHandler,
    private readonly imageHandler: ImageEventsHandler,
    private readonly audioHandler: AudioEventsHandler,
    private readonly mcpHandler: MCPEventsHandler,
    private readonly refusalHandler: RefusalEventsHandler,
    private readonly structuralHandler: StructuralEventsHandler,
  ) {
    const apiKey = this.configService.get<string>('openai.apiKey');
    const baseURL = this.configService.get<string>('openai.baseUrl');
    this.defaultModel =
      this.configService.get<string>('openai.defaultModel') || 'gpt-5';

    this.client = new OpenAI({
      apiKey,
      baseURL,
      timeout: this.configService.get<number>('openai.timeout'),
      maxRetries: this.configService.get<number>('openai.maxRetries'),
    });
  }

  /**
   * Create a non-streaming text response using OpenAI Responses API
   *
   * Generates text completions using the modern Responses API (SDK 6.2+) with support for
   * 27 parameters including conversation management, optimization, and safety features.
   *
   * @param dto - Text generation parameters including model, input, instructions, and optional parameters
   * @returns Promise resolving to OpenAI Response object with output_text and usage statistics
   *
   * @example
   * ```typescript
   * const response = await service.createTextResponse({
   *   model: 'gpt-4o',
   *   input: 'Explain quantum computing',
   *   instructions: 'You are a helpful assistant',
   *   temperature: 0.7,
   *   max_output_tokens: 1000,
   *   store: true
   * });
   * console.log(response.output_text);
   * console.log(response.usage.input_tokens, response.usage.output_tokens);
   * ```
   *
   * @throws {OpenAI.AuthenticationError} When API key is invalid
   * @throws {OpenAI.RateLimitError} When rate limit is exceeded
   * @throws {OpenAI.BadRequestError} When parameters are invalid
   *
   * @see https://platform.openai.com/docs/api-reference/responses
   */
  async createTextResponse(
    dto: CreateTextResponseDto,
  ): Promise<Responses.Response> {
    const startTime = Date.now();

    try {
      // Build request parameters for Responses API
      const params: ExtendedResponseCreateParamsNonStreaming = {
        model: dto.model || this.defaultModel,
        input: dto.input,
        stream: false,
      };

      // Add instructions if provided (replaces system message)
      if (dto.instructions) {
        params.instructions = dto.instructions;
      }

      // Add modalities if provided (text, audio)
      if (dto.modalities) {
        params.modalities = dto.modalities;
      }

      // Add tools if provided
      if (dto.tools) {
        // Type assertion: DTO validation ensures tools are valid
        params.tools =
          dto.tools as Responses.ResponseCreateParamsStreaming['tools'];
      }

      // Add text configuration if provided (includes format and verbosity)
      if (dto.text !== undefined) {
        params.text = dto.text;
      }

      // Add sampling parameters if provided
      if (dto.temperature !== undefined) {
        params.temperature = dto.temperature;
      }

      if (dto.top_p !== undefined) {
        params.top_p = dto.top_p;
      }

      // Add conversation management parameters
      if (dto.conversation !== undefined) {
        params.conversation = dto.conversation;
      }

      if (dto.previous_response_id !== undefined) {
        params.previous_response_id = dto.previous_response_id;
      }

      if (dto.store !== undefined) {
        params.store = dto.store;
      }

      // Add response control parameters
      if (dto.max_output_tokens !== undefined) {
        params.max_output_tokens = dto.max_output_tokens;
      }

      if (dto.tool_choice !== undefined) {
        params.tool_choice = dto.tool_choice;
      }

      if (dto.parallel_tool_calls !== undefined) {
        params.parallel_tool_calls = dto.parallel_tool_calls;
      }

      // Add optimization parameters
      // Caching & Performance
      if (dto.prompt_cache_key !== undefined) {
        params.prompt_cache_key = dto.prompt_cache_key;
      }

      if (dto.service_tier !== undefined) {
        params.service_tier = dto.service_tier;
      }

      if (dto.background !== undefined) {
        params.background = dto.background;
      }

      if (dto.truncation !== undefined) {
        params.truncation = dto.truncation;
      }

      // Safety & Metadata
      if (dto.safety_identifier !== undefined) {
        params.safety_identifier = dto.safety_identifier;
      }

      if (dto.metadata !== undefined) {
        params.metadata = dto.metadata;
      }

      // Add advanced features
      if (dto.prompt !== undefined) {
        params.prompt = dto.prompt as
          | Responses.ResponsePrompt
          | null
          | undefined;
      }

      if (dto.include !== undefined) {
        params.include = dto.include as
          | Array<Responses.ResponseIncludable>
          | null
          | undefined;
      }

      if (dto.reasoning !== undefined) {
        // Import Shared types at top of file for this
        params.reasoning = dto.reasoning as typeof params.reasoning;
      }

      // Note: max_tokens, frequency_penalty, and presence_penalty are not supported
      // by the Responses API according to the OpenAI SDK types
      // Only temperature and top_p are available

      // Make the API call using Responses API
      const response: Responses.Response =
        await this.client.responses.create(params);

      const latency = Date.now() - startTime;

      // Extract usage information with detailed token breakdown
      const usage = this.extractUsage(response);

      // Extract response metadata (status, error, incomplete_details)
      const responseMetadata = this.extractResponseMetadata(response);

      // Log the full native OpenAI response with enhanced metadata
      this.loggerService.logOpenAIInteraction({
        timestamp: new Date().toISOString(),
        api: 'responses',
        endpoint: '/v1/responses',
        // Intentional assertion: params type is complex OpenAI SDK type that needs serialization for logging
        request: params as Record<string, unknown>,
        response: response,
        metadata: {
          latency_ms: latency,
          tokens_used: usage?.total_tokens,
          cached_tokens: usage?.cached_tokens,
          reasoning_tokens: usage?.reasoning_tokens,
          cost_estimate: this.estimateCost(usage, response.model),
          rate_limit_headers: {},
          response_status: responseMetadata.status,
          response_error: responseMetadata.error,
          incomplete_details: responseMetadata.incomplete_details,
          conversation: responseMetadata.conversation,
          background: responseMetadata.background,
          max_output_tokens: responseMetadata.max_output_tokens,
          previous_response_id: responseMetadata.previous_response_id,
        },
      });

      return response;
    } catch (error) {
      const latency = Date.now() - startTime;

      // Type guard for errors with message property
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Type-safe error handling
      const errorDetails: Record<string, unknown> = {
        message: errorMessage,
      };

      if (this.hasErrorType(error)) {
        errorDetails.type = error.type;
      }

      if (this.hasErrorCode(error)) {
        errorDetails.code = error.code;
      }

      if (this.hasErrorStatus(error)) {
        errorDetails.status = error.status;
      }

      // Log the error
      this.loggerService.logOpenAIInteraction({
        timestamp: new Date().toISOString(),
        api: 'responses',
        endpoint: '/v1/responses',
        request: {
          model: dto.model || this.defaultModel,
          input: dto.input,
        },
        error: {
          ...errorDetails,
          message: errorMessage,
          original_error: error,
        },
        metadata: {
          latency_ms: latency,
        },
      });

      throw error;
    }
  }

  /**
   * Create a streaming text response using OpenAI Responses API with Server-Sent Events
   *
   * Generates text completions as a stream of events using the Responses API (SDK 6.2+).
   * Handles all 51 streaming event types by delegating to specialized handler services
   * in an orchestrator pattern for maintainable and testable code.
   *
   * Streaming events are processed in real-time and include: lifecycle events (created, completed,
   * failed), text deltas, reasoning tokens (o-series models), tool calls, image generation,
   * audio output, MCP events, refusals, and structural boundaries.
   *
   * @param dto - Text generation parameters including model, input, and optional streaming configuration
   * @returns AsyncIterable yielding SSE events in format: `{event: string, data: string, sequence: number}`
   *
   * @example
   * ```typescript
   * const stream = service.createTextResponseStream({
   *   model: 'gpt-4o',
   *   input: 'Tell me a story',
   *   temperature: 0.8,
   *   stream_options: { include_obfuscation: true }
   * });
   *
   * for await (const event of stream) {
   *   console.log(`Event: ${event.event}`);
   *   const data = JSON.parse(event.data);
   *   if (data.delta) console.log(data.delta);
   * }
   * ```
   *
   * @throws {OpenAI.AuthenticationError} When API key is invalid
   * @throws {OpenAI.RateLimitError} When rate limit is exceeded
   * @throws {OpenAI.APIConnectionTimeoutError} When request times out
   *
   * @see https://platform.openai.com/docs/api-reference/responses-streaming
   */
  async *createTextResponseStream(
    dto: CreateTextResponseDto,
  ): AsyncIterable<SSEEvent> {
    const startTime = Date.now();

    // Initialize state tracking for accumulated data
    const state: StreamState = {
      fullText: '',
      reasoning: '',
      reasoningSummary: '',
      refusal: '',
      toolCalls: new Map(),
      audio: '',
      audioTranscript: '',
      startTime,
    };

    try {
      // Build request parameters for Responses API with streaming
      const params: ExtendedResponseCreateParamsStreaming = {
        model: dto.model || this.defaultModel,
        input: dto.input,
        stream: true,
      };

      // Add instructions if provided
      if (dto.instructions) {
        params.instructions = dto.instructions;
      }

      // Add modalities if provided (text, audio)
      if (dto.modalities) {
        params.modalities = dto.modalities;
      }

      // Add tools if provided
      if (dto.tools) {
        // Type assertion: DTO validation ensures tools are valid
        params.tools =
          dto.tools as Responses.ResponseCreateParamsStreaming['tools'];
      }

      // Add text configuration if provided (includes format and verbosity)
      if (dto.text !== undefined) {
        params.text = dto.text;
      }

      // Add sampling parameters if provided
      if (dto.temperature !== undefined) {
        params.temperature = dto.temperature;
      }

      if (dto.top_p !== undefined) {
        params.top_p = dto.top_p;
      }

      // Add conversation management parameters
      if (dto.conversation !== undefined) {
        params.conversation = dto.conversation;
      }

      if (dto.previous_response_id !== undefined) {
        params.previous_response_id = dto.previous_response_id;
      }

      if (dto.store !== undefined) {
        params.store = dto.store;
      }

      // Add response control parameters
      if (dto.max_output_tokens !== undefined) {
        params.max_output_tokens = dto.max_output_tokens;
      }

      if (dto.tool_choice !== undefined) {
        params.tool_choice = dto.tool_choice;
      }

      if (dto.parallel_tool_calls !== undefined) {
        params.parallel_tool_calls = dto.parallel_tool_calls;
      }

      // Add optimization parameters
      // Caching & Performance
      if (dto.prompt_cache_key !== undefined) {
        params.prompt_cache_key = dto.prompt_cache_key;
      }

      if (dto.service_tier !== undefined) {
        params.service_tier = dto.service_tier;
      }

      if (dto.background !== undefined) {
        params.background = dto.background;
      }

      if (dto.truncation !== undefined) {
        params.truncation = dto.truncation;
      }

      // Safety & Metadata
      if (dto.safety_identifier !== undefined) {
        params.safety_identifier = dto.safety_identifier;
      }

      if (dto.metadata !== undefined) {
        params.metadata = dto.metadata;
      }

      // Stream Options
      if (dto.stream_options !== undefined) {
        params.stream_options = dto.stream_options;
      }

      // Add advanced features
      if (dto.prompt !== undefined) {
        params.prompt = dto.prompt as
          | Responses.ResponsePrompt
          | null
          | undefined;
      }

      if (dto.include !== undefined) {
        params.include = dto.include as
          | Array<Responses.ResponseIncludable>
          | null
          | undefined;
      }

      if (dto.reasoning !== undefined) {
        params.reasoning = dto.reasoning as typeof params.reasoning;
      }

      // Log stream start
      this.loggerService.logStreamingEvent({
        timestamp: new Date().toISOString(),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'stream_start',
        sequence: 0,
        // Type assertion for logging: serialize extended params as plain object
        request: params as unknown as Record<string, unknown>,
      });

      // Make the streaming API call
      const stream = await this.client.responses.create(params);

      // Process all streaming events with comprehensive switch/case
      for await (const event of stream) {
        const sequence = event.sequence_number || 0;

        // Comprehensive event handling with switch statement
        // Delegates to specialized handler services
        switch (event.type) {
          // ===== LIFECYCLE EVENTS (7) =====
          case STREAMING_EVENT_TYPES.RESPONSE_CREATED:
            yield* this.lifecycleHandler.handleResponseCreated(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.RESPONSE_COMPLETED:
            yield* this.lifecycleHandler.handleResponseCompleted(
              event,
              state,
              sequence,
              (response: Responses.Response) => this.extractUsage(response),
              (response: Responses.Response) =>
                this.extractResponseMetadata(response),
              (
                usage: {
                  prompt_tokens?: number;
                  completion_tokens?: number;
                  total_tokens?: number;
                } | null,
              ) => this.estimateCost(usage),
            );
            break;

          case STREAMING_EVENT_TYPES.RESPONSE_FAILED:
            yield* this.lifecycleHandler.handleResponseFailed(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.ERROR:
            yield* this.lifecycleHandler.handleErrorEvent(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.RESPONSE_IN_PROGRESS:
            yield* this.lifecycleHandler.handleResponseInProgress(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.RESPONSE_INCOMPLETE:
            yield* this.lifecycleHandler.handleResponseIncomplete(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.RESPONSE_QUEUED:
            yield* this.lifecycleHandler.handleResponseQueued(
              event,
              state,
              sequence,
            );
            break;

          // ===== TEXT OUTPUT EVENTS (3) =====
          case STREAMING_EVENT_TYPES.TEXT_DELTA:
            yield* this.textHandler.handleTextDelta(event, state, sequence);
            break;

          case STREAMING_EVENT_TYPES.TEXT_DONE:
            yield* this.textHandler.handleTextDone(event, state, sequence);
            break;

          case STREAMING_EVENT_TYPES.TEXT_ANNOTATION_ADDED:
            yield* this.textHandler.handleTextAnnotation(
              event,
              state,
              sequence,
            );
            break;

          // ===== REASONING EVENTS (6) =====
          case STREAMING_EVENT_TYPES.REASONING_TEXT_DELTA:
            yield* this.reasoningHandler.handleReasoningTextDelta(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.REASONING_TEXT_DONE:
            yield* this.reasoningHandler.handleReasoningTextDone(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.REASONING_SUMMARY_TEXT_DELTA:
            yield* this.reasoningHandler.handleReasoningSummaryDelta(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.REASONING_SUMMARY_TEXT_DONE:
            yield* this.reasoningHandler.handleReasoningSummaryDone(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.REASONING_SUMMARY_PART_ADDED:
          case STREAMING_EVENT_TYPES.REASONING_SUMMARY_PART_DONE:
            yield* this.reasoningHandler.handleReasoningSummaryPart(
              event,
              state,
              sequence,
            );
            break;

          // ===== TOOL CALLING EVENTS (15) =====
          // Function Calls
          case STREAMING_EVENT_TYPES.FUNCTION_CALL_ARGUMENTS_DELTA:
            yield* this.toolCallingHandler.handleFunctionCallDelta(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.FUNCTION_CALL_ARGUMENTS_DONE:
            yield* this.toolCallingHandler.handleFunctionCallDone(
              event,
              state,
              sequence,
            );
            break;

          // Code Interpreter
          case STREAMING_EVENT_TYPES.CODE_INTERPRETER_IN_PROGRESS:
          case STREAMING_EVENT_TYPES.CODE_INTERPRETER_INTERPRETING:
            yield* this.toolCallingHandler.handleCodeInterpreterProgress(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.CODE_INTERPRETER_CODE_DELTA:
            yield* this.toolCallingHandler.handleCodeInterpreterCodeDelta(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.CODE_INTERPRETER_CODE_DONE:
            yield* this.toolCallingHandler.handleCodeInterpreterCodeDone(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.CODE_INTERPRETER_COMPLETED:
            yield* this.toolCallingHandler.handleCodeInterpreterCompleted(
              event,
              state,
              sequence,
            );
            break;

          // File Search
          case STREAMING_EVENT_TYPES.FILE_SEARCH_IN_PROGRESS:
          case STREAMING_EVENT_TYPES.FILE_SEARCH_SEARCHING:
            yield* this.toolCallingHandler.handleFileSearchProgress(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.FILE_SEARCH_COMPLETED:
            yield* this.toolCallingHandler.handleFileSearchCompleted(
              event,
              state,
              sequence,
            );
            break;

          // Web Search
          case STREAMING_EVENT_TYPES.WEB_SEARCH_IN_PROGRESS:
          case STREAMING_EVENT_TYPES.WEB_SEARCH_SEARCHING:
            yield* this.toolCallingHandler.handleWebSearchProgress(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.WEB_SEARCH_COMPLETED:
            yield* this.toolCallingHandler.handleWebSearchCompleted(
              event,
              state,
              sequence,
            );
            break;

          // Custom Tools
          case STREAMING_EVENT_TYPES.CUSTOM_TOOL_INPUT_DELTA:
            yield* this.toolCallingHandler.handleCustomToolDelta(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.CUSTOM_TOOL_INPUT_DONE:
            yield* this.toolCallingHandler.handleCustomToolDone(
              event,
              state,
              sequence,
            );
            break;

          // ===== IMAGE GENERATION EVENTS (4) =====
          case STREAMING_EVENT_TYPES.IMAGE_GEN_IN_PROGRESS:
          case STREAMING_EVENT_TYPES.IMAGE_GEN_GENERATING:
            yield* this.imageHandler.handleImageGenProgress(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.IMAGE_GEN_PARTIAL:
            yield* this.imageHandler.handleImageGenPartial(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.IMAGE_GEN_COMPLETED:
            yield* this.imageHandler.handleImageGenCompleted(
              event,
              state,
              sequence,
            );
            break;

          // ===== AUDIO EVENTS (4) =====
          case STREAMING_EVENT_TYPES.AUDIO_DELTA:
            yield* this.audioHandler.handleAudioDelta(event, state, sequence);
            break;

          case STREAMING_EVENT_TYPES.AUDIO_DONE:
            yield* this.audioHandler.handleAudioDone(event, state, sequence);
            break;

          case STREAMING_EVENT_TYPES.AUDIO_TRANSCRIPT_DELTA:
            yield* this.audioHandler.handleAudioTranscriptDelta(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.AUDIO_TRANSCRIPT_DONE:
            yield* this.audioHandler.handleAudioTranscriptDone(
              event,
              state,
              sequence,
            );
            break;

          // ===== MCP EVENTS (8) =====
          case STREAMING_EVENT_TYPES.MCP_CALL_IN_PROGRESS:
            yield* this.mcpHandler.handleMCPCallProgress(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.MCP_CALL_ARGUMENTS_DELTA:
            yield* this.mcpHandler.handleMCPCallDelta(event, state, sequence);
            break;

          case STREAMING_EVENT_TYPES.MCP_CALL_ARGUMENTS_DONE:
            yield* this.mcpHandler.handleMCPCallDone(event, state, sequence);
            break;

          case STREAMING_EVENT_TYPES.MCP_CALL_COMPLETED:
            yield* this.mcpHandler.handleMCPCallCompleted(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.MCP_CALL_FAILED:
            yield* this.mcpHandler.handleMCPCallFailed(event, state, sequence);
            break;

          case STREAMING_EVENT_TYPES.MCP_LIST_TOOLS_IN_PROGRESS:
          case STREAMING_EVENT_TYPES.MCP_LIST_TOOLS_COMPLETED:
          case STREAMING_EVENT_TYPES.MCP_LIST_TOOLS_FAILED:
            yield* this.mcpHandler.handleMCPListTools(event, state, sequence);
            break;

          // ===== REFUSAL EVENTS (2) =====
          case STREAMING_EVENT_TYPES.REFUSAL_DELTA:
            yield* this.refusalHandler.handleRefusalDelta(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.REFUSAL_DONE:
            yield* this.refusalHandler.handleRefusalDone(
              event,
              state,
              sequence,
            );
            break;

          // ===== STRUCTURAL EVENTS (2) =====
          case STREAMING_EVENT_TYPES.OUTPUT_ITEM_ADDED:
          case STREAMING_EVENT_TYPES.OUTPUT_ITEM_DONE:
          case STREAMING_EVENT_TYPES.CONTENT_PART_ADDED:
          case STREAMING_EVENT_TYPES.CONTENT_PART_DONE:
            yield* this.structuralHandler.handleStructuralEvent(
              event,
              state,
              sequence,
            );
            break;

          // ===== UNKNOWN EVENTS =====
          default:
            yield* this.structuralHandler.handleUnknownEvent(
              event,
              state,
              sequence,
            );
            break;
        }
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Log the error
      this.loggerService.logStreamingEvent({
        timestamp: new Date().toISOString(),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'stream_error',
        sequence: 0,
        error: {
          message: errorMessage,
          // Intentional assertion: error can be any type, needs serialization for logging
          original_error: error,
        },
        metadata: {
          latency_ms: latency,
        },
      });

      // Yield error event
      yield {
        event: 'error',
        data: JSON.stringify({ error: errorMessage }),
        sequence: 0,
      };

      throw error;
    }
  }

  /**
   * Generate an image using gpt-image-1 model via Responses API
   *
   * Creates images using the gpt-image-1 image generation tool integrated into the Responses API.
   * Supports 9 image-specific parameters for quality, format, size, moderation, and compression control.
   * The generated image is returned as base64-encoded data in the response.output_text field.
   *
   * @param dto - Image generation parameters including prompt and image configuration options
   * @returns Promise resolving to Response object with base64-encoded image in output_text
   *
   * @example
   * ```typescript
   * const response = await service.createImageResponse({
   *   model: 'gpt-4o',
   *   input: 'A futuristic city at sunset with flying cars',
   *   image_model: 'gpt-image-1',
   *   image_quality: 'high',
   *   image_format: 'webp',
   *   image_size: '1536x1024',
   *   output_compression: 95
   * });
   *
   * // Output format: "data:image/webp;base64,..."
   * const base64Image = response.output_text;
   * ```
   *
   * @throws {OpenAI.BadRequestError} When image parameters are invalid or content violates policy
   * @throws {OpenAI.RateLimitError} When image generation rate limit is exceeded
   *
   * @see https://platform.openai.com/docs/api-reference/responses
   */
  async createImageResponse(
    dto: CreateImageResponseDto,
  ): Promise<Responses.Response> {
    const startTime = Date.now();

    try {
      // Build request parameters for Responses API with gpt-image-1
      const params: ExtendedResponseCreateParamsNonStreaming = {
        model: dto.model || 'gpt-5', // Use gpt-4o for image generation capability
        input: dto.input,
        stream: false,
      };

      // Add instructions if provided
      if (dto.instructions) {
        params.instructions = dto.instructions;
      }

      // Add modalities if provided (text, audio)
      if (dto.modalities) {
        params.modalities = dto.modalities;
      }

      // Build image_generation tool parameters
      // Build as a plain object to avoid type conflicts, then cast to Tool type
      const imageGenerationToolConfig: Record<string, unknown> = {
        type: 'image_generation',
      };

      // Add image model if specified
      if (dto.image_model !== undefined) {
        imageGenerationToolConfig.model = dto.image_model;
      }

      // Add image quality if specified
      if (dto.image_quality !== undefined) {
        imageGenerationToolConfig.quality = dto.image_quality;
      }

      // Add image format if specified
      if (dto.image_format !== undefined) {
        imageGenerationToolConfig.output_format = dto.image_format;
      }

      // Add image size if specified
      if (dto.image_size !== undefined) {
        imageGenerationToolConfig.size = dto.image_size;
      }

      // Add moderation level if specified
      if (dto.image_moderation !== undefined) {
        imageGenerationToolConfig.moderation = dto.image_moderation;
      }

      // Add background style if specified
      if (dto.image_background !== undefined) {
        imageGenerationToolConfig.background = dto.image_background;
      }

      // Add input fidelity if specified
      if (dto.input_fidelity !== undefined) {
        imageGenerationToolConfig.input_fidelity = dto.input_fidelity;
      }

      // Add output compression if specified
      if (dto.output_compression !== undefined) {
        imageGenerationToolConfig.output_compression = dto.output_compression;
      }

      // Add partial images setting if specified (for streaming support)
      if (dto.partial_images !== undefined) {
        imageGenerationToolConfig.partial_images = dto.partial_images;
      }

      // Intentional type assertion: Building image_generation tool config dynamically
      // The SDK's Tool type is a discriminated union, and we're constructing it incrementally
      // Double cast is necessary because we're building the object dynamically
      const imageGenerationTool =
        imageGenerationToolConfig as unknown as Responses.Tool;

      // Combine user-provided tools with image_generation tool
      params.tools = dto.tools
        ? [...(dto.tools as Responses.Tool[]), imageGenerationTool]
        : [imageGenerationTool];

      // Add conversation management parameters
      if (dto.conversation !== undefined) {
        params.conversation = dto.conversation;
      }

      if (dto.previous_response_id !== undefined) {
        params.previous_response_id = dto.previous_response_id;
      }

      if (dto.store !== undefined) {
        params.store = dto.store;
      }

      // Add response control parameters
      if (dto.max_output_tokens !== undefined) {
        params.max_output_tokens = dto.max_output_tokens;
      }

      if (dto.tool_choice !== undefined) {
        params.tool_choice = dto.tool_choice;
      }

      if (dto.parallel_tool_calls !== undefined) {
        params.parallel_tool_calls = dto.parallel_tool_calls;
      }

      // Add optimization parameters
      // Caching & Performance
      if (dto.prompt_cache_key !== undefined) {
        params.prompt_cache_key = dto.prompt_cache_key;
      }

      if (dto.service_tier !== undefined) {
        params.service_tier = dto.service_tier;
      }

      if (dto.background !== undefined) {
        params.background = dto.background;
      }

      if (dto.truncation !== undefined) {
        params.truncation = dto.truncation;
      }

      // Safety & Metadata
      if (dto.safety_identifier !== undefined) {
        params.safety_identifier = dto.safety_identifier;
      }

      if (dto.metadata !== undefined) {
        params.metadata = dto.metadata;
      }

      // Add advanced features (prompt and include, no reasoning for images)
      if (dto.prompt !== undefined) {
        params.prompt = dto.prompt as
          | Responses.ResponsePrompt
          | null
          | undefined;
      }

      if (dto.include !== undefined) {
        params.include = dto.include as
          | Array<Responses.ResponseIncludable>
          | null
          | undefined;
      }

      // Make the API call using Responses API
      const response: Responses.Response =
        await this.client.responses.create(params);

      const latency = Date.now() - startTime;

      // Extract usage information with detailed token breakdown
      const usage = this.extractUsage(response);

      // Extract response metadata (status, error, incomplete_details)
      const responseMetadata = this.extractResponseMetadata(response);

      // Log the full native OpenAI response with enhanced metadata
      this.loggerService.logOpenAIInteraction({
        timestamp: new Date().toISOString(),
        api: 'responses',
        endpoint: '/v1/responses (gpt-image-1)',
        // Intentional assertion: params type is complex OpenAI SDK type that needs serialization for logging
        request: params as Record<string, unknown>,
        response: response,
        metadata: {
          latency_ms: latency,
          tokens_used: usage?.total_tokens,
          cached_tokens: usage?.cached_tokens,
          reasoning_tokens: usage?.reasoning_tokens,
          cost_estimate: this.estimateCost(usage, response.model),
          rate_limit_headers: {},
          response_status: responseMetadata.status,
          response_error: responseMetadata.error,
          incomplete_details: responseMetadata.incomplete_details,
          conversation: responseMetadata.conversation,
          background: responseMetadata.background,
          max_output_tokens: responseMetadata.max_output_tokens,
          previous_response_id: responseMetadata.previous_response_id,
        },
      });

      return response;
    } catch (error) {
      const latency = Date.now() - startTime;

      // Build error details
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorDetails: {
        message: string;
        type?: string;
        code?: string;
        status?: number;
      } = {
        message: errorMessage,
      };

      if (this.hasErrorType(error)) {
        errorDetails.type = error.type;
      }

      if (this.hasErrorCode(error)) {
        errorDetails.code = error.code;
      }

      if (this.hasErrorStatus(error)) {
        errorDetails.status = error.status;
      }

      // Log the error
      this.loggerService.logOpenAIInteraction({
        timestamp: new Date().toISOString(),
        api: 'responses',
        endpoint: '/v1/responses (gpt-image-1)',
        request: {
          model: dto.model || 'gpt-image-1',
          input: dto.input,
        },
        error: {
          ...errorDetails,
          message: errorMessage,
          original_error: error,
        },
        metadata: {
          latency_ms: latency,
        },
      });

      throw error;
    }
  }

  /**
   * Generate an image with progressive rendering using streaming SSE
   *
   * Creates images using gpt-image-1 with progressive rendering support via partial images (0-3).
   * As the image generates, the API streams partial image data allowing for better user experience
   * by showing incremental progress. Each partial image is base64-encoded and delivered via SSE.
   *
   * @param dto - Image generation parameters with optional partial_images setting (default: 3)
   * @returns AsyncIterable yielding SSE events including in_progress, partial_image, and completed events
   *
   * @example
   * ```typescript
   * const stream = service.createImageResponseStream({
   *   model: 'gpt-4o',
   *   input: 'A serene mountain landscape',
   *   image_model: 'gpt-image-1',
   *   image_quality: 'high',
   *   partial_images: 3  // Stream 3 progressive partial images
   * });
   *
   * for await (const event of stream) {
   *   if (event.event === 'response.image_generation_call.partial_image') {
   *     const data = JSON.parse(event.data);
   *     // data.image_data contains base64-encoded partial image
   *     displayPartialImage(data.image_data);
   *   }
   * }
   * ```
   *
   * @throws {OpenAI.BadRequestError} When image parameters are invalid
   * @throws {OpenAI.APIConnectionTimeoutError} When generation times out
   *
   * @see https://platform.openai.com/docs/api-reference/responses-streaming
   */
  async *createImageResponseStream(
    dto: CreateImageResponseDto,
  ): AsyncIterable<SSEEvent> {
    const startTime = Date.now();

    // Initialize state tracking for accumulated data
    const state: StreamState = {
      fullText: '',
      reasoning: '',
      reasoningSummary: '',
      refusal: '',
      toolCalls: new Map(),
      audio: '',
      audioTranscript: '',
      startTime,
    };

    try {
      // Build request parameters for streaming
      const params: ExtendedResponseCreateParamsStreaming = {
        model: dto.model || 'gpt-5', // Use gpt-4o for image generation capability
        input: dto.input,
        stream: true,
      };

      // Add instructions if provided
      if (dto.instructions) {
        params.instructions = dto.instructions;
      }

      // Add modalities if provided (text, audio)
      if (dto.modalities) {
        params.modalities = dto.modalities;
      }

      // Build image_generation tool parameters
      const imageGenerationToolConfig: Record<string, unknown> = {
        type: 'image_generation',
      };

      // Add image parameters
      if (dto.image_model !== undefined) {
        imageGenerationToolConfig.model = dto.image_model;
      }
      if (dto.image_quality !== undefined) {
        imageGenerationToolConfig.quality = dto.image_quality;
      }
      if (dto.image_format !== undefined) {
        imageGenerationToolConfig.output_format = dto.image_format;
      }
      if (dto.image_size !== undefined) {
        imageGenerationToolConfig.size = dto.image_size;
      }
      if (dto.image_moderation !== undefined) {
        imageGenerationToolConfig.moderation = dto.image_moderation;
      }
      if (dto.image_background !== undefined) {
        imageGenerationToolConfig.background = dto.image_background;
      }
      if (dto.input_fidelity !== undefined) {
        imageGenerationToolConfig.input_fidelity = dto.input_fidelity;
      }
      if (dto.output_compression !== undefined) {
        imageGenerationToolConfig.output_compression = dto.output_compression;
      }
      // Enable progressive rendering - default to 3 for best streaming experience
      imageGenerationToolConfig.partial_images = dto.partial_images ?? 3;

      // Cast to Tool type
      const imageGenerationTool =
        imageGenerationToolConfig as unknown as Responses.Tool;

      // Combine user-provided tools with image_generation tool
      params.tools = dto.tools
        ? [...(dto.tools as Responses.Tool[]), imageGenerationTool]
        : [imageGenerationTool];

      // Add conversation parameters
      if (dto.conversation !== undefined) {
        params.conversation = dto.conversation;
      }
      if (dto.previous_response_id !== undefined) {
        params.previous_response_id = dto.previous_response_id;
      }
      if (dto.store !== undefined) {
        params.store = dto.store;
      }

      // Add response control parameters
      if (dto.max_output_tokens !== undefined) {
        params.max_output_tokens = dto.max_output_tokens;
      }
      if (dto.tool_choice !== undefined) {
        params.tool_choice = dto.tool_choice;
      }
      if (dto.parallel_tool_calls !== undefined) {
        params.parallel_tool_calls = dto.parallel_tool_calls;
      }

      // Add optimization parameters
      if (dto.prompt_cache_key !== undefined) {
        params.prompt_cache_key = dto.prompt_cache_key;
      }
      if (dto.service_tier !== undefined) {
        params.service_tier = dto.service_tier;
      }
      if (dto.background !== undefined) {
        params.background = dto.background;
      }
      if (dto.truncation !== undefined) {
        params.truncation = dto.truncation;
      }
      if (dto.safety_identifier !== undefined) {
        params.safety_identifier = dto.safety_identifier;
      }
      if (dto.metadata !== undefined) {
        params.metadata = dto.metadata;
      }

      // Add advanced features (prompt and include, no reasoning for images)
      if (dto.prompt !== undefined) {
        params.prompt = dto.prompt as
          | Responses.ResponsePrompt
          | null
          | undefined;
      }

      if (dto.include !== undefined) {
        params.include = dto.include as
          | Array<Responses.ResponseIncludable>
          | null
          | undefined;
      }

      // Create streaming request
      const stream = await this.client.responses.create(params);

      // Process streaming events using the same comprehensive event handling as text
      for await (const event of stream) {
        const sequence = event.sequence_number || 0;

        // Delegate to existing handlers - they already support image events
        switch (event.type) {
          // Image generation events
          case STREAMING_EVENT_TYPES.IMAGE_GEN_IN_PROGRESS:
          case STREAMING_EVENT_TYPES.IMAGE_GEN_GENERATING:
            yield* this.imageHandler.handleImageGenProgress(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.IMAGE_GEN_PARTIAL:
            yield* this.imageHandler.handleImageGenPartial(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.IMAGE_GEN_COMPLETED:
            yield* this.imageHandler.handleImageGenCompleted(
              event,
              state,
              sequence,
            );
            break;

          // Lifecycle events
          case STREAMING_EVENT_TYPES.RESPONSE_CREATED:
            yield* this.lifecycleHandler.handleResponseCreated(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.RESPONSE_COMPLETED:
            yield* this.lifecycleHandler.handleResponseCompleted(
              event,
              state,
              sequence,
              (response: Responses.Response) => this.extractUsage(response),
              (response: Responses.Response) =>
                this.extractResponseMetadata(response),
              (
                usage: {
                  prompt_tokens?: number;
                  completion_tokens?: number;
                  total_tokens?: number;
                } | null,
              ) => this.estimateCost(usage),
            );
            break;

          case STREAMING_EVENT_TYPES.RESPONSE_FAILED:
            yield* this.lifecycleHandler.handleResponseFailed(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.ERROR:
            yield* this.lifecycleHandler.handleErrorEvent(
              event,
              state,
              sequence,
            );
            break;

          // Text events (if model provides text alongside images)
          case STREAMING_EVENT_TYPES.TEXT_DELTA:
            yield* this.textHandler.handleTextDelta(event, state, sequence);
            break;

          case STREAMING_EVENT_TYPES.TEXT_DONE:
            yield* this.textHandler.handleTextDone(event, state, sequence);
            break;

          // Other events handled by structural handler
          default:
            yield* this.structuralHandler.handleStructuralEvent(
              event,
              state,
              sequence,
            );
            break;
        }

        // Log each streaming event
        this.loggerService.logStreamingEvent({
          timestamp: new Date().toISOString(),
          api: 'responses',
          endpoint: '/v1/responses (gpt-image-1 stream)',
          event_type: event.type,
          sequence,
          delta: '',
        });
      }
    } catch (error) {
      const latency = Date.now() - startTime;

      // Build error details
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorDetails: {
        message: string;
        type?: string;
        code?: string;
        status?: number;
      } = {
        message: errorMessage,
      };

      if (this.hasErrorType(error)) {
        errorDetails.type = error.type;
      }
      if (this.hasErrorCode(error)) {
        errorDetails.code = error.code;
      }
      if (this.hasErrorStatus(error)) {
        errorDetails.status = error.status;
      }

      // Log the error
      this.loggerService.logOpenAIInteraction({
        timestamp: new Date().toISOString(),
        api: 'responses',
        endpoint: '/v1/responses (gpt-image-1 stream)',
        request: {
          model: dto.model || 'gpt-5',
          input: dto.input,
        },
        error: {
          ...errorDetails,
          message: errorMessage,
          original_error: error,
        },
        metadata: {
          latency_ms: latency,
        },
      });

      // Yield error event to client
      const sequence = 0;
      yield {
        event: 'error',
        data: JSON.stringify({
          error: errorMessage,
        }),
        sequence,
      };

      throw error;
    }
  }

  /**
   * Resume streaming a stored response by ID
   *
   * Retrieves a stored response and streams its events from where it left off.
   * Useful for resuming interrupted streaming connections or reviewing streamed responses.
   * Only works for responses created with stream=true and store=true.
   *
   * @param responseId - The ID of the response to resume (e.g., 'resp_abc123')
   * @returns AsyncIterable yielding SSE events from the stored response
   *
   * @example
   * ```typescript
   * // Resume a previously interrupted stream
   * const stream = service.resumeResponseStream('resp_abc123');
   *
   * for await (const event of stream) {
   *   console.log(`Event: ${event.event}, Sequence: ${event.sequence}`);
   * }
   * ```
   *
   * @throws {OpenAI.NotFoundError} When response ID doesn't exist or has expired (30-day retention)
   * @throws {OpenAI.BadRequestError} When response wasn't created with streaming enabled
   *
   * @see https://platform.openai.com/docs/api-reference/responses/retrieve
   */
  async *resumeResponseStream(responseId: string): AsyncIterable<SSEEvent> {
    const startTime = Date.now();

    // Initialize state tracking for accumulated data
    const state: StreamState = {
      fullText: '',
      reasoning: '',
      reasoningSummary: '',
      refusal: '',
      toolCalls: new Map(),
      audio: '',
      audioTranscript: '',
      startTime,
    };

    try {
      // Log stream start
      this.loggerService.logStreamingEvent({
        timestamp: new Date().toISOString(),
        api: 'responses',
        endpoint: `/v1/responses/${responseId}/stream (GET)`,
        event_type: 'stream_resume',
        sequence: 0,
        request: {
          responseId,
          stream: true,
        },
      });

      // Retrieve with streaming enabled
      const stream = await this.client.responses.retrieve(responseId, {
        stream: true,
      });

      // Process all streaming events using the same comprehensive event handling
      for await (const event of stream) {
        const sequence = event.sequence_number || 0;

        // Use the same event routing as createTextResponseStream
        switch (event.type) {
          // ===== LIFECYCLE EVENTS (7) =====
          case STREAMING_EVENT_TYPES.RESPONSE_CREATED:
            yield* this.lifecycleHandler.handleResponseCreated(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.RESPONSE_COMPLETED:
            yield* this.lifecycleHandler.handleResponseCompleted(
              event,
              state,
              sequence,
              (response: Responses.Response) => this.extractUsage(response),
              (response: Responses.Response) =>
                this.extractResponseMetadata(response),
              (
                usage: {
                  prompt_tokens?: number;
                  completion_tokens?: number;
                  total_tokens?: number;
                } | null,
              ) => this.estimateCost(usage),
            );
            break;

          case STREAMING_EVENT_TYPES.RESPONSE_FAILED:
            yield* this.lifecycleHandler.handleResponseFailed(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.ERROR:
            yield* this.lifecycleHandler.handleErrorEvent(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.RESPONSE_IN_PROGRESS:
            yield* this.lifecycleHandler.handleResponseInProgress(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.RESPONSE_INCOMPLETE:
            yield* this.lifecycleHandler.handleResponseIncomplete(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.RESPONSE_QUEUED:
            yield* this.lifecycleHandler.handleResponseQueued(
              event,
              state,
              sequence,
            );
            break;

          // ===== TEXT OUTPUT EVENTS (3) =====
          case STREAMING_EVENT_TYPES.TEXT_DELTA:
            yield* this.textHandler.handleTextDelta(event, state, sequence);
            break;

          case STREAMING_EVENT_TYPES.TEXT_DONE:
            yield* this.textHandler.handleTextDone(event, state, sequence);
            break;

          case STREAMING_EVENT_TYPES.TEXT_ANNOTATION_ADDED:
            yield* this.textHandler.handleTextAnnotation(
              event,
              state,
              sequence,
            );
            break;

          // ===== REASONING EVENTS (6) =====
          case STREAMING_EVENT_TYPES.REASONING_TEXT_DELTA:
            yield* this.reasoningHandler.handleReasoningTextDelta(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.REASONING_TEXT_DONE:
            yield* this.reasoningHandler.handleReasoningTextDone(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.REASONING_SUMMARY_TEXT_DELTA:
            yield* this.reasoningHandler.handleReasoningSummaryDelta(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.REASONING_SUMMARY_TEXT_DONE:
            yield* this.reasoningHandler.handleReasoningSummaryDone(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.REASONING_SUMMARY_PART_ADDED:
          case STREAMING_EVENT_TYPES.REASONING_SUMMARY_PART_DONE:
            yield* this.reasoningHandler.handleReasoningSummaryPart(
              event,
              state,
              sequence,
            );
            break;

          // ===== TOOL CALLING EVENTS (15) =====
          case STREAMING_EVENT_TYPES.FUNCTION_CALL_ARGUMENTS_DELTA:
            yield* this.toolCallingHandler.handleFunctionCallDelta(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.FUNCTION_CALL_ARGUMENTS_DONE:
            yield* this.toolCallingHandler.handleFunctionCallDone(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.CODE_INTERPRETER_IN_PROGRESS:
          case STREAMING_EVENT_TYPES.CODE_INTERPRETER_INTERPRETING:
            yield* this.toolCallingHandler.handleCodeInterpreterProgress(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.CODE_INTERPRETER_CODE_DELTA:
            yield* this.toolCallingHandler.handleCodeInterpreterCodeDelta(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.CODE_INTERPRETER_CODE_DONE:
            yield* this.toolCallingHandler.handleCodeInterpreterCodeDone(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.CODE_INTERPRETER_COMPLETED:
            yield* this.toolCallingHandler.handleCodeInterpreterCompleted(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.FILE_SEARCH_IN_PROGRESS:
          case STREAMING_EVENT_TYPES.FILE_SEARCH_SEARCHING:
            yield* this.toolCallingHandler.handleFileSearchProgress(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.FILE_SEARCH_COMPLETED:
            yield* this.toolCallingHandler.handleFileSearchCompleted(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.WEB_SEARCH_IN_PROGRESS:
          case STREAMING_EVENT_TYPES.WEB_SEARCH_SEARCHING:
            yield* this.toolCallingHandler.handleWebSearchProgress(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.WEB_SEARCH_COMPLETED:
            yield* this.toolCallingHandler.handleWebSearchCompleted(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.CUSTOM_TOOL_INPUT_DELTA:
            yield* this.toolCallingHandler.handleCustomToolDelta(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.CUSTOM_TOOL_INPUT_DONE:
            yield* this.toolCallingHandler.handleCustomToolDone(
              event,
              state,
              sequence,
            );
            break;

          // ===== IMAGE GENERATION EVENTS (4) =====
          case STREAMING_EVENT_TYPES.IMAGE_GEN_IN_PROGRESS:
          case STREAMING_EVENT_TYPES.IMAGE_GEN_GENERATING:
            yield* this.imageHandler.handleImageGenProgress(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.IMAGE_GEN_PARTIAL:
            yield* this.imageHandler.handleImageGenPartial(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.IMAGE_GEN_COMPLETED:
            yield* this.imageHandler.handleImageGenCompleted(
              event,
              state,
              sequence,
            );
            break;

          // ===== AUDIO EVENTS (4) =====
          case STREAMING_EVENT_TYPES.AUDIO_DELTA:
            yield* this.audioHandler.handleAudioDelta(event, state, sequence);
            break;

          case STREAMING_EVENT_TYPES.AUDIO_DONE:
            yield* this.audioHandler.handleAudioDone(event, state, sequence);
            break;

          case STREAMING_EVENT_TYPES.AUDIO_TRANSCRIPT_DELTA:
            yield* this.audioHandler.handleAudioTranscriptDelta(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.AUDIO_TRANSCRIPT_DONE:
            yield* this.audioHandler.handleAudioTranscriptDone(
              event,
              state,
              sequence,
            );
            break;

          // ===== MCP EVENTS (8) =====
          case STREAMING_EVENT_TYPES.MCP_CALL_IN_PROGRESS:
            yield* this.mcpHandler.handleMCPCallProgress(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.MCP_CALL_ARGUMENTS_DELTA:
            yield* this.mcpHandler.handleMCPCallDelta(event, state, sequence);
            break;

          case STREAMING_EVENT_TYPES.MCP_CALL_ARGUMENTS_DONE:
            yield* this.mcpHandler.handleMCPCallDone(event, state, sequence);
            break;

          case STREAMING_EVENT_TYPES.MCP_CALL_COMPLETED:
            yield* this.mcpHandler.handleMCPCallCompleted(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.MCP_CALL_FAILED:
            yield* this.mcpHandler.handleMCPCallFailed(event, state, sequence);
            break;

          case STREAMING_EVENT_TYPES.MCP_LIST_TOOLS_IN_PROGRESS:
          case STREAMING_EVENT_TYPES.MCP_LIST_TOOLS_COMPLETED:
          case STREAMING_EVENT_TYPES.MCP_LIST_TOOLS_FAILED:
            yield* this.mcpHandler.handleMCPListTools(event, state, sequence);
            break;

          // ===== REFUSAL EVENTS (2) =====
          case STREAMING_EVENT_TYPES.REFUSAL_DELTA:
            yield* this.refusalHandler.handleRefusalDelta(
              event,
              state,
              sequence,
            );
            break;

          case STREAMING_EVENT_TYPES.REFUSAL_DONE:
            yield* this.refusalHandler.handleRefusalDone(
              event,
              state,
              sequence,
            );
            break;

          // ===== STRUCTURAL EVENTS (2) =====
          case STREAMING_EVENT_TYPES.OUTPUT_ITEM_ADDED:
          case STREAMING_EVENT_TYPES.OUTPUT_ITEM_DONE:
          case STREAMING_EVENT_TYPES.CONTENT_PART_ADDED:
          case STREAMING_EVENT_TYPES.CONTENT_PART_DONE:
            yield* this.structuralHandler.handleStructuralEvent(
              event,
              state,
              sequence,
            );
            break;

          // ===== UNKNOWN EVENTS =====
          default:
            yield* this.structuralHandler.handleUnknownEvent(
              event,
              state,
              sequence,
            );
            break;
        }
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Log the error
      this.loggerService.logStreamingEvent({
        timestamp: new Date().toISOString(),
        api: 'responses',
        endpoint: `/v1/responses/${responseId}/stream (GET)`,
        event_type: 'stream_error',
        sequence: 0,
        error: {
          message: errorMessage,
          original_error: error,
        },
        metadata: {
          latency_ms: latency,
        },
      });

      // Yield error event
      yield {
        event: 'error',
        data: JSON.stringify({ error: errorMessage }),
        sequence: 0,
      };

      throw error;
    }
  }

  /**
   * Retrieve a stored response by ID
   *
   * Fetches a previously stored response from OpenAI's 30-day retention storage.
   * Responses must have been created with store=true to be retrievable.
   * Useful for reviewing past responses, extracting data, or continuing conversations.
   *
   * @param responseId - The ID of the response to retrieve (format: 'resp_*')
   * @returns Promise resolving to the complete Response object with output_text and metadata
   *
   * @example
   * ```typescript
   * const response = await service.retrieve('resp_abc123');
   * console.log(response.output_text);
   * console.log(response.status);  // 'completed', 'failed', 'incomplete'
   * console.log(response.usage.total_tokens);
   * ```
   *
   * @throws {OpenAI.NotFoundError} When response ID doesn't exist or has expired
   * @throws {OpenAI.AuthenticationError} When API key is invalid
   *
   * @see https://platform.openai.com/docs/api-reference/responses/retrieve
   */
  async retrieve(responseId: string): Promise<Responses.Response> {
    const startTime = Date.now();

    try {
      // Non-streaming retrieval
      const response: Responses.Response = await this.client.responses.retrieve(
        responseId,
        { stream: false },
      );

      const latency = Date.now() - startTime;

      // Extract usage and metadata
      const usage = this.extractUsage(response);
      const responseMetadata = this.extractResponseMetadata(response);

      // Log the retrieval
      this.loggerService.logOpenAIInteraction({
        timestamp: new Date().toISOString(),
        api: 'responses',
        endpoint: `/v1/responses/${responseId} (GET)`,
        request: {
          responseId,
          stream: false,
        },
        response,
        metadata: {
          latency_ms: latency,
          tokens_used: usage?.total_tokens,
          cached_tokens: usage?.cached_tokens,
          reasoning_tokens: usage?.reasoning_tokens,
          cost_estimate: this.estimateCost(usage, response.model),
          ...responseMetadata,
        },
      });

      return response;
    } catch (error: unknown) {
      const latency = Date.now() - startTime;
      let errorMessage = 'Unknown error';
      const errorDetails: Record<string, unknown> = {};

      if (error instanceof Error) {
        errorMessage = error.message;
      }

      if (this.hasErrorType(error)) {
        errorDetails.type = error.type;
      }

      if (this.hasErrorCode(error)) {
        errorDetails.code = error.code;
      }

      if (this.hasErrorStatus(error)) {
        errorDetails.status = error.status;
      }

      // Log the error
      this.loggerService.logOpenAIInteraction({
        timestamp: new Date().toISOString(),
        api: 'responses',
        endpoint: `/v1/responses/${responseId} (GET)`,
        request: {
          responseId,
          stream: false,
        },
        error: {
          ...errorDetails,
          message: errorMessage,
          original_error: error,
        },
        metadata: {
          latency_ms: latency,
        },
      });

      throw error;
    }
  }

  /**
   * Delete a stored response by ID
   *
   * Permanently deletes a stored response from OpenAI's servers. This action cannot be undone.
   * After deletion, the response ID will no longer be valid for retrieval or resuming streams.
   * Useful for compliance, privacy, or managing storage quota.
   *
   * @param responseId - The ID of the response to delete (format: 'resp_*')
   * @returns Promise resolving to deletion confirmation object
   *
   * @example
   * ```typescript
   * const result = await service.delete('resp_abc123');
   * console.log(result);  // { id: 'resp_abc123', deleted: true, object: 'response' }
   * ```
   *
   * @throws {OpenAI.NotFoundError} When response ID doesn't exist or was already deleted
   * @throws {OpenAI.AuthenticationError} When API key is invalid
   *
   * @see https://platform.openai.com/docs/api-reference/responses/delete
   */
  async delete(
    responseId: string,
  ): Promise<{ id: string; deleted: boolean; object: string }> {
    const startTime = Date.now();

    try {
      // Call OpenAI SDK delete method
      await this.client.responses.delete(responseId);

      const latency = Date.now() - startTime;

      // Create confirmation object
      const confirmation = {
        id: responseId,
        deleted: true,
        object: 'response',
      };

      // Log the deletion
      this.loggerService.logOpenAIInteraction({
        timestamp: new Date().toISOString(),
        api: 'responses',
        endpoint: `/v1/responses/${responseId} (DELETE)`,
        request: {
          responseId,
        },
        response: confirmation,
        metadata: {
          latency_ms: latency,
        },
      });

      return confirmation;
    } catch (error: unknown) {
      const latency = Date.now() - startTime;
      let errorMessage = 'Unknown error';
      const errorDetails: Record<string, unknown> = {};

      if (error instanceof Error) {
        errorMessage = error.message;
      }

      if (this.hasErrorType(error)) {
        errorDetails.type = error.type;
      }

      if (this.hasErrorCode(error)) {
        errorDetails.code = error.code;
      }

      if (this.hasErrorStatus(error)) {
        errorDetails.status = error.status;
      }

      // Log the error
      this.loggerService.logOpenAIInteraction({
        timestamp: new Date().toISOString(),
        api: 'responses',
        endpoint: `/v1/responses/${responseId} (DELETE)`,
        request: {
          responseId,
        },
        error: {
          ...errorDetails,
          message: errorMessage,
          original_error: error,
        },
        metadata: {
          latency_ms: latency,
        },
      });

      throw error;
    }
  }

  /**
   * Cancel a background response by ID
   *
   * Stops a long-running background response that was created with background=true.
   * Only works for responses that are still in progress. Completed responses cannot be canceled.
   * The response will be marked with status='cancelled' and may include partial output.
   *
   * @param responseId - The ID of the background response to cancel (format: 'resp_*')
   * @returns Promise resolving to the cancelled Response object with partial output if available
   *
   * @example
   * ```typescript
   * // Start a background response
   * const response = await service.createTextResponse({
   *   input: 'Write a long essay...',
   *   background: true
   * });
   *
   * // Cancel it later
   * const cancelled = await service.cancel(response.id);
   * console.log(cancelled.status);  // 'cancelled'
   * console.log(cancelled.output_text);  // Partial output before cancellation
   * ```
   *
   * @throws {OpenAI.NotFoundError} When response ID doesn't exist
   * @throws {OpenAI.BadRequestError} When response wasn't created with background=true or is already completed
   *
   * @see https://platform.openai.com/docs/api-reference/responses/cancel
   */
  async cancel(responseId: string): Promise<Responses.Response> {
    const startTime = Date.now();

    try {
      // Call OpenAI SDK cancel method
      const response: Responses.Response =
        await this.client.responses.cancel(responseId);

      const latency = Date.now() - startTime;

      // Extract usage and metadata
      const usage = this.extractUsage(response);
      const responseMetadata = this.extractResponseMetadata(response);

      // Log the cancellation
      this.loggerService.logOpenAIInteraction({
        timestamp: new Date().toISOString(),
        api: 'responses',
        endpoint: `/v1/responses/${responseId}/cancel (POST)`,
        request: {
          responseId,
        },
        response,
        metadata: {
          latency_ms: latency,
          tokens_used: usage?.total_tokens,
          cached_tokens: usage?.cached_tokens,
          reasoning_tokens: usage?.reasoning_tokens,
          cost_estimate: this.estimateCost(usage, response.model),
          ...responseMetadata,
        },
      });

      return response;
    } catch (error: unknown) {
      const latency = Date.now() - startTime;
      let errorMessage = 'Unknown error';
      const errorDetails: Record<string, unknown> = {};

      if (error instanceof Error) {
        errorMessage = error.message;
      }

      if (this.hasErrorType(error)) {
        errorDetails.type = error.type;
      }

      if (this.hasErrorCode(error)) {
        errorDetails.code = error.code;
      }

      if (this.hasErrorStatus(error)) {
        errorDetails.status = error.status;
      }

      // Log the error
      this.loggerService.logOpenAIInteraction({
        timestamp: new Date().toISOString(),
        api: 'responses',
        endpoint: `/v1/responses/${responseId}/cancel (POST)`,
        request: {
          responseId,
        },
        error: {
          ...errorDetails,
          message: errorMessage,
          original_error: error,
        },
        metadata: {
          latency_ms: latency,
        },
      });

      throw error;
    }
  }

  /**
   * Extract usage information from response with detailed token breakdown
   *
   * Parses the ResponseUsage object to extract token counts including input tokens,
   * output tokens, cached tokens (from prompt cache), and reasoning tokens (for o-series models).
   * This data is used for logging, cost estimation, and monitoring.
   *
   * @param response - The Response object from OpenAI API
   * @returns Object containing token counts or null if usage data unavailable
   * @private
   */
  private extractUsage(response: Responses.Response): {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cached_tokens?: number;
    reasoning_tokens?: number;
  } | null {
    if (response.usage) {
      const usage: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        cached_tokens?: number;
        reasoning_tokens?: number;
      } = {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.total_tokens,
      };

      // Extract cached tokens from input_tokens_details
      if (
        response.usage.input_tokens_details &&
        'cached_tokens' in response.usage.input_tokens_details
      ) {
        usage.cached_tokens = response.usage.input_tokens_details.cached_tokens;
      }

      // Extract reasoning tokens from output_tokens_details (for o-series models)
      if (
        response.usage.output_tokens_details &&
        'reasoning_tokens' in response.usage.output_tokens_details
      ) {
        usage.reasoning_tokens =
          response.usage.output_tokens_details.reasoning_tokens;
      }

      return usage;
    }
    return null;
  }

  /**
   * Extract response metadata for enhanced logging
   *
   * Extracts comprehensive metadata from the Response object including status, error details,
   * conversation context, optimization parameters (caching, service tier, truncation), and
   * safety identifiers. Used for detailed logging and monitoring of API interactions.
   *
   * @param response - The Response object from OpenAI API
   * @returns Object containing all available metadata fields
   * @private
   */
  private extractResponseMetadata(response: Responses.Response): {
    status?: string;
    error?: unknown;
    incomplete_details?: unknown;
    conversation?: unknown;
    background?: boolean | null;
    max_output_tokens?: number | null;
    previous_response_id?: string | null;
    prompt_cache_key?: string;
    service_tier?: string | null;
    truncation?: string | null;
    safety_identifier?: string;
    metadata?: Record<string, string> | null;
    text_verbosity?: string | null;
    stream_options_obfuscation?: boolean;
  } {
    const metadata: {
      status?: string;
      error?: unknown;
      incomplete_details?: unknown;
      conversation?: unknown;
      background?: boolean | null;
      max_output_tokens?: number | null;
      previous_response_id?: string | null;
      prompt_cache_key?: string;
      service_tier?: string | null;
      truncation?: string | null;
      safety_identifier?: string;
      metadata?: Record<string, string> | null;
      text_verbosity?: string | null;
      stream_options_obfuscation?: boolean;
    } = {};

    // Extract status
    if (response.status) {
      metadata.status = response.status;
    }

    // Extract error if present
    if (response.error) {
      metadata.error = response.error;
    }

    // Extract incomplete details
    if (response.incomplete_details) {
      metadata.incomplete_details = response.incomplete_details;
    }

    // Extract conversation info
    if (response.conversation) {
      metadata.conversation = response.conversation;
    }

    // Extract background flag
    if (response.background !== undefined) {
      metadata.background = response.background;
    }

    // Extract max_output_tokens
    if (response.max_output_tokens !== undefined) {
      metadata.max_output_tokens = response.max_output_tokens;
    }

    // Extract previous_response_id
    if (response.previous_response_id !== undefined) {
      metadata.previous_response_id = response.previous_response_id;
    }

    // Extract optimization parameters
    if (response.prompt_cache_key !== undefined) {
      metadata.prompt_cache_key = response.prompt_cache_key;
    }

    if (response.service_tier !== undefined) {
      metadata.service_tier = response.service_tier;
    }

    if (response.truncation !== undefined) {
      metadata.truncation = response.truncation;
    }

    if (response.safety_identifier !== undefined) {
      metadata.safety_identifier = response.safety_identifier;
    }

    if (response.metadata !== undefined) {
      metadata.metadata = response.metadata;
    }

    // Extract text verbosity if present
    if (
      response.text &&
      typeof response.text === 'object' &&
      'verbosity' in response.text
    ) {
      metadata.text_verbosity = (
        response.text as { verbosity?: string }
      ).verbosity;
    }

    return metadata;
  }

  /**
   * Estimate cost based on token usage using PricingService
   *
   * Delegates to PricingService for accurate multi-model cost calculation.
   * Supports all token types: input, output, reasoning, cached.
   * Supports 6 models: gpt-4o, gpt-4o-mini, o1, o3-mini, gpt-5, gpt-image-1.
   *
   * @param usage - Token usage object with various token count fields
   * @param model - Model name (defaults to 'gpt-4o' if not specified)
   * @returns Estimated cost in USD
   * @private
   */
  private estimateCost(
    usage:
      | {
          input_tokens?: number;
          output_tokens?: number;
          total_tokens?: number;
          input_tokens_details?: {
            cached_tokens?: number;
          };
          output_tokens_details?: {
            reasoning_tokens?: number;
          };
          // Legacy field names for compatibility
          prompt_tokens?: number;
          completion_tokens?: number;
        }
      | null
      | undefined,
    model = 'gpt-4o',
  ): number {
    if (!usage) return 0;

    // Normalize legacy field names to new Responses API format
    const normalizedUsage = {
      input_tokens: usage.input_tokens || usage.prompt_tokens || 0,
      output_tokens: usage.output_tokens || usage.completion_tokens || 0,
      total_tokens: usage.total_tokens,
      input_tokens_details: usage.input_tokens_details,
      output_tokens_details: usage.output_tokens_details,
    };

    return this.pricingService.calculateCost(normalizedUsage, model);
  }

  /**
   * Type guard to check if error has a type property
   *
   * @param error - Unknown error object
   * @returns True if error has a string type property
   * @private
   */
  private hasErrorType(error: unknown): error is { type: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      typeof (error as Record<string, unknown>).type === 'string'
    );
  }

  /**
   * Type guard to check if error has a code property
   *
   * @param error - Unknown error object
   * @returns True if error has a string code property
   * @private
   */
  private hasErrorCode(error: unknown): error is { code: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as Record<string, unknown>).code === 'string'
    );
  }

  /**
   * Type guard to check if error has a param property
   *
   * @param error - Unknown error object
   * @returns True if error has a string param property
   * @private
   */
  private hasErrorParam(error: unknown): error is { param: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'param' in error &&
      typeof (error as Record<string, unknown>).param === 'string'
    );
  }

  /**
   * Type guard to check if error has a status property
   *
   * @param error - Unknown error object
   * @returns True if error has a number status property
   * @private
   */
  private hasErrorStatus(error: unknown): error is { status: number } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      typeof (error as Record<string, unknown>).status === 'number'
    );
  }
}
