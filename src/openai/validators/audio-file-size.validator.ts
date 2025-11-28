import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

/**
 * Audio file size limit (25 MB in bytes)
 *
 * OpenAI Audio API (transcription and translation) has a maximum file size of 25 MB.
 *
 * **Note:** For longer audio files, split the audio into chunks before uploading.
 */
export const AUDIO_MAX_SIZE_MB = 25;
export const AUDIO_MAX_SIZE_BYTES = 25 * 1024 * 1024; // 26,214,400 bytes

/**
 * Validator constraint for audio file size validation
 *
 * Validates that an audio file size is within the 25 MB limit required by OpenAI Audio API.
 *
 * **Validation Rules:**
 * - File size must be a positive number (in bytes)
 * - File size must be ≤ 25 MB (26,214,400 bytes)
 *
 * **Use Cases:**
 * - Transcription API file uploads
 * - Translation API file uploads
 *
 * **Note:** TTS (Text-to-Speech) does not have file uploads, only text input (max 4096 characters)
 *
 * @example
 * ```typescript
 * // Valid file sizes
 * { size: 1048576 }      // 1 MB (✓)
 * { size: 10485760 }     // 10 MB (✓)
 * { size: 26214400 }     // 25 MB exactly (✓)
 *
 * // Invalid file sizes
 * { size: 30000000 }     // 30 MB (✗ > 25 MB limit)
 * { size: 0 }            // 0 bytes (✗ must be positive)
 * { size: -1000 }        // Negative (✗ must be positive)
 * ```
 */
@ValidatorConstraint({ async: false })
export class IsAudioFileSizeValidConstraint
  implements ValidatorConstraintInterface
{
  validate(file: unknown): boolean {
    // File must be an object with size property
    if (typeof file !== 'object' || file === null) {
      return false;
    }

    const fileObj = file as { size?: number };

    // Size must exist and be a number
    if (typeof fileObj.size !== 'number' || isNaN(fileObj.size)) {
      return false;
    }

    // File size must be positive
    if (fileObj.size <= 0) {
      return false;
    }

    // File size must be ≤ 25 MB
    return fileObj.size <= AUDIO_MAX_SIZE_BYTES;
  }

  defaultMessage(args: ValidationArguments): string {
    const file = args.value as { size?: unknown };

    // Handle missing file
    if (!file || typeof file !== 'object') {
      return `Invalid file object. Expected file with size property.`;
    }

    const fileSize = file.size as number;

    // Handle invalid file size type
    if (typeof fileSize !== 'number' || isNaN(fileSize)) {
      return `File size must be a number (in bytes). Received: ${typeof fileSize}`;
    }

    // Handle non-positive file size
    if (fileSize <= 0) {
      return `File size must be positive. Received: ${fileSize} bytes`;
    }

    // File size exceeds 25 MB limit
    const actualSizeMB = (fileSize / (1024 * 1024)).toFixed(2);

    return `Audio file size (${actualSizeMB} MB) exceeds maximum allowed size of ${AUDIO_MAX_SIZE_MB} MB (${AUDIO_MAX_SIZE_BYTES.toLocaleString()} bytes).

Current file: ${actualSizeMB} MB (${fileSize.toLocaleString()} bytes)
Maximum allowed: ${AUDIO_MAX_SIZE_MB} MB (${AUDIO_MAX_SIZE_BYTES.toLocaleString()} bytes)

For longer audio files, consider splitting the audio into smaller chunks before uploading.`;
  }
}

/**
 * Decorator for validating audio file size
 *
 * This decorator validates that an uploaded audio file is within the 25 MB size limit.
 *
 * **Usage Example:**
 * ```typescript
 * // In a validation DTO
 * export class AudioUploadDto {
 *   @IsAudioFileSizeValid()
 *   file: Express.Multer.File;
 * }
 * ```
 *
 * **Note:** This validator checks the `size` property of the file object.
 *
 * @param validationOptions - Optional class-validator options
 */
export function IsAudioFileSizeValid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsAudioFileSizeValidConstraint,
    });
  };
}

/**
 * Helper function to validate audio file size
 *
 * Use this as a standalone validator in controllers or services.
 *
 * @param fileSizeBytes - File size in bytes
 * @returns True if file size is valid (≤ 25 MB), false otherwise
 *
 * @example
 * ```typescript
 * // In a controller
 * if (!validateAudioFileSize(file.size)) {
 *   throw new BadRequestException(
 *     getAudioFileSizeErrorMessage(file.size)
 *   );
 * }
 * ```
 */
export function validateAudioFileSize(fileSizeBytes: number): boolean {
  if (typeof fileSizeBytes !== 'number' || isNaN(fileSizeBytes)) {
    return false;
  }

  if (fileSizeBytes <= 0) {
    return false;
  }

  return fileSizeBytes <= AUDIO_MAX_SIZE_BYTES;
}

/**
 * Helper function to get detailed error message for audio file size validation
 *
 * @param fileSizeBytes - File size in bytes
 * @returns Detailed error message
 *
 * @example
 * ```typescript
 * if (!validateAudioFileSize(file.size)) {
 *   const errorMessage = getAudioFileSizeErrorMessage(file.size);
 *   throw new BadRequestException(errorMessage);
 * }
 * ```
 */
export function getAudioFileSizeErrorMessage(fileSizeBytes: number): string {
  if (typeof fileSizeBytes !== 'number' || isNaN(fileSizeBytes)) {
    return `File size must be a number (in bytes). Received: ${typeof fileSizeBytes}`;
  }

  if (fileSizeBytes <= 0) {
    return `File size must be positive. Received: ${fileSizeBytes} bytes`;
  }

  const actualSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);

  return `Audio file size (${actualSizeMB} MB) exceeds maximum allowed size of ${AUDIO_MAX_SIZE_MB} MB (${AUDIO_MAX_SIZE_BYTES.toLocaleString()} bytes).

Current file: ${actualSizeMB} MB (${fileSizeBytes.toLocaleString()} bytes)
Maximum allowed: ${AUDIO_MAX_SIZE_MB} MB (${AUDIO_MAX_SIZE_BYTES.toLocaleString()} bytes)

For longer audio files, consider splitting the audio into smaller chunks before uploading.`;
}
