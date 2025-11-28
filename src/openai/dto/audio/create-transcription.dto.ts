import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  Min,
  Max,
  Length,
} from 'class-validator';

/**
 * DTO for transcribing audio to text in the original language.
 *
 * **Endpoint**: POST /api/audio/transcriptions
 *
 * **Model Capabilities**:
 *
 * **whisper-1**:
 * - Powered by Whisper V2
 * - General purpose transcription
 * - Duration-based pricing ($0.006/minute)
 *
 * **gpt-4o-transcribe**:
 * - Better nuance and reduced errors
 * - Handles accents and background noise
 * - Token-based pricing
 *
 * **gpt-4o-mini-transcribe**:
 * - Faster, more efficient
 * - Token-based pricing
 *
 * **gpt-4o-transcribe-diarize**:
 * - Speaker identification (up to 4 speakers)
 * - Use with response_format: 'diarized_json'
 *
 * **Response Formats**:
 * - json: Simple { text: string } response
 * - text: Plain string output
 * - srt: SubRip subtitle format
 * - vtt: WebVTT subtitle format
 * - verbose_json: Extended metadata with segments and words
 * - diarized_json: Speaker identification with timestamps
 *
 * **Supported Audio Formats**:
 * flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm (max 25 MB)
 *
 * @see {@link https://platform.openai.com/docs/api-reference/audio/createTranscription}
 *
 * @example
 * ```typescript
 * // Basic transcription
 * const dto: CreateTranscriptionDto = {
 *   model: 'whisper-1',
 *   language: 'en'
 * };
 *
 * // Verbose with word timestamps
 * const dto: CreateTranscriptionDto = {
 *   model: 'gpt-4o-transcribe',
 *   response_format: 'verbose_json',
 *   timestamp_granularities: ['word', 'segment']
 * };
 *
 * // Speaker diarization
 * const dto: CreateTranscriptionDto = {
 *   model: 'gpt-4o-transcribe-diarize',
 *   response_format: 'diarized_json'
 * };
 * ```
 */
export class CreateTranscriptionDto {
  /**
   * The model to use for transcription.
   *
   * **Options**:
   * - `whisper-1` - Powered by Whisper V2, general purpose
   * - `gpt-4o-transcribe` - Better nuance, handles accents/noise
   * - `gpt-4o-mini-transcribe` - Faster, more efficient
   * - `gpt-4o-transcribe-diarize` - Speaker identification
   *
   * **Default**: `whisper-1`
   *
   * @example 'whisper-1'
   */
  @ApiProperty({
    description: 'The model to use for transcription',
    enum: [
      'whisper-1',
      'gpt-4o-transcribe',
      'gpt-4o-mini-transcribe',
      'gpt-4o-transcribe-diarize',
    ],
    default: 'whisper-1',
    example: 'whisper-1',
  })
  @IsEnum(
    [
      'whisper-1',
      'gpt-4o-transcribe',
      'gpt-4o-mini-transcribe',
      'gpt-4o-transcribe-diarize',
    ],
    {
      message:
        'model must be whisper-1, gpt-4o-transcribe, gpt-4o-mini-transcribe, or gpt-4o-transcribe-diarize',
    },
  )
  model:
    | 'whisper-1'
    | 'gpt-4o-transcribe'
    | 'gpt-4o-mini-transcribe'
    | 'gpt-4o-transcribe-diarize' = 'whisper-1';

  /**
   * The language of the input audio in ISO-639-1 format.
   *
   * **Format**: Two-letter language code (e.g., 'en', 'es', 'fr')
   *
   * **Optional**: Providing the language improves accuracy and latency.
   *
   * @example 'en'
   */
  @ApiPropertyOptional({
    description:
      'The language of the input audio in ISO-639-1 format (e.g., en, es, fr). Improves accuracy.',
    minLength: 2,
    maxLength: 2,
    example: 'en',
  })
  @IsOptional()
  @IsString()
  @Length(2, 2, {
    message: 'language must be a 2-character ISO-639-1 code (e.g., en, es)',
  })
  language?: string;

  /**
   * Optional text to guide the model's style or continue a previous audio segment.
   *
   * **Use Cases**:
   * - Provide context or specialized vocabulary
   * - Guide the transcription style
   * - Continue from previous segment
   *
   * **Note**: The prompt should match the audio language.
   *
   * @example 'This meeting is about artificial intelligence and machine learning.'
   */
  @ApiPropertyOptional({
    description:
      'Optional text to guide the model style or continue previous segment',
    example: 'This meeting is about artificial intelligence.',
  })
  @IsOptional()
  @IsString()
  prompt?: string;

  /**
   * The format of the transcription output.
   *
   * **Options**:
   * - `json` - Simple { text: string } response (default)
   * - `text` - Plain string output
   * - `srt` - SubRip subtitle format
   * - `vtt` - WebVTT subtitle format
   * - `verbose_json` - Extended metadata with segments and words
   * - `diarized_json` - Speaker identification with timestamps
   *
   * **Default**: `json`
   *
   * **Note**: `timestamp_granularities` only works with `verbose_json`
   *
   * @example 'json'
   */
  @ApiPropertyOptional({
    description: 'The format of the transcription output',
    enum: ['json', 'text', 'srt', 'vtt', 'verbose_json', 'diarized_json'],
    default: 'json',
    example: 'json',
  })
  @IsOptional()
  @IsEnum(['json', 'text', 'srt', 'vtt', 'verbose_json', 'diarized_json'], {
    message:
      'response_format must be one of: json, text, srt, vtt, verbose_json, diarized_json',
  })
  response_format?:
    | 'json'
    | 'text'
    | 'srt'
    | 'vtt'
    | 'verbose_json'
    | 'diarized_json' = 'json';

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

  /**
   * The timestamp granularities to include in the response.
   *
   * **Options**:
   * - `segment` - Sentence-level timestamps (default, no added latency)
   * - `word` - Word-level timestamps (adds latency)
   * - `['segment', 'word']` - Both granularities
   *
   * **Requirements**:
   * - Only works with `response_format: 'verbose_json'`
   * - Ignored for other response formats
   *
   * **Default**: `['segment']`
   *
   * @example ['word', 'segment']
   */
  @ApiPropertyOptional({
    description:
      'Timestamp granularities (segment and/or word). Only for verbose_json format.',
    type: [String],
    enum: ['word', 'segment'],
    isArray: true,
    example: ['segment'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(['word', 'segment'], {
    each: true,
    message: 'Each timestamp_granularity must be either word or segment',
  })
  timestamp_granularities?: ('word' | 'segment')[];
}
