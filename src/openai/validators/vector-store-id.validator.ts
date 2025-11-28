import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Validator constraint for vector store ID format
 *
 * Validates:
 * - Must be a string
 * - Must start with "vs_"
 * - Must have content after "vs_" prefix
 */
@ValidatorConstraint({ async: false })
export class IsVectorStoreIdConstraint implements ValidatorConstraintInterface {
  validate(id: unknown): boolean {
    // Must be a string
    if (typeof id !== 'string') {
      return false;
    }

    // Must start with "vs_"
    if (!id.startsWith('vs_')) {
      return false;
    }

    // Must have content after "vs_" (length > 3)
    if (id.length <= 3) {
      return false;
    }

    return true;
  }

  defaultMessage(): string {
    return 'Vector store ID must be a string starting with "vs_" followed by an identifier';
  }
}

/**
 * Decorator for validating vector store ID format
 *
 * Usage:
 * ```typescript
 * @IsString()
 * @IsVectorStoreIdValid()
 * vector_store_id: string;
 * ```
 */
export function IsVectorStoreIdValid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsVectorStoreIdConstraint,
    });
  };
}

/**
 * Helper function to validate vector store ID format
 *
 * Use this as a standalone validator in controllers or services.
 *
 * @param id - Vector store ID to validate
 * @returns True if vector store ID is valid, false otherwise
 *
 * @example
 * ```typescript
 * // In a service
 * if (!validateVectorStoreId(vectorStoreId)) {
 *   throw new BadRequestException(
 *     getVectorStoreIdErrorMessage(vectorStoreId)
 *   );
 * }
 * ```
 */
export function validateVectorStoreId(id: unknown): boolean {
  // Must be a string
  if (typeof id !== 'string') {
    return false;
  }

  // Must start with "vs_"
  if (!id.startsWith('vs_')) {
    return false;
  }

  // Must have content after "vs_" (length > 3)
  if (id.length <= 3) {
    return false;
  }

  return true;
}

/**
 * Helper function to get detailed error message for vector store ID validation
 *
 * @param id - Vector store ID that failed validation
 * @returns Detailed error message
 *
 * @example
 * ```typescript
 * if (!validateVectorStoreId(id)) {
 *   const errorMessage = getVectorStoreIdErrorMessage(id);
 *   throw new BadRequestException(errorMessage);
 * }
 * ```
 */
export function getVectorStoreIdErrorMessage(id: unknown): string {
  // Handle non-string
  if (typeof id !== 'string') {
    return `Vector store ID must be a string. Received: ${typeof id}`;
  }

  // Handle wrong prefix
  if (!id.startsWith('vs_')) {
    return `Vector store ID must start with "vs_". Received: "${id}"`;
  }

  // Handle empty content after prefix
  if (id.length <= 3) {
    return `Vector store ID must have content after "vs_" prefix. Received: "${id}"`;
  }

  return 'Vector store ID must be a string starting with "vs_" followed by an identifier';
}
