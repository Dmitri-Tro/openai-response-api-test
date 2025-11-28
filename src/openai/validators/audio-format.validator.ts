import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

/**
 * Supported audio formats for transcription and translation
 *
 * **Supported Formats:**
 * - flac: FLAC audio format
 * - mp3: MP3 audio format
 * - mp4: MP4 container with audio
 * - mpeg: MPEG audio format
 * - mpga: MPEG audio (alternative extension)
 * - m4a: M4A audio format (AAC)
 * - ogg: OGG audio format
 * - wav: WAV audio format
 * - webm: WebM container with audio
 *
 * **Note:** opus format is NOT supported via OpenAI API (only in open-source Whisper)
 */
export const SUPPORTED_AUDIO_FORMATS = [
  'flac',
  'mp3',
  'mp4',
  'mpeg',
  'mpga',
  'm4a',
  'ogg',
  'wav',
  'webm',
] as const;

export type SupportedAudioFormat = (typeof SUPPORTED_AUDIO_FORMATS)[number];

/**
 * Validator constraint for audio file format validation
 *
 * Validates that an audio file has a supported format for transcription or translation.
 *
 * **Validation Rules:**
 * - File must have a valid extension matching supported formats
 * - Extension is extracted from filename
 * - Validation is case-insensitive
 *
 * **Supported Formats:**
 * flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm
 *
 * **NOT Supported:**
 * - opus (only supported in open-source Whisper, not via API)
 *
 * @example
 * ```typescript
 * // Valid audio files
 * { originalname: 'interview.mp3' }        // ✓
 * { originalname: 'podcast.wav' }          // ✓
 * { originalname: 'recording.m4a' }        // ✓
 * { originalname: 'audio.MP3' }            // ✓ (case-insensitive)
 *
 * // Invalid audio files
 * { originalname: 'audio.opus' }           // ✗ (not supported via API)
 * { originalname: 'audio.aac' }            // ✗ (use m4a instead)
 * { originalname: 'document.pdf' }         // ✗ (not audio format)
 * ```
 */
@ValidatorConstraint({ async: false })
export class IsAudioFormatValidConstraint
  implements ValidatorConstraintInterface
{
  validate(file: unknown): boolean {
    // File must be an object with originalname property
    if (typeof file !== 'object' || file === null) {
      return false;
    }

    const fileObj = file as { originalname?: string };

    // Filename must exist
    if (!fileObj.originalname || typeof fileObj.originalname !== 'string') {
      return false;
    }

    // Extract file extension (case-insensitive)
    const extension = fileObj.originalname.split('.').pop()?.toLowerCase();

    // Extension must exist and be in supported formats
    if (!extension) {
      return false;
    }

    return SUPPORTED_AUDIO_FORMATS.includes(extension as SupportedAudioFormat);
  }

  defaultMessage(args: ValidationArguments): string {
    const file = args.value as { originalname?: string };

    // Handle missing file
    if (!file || typeof file !== 'object') {
      return `Invalid file object. Expected file with originalname property.`;
    }

    const filename = file.originalname || 'unknown';
    const extension = filename.split('.').pop()?.toLowerCase() || 'none';

    return `Audio format "${extension}" is not supported.

Supported formats: ${SUPPORTED_AUDIO_FORMATS.join(', ')}

Note: opus format is NOT supported via OpenAI API (only in open-source Whisper)

File: ${filename}`;
  }
}

/**
 * Decorator for validating audio file format
 *
 * This decorator validates that an uploaded audio file has a supported format.
 *
 * **Usage Example:**
 * ```typescript
 * // In a validation DTO
 * export class AudioUploadDto {
 *   @IsAudioFormatValid()
 *   file: Express.Multer.File;
 * }
 * ```
 *
 * **Note:** This validator checks the file extension from `originalname`.
 * For additional security, combine with mimetype validation.
 *
 * @param validationOptions - Optional class-validator options
 */
export function IsAudioFormatValid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsAudioFormatValidConstraint,
    });
  };
}

/**
 * Helper function to validate audio file format
 *
 * Use this as a standalone validator in controllers or services.
 *
 * @param filename - Audio filename with extension
 * @returns True if file format is supported, false otherwise
 *
 * @example
 * ```typescript
 * // In a controller
 * if (!validateAudioFormat(file.originalname)) {
 *   throw new BadRequestException(
 *     getAudioFormatErrorMessage(file.originalname)
 *   );
 * }
 * ```
 */
export function validateAudioFormat(filename: string): boolean {
  if (!filename || typeof filename !== 'string') {
    return false;
  }

  const extension = filename.split('.').pop()?.toLowerCase();

  if (!extension) {
    return false;
  }

  return SUPPORTED_AUDIO_FORMATS.includes(extension as SupportedAudioFormat);
}

/**
 * Helper function to get detailed error message for audio format validation
 *
 * @param filename - Audio filename with extension
 * @returns Detailed error message
 *
 * @example
 * ```typescript
 * if (!validateAudioFormat(file.originalname)) {
 *   const errorMessage = getAudioFormatErrorMessage(file.originalname);
 *   throw new BadRequestException(errorMessage);
 * }
 * ```
 */
export function getAudioFormatErrorMessage(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return `Invalid filename. Expected string with file extension.`;
  }

  const extension = filename.split('.').pop()?.toLowerCase() || 'none';

  return `Audio format "${extension}" is not supported.

Supported formats: ${SUPPORTED_AUDIO_FORMATS.join(', ')}

Note: opus format is NOT supported via OpenAI API (only in open-source Whisper)

File: ${filename}`;
}
