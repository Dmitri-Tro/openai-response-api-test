import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsObject,
  IsNumber,
  Min,
  Max,
  ArrayNotEmpty,
  IsIn,
} from 'class-validator';
import type { Responses } from 'openai/resources/responses';
import type * as Shared from 'openai/resources/shared';
import { IsFileSearchToolValid } from '../validators/file-search-tool.validator';
import { IsCodeInterpreterToolValid } from '../validators/code-interpreter-tool.validator';
import { IsPromptValid } from '../validators/prompt.validator';

/**
 * Data Transfer Object for creating text responses via OpenAI Responses API
 *
 * This DTO encapsulates all parameters for text generation requests using the modern
 * Responses API (`client.responses.create()`). Supports 28 parameters across 6 categories:
 *
 * **Core Parameters:**
 * - `model` - GPT model selection (gpt-5, gpt-4o, o1, o3, etc.)
 * - `input` - User message or prompt text
 * - `instructions` - System instructions for model behavior
 * - `modalities` - Output modalities (text, audio)
 * - `stream` - Enable Server-Sent Events streaming
 * - `tools` - Available tools for function calling
 * - `text` - Response format configuration (text/json_schema/json_object)
 * - `temperature` - Sampling randomness (0-2)
 * - `top_p` - Nucleus sampling probability (0-1)
 *
 * **Conversation & Multi-Turn:**
 * - `conversation` - Conversation ID for context continuity
 * - `previous_response_id` - Previous response for multi-turn
 * - `store` - Store response for later retrieval
 *
 * **Response Control:**
 * - `max_output_tokens` - Token limit for generation
 * - `tool_choice` - Tool selection strategy (auto/none/required/specific)
 * - `parallel_tool_calls` - Enable parallel tool execution
 *
 * **Caching & Performance:**
 * - `prompt_cache_key` - Cache key for optimizing similar requests
 * - `service_tier` - Latency tier (auto/default/flex/scale/priority)
 * - `background` - Run in background for long operations
 * - `truncation` - Context window overflow handling (auto/disabled)
 *
 * **Safety & Metadata:**
 * - `safety_identifier` - User identifier for policy enforcement
 * - `metadata` - Custom key-value pairs (16 max, 64-char keys, 512-char values)
 *
 * **Advanced Features:**
 * - `stream_options` - Streaming configuration (obfuscation)
 * - `prompt` - Reusable prompt template with variables
 * - `include` - Additional output data (web sources, code outputs, logprobs, etc.)
 * - `reasoning` - Reasoning configuration for o-series models (effort, summary)
 *
 * **Key Differences from Chat Completions API:**
 * - Uses `input` instead of `messages` array
 * - Uses `instructions` instead of system message
 * - Uses `text` instead of `response_format`
 * - Returns `response.output_text` instead of `choices[0].message.content`
 *
 * **Validation:**
 * All fields are validated using class-validator decorators. Required fields: `input`.
 * Optional fields have sensible defaults or can be omitted.
 *
 * @see {@link https://platform.openai.com/docs/api-reference/responses/create}
 * @see {@link https://platform.openai.com/docs/guides/text}
 */
export class CreateTextResponseDto {
  @ApiProperty({
    description: 'The model to use for text generation',
    example: 'gpt-5',
    default: 'gpt-5',
  })
  @IsString()
  @IsOptional()
  model?: string = 'gpt-5';

  @ApiProperty({
    description: 'The input text or conversation messages',
    example: 'Explain quantum computing in simple terms',
  })
  @IsString()
  input!: string;

  @ApiPropertyOptional({
    description: 'System instructions for the model',
    example: 'You are a helpful assistant that explains complex topics simply',
  })
  @IsString()
  @IsOptional()
  instructions?: string;

  @ApiPropertyOptional({
    description: `Output modalities the model should generate. Specify which types of content to generate:
      - 'text': Text output (default)
      - 'audio': Audio output (voice synthesis)

      Examples: ['text'], ['audio'], ['text', 'audio']

      Note: Audio generation requires audio-capable models and incurs additional costs.
      Generated audio is returned as base64-encoded data in streaming events.`,
    example: ['text'],
    enum: ['text', 'audio'],
    isArray: true,
    type: [String],
  })
  @IsArray()
  @IsOptional()
  @ArrayNotEmpty({ message: 'modalities array cannot be empty' })
  @IsIn(['text', 'audio'], {
    each: true,
    message: 'Each modality must be either "text" or "audio"',
  })
  modalities?: Array<'text' | 'audio'>;

  @ApiPropertyOptional({
    description: 'Whether to stream the response',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  stream?: boolean = false;

  @ApiPropertyOptional({
    description: `Tools available for the model to use. Supports:
      - function: User-defined functions for custom operations
      - code_interpreter: Execute Python code in sandboxed environment (data analysis, calculations, file processing)
      - web_search: Search the internet for real-time information
      - file_search: Semantic search through vector stores (requires Vector Stores API - Phase 5)
      - custom_tool: User-defined tool extensions

      Code Interpreter: $0.03 per container + token costs, 1 hour session, 20min idle timeout
      File Search: Requires vector stores (Phase 5)`,
    example: [
      {
        type: 'code_interpreter',
        container: {
          type: 'auto',
          file_ids: ['file-abc123xyz789012345678901'],
        },
      },
      {
        type: 'file_search',
        vector_store_ids: ['vs_abc123'],
        max_num_results: 10,
        ranking_options: {
          ranker: 'auto',
          score_threshold: 0.7,
        },
      },
    ],
    type: 'array',
  })
  @IsArray()
  @IsOptional()
  @IsCodeInterpreterToolValid({
    message: 'Invalid code_interpreter tool configuration',
  })
  @IsFileSearchToolValid({ message: 'Invalid file_search tool configuration' })
  tools?: Responses.ResponseCreateParamsNonStreaming['tools'];

  @ApiPropertyOptional({
    description:
      'Configuration options for a text response from the model. ' +
      'Can be plain text or structured JSON data. ' +
      'Includes "format" (type: text/json_schema/json_object) and "verbosity" (low/medium/high). ' +
      'Learn more: https://platform.openai.com/docs/guides/text, https://platform.openai.com/docs/guides/structured-outputs',
    example: { format: { type: 'text' }, verbosity: 'medium' },
  })
  @IsObject()
  @IsOptional()
  text?: Responses.ResponseCreateParamsNonStreaming['text'];

  @ApiPropertyOptional({
    description:
      'Sampling temperature between 0 and 2. Higher values make output more random',
    example: 1.0,
    minimum: 0,
    maximum: 2,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional({
    description: 'Nucleus sampling probability between 0 and 1',
    example: 1.0,
    minimum: 0,
    maximum: 1,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  top_p?: number;

  // Note: max_tokens, frequency_penalty, and presence_penalty are not supported
  // by the Responses API according to the OpenAI SDK types

  // Conversation & Multi-Turn Support
  @ApiPropertyOptional({
    description:
      'The conversation that this response belongs to. Items from this conversation are prepended to input_items.',
    example: 'conv_abc123',
  })
  @IsOptional()
  conversation?:
    | string
    | Responses.ResponseCreateParamsNonStreaming['conversation'];

  @ApiPropertyOptional({
    description:
      'The unique ID of the previous response for multi-turn conversations. Cannot be used with conversation parameter.',
    example: 'resp_xyz789',
  })
  @IsString()
  @IsOptional()
  previous_response_id?: string;

  @ApiPropertyOptional({
    description:
      'Whether to store the generated model response for later retrieval via API',
    example: true,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  store?: boolean;

  // Response Control Parameters
  @ApiPropertyOptional({
    description:
      'Upper bound for the number of tokens that can be generated, including visible output tokens and reasoning tokens',
    example: 1000,
    minimum: 1,
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  max_output_tokens?: number;

  @ApiPropertyOptional({
    description:
      'Controls how the model should select which tool(s) to use when generating a response. Can be "auto", "none", "required", or a specific tool.',
  })
  @IsOptional()
  tool_choice?: Responses.ResponseCreateParamsNonStreaming['tool_choice'];

  @ApiPropertyOptional({
    description: 'Whether to allow the model to run tool calls in parallel',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  parallel_tool_calls?: boolean;

  // Caching & Performance Parameters
  @ApiPropertyOptional({
    description:
      'Used by OpenAI to cache responses for similar requests to optimize your cache hit rates. ' +
      'Replaces the deprecated "user" field. Learn more: https://platform.openai.com/docs/guides/prompt-caching',
    example: 'user-123-hashed',
  })
  @IsString()
  @IsOptional()
  prompt_cache_key?: string;

  @ApiPropertyOptional({
    description:
      'Specifies the latency tier to use for processing the request. ' +
      'This parameter is relevant for customers subscribed to the scale tier service. ' +
      '"flex" provides 50% cheaper processing with increased latency. ' +
      '"priority" offers faster processing for Enterprise customers. ' +
      'Default: "auto" (uses Project settings).',
    enum: ['auto', 'default', 'flex', 'scale', 'priority'],
    example: 'auto',
  })
  @IsOptional()
  service_tier?: 'auto' | 'default' | 'flex' | 'scale' | 'priority' | null;

  @ApiPropertyOptional({
    description:
      'Whether to run the model response in the background. ' +
      'Useful for long-running operations. Responses can be retrieved later via API. ' +
      'Learn more: https://platform.openai.com/docs/guides/background',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  background?: boolean | null;

  @ApiPropertyOptional({
    description:
      'The truncation strategy to use for the model response. ' +
      '"auto": If input exceeds context window, truncate from beginning of conversation. ' +
      '"disabled" (default): Request will fail with 400 error if input exceeds context window.',
    enum: ['auto', 'disabled'],
    example: 'disabled',
  })
  @IsOptional()
  truncation?: 'auto' | 'disabled' | null;

  // Safety & Metadata Parameters
  @ApiPropertyOptional({
    description:
      'A stable identifier used to help detect users of your application that may be violating OpenAI usage policies. ' +
      'The IDs should be a string that uniquely identifies each user. ' +
      'We recommend hashing their username or email address to avoid sending identifying information. ' +
      'Learn more: https://platform.openai.com/docs/guides/safety-best-practices#safety-identifiers',
    example: 'hashed-user-id-abc123',
  })
  @IsString()
  @IsOptional()
  safety_identifier?: string;

  @ApiPropertyOptional({
    description:
      'Set of 16 key-value pairs that can be attached to an object. ' +
      'Useful for storing additional information in a structured format. ' +
      'Keys: max 64 characters. Values: max 512 characters.',
    example: { request_id: '123', user_tier: 'premium' },
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, string> | null;

  // Stream Options
  @ApiPropertyOptional({
    description:
      'Options for streaming responses. Only set this when you set stream: true. ' +
      '"include_obfuscation": When true (default), adds random characters to normalize payload sizes ' +
      'as mitigation for side-channel attacks. Set to false to optimize for bandwidth if network is trusted.',
    example: { include_obfuscation: true },
  })
  @IsObject()
  @IsOptional()
  stream_options?: { include_obfuscation?: boolean } | null;

  // Advanced Features
  @ApiPropertyOptional({
    description:
      'Reference to a prompt template and its variables. ' +
      'Allows you to reuse stored prompts with variable substitution. ' +
      'Learn more: https://platform.openai.com/docs/guides/text?api-mode=responses#reusable-prompts',
    example: {
      id: 'pmpt_abc123',
      version: '2',
      variables: { customer_name: 'Jane Doe', product: '40oz juice box' },
    },
  })
  @IsPromptValid({ message: 'Invalid prompt configuration' })
  @IsOptional()
  prompt?: Responses.ResponsePrompt | null;

  @ApiPropertyOptional({
    description:
      'Specify additional output data to include in the model response. ' +
      'Supported values:\n' +
      '- "web_search_call.action.sources": Include web search sources\n' +
      '- "code_interpreter_call.outputs": Include code execution outputs\n' +
      '- "computer_call_output.output.image_url": Include computer call image URLs\n' +
      '- "file_search_call.results": Include file search results\n' +
      '- "message.input_image.image_url": Include input image URLs\n' +
      '- "reasoning.encrypted_content": Include encrypted reasoning tokens for stateless multi-turn\n' +
      '- "message.output_text.logprobs": Include log probabilities for output tokens',
    example: ['code_interpreter_call.outputs', 'message.output_text.logprobs'],
  })
  @IsArray()
  @IsOptional()
  include?: Array<
    | 'file_search_call.results'
    | 'web_search_call.results'
    | 'web_search_call.action.sources'
    | 'message.input_image.image_url'
    | 'computer_call_output.output.image_url'
    | 'code_interpreter_call.outputs'
    | 'reasoning.encrypted_content'
    | 'message.output_text.logprobs'
  > | null;

  @ApiPropertyOptional({
    description:
      '**gpt-5 and o-series models only**\n\n' +
      'Configuration options for reasoning models (o1, o3, gpt-5). ' +
      'Learn more: https://platform.openai.com/docs/guides/reasoning\n\n' +
      'effort: Constrains reasoning effort. Values: "minimal", "low", "medium", "high". ' +
      'Reducing effort results in faster responses and fewer reasoning tokens.\n' +
      'Note: gpt-5-pro only supports "high".\n\n' +
      'summary: Summary detail level. Values: "auto", "concise", "detailed".',
    example: { effort: 'medium', summary: 'auto' },
  })
  @IsObject()
  @IsOptional()
  reasoning?: Shared.Reasoning | null;
}
