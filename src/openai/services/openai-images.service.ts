import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { toFile } from 'openai';
import type { Images } from 'openai/resources/images';
import { LoggerService } from '../../common/services/logger.service';
import {
  CreateImagesDto,
  EditImageDto,
  ImageVariationDto,
} from '../dto/images';
import type { ImagesResponse, Image } from '../interfaces/images';

/**
 * Service for interacting with OpenAI Images API
 *
 * **Purpose**: Direct image generation using DALL-E 2 and DALL-E 3 models.
 * This is separate from Responses API gpt-image-1 image generation (Phase 2).
 *
 * **Supported Operations**:
 * - Image generation from text prompts (DALL-E 2, DALL-E 3)
 * - Image editing with masks (DALL-E 2 only)
 * - Image variations without prompts (DALL-E 2 only)
 *
 * **API Distinction**:
 * - **Images API** (Phase 5): Direct generation via `/v1/images/*` endpoints (DALL-E 2/3)
 * - **Responses API** (Phase 2): Conversational generation via `/v1/responses` (gpt-image-1)
 *
 * @see {@link https://platform.openai.com/docs/api-reference/images}
 */
@Injectable()
export class OpenAIImagesService {
  private client: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly loggerService: LoggerService,
  ) {
    const apiKey = this.configService.get<string>('openai.apiKey');
    const baseURL = this.configService.get<string>('openai.baseUrl');

    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL,
      timeout: this.configService.get<number>('openai.timeout'),
      maxRetries: this.configService.get<number>('openai.maxRetries'),
    });
  }

  /**
   * Generate images from text prompts using DALL-E 2 or DALL-E 3
   *
   * **Model Capabilities**:
   * - **DALL-E 3**: Higher quality, HD support, revised prompts, 1 image only
   * - **DALL-E 2**: Budget-friendly, multiple images (1-10), various sizes
   *
   * **Response Format**:
   * - `url`: Direct URL (expires in 60 minutes)
   * - `b64_json`: Base64-encoded image data
   *
   * @param dto - Image generation parameters
   * @returns OpenAI Images response with generated image(s)
   *
   * @example
   * ```typescript
   * // DALL-E 3 with HD quality
   * const response = await service.generateImages({
   *   model: 'dall-e-3',
   *   prompt: 'A serene mountain landscape',
   *   size: '1792x1024',
   *   quality: 'hd',
   *   style: 'natural'
   * });
   *
   * // DALL-E 2 with multiple images
   * const response = await service.generateImages({
   *   model: 'dall-e-2',
   *   prompt: 'A cute baby sea otter',
   *   n: 5,
   *   size: '512x512'
   * });
   * ```
   */
  async generateImages(dto: CreateImagesDto): Promise<ImagesResponse> {
    const startTime = Date.now();

    try {
      // Build SDK parameters from DTO
      const params: Images.ImageGenerateParamsNonStreaming = {
        prompt: dto.prompt,
        ...(dto.model && { model: dto.model }),
        ...(dto.n && { n: dto.n }),
        ...(dto.size && { size: dto.size }),
        ...(dto.quality && { quality: dto.quality }),
        ...(dto.style && { style: dto.style }),
        ...(dto.response_format && { response_format: dto.response_format }),
        ...(dto.user && { user: dto.user }),
      };

      // Call OpenAI SDK
      const response: ImagesResponse =
        await this.client.images.generate(params);

      // Calculate cost estimate
      const costEstimate = this.estimateImageCost(
        dto.model || 'dall-e-2',
        dto.size || '1024x1024',
        dto.quality,
        dto.n || 1,
      );

      // Log successful interaction
      this.loggerService.logOpenAIInteraction({
        timestamp: new Date().toISOString(),
        api: 'images',
        endpoint: '/v1/images/generations',
        request: params as unknown as Record<string, unknown>,
        response: response,
        metadata: {
          latency_ms: Date.now() - startTime,
          model: dto.model || 'dall-e-2',
          images_generated: response.data?.length || 0,
          cost_estimate: costEstimate,
          has_revised_prompt: response.data?.[0]?.revised_prompt !== undefined,
        },
      });

      return response;
    } catch (error: unknown) {
      const latency = Date.now() - startTime;

      // Log error
      this.loggerService.logOpenAIInteraction({
        timestamp: new Date().toISOString(),
        api: 'images',
        endpoint: '/v1/images/generations',
        request: {
          prompt: dto.prompt,
          model: dto.model,
        },
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          original_error: error,
        },
        metadata: {
          latency_ms: latency,
        },
      });

      // Rethrow error for exception filter to handle
      throw error;
    }
  }

  /**
   * Edit images using a source image, optional mask, and text prompt
   *
   * **Requirements**:
   * - Model: Only DALL-E 2 supported (DALL-E 3 does not support edits)
   * - Image: PNG, JPEG, or WEBP file, less than 4MB, must be square
   * - Mask: PNG file, less than 4MB, same dimensions as image
   * - Prompt: Max 1000 characters
   *
   * **Mask Behavior**:
   * Fully transparent areas (alpha = 0) in the mask indicate where to edit the image.
   * If no mask is provided, the entire image can be edited/extended.
   *
   * @param image - Source image file (Multer file)
   * @param mask - Optional mask file (Multer file)
   * @param dto - Edit parameters
   * @returns OpenAI Images response with edited image(s)
   *
   * @example
   * ```typescript
   * const response = await service.editImage(
   *   imageFile,
   *   maskFile,
   *   {
   *     prompt: 'Add a red door to the house',
   *     n: 2,
   *     size: '1024x1024'
   *   }
   * );
   * ```
   */
  async editImage(
    image: Express.Multer.File,
    mask: Express.Multer.File | undefined,
    dto: EditImageDto,
  ): Promise<ImagesResponse> {
    const startTime = Date.now();

    try {
      // Convert Multer file buffer to File using OpenAI SDK helper
      const imageFile = await toFile(image.buffer, image.originalname, {
        type: image.mimetype,
      });
      const maskFile = mask
        ? await toFile(mask.buffer, mask.originalname, { type: mask.mimetype })
        : undefined;

      // Build SDK parameters
      const params: Images.ImageEditParamsNonStreaming = {
        image: imageFile,
        prompt: dto.prompt,
        ...(maskFile && { mask: maskFile }),
        ...(dto.model && { model: dto.model }),
        ...(dto.n && { n: dto.n }),
        ...(dto.size && { size: dto.size }),
        ...(dto.response_format && { response_format: dto.response_format }),
        ...(dto.user && { user: dto.user }),
      };

      // Call OpenAI SDK
      const response: ImagesResponse = await this.client.images.edit(params);

      // Calculate cost estimate
      const costEstimate = this.estimateImageCost(
        'dall-e-2',
        dto.size || '1024x1024',
        undefined,
        dto.n || 1,
      );

      // Log successful interaction
      this.loggerService.logOpenAIInteraction({
        timestamp: new Date().toISOString(),
        api: 'images',
        endpoint: '/v1/images/edits',
        request: {
          prompt: dto.prompt,
          model: dto.model,
          n: dto.n,
          size: dto.size,
          has_mask: mask !== undefined,
          image_size_bytes: image.size,
          mask_size_bytes: mask?.size,
        },
        response: response,
        metadata: {
          latency_ms: Date.now() - startTime,
          cost_estimate: costEstimate,
          model: 'dall-e-2',
          images_generated: response.data?.length || 0,
          image_size_bytes: image.size,
          has_mask: mask !== undefined,
          mask_size_bytes: mask?.size,
        },
      });

      return response;
    } catch (error: unknown) {
      const latency = Date.now() - startTime;

      // Log error
      this.loggerService.logOpenAIInteraction({
        timestamp: new Date().toISOString(),
        api: 'images',
        endpoint: '/v1/images/edits',
        request: {
          prompt: dto.prompt,
          image_size_bytes: image.size,
          has_mask: mask !== undefined,
        },
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
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
   * Create variations of an image without a text prompt
   *
   * **Requirements**:
   * - Model: Only DALL-E 2 supported (DALL-E 3 does not support variations)
   * - Image: PNG file only, less than 4MB, must be square
   * - No prompt required (stylistic variations only)
   *
   * **Use Cases**:
   * - Generate multiple style variations of a single image
   * - Create alternatives without specifying a text prompt
   * - Explore different artistic interpretations
   *
   * @param image - Source image file (Multer file)
   * @param dto - Variation parameters
   * @returns OpenAI Images response with variation image(s)
   *
   * @example
   * ```typescript
   * const response = await service.createImageVariation(
   *   imageFile,
   *   {
   *     n: 3,
   *     size: '1024x1024',
   *     response_format: 'url'
   *   }
   * );
   * ```
   */
  async createImageVariation(
    image: Express.Multer.File,
    dto: ImageVariationDto,
  ): Promise<ImagesResponse> {
    const startTime = Date.now();

    try {
      // Convert Multer file buffer to File using OpenAI SDK helper
      const imageFile = await toFile(image.buffer, image.originalname, {
        type: image.mimetype,
      });

      // Build SDK parameters
      const params: Images.ImageCreateVariationParams = {
        image: imageFile,
        ...(dto.model && { model: dto.model }),
        ...(dto.n && { n: dto.n }),
        ...(dto.size && { size: dto.size }),
        ...(dto.response_format && { response_format: dto.response_format }),
        ...(dto.user && { user: dto.user }),
      };

      // Call OpenAI SDK
      const response: ImagesResponse =
        await this.client.images.createVariation(params);

      // Calculate cost estimate
      const costEstimate = this.estimateImageCost(
        'dall-e-2',
        dto.size || '1024x1024',
        undefined,
        dto.n || 1,
      );

      // Log successful interaction
      this.loggerService.logOpenAIInteraction({
        timestamp: new Date().toISOString(),
        api: 'images',
        endpoint: '/v1/images/variations',
        request: {
          model: dto.model,
          n: dto.n,
          size: dto.size,
          image_size_bytes: image.size,
        },
        response: response,
        metadata: {
          latency_ms: Date.now() - startTime,
          cost_estimate: costEstimate,
          model: 'dall-e-2',
          images_generated: response.data?.length || 0,
          image_size_bytes: image.size,
        },
      });

      return response;
    } catch (error: unknown) {
      const latency = Date.now() - startTime;

      // Log error
      this.loggerService.logOpenAIInteraction({
        timestamp: new Date().toISOString(),
        api: 'images',
        endpoint: '/v1/images/variations',
        request: {
          image_size_bytes: image.size,
          model: dto.model,
        },
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
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
   * Extract image URLs from ImagesResponse
   *
   * **Use Case**: Get direct URLs when response_format is 'url'
   *
   * **Note**: URLs expire in 60 minutes after generation
   *
   * @param response - OpenAI Images response
   * @returns Array of image URLs (empty if b64_json format used)
   *
   * @example
   * ```typescript
   * const response = await service.generateImages({ ... });
   * const urls = service.extractImageUrls(response);
   * // ['https://oaidalleapiprodscus.blob.core.windows.net/...']
   * ```
   */
  extractImageUrls(response: ImagesResponse): string[] {
    if (!response.data) {
      return [];
    }

    return response.data
      .filter((image: Image) => image.url !== undefined)
      .map((image: Image) => image.url!);
  }

  /**
   * Extract base64-encoded images from ImagesResponse
   *
   * **Use Case**: Get base64 data when response_format is 'b64_json'
   *
   * @param response - OpenAI Images response
   * @returns Array of base64-encoded image strings (empty if url format used)
   *
   * @example
   * ```typescript
   * const response = await service.generateImages({ response_format: 'b64_json', ... });
   * const base64Images = service.extractBase64Images(response);
   * // ['iVBORw0KGgoAAAANSUhEUgAAAAUA...']
   *
   * // Use in HTML
   * const imgSrc = `data:image/png;base64,${base64Images[0]}`;
   * ```
   */
  extractBase64Images(response: ImagesResponse): string[] {
    if (!response.data) {
      return [];
    }

    return response.data
      .filter((image: Image) => image.b64_json !== undefined)
      .map((image: Image) => image.b64_json!);
  }

  /**
   * Estimate cost of image generation based on model, size, quality, and quantity
   *
   * **Pricing** (as of 2025):
   *
   * **DALL-E 3**:
   * - Standard 1024x1024: $0.040 per image
   * - HD 1024x1024: $0.080 per image
   * - HD 1792x1024 or 1024x1792: $0.120 per image
   *
   * **DALL-E 2**:
   * - 1024x1024: $0.020 per image
   * - 512x512: $0.018 per image
   * - 256x256: $0.016 per image
   *
   * @param model - Image model (dall-e-2 or dall-e-3)
   * @param size - Image size
   * @param quality - Quality setting (DALL-E 3 only)
   * @param n - Number of images
   * @returns Estimated cost in USD
   *
   * @example
   * ```typescript
   * const cost = service.estimateImageCost('dall-e-3', '1792x1024', 'hd', 1);
   * // 0.12 (HD large image)
   *
   * const cost = service.estimateImageCost('dall-e-2', '512x512', undefined, 5);
   * // 0.09 (5 medium images)
   * ```
   */
  estimateImageCost(
    model: string,
    size: string,
    quality?: string,
    n: number = 1,
  ): number {
    let costPerImage = 0;

    if (model === 'dall-e-3') {
      if (quality === 'hd') {
        // HD quality
        if (size === '1024x1024') {
          costPerImage = 0.08;
        } else if (size === '1792x1024' || size === '1024x1792') {
          costPerImage = 0.12;
        } else {
          costPerImage = 0.08; // Default HD price
        }
      } else {
        // Standard quality
        costPerImage = 0.04;
      }
    } else if (model === 'dall-e-2') {
      if (size === '1024x1024') {
        costPerImage = 0.02;
      } else if (size === '512x512') {
        costPerImage = 0.018;
      } else if (size === '256x256') {
        costPerImage = 0.016;
      } else {
        costPerImage = 0.02; // Default price
      }
    } else {
      // Unknown model - use DALL-E 2 default
      costPerImage = 0.02;
    }

    return costPerImage * n;
  }
}
