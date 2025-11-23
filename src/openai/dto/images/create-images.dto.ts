import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import type { ImageModel } from '../../interfaces/images';
import { IsImageModelSizeValid } from '../../validators/image-model-size.validator';

/**
 * DTO for creating images via DALL-E 2 or DALL-E 3.
 *
 * **Endpoint**: POST /api/images/generate
 *
 * **Model-Specific Constraints**:
 *
 * **DALL-E 3**:
 * - Sizes: 1024x1024, 1792x1024, 1024x1792
 * - Quality: standard, hd
 * - Style: vivid, natural
 * - n: Must be 1 (only 1 image supported)
 * - Prompt max length: 4000 characters
 * - Returns revised_prompt
 *
 * **DALL-E 2**:
 * - Sizes: 256x256, 512x512, 1024x1024
 * - Quality: Only standard
 * - Style: Not supported
 * - n: 1-10 images
 * - Prompt max length: 1000 characters
 *
 * @see {@link https://platform.openai.com/docs/api-reference/images/create}
 *
 * @example
 * ```typescript
 * // DALL-E 3 with HD quality
 * const dto: CreateImagesDto = {
 *   model: 'dall-e-3',
 *   prompt: 'A serene mountain landscape with a lake',
 *   size: '1792x1024',
 *   quality: 'hd',
 *   style: 'natural',
 *   n: 1
 * };
 *
 * // DALL-E 2 with multiple images
 * const dto: CreateImagesDto = {
 *   model: 'dall-e-2',
 *   prompt: 'A cute baby sea otter',
 *   size: '512x512',
 *   n: 5
 * };
 * ```
 */
export class CreateImagesDto {
  /**
   * The model to use for image generation.
   *
   * **Options**:
   * - `gpt-image-1` - Latest multimodal model, up to 4096×4096, b64_json only, 1 image only
   * - `dall-e-3` - Higher quality, HD support, revised prompts, 1 image only
   * - `dall-e-2` - Budget-friendly, supports multiple images and smaller sizes
   *
   * **Default**: `dall-e-2`
   *
   * **gpt-image-1 Limitations**:
   * - No `quality` or `style` parameters
   * - No `url` response format (only `b64_json`)
   * - Only 1 image per request (n=1)
   *
   * @example 'gpt-image-1'
   */
  @ApiPropertyOptional({
    description: 'The model to use for image generation',
    enum: ['dall-e-2', 'dall-e-3', 'gpt-image-1'],
    default: 'dall-e-2',
    example: 'dall-e-3',
  })
  @IsOptional()
  @IsEnum(['dall-e-2', 'dall-e-3', 'gpt-image-1'], {
    message: 'model must be dall-e-2, dall-e-3, or gpt-image-1',
  })
  model?: ImageModel = 'dall-e-2';

  /**
   * A text description of the desired image(s).
   *
   * **Max Length**:
   * - DALL-E 3: 4000 characters
   * - DALL-E 2: 1000 characters
   *
   * @example 'A serene mountain landscape with a crystal-clear lake in the foreground, surrounded by pine trees'
   */
  @ApiProperty({
    description: 'Text description of the desired image(s)',
    maxLength: 4000,
    example:
      'A serene mountain landscape with a crystal-clear lake in the foreground',
  })
  @IsString()
  @MaxLength(4000, {
    message:
      'prompt must not exceed 4000 characters for dall-e-3, 1000 for dall-e-2',
  })
  prompt!: string;

  /**
   * The number of images to generate.
   *
   * **Constraints**:
   * - DALL-E 3: Must be 1 (only 1 image supported)
   * - DALL-E 2: 1-10 images
   *
   * **Default**: 1
   *
   * @example 1
   */
  @ApiPropertyOptional({
    description: 'Number of images to generate (DALL-E 2: 1-10, DALL-E 3: 1)',
    minimum: 1,
    maximum: 10,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'n must be at least 1' })
  @Max(10, { message: 'n must not exceed 10' })
  n?: number = 1;

  /**
   * The size of the generated images.
   *
   * **gpt-image-1 Sizes**:
   * - `1024x1024` - Square (standard)
   * - `1024x1536` - Portrait
   * - `1536x1024` - Landscape
   * - `auto` - Automatically determined based on prompt
   *
   * **DALL-E 3 Sizes**:
   * - `1024x1024` - Square (standard)
   * - `1792x1024` - Landscape
   * - `1024x1792` - Portrait
   *
   * **DALL-E 2 Sizes**:
   * - `256x256` - Small (cheapest)
   * - `512x512` - Medium
   * - `1024x1024` - Large
   *
   * **Default**: `1024x1024`
   *
   * @example '1792x1024'
   */
  @ApiPropertyOptional({
    description: 'Size of the generated images (varies by model)',
    enum: [
      '256x256',
      '512x512',
      '1024x1024',
      '1792x1024',
      '1024x1792',
      '1024x1536',
      '1536x1024',
      'auto',
    ],
    default: '1024x1024',
    example: '1024x1024',
  })
  @IsOptional()
  @IsEnum(
    [
      '256x256',
      '512x512',
      '1024x1024',
      '1792x1024',
      '1024x1792',
      '1024x1536',
      '1536x1024',
      'auto',
    ],
    {
      message:
        'size must be one of: 256x256, 512x512, 1024x1024, 1792x1024, 1024x1792, 1024x1536, 1536x1024, auto',
    },
  )
  @IsImageModelSizeValid()
  size?:
    | '256x256'
    | '512x512'
    | '1024x1024'
    | '1792x1024'
    | '1024x1792'
    | '1024x1536'
    | '1536x1024'
    | 'auto' = '1024x1024';

  /**
   * The quality of the image generation.
   *
   * **DALL-E 3**:
   * - `standard` - Standard quality (faster, cheaper)
   * - `hd` - High definition (4x more expensive, better detail)
   *
   * **DALL-E 2**:
   * - Only `standard` supported
   *
   * **Note**: The `quality` parameter is not currently supported by the OpenAI Images API.
   * Including it will result in an API error. This field is kept for future compatibility.
   *
   * @example 'hd'
   */
  @ApiPropertyOptional({
    description:
      'Quality of the generated image (DALL-E 3: standard/hd, DALL-E 2: standard only)',
    enum: ['standard', 'hd'],
    example: 'standard',
  })
  @IsOptional()
  @IsEnum(['standard', 'hd'], {
    message: 'quality must be either standard or hd',
  })
  quality?: 'standard' | 'hd';

  /**
   * The style of the generated images (DALL-E 3 only).
   *
   * - `vivid` - Hyper-real and dramatic images
   * - `natural` - More natural, less hyper-real looking images
   *
   * **Note**: Not supported for DALL-E 2
   *
   * @example 'natural'
   */
  @ApiPropertyOptional({
    description:
      'Style of the generated images (DALL-E 3 only: vivid or natural)',
    enum: ['vivid', 'natural'],
    example: 'natural',
  })
  @IsOptional()
  @IsEnum(['vivid', 'natural'], {
    message: 'style must be either vivid or natural',
  })
  style?: 'vivid' | 'natural';

  /**
   * The format in which the generated images are returned.
   *
   * - `url` - Direct URL (expires in 60 minutes) - **Default**
   * - `b64_json` - Base64-encoded image data
   *
   * **Note**: URLs are only valid for 60 minutes after generation
   *
   * @example 'url'
   */
  @ApiPropertyOptional({
    description:
      'Format of the returned images (url: direct URL expires in 60min, b64_json: base64 data)',
    enum: ['url', 'b64_json'],
    default: 'url',
    example: 'url',
  })
  @IsOptional()
  @IsEnum(['url', 'b64_json'], {
    message: 'response_format must be either url or b64_json',
  })
  response_format?: 'url' | 'b64_json' = 'url';

  /**
   * A unique identifier representing your end-user.
   *
   * This helps OpenAI monitor and detect abuse.
   *
   * @see {@link https://platform.openai.com/docs/guides/safety-best-practices#end-user-ids}
   *
   * @example 'user-12345'
   */
  @ApiPropertyOptional({
    description: 'Unique identifier for end-user (helps OpenAI monitor abuse)',
    example: 'user-12345',
  })
  @IsOptional()
  @IsString()
  user?: string;
}
