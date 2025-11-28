import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

/**
 * DTO for translating audio from any language to English text.
 *
 * **Endpoint**: POST /api/audio/translations
 *
 * **Model Support**:
 * - **whisper-1**: Powered by Whisper V2, general purpose
 * - **Note**: whisper-turbo NOT recommended (returns original language instead of translating)
 *
 * **Translation Direction**:
 * - **Supported**: Any language → English
 * - **NOT Supported**: English → Other languages, Language A → Language B
 *
 * **Response Formats**:
 * - json: Simple { text: string } response (default)
 * - text: Plain string output
 * - srt: SubRip subtitle format
 * - vtt: WebVTT subtitle format
 * - verbose_json: Extended metadata with segments and detected language
 *
 * **Supported Audio Formats**:
 * mp3, mp4, mpeg, mpga, m4a, wav, webm (max 25 MB)
 *
 * **Note**: The translation result is always in English, regardless of the source language.
 *
 * @see {@link https://platform.openai.com/docs/api-reference/audio/createTranslation}
 *
 * @example
 * ```typescript
 * // Basic translation (Spanish → English)
 * const dto: CreateTranslationDto = {
 *   model: 'whisper-1'
 * };
 *
 * // Verbose translation with metadata
 * const dto: CreateTranslationDto = {
 *   model: 'whisper-1',
 *   response_format: 'verbose_json'
 * };
 *
 * // Translation with prompt for context
 * const dto: CreateTranslationDto = {
 *   model: 'whisper-1',
 *   prompt: 'This is a medical conference discussion'
 * };
 * ```
 */
export class CreateTranslationDto {
  /**
   * The model to use for translation.
   *
   * **Supported Models**:
   * - `whisper-1` - Powered by Whisper V2, general purpose
   *
   * **Not Recommended**:
   * - `whisper-turbo` - Returns original language instead of translating
   *
   * **Default**: `whisper-1`
   *
   * @example 'whisper-1'
   */
  @ApiProperty({
    description: 'The model to use for translation (whisper-1 only)',
    enum: ['whisper-1'],
    default: 'whisper-1',
    example: 'whisper-1',
  })
  @IsEnum(['whisper-1'], {
    message: 'model must be whisper-1',
  })
  model = 'whisper-1' as const;

  /**
   * Optional text to guide the model's translation style.
   *
   * **Use Cases**:
   * - Provide context or specialized vocabulary
   * - Guide the translation style
   * - Specify domain (medical, legal, technical, etc.)
   *
   * **Note**: The prompt can be in any language or English.
   *
   * @example 'This is a medical conference discussion about cardiology.'
   */
  @ApiPropertyOptional({
    description: 'Optional text to guide the translation style',
    example: 'This is a medical conference discussion.',
  })
  @IsOptional()
  @IsString()
  prompt?: string;

  /**
   * The format of the translation output.
   *
   * **Options**:
   * - `json` - Simple { text: string } response (default)
   * - `text` - Plain string output
   * - `srt` - SubRip subtitle format
   * - `vtt` - WebVTT subtitle format
   * - `verbose_json` - Extended metadata with segments and detected language
   *
   * **Default**: `json`
   *
   * **Note**: The `verbose_json` format includes the detected source language.
   *
   * @example 'json'
   */
  @ApiPropertyOptional({
    description: 'The format of the translation output',
    enum: ['json', 'text', 'srt', 'vtt', 'verbose_json'],
    default: 'json',
    example: 'json',
  })
  @IsOptional()
  @IsEnum(['json', 'text', 'srt', 'vtt', 'verbose_json'], {
    message:
      'response_format must be one of: json, text, srt, vtt, verbose_json',
  })
  response_format?: 'json' | 'text' | 'srt' | 'vtt' | 'verbose_json' = 'json';

  /**
   * The sampling temperature between 0 and 1.
   *
   * **Range**: 0.0 to 1.0
   * **Default**: 0
   *
   * - 0: More focused and deterministic
   * - 1: More random
   *
   * Higher values increase randomness, lower values make output more focused.
   *
   * @example 0
   */
  @ApiPropertyOptional({
    description: 'Sampling temperature (0 to 1). Higher = more random.',
    minimum: 0,
    maximum: 1,
    default: 0,
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'temperature must be at least 0' })
  @Max(1, { message: 'temperature must not exceed 1' })
  temperature?: number = 0;
}
