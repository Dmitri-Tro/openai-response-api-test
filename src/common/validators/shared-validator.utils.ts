/**
 * Shared validator utility functions
 *
 * **Purpose**: Provide reusable validation functions to reduce code duplication
 * across custom validators and improve consistency.
 *
 * **Usage**:
 * ```typescript
 * import { isNonEmptyString, validateIdFormat } from '@common/validators/shared-validator.utils';
 *
 * // In validator
 * if (!isNonEmptyString(value)) {
 *   return false;
 * }
 *
 * if (!validateIdFormat(fileId, 'file-', 5)) {
 *   return false;
 * }
 * ```
 *
 * **Guidelines**:
 * - Use these utilities in custom validators to ensure consistent behavior
 * - Add new utilities when patterns are reused 2+ times
 * - Keep functions pure and type-safe
 */

/**
 * Type guards for common validation scenarios
 */

/**
 * Check if value is a non-empty string
 * @param value - Value to check
 * @returns True if value is a string with length > 0
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Check if value is a string (empty or not)
 * @param value - Value to check
 * @returns True if value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Check if value is a valid number (not NaN)
 * @param value - Value to check
 * @returns True if value is a number and not NaN
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Check if value is a non-empty array
 * @param value - Value to check
 * @returns True if value is an array with length > 0
 */
export function isNonEmptyArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Check if value is a non-null object (excludes arrays)
 * @param value - Value to check
 * @returns True if value is an object and not null or array
 */
export function isNonNullObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * ID format validation
 */

/**
 * Validate ID format with prefix and minimum length
 * @param id - ID to validate
 * @param prefix - Required prefix (e.g., "file-", "vs_", "pmpt_")
 * @param minContentLength - Minimum length after prefix (default: 1)
 * @returns True if ID has correct format
 *
 * @example
 * ```typescript
 * validateIdFormat('file-abc123', 'file-', 5)  // true
 * validateIdFormat('file-', 'file-', 1)        // false (no content after prefix)
 * validateIdFormat('vs_abc', 'vs_', 1)         // true
 * ```
 */
export function validateIdFormat(
  id: unknown,
  prefix: string,
  minContentLength: number = 1,
): boolean {
  if (!isString(id)) {
    return false;
  }

  if (!id.startsWith(prefix)) {
    return false;
  }

  // Check if there's enough content after the prefix
  const contentLength = id.length - prefix.length;
  return contentLength >= minContentLength;
}

/**
 * String length validation
 */

/**
 * Check if string length is within range
 * @param value - String to check
 * @param min - Minimum length (inclusive)
 * @param max - Maximum length (inclusive)
 * @returns True if string length is within range
 */
export function isStringLengthInRange(
  value: unknown,
  min: number,
  max: number,
): boolean {
  if (!isString(value)) {
    return false;
  }

  return value.length >= min && value.length <= max;
}

/**
 * Array validation
 */

/**
 * Check if all array elements match a predicate
 * @param arr - Array to check
 * @param predicate - Function to test each element
 * @returns True if all elements match predicate
 *
 * @example
 * ```typescript
 * allElementsMatch(['a', 'b'], isString)  // true
 * allElementsMatch([1, 2, 3], isString)   // false
 * ```
 */
export function allElementsMatch<T>(
  arr: unknown,
  predicate: (element: unknown) => element is T,
): arr is T[] {
  if (!Array.isArray(arr)) {
    return false;
  }

  return arr.every(predicate);
}

/**
 * Check if array has specific length
 * @param arr - Array to check
 * @param length - Expected length
 * @returns True if array has expected length
 */
export function hasArrayLength(arr: unknown, length: number): boolean {
  return Array.isArray(arr) && arr.length === length;
}

/**
 * Metadata validation
 */

/**
 * Check if value is valid metadata (object with string key-value pairs)
 * @param value - Value to check
 * @param maxKeys - Maximum number of keys allowed (default: 16)
 * @param maxKeyLength - Maximum key length (default: 64)
 * @param maxValueLength - Maximum value length (default: 512)
 * @returns True if value is valid metadata
 */
export function isValidMetadata(
  value: unknown,
  maxKeys: number = 16,
  maxKeyLength: number = 64,
  maxValueLength: number = 512,
): boolean {
  if (!isNonNullObject(value)) {
    return false;
  }

  const entries = Object.entries(value);

  // Check number of keys
  if (entries.length > maxKeys) {
    return false;
  }

  // Validate each key-value pair
  for (const [key, val] of entries) {
    // Key must be string within length limit
    if (key.length > maxKeyLength) {
      return false;
    }

    // Value must be string within length limit
    if (typeof val !== 'string' || val.length > maxValueLength) {
      return false;
    }
  }

  return true;
}

/**
 * Numeric range validation
 */

/**
 * Check if number is within range (inclusive)
 * @param value - Number to check
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @returns True if number is within range
 */
export function isNumberInRange(
  value: unknown,
  min: number,
  max: number,
): boolean {
  if (!isValidNumber(value)) {
    return false;
  }

  return value >= min && value <= max;
}

/**
 * Check if number is positive (> 0)
 * @param value - Number to check
 * @returns True if number is positive
 */
export function isPositiveNumber(value: unknown): value is number {
  return isValidNumber(value) && value > 0;
}

/**
 * Type name helpers for error messages
 */

/**
 * Get human-readable type name for error messages
 * @param value - Value to get type name for
 * @returns Type name string
 *
 * @example
 * ```typescript
 * getTypeName('hello')      // 'string'
 * getTypeName(123)          // 'number'
 * getTypeName([1, 2])       // 'array'
 * getTypeName({ a: 1 })     // 'object'
 * getTypeName(null)         // 'null'
 * getTypeName(undefined)    // 'undefined'
 * ```
 */
export function getTypeName(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return 'array';
  }

  return typeof value;
}
