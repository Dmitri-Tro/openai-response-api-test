import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, Length } from 'class-validator';
import type { Videos } from 'openai/resources/videos';

/**
 * Data Transfer Object for creating videos via OpenAI Videos API (Sora)
 *
 * This DTO encapsulates all parameters for video generation requests using the
 * Videos API (`client.videos.create()`). Supports 5 parameters:
 *
 * **Core Parameters:**
 * - `prompt` - Text description of the video to generate (required)
 * - `model` - Video generation model ('sora-2' or 'sora-2-pro')
 * - `seconds` - Duration of the video clip ('4', '8', or '12' seconds)
 * - `size` - Output resolution (4 options for portrait/landscape)
 * - `input_reference` - Optional image reference for guidance (deferred to file upload phase)
 *
 * **Key Characteristics:**
 * - **Asynchronous Job Pattern**: Videos are generated asynchronously with status polling
 * - **No Streaming Support**: Unlike Responses API, uses polling for progress updates
 * - **Duration as Strings**: seconds parameter uses string literals ('4', '8', '12'), not numbers
 * - **Fixed Resolutions**: Only 4 predefined resolution options available
 *
 * **Model Comparison:**
 * - **sora-2**: Standard video generation, good quality-to-speed ratio
 * - **sora-2-pro**: Professional-grade, higher quality, slower generation, higher cost
 *
 * **Resolution Options:**
 * - '720x1280' - Portrait (9:16) - Mobile/social media
 * - '1280x720' - Landscape (16:9) - Desktop/YouTube
 * - '1024x1792' - High-res portrait (9:16)
 * - '1792x1024' - High-res landscape (16:9)
 *
 * **Duration Options:**
 * - '4' - 4 seconds (default, fastest generation)
 * - '8' - 8 seconds (medium length)
 * - '12' - 12 seconds (longest, slowest generation)
 *
 * **Pricing:**
 * - sora-2: ~$0.10-$0.15 per second
 * - sora-2-pro: ~$0.30-$0.50 per second
 * - Example: 12-second video with sora-2-pro ≈ $4.80
 *
 * **Validation:**
 * All fields are validated using class-validator decorators. Required fields: `prompt`.
 *
 * @see {@link https://platform.openai.com/docs/api-reference/videos/create}
 * @see {@link https://platform.openai.com/docs/guides/videos}
 */
export class CreateVideoDto {
  /**
   * Text description of the video to generate
   *
   * Describe the desired video content, including:
   * - Visual elements (subjects, objects, scenery)
   * - Actions and movements
   * - Lighting and atmosphere
   * - Camera angles and movements
   * - Style and mood
   *
   * **Best Practices:**
   * - Be specific and descriptive (vs. vague)
   * - Mention key visual details
   * - Specify desired camera work if important
   * - Include lighting/mood preferences
   * - Keep under 500 characters for best results
   *
   * **Examples:**
   * - "A serene mountain landscape at sunset with birds flying over a crystal-clear lake"
   * - "Time-lapse of a bustling city street at night with neon lights reflecting on wet pavement"
   * - "Close-up shot of a flower blooming in fast motion against a black background"
   *
   * @example "A professional timelapse of a city skyline transitioning from day to night"
   */
  @ApiProperty({
    description:
      'Text description of the video to generate. Be specific about visual elements, ' +
      'actions, lighting, and camera work. Maximum 500 characters for optimal results.',
    example:
      'A serene mountain landscape at sunset with birds flying over a lake',
    minLength: 1,
    maxLength: 500,
  })
  @IsString()
  @Length(1, 500, {
    message:
      'prompt must be between 1 and 500 characters. Shorter prompts produce better results.',
  })
  prompt!: string;

  /**
   * Video generation model to use
   *
   * **Model Options:**
   *
   * **sora-2** (default):
   * - Standard video generation model
   * - Good balance of quality and speed
   * - Lower cost (~$0.10-$0.15/sec)
   * - Suitable for most use cases
   * - Faster generation time
   *
   * **sora-2-pro**:
   * - Professional-grade video generation
   * - Highest quality output
   * - Higher cost (~$0.30-$0.50/sec)
   * - Slower generation time
   * - Best for production-quality content
   *
   * **When to use sora-2-pro:**
   * - Professional marketing videos
   * - High-quality product demonstrations
   * - Content requiring maximum visual fidelity
   * - Projects where quality > cost/speed
   *
   * **When to use sora-2:**
   * - Social media content
   * - Rapid prototyping
   * - Draft/preview videos
   * - Budget-conscious projects
   *
   * @default 'sora-2'
   * @example 'sora-2'
   */
  @ApiPropertyOptional({
    description:
      'Video generation model:\n' +
      '  - "sora-2": Standard quality video generation (default, faster, lower cost)\n' +
      '  - "sora-2-pro": Professional-grade video (higher quality, slower, higher cost)\n' +
      '\n' +
      'Use sora-2 for social media and drafts. Use sora-2-pro for production content.',
    enum: ['sora-2', 'sora-2-pro'],
    default: 'sora-2',
    example: 'sora-2',
  })
  @IsEnum(['sora-2', 'sora-2-pro'], {
    message: 'model must be either "sora-2" or "sora-2-pro"',
  })
  @IsOptional()
  model?: Videos.VideoModel;

  /**
   * Duration of the generated video clip in seconds
   *
   * **IMPORTANT**: This parameter uses string literals, not numbers.
   * Valid values: '4', '8', '12' (as strings)
   *
   * **Duration Options:**
   *
   * **'4' seconds** (default):
   * - Fastest generation time
   * - Lowest cost
   * - Best for short clips and quick previews
   * - Ideal for social media stories
   *
   * **'8' seconds**:
   * - Medium generation time
   * - Medium cost
   * - Suitable for most content types
   * - Good balance of length and cost
   *
   * **'12' seconds**:
   * - Longest generation time
   * - Highest cost
   * - Best for detailed scenes
   * - Maximum allowed duration
   *
   * **Cost Impact:**
   * - Longer duration = proportionally higher cost
   * - Example (sora-2): 4sec ≈ $0.50, 12sec ≈ $1.50
   * - Example (sora-2-pro): 4sec ≈ $1.50, 12sec ≈ $4.50
   *
   * @default '4'
   * @example '4'
   */
  @ApiPropertyOptional({
    description:
      'Clip duration in seconds (as string literals):\n' +
      '  - "4": 4 seconds (default, fastest, lowest cost)\n' +
      '  - "8": 8 seconds (medium length and cost)\n' +
      '  - "12": 12 seconds (longest, slowest, highest cost)\n' +
      '\n' +
      'IMPORTANT: Use string values ("4"), not numbers (4). Cost scales with duration.',
    enum: ['4', '8', '12'],
    default: '4',
    example: '4',
    type: String,
  })
  @IsEnum(['4', '8', '12'], {
    message: 'seconds must be one of: "4", "8", "12" (as strings, not numbers)',
  })
  @IsOptional()
  seconds?: Videos.VideoSeconds;

  /**
   * Output video resolution
   *
   * **Resolution Options:**
   *
   * **Portrait Orientations (9:16 aspect ratio):**
   * - **'720x1280'** (default): Standard portrait
   *   - Use for: Instagram Stories, TikTok, Snapchat, mobile content
   *   - 720p vertical resolution
   *   - Lower file size, faster generation
   *
   * - **'1024x1792'**: High-resolution portrait
   *   - Use for: Premium mobile content, high-quality social media
   *   - Enhanced detail and sharpness
   *   - Larger file size, slower generation
   *
   * **Landscape Orientations (16:9 aspect ratio):**
   * - **'1280x720'**: Standard landscape (720p)
   *   - Use for: YouTube, presentations, desktop viewing, web embeds
   *   - Standard HD resolution
   *   - Balanced quality and file size
   *
   * - **'1792x1024'**: High-resolution landscape
   *   - Use for: Premium content, professional videos, 4K displays
   *   - Enhanced detail for large screens
   *   - Largest file size, slowest generation
   *
   * **Choosing Resolution:**
   * - **Mobile-first content**: Use portrait (720x1280 or 1024x1792)
   * - **Desktop/YouTube**: Use landscape (1280x720 or 1792x1024)
   * - **Quality vs Speed**: Standard resolutions generate faster
   * - **File Size**: Higher resolutions = larger files
   *
   * @default '720x1280'
   * @example '720x1280'
   */
  @ApiPropertyOptional({
    description:
      'Output video resolution:\n' +
      '  - "720x1280": Portrait 9:16 - Mobile/social media (default)\n' +
      '  - "1280x720": Landscape 16:9 - Desktop/YouTube\n' +
      '  - "1024x1792": High-res portrait 9:16 - Premium mobile content\n' +
      '  - "1792x1024": High-res landscape 16:9 - Premium desktop content\n' +
      '\n' +
      'Choose based on target platform: portrait for mobile, landscape for desktop.',
    enum: ['720x1280', '1280x720', '1024x1792', '1792x1024'],
    default: '720x1280',
    example: '720x1280',
    type: String,
  })
  @IsEnum(['720x1280', '1280x720', '1024x1792', '1792x1024'], {
    message:
      'size must be one of: "720x1280", "1280x720", "1024x1792", "1792x1024"',
  })
  @IsOptional()
  size?: Videos.VideoSize;

  // Note: input_reference (Uploadable type) for image-to-video generation
  // will be implemented in Phase 4 (Files API) with proper multipart/form-data handling
  // Type: Videos.VideoCreateParams['input_reference']
}
