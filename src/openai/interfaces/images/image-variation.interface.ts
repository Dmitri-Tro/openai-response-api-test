/**
 * Image Variation Type Interfaces
 *
 * Types for creating image variations via `client.images.createVariation()` method.
 * Supports DALL-E 2 only (DALL-E 3 does not support variations).
 *
 * **Functionality**:
 * Creates variations of a given image without a text prompt.
 * The variations are stylistic variations maintaining the general composition.
 *
 * @see {@link https://platform.openai.com/docs/api-reference/images/createVariation}
 */

import type { Images } from 'openai/resources/images';

/**
 * Parameters for creating image variations.
 *
 * **Core Parameters**:
 * - `image` (required) - Source image file (PNG only)
 * - `model` - Only 'dall-e-2' supported
 * - `n` - Number of variations to generate (1-10)
 * - `size` - Image dimensions (256x256, 512x512, 1024x1024)
 * - `response_format` - 'url' or 'b64_json' (default: 'url')
 * - `user` - User identifier for abuse monitoring
 *
 * **Image Requirements**:
 * - Format: PNG only (not JPEG or WEBP)
 * - Size: Less than 4MB
 * - Dimensions: Must be square
 * - Quality: Higher quality input = better variations
 *
 * **DALL-E 2 Only**:
 * - DALL-E 3 does not support variations
 * - No text prompt required (unlike generate/edit)
 * - Variations maintain composition but change style/details
 *
 * **Use Cases**:
 * - Generate multiple style variations of a single image
 * - Create alternatives without specifying a text prompt
 * - Explore different artistic interpretations of the same composition
 *
 * @example
 * ```typescript
 * // Create 3 variations of an image
 * const params: ImageCreateVariationParams = {
 *   image: fs.createReadStream('path/to/image.png'),
 *   model: 'dall-e-2',
 *   n: 3,
 *   size: '1024x1024',
 *   response_format: 'url'
 * };
 *
 * // Create single variation in base64 format
 * const params: ImageCreateVariationParams = {
 *   image: fs.createReadStream('path/to/image.png'),
 *   model: 'dall-e-2',
 *   n: 1,
 *   size: '512x512',
 *   response_format: 'b64_json'
 * };
 * ```
 */
export type ImageCreateVariationParams = Images.ImageCreateVariationParams;

/**
 * Supported sizes for image variations (DALL-E 2 only).
 *
 * - `256x256` - Small (cheapest, fastest)
 * - `512x512` - Medium (balanced)
 * - `1024x1024` - Large (best quality, most expensive)
 *
 * **Note**: All sizes must be square for variations.
 */
export type VariationImageSize = '256x256' | '512x512' | '1024x1024';
