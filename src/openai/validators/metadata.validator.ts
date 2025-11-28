import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Validator constraint for metadata configuration
 *
 * Validates OpenAI Metadata constraints:
 * - Maximum 16 key-value pairs
 * - Keys: max 64 characters
 * - Values: max 512 characters
 * - Only string values allowed
 */
@ValidatorConstraint({ async: false })
export class IsMetadataConstraint implements ValidatorConstraintInterface {
  validate(metadata: unknown): boolean {
    // Optional field - undefined and null are valid
    if (metadata === undefined || metadata === null) {
      return true;
    }

    // Must be an object
    if (typeof metadata !== 'object' || Array.isArray(metadata)) {
      return false;
    }

    const metadataObj = metadata as Record<string, unknown>;
    const entries = Object.entries(metadataObj);

    // Maximum 16 key-value pairs
    if (entries.length > 16) {
      return false;
    }

    // Validate each key-value pair
    for (const [key, value] of entries) {
      // Validate key length
      if (key.length > 64) {
        return false;
      }

      // Validate value is string
      if (typeof value !== 'string') {
        return false;
      }

      // Validate value length
      if (value.length > 512) {
        return false;
      }
    }

    return true;
  }

  defaultMessage(): string {
    return `Invalid metadata configuration. Requirements:
      - Maximum 16 key-value pairs
      - Keys: max 64 characters
      - Values: must be strings, max 512 characters`;
  }
}

/**
 * Decorator for validating metadata configuration
 *
 * Usage:
 * ```typescript
 * @IsOptional()
 * @IsMetadataValid()
 * metadata?: Record<string, string> | null;
 * ```
 */
export function IsMetadataValid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsMetadataConstraint,
    });
  };
}

/**
 * Helper function to validate metadata configuration
 *
 * Use this as a standalone validator in controllers or services.
 *
 * @param metadata - Metadata object to validate
 * @returns True if metadata is valid, false otherwise
 *
 * @example
 * ```typescript
 * // In a service
 * if (!validateMetadata(dto.metadata)) {
 *   throw new BadRequestException(
 *     getMetadataErrorMessage(dto.metadata)
 *   );
 * }
 * ```
 */
export function validateMetadata(metadata: unknown): boolean {
  // Optional field - undefined and null are valid
  if (metadata === undefined || metadata === null) {
    return true;
  }

  // Must be an object
  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    return false;
  }

  const metadataObj = metadata as Record<string, unknown>;
  const entries = Object.entries(metadataObj);

  // Maximum 16 key-value pairs
  if (entries.length > 16) {
    return false;
  }

  // Validate each key-value pair
  for (const [key, value] of entries) {
    // Validate key length
    if (key.length > 64) {
      return false;
    }

    // Validate value is string
    if (typeof value !== 'string') {
      return false;
    }

    // Validate value length
    if (value.length > 512) {
      return false;
    }
  }

  return true;
}

/**
 * Helper function to get detailed error message for metadata validation
 *
 * @param metadata - Metadata object that failed validation
 * @returns Detailed error message
 *
 * @example
 * ```typescript
 * if (!validateMetadata(metadata)) {
 *   const errorMessage = getMetadataErrorMessage(metadata);
 *   throw new BadRequestException(errorMessage);
 * }
 * ```
 */
export function getMetadataErrorMessage(metadata: unknown): string {
  // Handle undefined/null (should be valid, but if called, provide message)
  if (metadata === undefined || metadata === null) {
    return 'Metadata is optional and can be undefined or null';
  }

  // Handle non-object
  if (typeof metadata !== 'object') {
    return `Metadata must be an object. Received: ${typeof metadata}`;
  }

  // Handle array
  if (Array.isArray(metadata)) {
    return `Metadata must be an object, not an array`;
  }

  const metadataObj = metadata as Record<string, unknown>;
  const entries = Object.entries(metadataObj);

  // Check maximum pairs
  if (entries.length > 16) {
    return `Metadata cannot have more than 16 key-value pairs. Received: ${entries.length}`;
  }

  // Validate each key-value pair
  for (const [key, value] of entries) {
    // Validate key length
    if (key.length > 64) {
      return `Metadata key '${key}' exceeds maximum length of 64 characters. Length: ${key.length}`;
    }

    // Validate value is string
    if (typeof value !== 'string') {
      return `Metadata value for key '${key}' must be a string. Received: ${typeof value}`;
    }

    // Validate value length
    if (value.length > 512) {
      return `Metadata value for key '${key}' exceeds maximum length of 512 characters. Length: ${value.length}`;
    }
  }

  return `Invalid metadata configuration. Requirements:
    - Maximum 16 key-value pairs
    - Keys: max 64 characters
    - Values: must be strings, max 512 characters`;
}
