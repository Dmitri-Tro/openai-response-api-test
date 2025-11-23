import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import type { ImageModel } from '../../interfaces/images';

/**
 * DTO for creating image variations via DALL-E 2.
 *
 * **Endpoint**: POST /api/images/variations
 *
 * **Requirements**:
 * - Model: Only `dall-e-2` supported (DALL-E 3 does not support variations)
 * - Image: PNG file only, less than 4MB, must be square
 * - No prompt required (unlike generate/edit)
 *
 * **Functionality**:
 * Creates variations of a given image maintaining the general composition
 * but changing style, colors, and details.
 *
 * **Use Cases**:
 * - Generate multiple style variations of a single image
 * - Create alternatives without specifying a text prompt
 * - Explore different artistic interpretations of the same composition
 *
 * @see {@link https://platform.openai.com/docs/api-reference/images/createVariation}
 *
 * @example
 * ```typescript
 * // Create 3 variations
 * const dto: ImageVariationDto = {
 *   model: 'dall-e-2',
 *   n: 3,
 *   size: '1024x1024',
 *   response_format: 'url'
 * };
 * // Image file uploaded via multipart/form-data
 * ```
 */
export class ImageVariationDto {
  /**
   * The model to use for creating variations.
   *
   * **Supported Models**:
   * - `dall-e-2` - Only model that supports variations
   *
   * **Note**: DALL-E 3 does not support image variations.
   *
   * **Default**: `dall-e-2`
   *
   * @example 'dall-e-2'
   */
  @ApiPropertyOptional({
    description: 'The model to use (only dall-e-2 supports variations)',
    enum: ['dall-e-2'],
    default: 'dall-e-2',
    example: 'dall-e-2',
  })
  @IsOptional()
  @IsEnum(['dall-e-2'], {
    message: 'model must be dall-e-2 (only model that supports variations)',
  })
  model?: Extract<ImageModel, 'dall-e-2'> = 'dall-e-2';

  /**
   * The number of variations to generate.
   *
   * **Range**: 1-10 images
   *
   * **Default**: 1
   *
   * @example 3
   */
  @ApiPropertyOptional({
    description: 'Number of variations to generate (1-10)',
    minimum: 1,
    maximum: 10,
    default: 1,
    example: 3,
  })
  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'n must be at least 1' })
  @Max(10, { message: 'n must not exceed 10' })
  n?: number = 1;

  /**
   * The size of the variation images.
   *
   * **DALL-E 2 Sizes** (must be square):
   * - `256x256` - Small (cheapest, fastest)
   * - `512x512` - Medium (balanced)
   * - `1024x1024` - Large (best quality)
   *
   * **Default**: `1024x1024`
   *
   * @example '1024x1024'
   */
  @ApiPropertyOptional({
    description:
      'Size of the variation images (DALL-E 2: 256x256, 512x512, 1024x1024)',
    enum: ['256x256', '512x512', '1024x1024'],
    default: '1024x1024',
    example: '1024x1024',
  })
  @IsOptional()
  @IsEnum(['256x256', '512x512', '1024x1024'], {
    message: 'size must be one of: 256x256, 512x512, 1024x1024',
  })
  size?: '256x256' | '512x512' | '1024x1024' = '1024x1024';

  /**
   * The format in which the variation images are returned.
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
