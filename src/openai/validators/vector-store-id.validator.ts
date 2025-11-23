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
