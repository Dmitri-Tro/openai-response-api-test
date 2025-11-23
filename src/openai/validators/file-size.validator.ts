import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

/**
 * File size limits by purpose (in bytes)
 *
 * **Size Limits:**
 * - assistants: 512 MB (536,870,912 bytes)
 * - vision: 20 MB (20,971,520 bytes)
 * - batch: 200 MB (209,715,200 bytes)
 * - fine-tune: 512 MB (536,870,912 bytes)
 * - user_data: 512 MB (536,870,912 bytes)
 * - evals: 512 MB (536,870,912 bytes)
 *
 * **Note:** These are standard API limits. The Uploads API supports up to 8 GB.
 */
export const FILE_SIZE_LIMITS_MB: Record<string, number> = {
  assistants: 512,
  vision: 20,
  batch: 200,
  'fine-tune': 512,
  user_data: 512,
  evals: 512,
};

export const FILE_SIZE_LIMITS_BYTES: Record<string, number> = {
  assistants: 512 * 1024 * 1024, // 536,870,912 bytes
  vision: 20 * 1024 * 1024, // 20,971,520 bytes
  batch: 200 * 1024 * 1024, // 209,715,200 bytes
  'fine-tune': 512 * 1024 * 1024, // 536,870,912 bytes
  user_data: 512 * 1024 * 1024, // 536,870,912 bytes
  evals: 512 * 1024 * 1024, // 536,870,912 bytes
};

/**
 * Validator constraint for file size validation based on purpose
 *
 * Validates that a file size (in bytes) is within the allowed limit for its purpose.
 * This validator requires access to both the file size and purpose fields.
 *
 * **Validation Rules:**
 * - File size must be a positive number (in bytes)
 * - File size must be ≤ purpose-specific limit
 * - Purpose must be valid
 *
 * **Usage Pattern:**
 * This validator is designed to be used in contexts where both file size and purpose
 * are available, such as:
 * - Controller validation (after file upload)
 * - Service layer validation
 * - Custom validation decorators with cross-field access
 *
 * **Size Limits by Purpose:**
 * - assistants: 512 MB (documents for file_search)
 * - vision: 20 MB (images for vision models)
 * - batch: 200 MB (JSONL for Batch API)
 * - fine-tune: 512 MB (JSONL for fine-tuning)
 * - user_data: 512 MB (general purpose files)
 * - evals: 512 MB (JSONL evaluation datasets)
 *
 * @example
 * ```typescript
 * // Valid file sizes
 * { size: 10485760, purpose: 'vision' }     // 10 MB for vision (✓ ≤ 20 MB)
 * { size: 104857600, purpose: 'batch' }     // 100 MB for batch (✓ ≤ 200 MB)
 * { size: 536870912, purpose: 'assistants' } // 512 MB for assistants (✓ ≤ 512 MB)
 *
 * // Invalid file sizes
 * { size: 25000000, purpose: 'vision' }     // 25 MB for vision (✗ > 20 MB limit)
 * { size: 600000000, purpose: 'batch' }     // 600 MB for batch (✗ > 200 MB limit)
 * ```
 */
@ValidatorConstraint({ async: false })
export class IsFileSizeValidConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown, args: ValidationArguments): boolean {
    // Value must be a number (file size in bytes)
    if (typeof value !== 'number' || isNaN(value)) {
      return false;
    }

    // File size must be positive
    if (value <= 0) {
      return false;
    }

    // Get purpose from validation context
    const object = args.object as any;
    const purpose = object.purpose;

    // If no purpose, cannot validate size
    if (!purpose || typeof purpose !== 'string') {
      return false;
    }

    // Check if purpose is valid
    if (!(purpose in FILE_SIZE_LIMITS_BYTES)) {
      return false;
    }

    // Validate size against purpose-specific limit
    const maxSize = FILE_SIZE_LIMITS_BYTES[purpose];
    return value <= maxSize;
  }

  defaultMessage(args: ValidationArguments): string {
    const fileSize = args.value;
    const object = args.object as any;
    const purpose = object.purpose;

    // Handle invalid file size type
    if (typeof fileSize !== 'number' || isNaN(fileSize)) {
      return `File size must be a number (in bytes). Received: ${typeof fileSize}`;
    }

    // Handle non-positive file size
    if (fileSize <= 0) {
      return `File size must be positive. Received: ${fileSize} bytes`;
    }

    // Handle missing or invalid purpose
    if (!purpose || typeof purpose !== 'string') {
      return `Cannot validate file size without a valid purpose. Received purpose: ${purpose}`;
    }

    // Handle invalid purpose (not in limits map)
    if (!(purpose in FILE_SIZE_LIMITS_BYTES)) {
      return `Unknown file purpose "${purpose}". Cannot determine size limit. Valid purposes: assistants, vision, batch, fine-tune, user_data, evals`;
    }

    // File size exceeds limit for this purpose
    const maxSizeMB = FILE_SIZE_LIMITS_MB[purpose];
    const maxSizeBytes = FILE_SIZE_LIMITS_BYTES[purpose];
    const actualSizeMB = (fileSize / (1024 * 1024)).toFixed(2);

    return `File size (${actualSizeMB} MB) exceeds maximum for purpose "${purpose}". Maximum allowed: ${maxSizeMB} MB (${maxSizeBytes.toLocaleString()} bytes).

Size limits by purpose:
  - "assistants": 512 MB (documents for file_search)
  - "vision": 20 MB (images for vision models)
  - "batch": 200 MB (JSONL for Batch API)
  - "fine-tune": 512 MB (JSONL for fine-tuning)
  - "user_data": 512 MB (general purpose files)
  - "evals": 512 MB (JSONL evaluation datasets)

Consider:
  - Using purpose "vision" for files ≤ 20 MB (if image format)
  - Using purpose "batch" for files ≤ 200 MB (if JSONL format)
  - Using Uploads API for files > 512 MB (supports up to 8 GB)`;
  }
}

/**
 * Decorator for validating file size based on purpose
 *
 * This decorator validates that a file size (in bytes) is within the allowed limit
 * for the file's purpose. It requires access to both the file size and purpose fields.
 *
 * **Usage Example:**
 * ```typescript
 * export class UploadValidationDto {
 *   @IsEnum(['assistants', 'vision', 'batch', 'fine-tune', 'user_data', 'evals'])
 *   purpose: string;
 *
 *   @IsNumber()
 *   @IsFileSizeValid()
 *   fileSize: number;  // Size in bytes
 * }
 * ```
 *
 * **Note:** This validator requires the `purpose` field to be present in the same object.
 *
 * @param validationOptions - Optional class-validator options
 */
export function IsFileSizeValid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsFileSizeValidConstraint,
    });
  };
}

/**
 * Helper function to validate file size against purpose
 *
 * Use this as a standalone validator in controllers or services where
 * you have both file size and purpose available.
 *
 * @param fileSizeBytes - File size in bytes
 * @param purpose - File purpose
 * @returns True if file size is valid for the purpose, false otherwise
 *
 * @example
 * ```typescript
 * // In a controller
 * if (!validateFileSize(file.size, dto.purpose)) {
 *   throw new BadRequestException(
 *     getFileSizeErrorMessage(file.size, dto.purpose)
 *   );
 * }
 * ```
 */
export function validateFileSize(
  fileSizeBytes: number,
  purpose: string,
): boolean {
  if (typeof fileSizeBytes !== 'number' || isNaN(fileSizeBytes)) {
    return false;
  }

  if (fileSizeBytes <= 0) {
    return false;
  }

  if (!(purpose in FILE_SIZE_LIMITS_BYTES)) {
    return false;
  }

  return fileSizeBytes <= FILE_SIZE_LIMITS_BYTES[purpose];
}

/**
 * Helper function to get detailed error message for file size validation
 *
 * @param fileSizeBytes - File size in bytes
 * @param purpose - File purpose
 * @returns Detailed error message
 *
 * @example
 * ```typescript
 * if (!validateFileSize(file.size, dto.purpose)) {
 *   const errorMessage = getFileSizeErrorMessage(file.size, dto.purpose);
 *   throw new BadRequestException(errorMessage);
 * }
 * ```
 */
export function getFileSizeErrorMessage(
  fileSizeBytes: number,
  purpose: string,
): string {
  if (typeof fileSizeBytes !== 'number' || isNaN(fileSizeBytes)) {
    return `File size must be a number (in bytes). Received: ${typeof fileSizeBytes}`;
  }

  if (fileSizeBytes <= 0) {
    return `File size must be positive. Received: ${fileSizeBytes} bytes`;
  }

  if (!(purpose in FILE_SIZE_LIMITS_BYTES)) {
    return `Unknown file purpose "${purpose}". Cannot determine size limit.`;
  }

  const maxSizeMB = FILE_SIZE_LIMITS_MB[purpose];
  const maxSizeBytes = FILE_SIZE_LIMITS_BYTES[purpose];
  const actualSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);

  return `File size (${actualSizeMB} MB) exceeds maximum for purpose "${purpose}". Maximum allowed: ${maxSizeMB} MB (${maxSizeBytes.toLocaleString()} bytes).`;
}
