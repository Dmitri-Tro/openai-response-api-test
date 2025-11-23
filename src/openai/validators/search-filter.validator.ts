import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Validator constraint for search filter configuration
 *
 * Validates:
 * - ComparisonFilter: { key: string, type: operator, value: primitive }
 * - CompoundFilter: { type: 'and' | 'or', filters: Filter[] }
 * - Supported operators: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'
 * - Recursive validation for nested compound filters
 */
@ValidatorConstraint({ async: false })
export class IsSearchFilterConstraint implements ValidatorConstraintInterface {
  validate(filter: unknown): boolean {
    // Optional field - undefined is valid
    if (filter === undefined) {
      return true;
    }

    return this.validateFilter(filter);
  }

  private validateFilter(filter: unknown): boolean {
    // Must be an object
    if (typeof filter !== 'object' || filter === null) {
      return false;
    }

    const filterObj = filter as Record<string, unknown>;

    // Must have 'type' field
    if (!('type' in filterObj) || typeof filterObj.type !== 'string') {
      return false;
    }

    // Check if comparison filter or compound filter
    if (filterObj.type === 'and' || filterObj.type === 'or') {
      return this.validateCompoundFilter(filterObj);
    } else {
      return this.validateComparisonFilter(filterObj);
    }
  }

  private validateComparisonFilter(filter: Record<string, unknown>): boolean {
    // Must have 'key', 'type', and 'value' fields
    if (!('key' in filter) || !('type' in filter) || !('value' in filter)) {
      return false;
    }

    // Validate key is string
    if (typeof filter.key !== 'string' || filter.key.length === 0) {
      return false;
    }

    // Validate type is valid operator
    const validOperators = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'];
    if (
      typeof filter.type !== 'string' ||
      !validOperators.includes(filter.type)
    ) {
      return false;
    }

    // Validate value is primitive type or array
    const value = filter.value;
    if (Array.isArray(value)) {
      // Array of primitives
      if (value.length === 0) {
        return false;
      }
      for (const item of value) {
        if (!this.isPrimitive(item)) {
          return false;
        }
      }
    } else {
      // Single primitive value
      if (!this.isPrimitive(value)) {
        return false;
      }
    }

    return true;
  }

  private validateCompoundFilter(filter: Record<string, unknown>): boolean {
    // Must have 'filters' field
    if (!('filters' in filter)) {
      return false;
    }

    // Validate filters is array
    if (!Array.isArray(filter.filters)) {
      return false;
    }

    // Must have at least one filter
    if (filter.filters.length === 0) {
      return false;
    }

    // Recursively validate each filter
    for (const nestedFilter of filter.filters) {
      if (!this.validateFilter(nestedFilter)) {
        return false;
      }
    }

    return true;
  }

  private isPrimitive(value: unknown): boolean {
    const valueType = typeof value;
    return (
      valueType === 'string' ||
      valueType === 'number' ||
      valueType === 'boolean'
    );
  }

  defaultMessage(): string {
    return `Invalid search filter configuration. Requirements:
      - ComparisonFilter: { key: string, type: operator, value: primitive | primitive[] }
        - Operators: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'
        - Value: string, number, boolean, or array of primitives
      - CompoundFilter: { type: 'and' | 'or', filters: Filter[] }
        - Filters array must not be empty
        - Supports nested compound filters`;
  }
}

/**
 * Decorator for validating search filter configuration
 *
 * Usage:
 * ```typescript
 * @IsOptional()
 * @IsSearchFilterValid()
 * filters?: ComparisonFilter | CompoundFilter;
 * ```
 */
export function IsSearchFilterValid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSearchFilterConstraint,
    });
  };
}
