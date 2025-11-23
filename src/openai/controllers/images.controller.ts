import {
  Body,
  Controller,
  Post,
  UseFilters,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import {
  FileInterceptor,
  FileFieldsInterceptor,
} from '@nestjs/platform-express';
import type { ImagesResponse } from '../interfaces/images';
import { OpenAIImagesService } from '../services/openai-images.service';
import {
  CreateImagesDto,
  EditImageDto,
  ImageVariationDto,
} from '../dto/images';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { RetryInterceptor } from '../../common/interceptors/retry.interceptor';
import { OpenAIExceptionFilter } from '../../common/filters/openai-exception.filter';

/**
 * Controller for OpenAI Images API
 *
 * **Purpose**: Direct image generation using DALL-E 2 and DALL-E 3 models.
 * This is separate from Responses API gpt-image-1 image generation (Phase 2).
 *
 * **Endpoints**:
 * - POST /api/images/generate - Generate images from text prompts
 * - POST /api/images/edit - Edit images with masks (DALL-E 2 only)
 * - POST /api/images/variations - Create image variations (DALL-E 2 only)
 *
 * **API Distinction**:
 * - **Images API** (Phase 5): Direct generation via `/v1/images/*` (DALL-E 2/3)
 * - **Responses API** (Phase 2): Conversational generation via `/v1/responses` (gpt-image-1)
 *
 * @see {@link https://platform.openai.com/docs/api-reference/images}
 */
@ApiTags('Images API')
@Controller('api/images')
@UseInterceptors(RetryInterceptor, LoggingInterceptor)
@UseFilters(OpenAIExceptionFilter)
export class ImagesController {
  constructor(private readonly imagesService: OpenAIImagesService) {}

  /**
   * Generate images from text prompts
   * POST /api/images/generate
   */
  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate images from text prompts',
    description:
      'Creates images from text descriptions using DALL-E 2 or DALL-E 3. ' +
      '\n\n**Model Capabilities**:' +
      '\n- **DALL-E 3**: Higher quality, HD support, revised prompts, 1 image only' +
      '\n- **DALL-E 2**: Budget-friendly, multiple images (1-10), various sizes' +
      '\n\n**Response Format**:' +
      '\n- `url`: Direct URL (expires in 60 minutes)' +
      '\n- `b64_json`: Base64-encoded image data',
  })
  @ApiResponse({
    status: 200,
    description: 'Images generated successfully',
    schema: {
      type: 'object',
      properties: {
        created: {
          type: 'number',
          description: 'Unix timestamp when images were created',
          example: 1701888237,
        },
        data: {
          type: 'array',
          description: 'Array of generated images',
          items: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'Direct URL to image (if response_format: url)',
                example:
                  'https://oaidalleapiprodscus.blob.core.windows.net/...',
              },
              b64_json: {
                type: 'string',
                description:
                  'Base64-encoded image (if response_format: b64_json)',
                example: 'iVBORw0KGgoAAAANSUhEUgAAAAUA...',
              },
              revised_prompt: {
                type: 'string',
                description:
                  'DALL-E 3 only: The actual prompt used after moderation',
                example: 'A serene mountain landscape with a lake...',
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid request - model/size mismatch, prompt too long, invalid parameters',
  })
  @ApiResponse({ status: 401, description: 'Invalid OpenAI API key' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 500, description: 'Image generation failed' })
  async generateImages(@Body() dto: CreateImagesDto): Promise<ImagesResponse> {
    return this.imagesService.generateImages(dto);
  }

  /**
   * Edit images using a source image, optional mask, and text prompt
   * POST /api/images/edit
   */
  @Post('edit')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'image', maxCount: 1 },
      { name: 'mask', maxCount: 1 },
    ]),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Edit images with masks (DALL-E 2 only)',
    description:
      'Edits or extends an image based on a text prompt and optional mask. ' +
      '\n\n**Requirements**:' +
      '\n- Model: Only DALL-E 2 supported (DALL-E 3 does not support edits)' +
      '\n- Image: PNG, JPEG, or WEBP file, less than 4MB, must be square' +
      '\n- Mask: PNG file, less than 4MB, same dimensions as image' +
      '\n- Prompt: Max 1000 characters' +
      '\n\n**Mask Behavior**:' +
      '\nFully transparent areas (alpha = 0) in the mask indicate where to edit the image. ' +
      'If no mask is provided, the entire image can be edited/extended.',
  })
  @ApiBody({
    description:
      'Image edit request with image file, optional mask, and parameters',
    schema: {
      type: 'object',
      required: ['image', 'prompt'],
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description:
            'Source image file (PNG, JPEG, or WEBP, less than 4MB, square)',
        },
        mask: {
          type: 'string',
          format: 'binary',
          description:
            'Optional mask file (PNG, less than 4MB, same dimensions as image)',
        },
        prompt: {
          type: 'string',
          description:
            'Text description of the desired edit (max 1000 characters)',
          example: 'Add a red door to the house',
          maxLength: 1000,
        },
        model: {
          type: 'string',
          enum: ['dall-e-2'],
          description: 'Model to use (only dall-e-2 supports edits)',
          default: 'dall-e-2',
        },
        n: {
          type: 'number',
          description: 'Number of edited images to generate (1-10)',
          minimum: 1,
          maximum: 10,
          default: 1,
        },
        size: {
          type: 'string',
          enum: ['256x256', '512x512', '1024x1024'],
          description: 'Size of edited images',
          default: '1024x1024',
        },
        response_format: {
          type: 'string',
          enum: ['url', 'b64_json'],
          description: 'Format of returned images (url or b64_json)',
          default: 'url',
        },
        user: {
          type: 'string',
          description: 'Unique end-user identifier',
          example: 'user-12345',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Images edited successfully',
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid request - image not square, mask dimensions mismatch, invalid file format',
  })
  @ApiResponse({ status: 401, description: 'Invalid OpenAI API key' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 500, description: 'Image editing failed' })
  async editImage(
    @UploadedFiles()
    files: {
      image?: Express.Multer.File[];
      mask?: Express.Multer.File[];
    },
    @Body() dto: EditImageDto,
  ): Promise<ImagesResponse> {
    // Validate image file is provided
    if (!files.image || files.image.length === 0) {
      throw new BadRequestException('Image file is required');
    }

    const image = files.image[0];
    const mask =
      files.mask && files.mask.length > 0 ? files.mask[0] : undefined;

    return this.imagesService.editImage(image, mask, dto);
  }

  /**
   * Create variations of an image without a text prompt
   * POST /api/images/variations
   */
  @Post('variations')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Create image variations (DALL-E 2 only)',
    description:
      'Creates variations of a given image maintaining the general composition but changing style, colors, and details. ' +
      '\n\n**Requirements**:' +
      '\n- Model: Only DALL-E 2 supported (DALL-E 3 does not support variations)' +
      '\n- Image: PNG file only, less than 4MB, must be square' +
      '\n- No prompt required (stylistic variations only)' +
      '\n\n**Use Cases**:' +
      '\n- Generate multiple style variations of a single image' +
      '\n- Create alternatives without specifying a text prompt' +
      '\n- Explore different artistic interpretations',
  })
  @ApiBody({
    description: 'Image variation request with image file and parameters',
    schema: {
      type: 'object',
      required: ['image'],
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Source image file (PNG only, less than 4MB, square)',
        },
        model: {
          type: 'string',
          enum: ['dall-e-2'],
          description: 'Model to use (only dall-e-2 supports variations)',
          default: 'dall-e-2',
        },
        n: {
          type: 'number',
          description: 'Number of variations to generate (1-10)',
          minimum: 1,
          maximum: 10,
          default: 1,
        },
        size: {
          type: 'string',
          enum: ['256x256', '512x512', '1024x1024'],
          description: 'Size of variation images',
          default: '1024x1024',
        },
        response_format: {
          type: 'string',
          enum: ['url', 'b64_json'],
          description: 'Format of returned images (url or b64_json)',
          default: 'url',
        },
        user: {
          type: 'string',
          description: 'Unique end-user identifier',
          example: 'user-12345',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Variations created successfully',
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid request - image not square, image not PNG, invalid file format',
  })
  @ApiResponse({ status: 401, description: 'Invalid OpenAI API key' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 500, description: 'Variation creation failed' })
  async createImageVariation(
    @UploadedFile() image: Express.Multer.File,
    @Body() dto: ImageVariationDto,
  ): Promise<ImagesResponse> {
    // Validate image file is provided
    if (!image) {
      throw new BadRequestException('Image file is required');
    }

    return this.imagesService.createImageVariation(image, dto);
  }
}
