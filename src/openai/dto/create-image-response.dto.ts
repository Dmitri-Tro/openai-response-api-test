import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsObject,
  IsEnum,
  IsInt,
  IsArray,
  Min,
  Max,
  ArrayNotEmpty,
  IsIn,
} from 'class-validator';
import type { Responses } from 'openai/resources/responses';
import { IsFileSearchToolValid } from '../validators/file-search-tool.validator';
import { IsCodeInterpreterToolValid } from '../validators/code-interpreter-tool.validator';
import { IsPromptValid } from '../validators/prompt.validator';

/**
 * Data Transfer Object for creating image responses via OpenAI Responses API with gpt-image-1
 *
 * This DTO extends the standard Responses API parameters with 9 image-specific parameters
 * for controlling image generation using the gpt-image-1 and gpt-image-1-mini models.
 * Supports advanced features like progressive rendering, multiple formats, and quality levels.
 *
 * **Core Parameters (Inherited from Text API):**
 * - `model` - Base model (gpt-5, gpt-4o, etc.) that invokes image generation
 * - `input` - Text prompt describing the desired image
 * - `instructions` - System instructions for image generation style
 * - `modalities` - Output modalities (text, audio)
 * - `tools` - Tools including the image_generation tool
 *
 * **Image-Specific Parameters:**
 * These parameters configure the image_generation tool:
 *
 * - `image_model` - Image generation model (gpt-image-1/gpt-image-1-mini)
 * - `image_quality` - Quality level (low/medium/high/auto)
 * - `image_format` - Output format (png/webp/jpeg)
 * - `image_size` - Dimensions (1024x1024/1024x1536/1536x1024/auto)
 * - `image_moderation` - Content filtering (auto/low)
 * - `image_background` - Background style (transparent/opaque/auto)
 * - `input_fidelity` - Prompt adherence (high/low, gpt-image-1 only)
 * - `output_compression` - Quality vs size tradeoff (0-100)
 * - `partial_images` - Progressive rendering count (0-3)
 *
 * **Progressive Rendering:**
 * Setting `partial_images` to 1-3 enables streaming of partial images during generation,
 * providing a better user experience similar to progressive JPEG loading. Partial images
 * are delivered via `response.image_generation_call.partial_image` events.
 *
 * **Image Delivery:**
 * Generated images are returned as base64-encoded data URLs in format:
 * `data:image/[png|jpeg|webp];base64,...`
 *
 * Final images are delivered via `response.image_generation_call.completed` event
 * and can be directly used in HTML img tags or saved to disk.
 *
 * **Conversation & Multi-Turn:**
 * - `conversation` - Conversation ID for multi-turn image generation
 * - `previous_response_id` - Previous response for context continuity
 * - `store` - Store response for later retrieval
 *
 * **Response Control:**
 * - `max_output_tokens` - Token limit for image generation reasoning
 * - `tool_choice` - Force or prevent image generation tool usage
 * - `parallel_tool_calls` - Enable parallel tool execution
 *
 * **Caching & Performance:**
 * - `prompt_cache_key` - Cache key for optimizing similar requests
 * - `service_tier` - Latency tier (auto/default/flex/scale/priority)
 * - `background` - Run in background for long operations
 * - `truncation` - Context window overflow handling
 *
 * **Safety & Metadata:**
 * - `safety_identifier` - User identifier for policy enforcement
 * - `metadata` - Custom key-value pairs for tracking
 *
 * **Advanced Features:**
 * - `prompt` - Reusable prompt template with variables
 * - `include` - Additional output data (e.g., 'message.input_image.image_url')
 *
 * **Validation:**
 * All fields are validated using class-validator decorators. Required fields: `input`.
 * Image-specific parameters have enum validation to ensure only valid values are accepted.
 *
 * @see {@link https://platform.openai.com/docs/api-reference/responses#image-generation}
 * @see {@link https://platform.openai.com/docs/guides/images}
 */
export class CreateImageResponseDto {
  @ApiProperty({
    description: 'The model to use for image generation',
    example: 'gpt-5',
    default: 'gpt-5',
  })
  @IsString()
  @IsOptional()
  model?: string = 'gpt-5';

  @ApiProperty({
    description: 'The prompt describing the image to generate',
    example: 'A serene landscape with mountains and a lake at sunset',
  })
  @IsString()
  input!: string;

  @ApiPropertyOptional({
    description: 'System instructions for image generation',
    example: 'Generate high-quality, realistic images',
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
    description: `Tools available for the model to use. Supports:
      - function: User-defined functions for custom operations
      - code_interpreter: Execute Python code for data analysis
      - web_search: Search the internet for real-time information
      - file_search: Semantic search through vector stores (requires Vector Stores API - Phase 5)
      - custom_tool: User-defined tool extensions`,
    example: [],
  })
  @IsArray()
  @IsOptional()
  @IsCodeInterpreterToolValid({
    message: 'Invalid code_interpreter tool configuration',
  })
  @IsFileSearchToolValid({ message: 'Invalid file_search tool configuration' })
  tools?: Responses.ResponseCreateParamsNonStreaming['tools'];

  // Image-Specific Parameters
  // These parameters configure the image_generation tool in the Responses API
  @ApiPropertyOptional({
    description:
      'Image generation model:\n' +
      '- "gpt-image-1": Standard quality image generation\n' +
      '- "gpt-image-1-mini": Faster, lower-cost image generation\n' +
      'Default: "gpt-image-1"',
    enum: ['gpt-image-1', 'gpt-image-1-mini'],
    example: 'gpt-image-1',
  })
  @IsEnum(['gpt-image-1', 'gpt-image-1-mini'])
  @IsOptional()
  image_model?: 'gpt-image-1' | 'gpt-image-1-mini';

  @ApiPropertyOptional({
    description:
      'Image generation quality level:\n' +
      '- "high": Best quality, slower generation\n' +
      '- "medium": Balanced quality and speed\n' +
      '- "low": Faster generation, lower quality\n' +
      '- "auto": Let the model decide (default)\n' +
      'Default: "auto"',
    enum: ['low', 'medium', 'high', 'auto'],
    example: 'auto',
  })
  @IsEnum(['low', 'medium', 'high', 'auto'])
  @IsOptional()
  image_quality?: 'low' | 'medium' | 'high' | 'auto';

  @ApiPropertyOptional({
    description:
      'Output image format:\n' +
      '- "png": Best quality, supports transparency, larger file size\n' +
      '- "webp": Good quality, smaller file size, supports transparency\n' +
      '- "jpeg": Smallest file size, no transparency\n' +
      'Default: "png"',
    enum: ['png', 'webp', 'jpeg'],
    example: 'png',
  })
  @IsEnum(['png', 'webp', 'jpeg'])
  @IsOptional()
  image_format?: 'png' | 'webp' | 'jpeg';

  @ApiPropertyOptional({
    description:
      'Image dimensions:\n' +
      '- "1024x1024": Square format\n' +
      '- "1024x1536": Portrait orientation\n' +
      '- "1536x1024": Landscape orientation\n' +
      '- "auto": Let the model decide (default)\n' +
      'Default: "auto"',
    enum: ['1024x1024', '1024x1536', '1536x1024', 'auto'],
    example: 'auto',
  })
  @IsEnum(['1024x1024', '1024x1536', '1536x1024', 'auto'])
  @IsOptional()
  image_size?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto';

  @ApiPropertyOptional({
    description:
      'Content moderation level:\n' +
      '- "auto": Standard content filtering (recommended)\n' +
      '- "low": Reduced filtering for creative freedom\n' +
      'Default: "auto"',
    enum: ['auto', 'low'],
    example: 'auto',
  })
  @IsEnum(['auto', 'low'])
  @IsOptional()
  image_moderation?: 'auto' | 'low';

  @ApiPropertyOptional({
    description:
      'Image background style:\n' +
      '- "transparent": Transparent background (PNG/WebP only)\n' +
      '- "opaque": Solid background\n' +
      '- "auto": Let the model decide (default)\n' +
      'Default: "auto"',
    enum: ['transparent', 'opaque', 'auto'],
    example: 'auto',
  })
  @IsEnum(['transparent', 'opaque', 'auto'])
  @IsOptional()
  image_background?: 'transparent' | 'opaque' | 'auto';

  @ApiPropertyOptional({
    description:
      'Input fidelity level (gpt-image-1 only, not supported by gpt-image-1-mini):\n' +
      '- "high": Higher adherence to input prompt\n' +
      '- "low": More creative interpretation\n' +
      'Default: null (model decides)',
    enum: ['high', 'low'],
    example: 'high',
  })
  @IsEnum(['high', 'low'])
  @IsOptional()
  input_fidelity?: 'high' | 'low' | null;

  @ApiPropertyOptional({
    description:
      'Output compression quality (0-100). Higher values mean better quality but larger file size.\n' +
      'Default: 100',
    minimum: 0,
    maximum: 100,
    example: 100,
  })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  output_compression?: number;

  @ApiPropertyOptional({
    description:
      'Number of partial images to stream during generation (0-3).\n' +
      'Enables progressive rendering for better user experience.\n' +
      '0 = disabled, 3 = maximum partial images.\n' +
      'Default: 0',
    minimum: 0,
    maximum: 3,
    example: 0,
  })
  @IsInt()
  @Min(0)
  @Max(3)
  @IsOptional()
  partial_images?: number;

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
      'Upper bound for the number of tokens that can be generated for image generation',
    example: 1000,
    minimum: 1,
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  max_output_tokens?: number;

  @ApiPropertyOptional({
    description:
      'Controls how the model should select which tool(s) to use when generating an image',
  })
  @IsOptional()
  tool_choice?: Responses.ResponseCreateParamsNonStreaming['tool_choice'];

  @ApiPropertyOptional({
    description:
      'Whether to allow the model to run tool calls in parallel during image generation',
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
      'Useful for long-running image generation operations. Responses can be retrieved later via API. ' +
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

  // Advanced Features
  @ApiPropertyOptional({
    description:
      'Reference to a prompt template and its variables. ' +
      'Allows you to reuse stored prompts with variable substitution. ' +
      'Learn more: https://platform.openai.com/docs/guides/text?api-mode=responses#reusable-prompts',
    example: {
      id: 'pmpt_abc123',
      version: '2',
      variables: { style: 'photorealistic', subject: 'mountain landscape' },
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
    example: ['message.input_image.image_url'],
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
}
