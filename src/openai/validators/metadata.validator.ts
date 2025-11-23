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
