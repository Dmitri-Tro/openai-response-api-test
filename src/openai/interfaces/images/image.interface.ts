/**
 * Image API Type Interfaces
 *
 * Re-exports and documentation for OpenAI Images API types.
 * Phase 5: Standalone Images API for DALL-E 3 and DALL-E 2 models.
 *
 * **Distinction from Responses API**:
 * - **Images API** (Phase 5): Direct image generation via `/v1/images/*` endpoints (DALL-E 3/2)
 * - **Responses API** (Phase 2): Conversational image generation via `/v1/responses` (gpt-image-1)
 *
 * @see {@link https://platform.openai.com/docs/api-reference/images}
 */

import type { Images } from 'openai/resources/images';

/**
 * Main response type from Images API endpoints.
 *
 * @property created - Unix timestamp (in seconds) when the image was created
 * @property data - Array of generated images (each with url or b64_json)
 * @property background - Background setting (for gpt-image-1 only)
 * @property output_format - Output format: png, webp, or jpeg (for gpt-image-1 only)
 * @property quality - Quality setting (for gpt-image-1 only)
 * @property size - Size of the generated image
 * @property usage - Token usage information (for gpt-image-1 only)
 *
 * @example
 * ```typescript
 * const response: ImagesResponse = {
 *   created: 1701888237,
 *   data: [
 *     {
 *       url: "https://oaidalleapiprodscus.blob.core.windows.net/...",
 *       revised_prompt: "A serene landscape..."
 *     }
 *   ]
 * };
 * ```
 */
export type ImagesResponse = Images.ImagesResponse;

/**
 * Individual image data within ImagesResponse.
 *
 * @property b64_json - Base64-encoded image data (if response_format: 'b64_json')
 * @property url - Direct URL to the generated image (if response_format: 'url', expires in 60 minutes)
 * @property revised_prompt - DALL-E 3 only: The actual prompt used after safety moderation
 *
 * **Response Format**:
 * - **url**: Direct URL (DALL-E 2/3, expires in 60 minutes)
 * - **b64_json**: Base64-encoded data (all models)
 *
 * **DALL-E 3 Revised Prompt**:
 * OpenAI automatically rewrites prompts for safety and quality.
 * The `revised_prompt` field shows the actual prompt used.
 *
 * @example
 * ```typescript
 * // URL format (DALL-E 3)
 * const imageData: Image = {
 *   url: "https://oaidalleapiprodscus.blob.core.windows.net/...",
 *   revised_prompt: "A serene mountain landscape with a lake in the foreground"
 * };
 *
 * // Base64 format (DALL-E 2)
 * const imageData: Image = {
 *   b64_json: "iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAY..."
 * };
 * ```
 */
export type Image = Images.Image;

/**
 * Image model types supported by Images API.
 *
 * **Model Comparison**:
 * - **gpt-image-1**: Latest multimodal model, up to 4096×4096, b64_json only, 1 image only, no quality/style params
 * - **dall-e-3**: Higher quality, revised prompts, HD support, 1 image only
 * - **dall-e-2**: Budget-friendly, multiple images (1-10), edits/variations support
 *
 * **gpt-image-1 Limitations**:
 * - No `quality` or `style` parameters
 * - No `url` response format (only `b64_json`)
 * - No support for edits or variations endpoints
 * - Only 1 image per request (n=1)
 *
 * @see {@link https://platform.openai.com/docs/models/dall-e}
 */
export type ImageModel = 'dall-e-2' | 'dall-e-3' | 'gpt-image-1';

/**
 * Supported image sizes by model.
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
 * - `1024x1024` - Large (best quality)
 *
 * @example
 * ```typescript
 * // gpt-image-1 auto size
 * const size: DalleImageSize = 'auto';
 *
 * // DALL-E 3 landscape
 * const size: DalleImageSize = '1792x1024';
 *
 * // DALL-E 2 medium
 * const size: DalleImageSize = '512x512';
 * ```
 */
export type DalleImageSize =
  | '256x256'
  | '512x512'
  | '1024x1024'
  | '1792x1024'
  | '1024x1792'
  | '1024x1536'
  | '1536x1024'
  | 'auto';

/**
 * Image quality settings.
 *
 * **DALL-E 3**:
 * - `standard` - Standard quality (faster, cheaper)
 * - `hd` - High definition (4x more expensive)
 *
 * **DALL-E 2**:
 * - Only `standard` supported
 *
 * @example
 * ```typescript
 * // DALL-E 3 HD quality
 * const quality: ImageQuality = 'hd';
 * ```
 */
export type ImageQuality = 'standard' | 'hd';

/**
 * Image style settings (DALL-E 3 only).
 *
 * - `vivid` - Hyper-real and dramatic images
 * - `natural` - More natural, less dramatic images
 *
 * @example
 * ```typescript
 * const style: ImageStyle = 'natural';
 * ```
 */
export type ImageStyle = 'vivid' | 'natural';

/**
 * Response format for generated images.
 *
 * - `url` - Direct URL (expires in 60 minutes) - DALL-E 2/3 only
 * - `b64_json` - Base64-encoded image data - All models
 *
 * **Note**: gpt-image-1 always returns b64_json
 *
 * @example
 * ```typescript
 * const format: ImageResponseFormat = 'url';
 * ```
 */
export type ImageResponseFormat = 'url' | 'b64_json';

/**
 * Image file formats for edits and variations.
 *
 * **Supported Formats**:
 * - `image/png`
 * - `image/jpeg`
 * - `image/webp`
 *
 * **Requirements**:
 * - Max size: 20MB (DALL-E 2) or 50MB (gpt-image-1)
 * - Must be square for edits/variations (DALL-E 2)
 *
 * @example
 * ```typescript
 * const format: ImageFileFormat = 'image/png';
 * ```
 */
export type ImageFileFormat = 'image/png' | 'image/jpeg' | 'image/webp';
