/**
 * Image Edit Type Interfaces
 *
 * Types for image editing via `client.images.edit()` method.
 * Supports DALL-E 2 only (DALL-E 3 does not support edits).
 *
 * **Functionality**:
 * Edits or extends an image based on a prompt and an optional mask.
 * The transparent areas of the mask indicate where the image should be edited.
 *
 * @see {@link https://platform.openai.com/docs/api-reference/images/createEdit}
 */

import type { Images } from 'openai/resources/images';

/**
 * Parameters for non-streaming image editing.
 *
 * **Core Parameters**:
 * - `image` (required) - Source image file (PNG, JPEG, or WEBP)
 * - `prompt` (required) - Text description of the desired edit
 * - `mask` - PNG file indicating where to edit (fully transparent = edit here)
 * - `model` - Only 'dall-e-2' supported
 * - `n` - Number of edited images to generate (1-10)
 * - `size` - Image dimensions (256x256, 512x512, 1024x1024)
 * - `response_format` - 'url' or 'b64_json' (default: 'url')
 * - `user` - User identifier for abuse monitoring
 *
 * **Image Requirements**:
 * - Format: PNG, JPEG, or WEBP
 * - Size: Less than 4MB
 * - Dimensions: Must be square
 * - Transparency: Alpha channel preserved in PNG
 *
 * **Mask Requirements**:
 * - Format: PNG only
 * - Size: Less than 4MB
 * - Dimensions: Must match image dimensions exactly
 * - Transparency: Fully transparent areas (alpha = 0) indicate edit regions
 *
 * **DALL-E 2 Only**:
 * - DALL-E 3 does not support image editing
 * - For DALL-E 3 edits, use Responses API with gpt-image-1
 *
 * @example
 * ```typescript
 * // Edit image with mask
 * const params: ImageEditParams = {
 *   image: fs.createReadStream('path/to/image.png'),
 *   mask: fs.createReadStream('path/to/mask.png'),
 *   prompt: 'Add a red door to the house',
 *   model: 'dall-e-2',
 *   n: 2,
 *   size: '1024x1024',
 *   response_format: 'url'
 * };
 *
 * // Edit without mask (extend/modify entire image)
 * const params: ImageEditParams = {
 *   image: fs.createReadStream('path/to/image.png'),
 *   prompt: 'Make it sunset',
 *   model: 'dall-e-2',
 *   size: '512x512'
 * };
 * ```
 */
export type ImageEditParams = Images.ImageEditParamsNonStreaming;

/**
 * Streaming image edit parameters (gpt-image-1 only, not used in Phase 5).
 *
 * Phase 5 focuses on non-streaming DALL-E 2 editing.
 * For streaming image editing with gpt-image-1, see Responses API (Phase 2).
 */
export type ImageEditParamsStreaming = Images.ImageEditParamsStreaming;
