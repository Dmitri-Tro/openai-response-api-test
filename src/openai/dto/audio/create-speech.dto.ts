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

/**
 * DTO for generating spoken audio from text using TTS (Text-to-Speech).
 *
 * **Endpoint**: POST /api/audio/speech
 *
 * **Model Capabilities**:
 *
 * **tts-1**:
 * - Optimized for real-time applications
 * - Lower latency
 * - Lower cost
 *
 * **tts-1-hd**:
 * - Higher quality audio
 * - Optimized for fidelity
 * - Higher cost
 *
 * **gpt-4o-mini-tts**:
 * - Latest model with advanced features
 * - Supports instructions parameter
 * - Variable pricing
 *
 * **Voice Options** (13 total):
 * - alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer, verse, marin, cedar
 *
 * **Audio Formats**:
 * - mp3: Default, widely compatible
 * - opus: Internet streaming, low latency
 * - aac: YouTube, mobile (iOS/Android)
 * - flac: Audiophile quality, lossless
 * - wav: Low latency applications
 * - pcm: Raw audio (24kHz, no headers)
 *
 * @see {@link https://platform.openai.com/docs/api-reference/audio/createSpeech}
 *
 * @example
 * ```typescript
 * // High-quality speech with custom voice
 * const dto: CreateSpeechDto = {
 *   model: 'tts-1-hd',
 *   voice: 'shimmer',
 *   input: 'The quick brown fox jumps over the lazy dog.',
 *   response_format: 'mp3',
 *   speed: 1.0
 * };
 *
 * // GPT-4o with instructions
 * const dto: CreateSpeechDto = {
 *   model: 'gpt-4o-mini-tts',
 *   voice: 'alloy',
 *   input: 'Hello world!',
 *   instructions: 'Speak in a cheerful, energetic tone'
 * };
 * ```
 */
export class CreateSpeechDto {
  /**
   * The model to use for TTS generation.
   *
   * **Options**:
   * - `tts-1` - Optimized for real-time, lower latency
   * - `tts-1-hd` - Higher quality, optimized for fidelity
   * - `gpt-4o-mini-tts` - Latest model with instructions support
   *
   * **Default**: `tts-1`
   *
   * @example 'tts-1-hd'
   */
  @ApiProperty({
    description: 'The model to use for TTS generation',
    enum: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts'],
    default: 'tts-1',
    example: 'tts-1-hd',
  })
  @IsEnum(['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts'], {
    message: 'model must be tts-1, tts-1-hd, or gpt-4o-mini-tts',
  })
  model: 'tts-1' | 'tts-1-hd' | 'gpt-4o-mini-tts' = 'tts-1';

  /**
   * The voice to use for speech generation.
   *
   * **Available Voices** (13 total):
   * - alloy - Neutral (versatile, can pass as masculine or feminine)
   * - ash - New voice (2025)
   * - ballad - New voice (2025)
   * - coral - New voice (2025)
   * - echo - Masculine
   * - fable - Masculine
   * - nova - Feminine
   * - onyx - Masculine
   * - sage - New voice (2025)
   * - shimmer - Feminine
   * - verse - New voice (2025)
   * - marin - New voice (2025)
   * - cedar - New voice (2025)
   *
   * @example 'alloy'
   */
  @ApiProperty({
    description: 'The voice to use for speech generation',
    enum: [
      'alloy',
      'ash',
      'ballad',
      'coral',
      'echo',
      'fable',
      'nova',
      'onyx',
      'sage',
      'shimmer',
      'verse',
      'marin',
      'cedar',
    ],
    example: 'alloy',
  })
  @IsEnum(
    [
      'alloy',
      'ash',
      'ballad',
      'coral',
      'echo',
      'fable',
      'nova',
      'onyx',
      'sage',
      'shimmer',
      'verse',
      'marin',
      'cedar',
    ],
    {
      message:
        'voice must be one of: alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer, verse, marin, cedar',
    },
  )
  voice!:
    | 'alloy'
    | 'ash'
    | 'ballad'
    | 'coral'
    | 'echo'
    | 'fable'
    | 'nova'
    | 'onyx'
    | 'sage'
    | 'shimmer'
    | 'verse'
    | 'marin'
    | 'cedar';

  /**
   * The text to generate audio for.
   *
   * **Max Length**: 4096 characters
   *
   * @example 'The quick brown fox jumps over the lazy dog.'
   */
  @ApiProperty({
    description: 'The text to generate audio for (max 4096 characters)',
    maxLength: 4096,
    example: 'The quick brown fox jumps over the lazy dog.',
  })
  @IsString()
  @MaxLength(4096, {
    message: 'input must not exceed 4096 characters',
  })
  input!: string;

  /**
   * The format of the audio output.
   *
   * **Options**:
   * - `mp3` - Default, widely compatible (lossy)
   * - `opus` - Internet streaming, low latency (lossy)
   * - `aac` - YouTube, mobile (iOS/Android) (lossy)
   * - `flac` - Audiophile quality, archiving (lossless)
   * - `wav` - Low latency applications (uncompressed)
   * - `pcm` - Raw audio (24kHz, no headers, lowest latency)
   *
   * **Default**: `mp3`
   *
   * @example 'mp3'
   */
  @ApiPropertyOptional({
    description: 'The format of the audio output',
    enum: ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'],
    default: 'mp3',
    example: 'mp3',
  })
  @IsOptional()
  @IsEnum(['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'], {
    message: 'response_format must be one of: mp3, opus, aac, flac, wav, pcm',
  })
  response_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm' = 'mp3';

  /**
   * The speed of the generated audio.
   *
   * **Range**: 0.25 to 4.0
   * **Default**: 1.0
   *
   * - 0.25: Slowest speed (0.25x)
   * - 1.0: Normal speed
   * - 4.0: Fastest speed (4x)
   *
   * **Note**: Some models (e.g., gpt-4o-mini-tts) may ignore this parameter.
   *
   * @example 1.0
   */
  @ApiPropertyOptional({
    description: 'The speed of the generated audio (0.25 to 4.0)',
    minimum: 0.25,
    maximum: 4.0,
    default: 1.0,
    example: 1.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.25, { message: 'speed must be at least 0.25' })
  @Max(4.0, { message: 'speed must not exceed 4.0' })
  speed?: number = 1.0;

  /**
   * Instructions for the model on how to perform the speech synthesis.
   *
   * **Supported Models**: `gpt-4o-mini-tts` only
   * **Not Supported**: `tts-1`, `tts-1-hd`
   *
   * Use instructions to guide the tone, emotion, or speaking style.
   *
   * @example 'Speak in a cheerful, energetic tone'
   */
  @ApiPropertyOptional({
    description:
      'Instructions for speech synthesis (gpt-4o-mini-tts only). Guide tone, emotion, or style.',
    example: 'Speak in a cheerful, energetic tone',
  })
  @IsOptional()
  @IsString()
  instructions?: string;
}
