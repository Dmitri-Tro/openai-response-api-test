import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Valid memory limit options for code interpreter containers
 * - 1g: 1 GB RAM (suitable for light data processing)
 * - 4g: 4 GB RAM (standard data analysis)
 * - 16g: 16 GB RAM (large dataset processing)
 * - 64g: 64 GB RAM (intensive computations)
 */
export type MemoryLimit = '1g' | '4g' | '16g' | '64g';

/**
 * Validator constraint for memory limit parameter
 * Ensures memory_limit is one of the supported values
 */
@ValidatorConstraint({ async: false })
export class IsMemoryLimitConstraint implements ValidatorConstraintInterface {
  /**
   * Validates memory_limit parameter
   * @param value - The value to validate
   * @returns true if valid, false otherwise
   */
  validate(value: unknown): boolean {
    if (value === undefined || value === null) {
      return true; // Optional field
    }

    if (typeof value !== 'string') {
      return false;
    }

    const validLimits: MemoryLimit[] = ['1g', '4g', '16g', '64g'];
    return validLimits.includes(value as MemoryLimit);
  }

  /**
   * Default error message for invalid memory limits
   * @returns Error message string
   */
  defaultMessage(): string {
    return 'memory_limit must be one of: 1g, 4g, 16g, 64g';
  }
}

/**
 * Custom decorator to validate memory_limit parameter
 * @param validationOptions - Optional validation options
 * @returns PropertyDecorator
 *
 * @example
 * ```typescript
 * class CreateCodeInterpreterDto {
 *   @IsOptional()
 *   @IsMemoryLimitValid()
 *   memory_limit?: MemoryLimit;
 * }
 * ```
 */
export function IsMemoryLimitValid(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      validator: IsMemoryLimitConstraint,
    });
  };
}
