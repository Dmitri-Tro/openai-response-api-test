/**
 * Image Generation Type Interfaces
 *
 * Types for image generation via `client.images.generate()` method.
 * Supports DALL-E 2 and DALL-E 3 models.
 *
 * @see {@link https://platform.openai.com/docs/api-reference/images/create}
 */

import type { Images } from 'openai/resources/images';

/**
 * Parameters for non-streaming image generation.
 *
 * **Core Parameters**:
 * - `prompt` (required) - Text description of the desired image(s)
 * - `model` - One of 'dall-e-2', 'dall-e-3' (defaults to 'dall-e-2')
 * - `n` - Number of images to generate (1-10 for DALL-E 2, only 1 for DALL-E 3)
 * - `size` - Image dimensions (varies by model)
 * - `quality` - 'standard' or 'hd' (DALL-E 3 only)
 * - `style` - 'vivid' or 'natural' (DALL-E 3 only)
 * - `response_format` - 'url' or 'b64_json' (default: 'url')
 * - `user` - User identifier for abuse monitoring
 *
 * **Model-Specific Constraints**:
 *
 * **DALL-E 3**:
 * - Sizes: 1024x1024, 1792x1024, 1024x1792
 * - Quality: standard, hd
 * - Style: vivid, natural
 * - n: Must be 1
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
 * @example
 * ```typescript
 * // DALL-E 3 with HD quality
 * const params: ImageGenerateParams = {
 *   model: 'dall-e-3',
 *   prompt: 'A serene mountain landscape with a lake in the foreground',
 *   size: '1792x1024',
 *   quality: 'hd',
 *   style: 'natural',
 *   response_format: 'url',
 *   n: 1
 * };
 *
 * // DALL-E 2 with multiple images
 * const params: ImageGenerateParams = {
 *   model: 'dall-e-2',
 *   prompt: 'A cute baby sea otter',
 *   size: '512x512',
 *   quality: 'standard',
 *   n: 5,
 *   response_format: 'b64_json'
 * };
 * ```
 */
export type ImageGenerateParams = Images.ImageGenerateParamsNonStreaming;

/**
 * Streaming image generation parameters (gpt-image-1 only, not used in Phase 5).
 *
 * Phase 5 focuses on non-streaming DALL-E 2/3 generation.
 * For streaming image generation with gpt-image-1, see Responses API (Phase 2).
 */
export type ImageGenerateParamsStreaming = Images.ImageGenerateParamsStreaming;
