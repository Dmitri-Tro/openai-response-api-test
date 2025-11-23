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

/**
 * DTO for editing images via DALL-E 2.
 *
 * **Endpoint**: POST /api/images/edit
 *
 * **Requirements**:
 * - Model: Only `dall-e-2` supported (DALL-E 3 does not support edits)
 * - Image: PNG, JPEG, or WEBP file, less than 4MB, must be square
 * - Mask: PNG file, less than 4MB, same dimensions as image
 * - Prompt: Text description of the edit, max 1000 characters
 *
 * **Functionality**:
 * The transparent areas of the mask (alpha = 0) indicate where the image should be edited.
 * If no mask is provided, the entire image can be edited/extended.
 *
 * @see {@link https://platform.openai.com/docs/api-reference/images/createEdit}
 *
 * @example
 * ```typescript
 * // Edit image with mask
 * const dto: EditImageDto = {
 *   prompt: 'Add a red door to the house',
 *   model: 'dall-e-2',
 *   n: 2,
 *   size: '1024x1024'
 * };
 * // Image and mask files uploaded via multipart/form-data
 *
 * // Edit without mask
 * const dto: EditImageDto = {
 *   prompt: 'Make it sunset',
 *   size: '512x512'
 * };
 * ```
 */
export class EditImageDto {
  /**
   * A text description of the desired edit.
   *
   * **Max Length**: 1000 characters (DALL-E 2)
   *
   * @example 'Add a red door to the house'
   */
  @ApiProperty({
    description: 'Text description of the desired edit (max 1000 characters)',
    maxLength: 1000,
    example: 'Add a red door to the house',
  })
  @IsString()
  @MaxLength(1000, {
    message: 'prompt must not exceed 1000 characters for dall-e-2',
  })
  prompt!: string;

  /**
   * The model to use for image editing.
   *
   * **Supported Models**:
   * - `dall-e-2` - Only model that supports edits
   *
   * **Note**: DALL-E 3 does not support image editing.
   * For DALL-E 3 image editing, use Responses API with gpt-image-1.
   *
   * **Default**: `dall-e-2`
   *
   * @example 'dall-e-2'
   */
  @ApiPropertyOptional({
    description: 'The model to use (only dall-e-2 supports edits)',
    enum: ['dall-e-2'],
    default: 'dall-e-2',
    example: 'dall-e-2',
  })
  @IsOptional()
  @IsEnum(['dall-e-2'], {
    message: 'model must be dall-e-2 (only model that supports edits)',
  })
  model?: Extract<ImageModel, 'dall-e-2'> = 'dall-e-2';

  /**
   * The number of edited images to generate.
   *
   * **Range**: 1-10 images
   *
   * **Default**: 1
   *
   * @example 2
   */
  @ApiPropertyOptional({
    description: 'Number of edited images to generate (1-10)',
    minimum: 1,
    maximum: 10,
    default: 1,
    example: 2,
  })
  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'n must be at least 1' })
  @Max(10, { message: 'n must not exceed 10' })
  n?: number = 1;

  /**
   * The size of the edited images.
   *
   * **DALL-E 2 Sizes** (must be square):
   * - `256x256` - Small (cheapest)
   * - `512x512` - Medium
   * - `1024x1024` - Large (best quality)
   *
   * **Default**: `1024x1024`
   *
   * @example '1024x1024'
   */
  @ApiPropertyOptional({
    description:
      'Size of the edited images (DALL-E 2: 256x256, 512x512, 1024x1024)',
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
   * The format in which the edited images are returned.
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
