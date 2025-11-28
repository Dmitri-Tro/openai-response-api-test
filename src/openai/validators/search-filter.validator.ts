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

/**
 * Helper function to validate search filter configuration
 *
 * Use this as a standalone validator in controllers or services.
 *
 * @param filter - Search filter object to validate (ComparisonFilter or CompoundFilter)
 * @returns True if search filter is valid, false otherwise
 *
 * @example
 * ```typescript
 * // In a service
 * if (!validateSearchFilter(dto.filters)) {
 *   throw new BadRequestException(
 *     getSearchFilterErrorMessage(dto.filters)
 *   );
 * }
 * ```
 */
export function validateSearchFilter(filter: unknown): boolean {
  // Optional field - undefined is valid
  if (filter === undefined) {
    return true;
  }

  return validateFilterRecursive(filter);
}

function validateFilterRecursive(filter: unknown): boolean {
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
    return validateCompoundFilterHelper(filterObj);
  } else {
    return validateComparisonFilterHelper(filterObj);
  }
}

function validateComparisonFilterHelper(
  filter: Record<string, unknown>,
): boolean {
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
      if (!isPrimitiveValue(item)) {
        return false;
      }
    }
  } else {
    // Single primitive value
    if (!isPrimitiveValue(value)) {
      return false;
    }
  }

  return true;
}

function validateCompoundFilterHelper(
  filter: Record<string, unknown>,
): boolean {
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
    if (!validateFilterRecursive(nestedFilter)) {
      return false;
    }
  }

  return true;
}

function isPrimitiveValue(value: unknown): boolean {
  const valueType = typeof value;
  return (
    valueType === 'string' || valueType === 'number' || valueType === 'boolean'
  );
}

/**
 * Helper function to get detailed error message for search filter validation
 *
 * @param filter - Search filter object that failed validation
 * @returns Detailed error message
 *
 * @example
 * ```typescript
 * if (!validateSearchFilter(filters)) {
 *   const errorMessage = getSearchFilterErrorMessage(filters);
 *   throw new BadRequestException(errorMessage);
 * }
 * ```
 */
export function getSearchFilterErrorMessage(filter: unknown): string {
  // Handle undefined (should be valid, but if called, provide message)
  if (filter === undefined) {
    return 'Search filter is optional and can be undefined';
  }

  // Handle non-object
  if (typeof filter !== 'object' || filter === null) {
    return `Search filter must be an object. Received: ${typeof filter}`;
  }

  const filterObj = filter as Record<string, unknown>;

  // Handle missing type
  if (!('type' in filterObj)) {
    return `Search filter must have a 'type' field. Received: ${Object.keys(filterObj).join(', ')}`;
  }

  // Handle invalid type value
  if (typeof filterObj.type !== 'string') {
    return `Search filter 'type' must be a string. Received: ${typeof filterObj.type}`;
  }

  // Determine filter kind and validate
  if (filterObj.type === 'and' || filterObj.type === 'or') {
    // Compound filter validation
    if (!('filters' in filterObj)) {
      return `Compound filter (type: '${filterObj.type}') must have 'filters' array`;
    }

    if (!Array.isArray(filterObj.filters)) {
      return `Compound filter 'filters' must be an array. Received: ${typeof filterObj.filters}`;
    }

    if (filterObj.filters.length === 0) {
      return `Compound filter 'filters' array must not be empty`;
    }

    // Check for invalid nested filters
    for (let i = 0; i < filterObj.filters.length; i++) {
      const nestedFilter = filterObj.filters[i] as unknown;
      if (!validateFilterRecursive(nestedFilter)) {
        return `Invalid nested filter at index ${i} in compound filter`;
      }
    }
  } else {
    // Comparison filter validation
    const validOperators = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'];

    if (!validOperators.includes(filterObj.type)) {
      return `Invalid comparison operator '${filterObj.type}'. Valid operators: ${validOperators.join(', ')}`;
    }

    if (!('key' in filterObj)) {
      return `Comparison filter missing required field: 'key'`;
    }

    if (typeof filterObj.key !== 'string' || filterObj.key.length === 0) {
      return `Comparison filter 'key' must be a non-empty string. Received: ${typeof filterObj.key}`;
    }

    if (!('value' in filterObj)) {
      return `Comparison filter missing required field: 'value'`;
    }

    const value = filterObj.value;
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return `Comparison filter 'value' array must not be empty`;
      }

      for (let i = 0; i < value.length; i++) {
        if (!isPrimitiveValue(value[i])) {
          return `Comparison filter 'value' array contains non-primitive at index ${i}. Expected string, number, or boolean.`;
        }
      }
    } else {
      if (!isPrimitiveValue(value)) {
        return `Comparison filter 'value' must be a primitive type (string, number, boolean). Received: ${typeof value}`;
      }
    }
  }

  return `Invalid search filter configuration. Requirements:
    - ComparisonFilter: { key: string, type: operator, value: primitive | primitive[] }
      - Operators: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'
      - Value: string, number, boolean, or array of primitives
    - CompoundFilter: { type: 'and' | 'or', filters: Filter[] }
      - Filters array must not be empty
      - Supports nested compound filters`;
}
