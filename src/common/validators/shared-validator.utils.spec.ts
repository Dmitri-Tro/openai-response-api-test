import {
  isNonEmptyString,
  isString,
  isValidNumber,
  isNonEmptyArray,
  isNonNullObject,
  validateIdFormat,
  isStringLengthInRange,
  allElementsMatch,
  hasArrayLength,
  isValidMetadata,
  isNumberInRange,
  isPositiveNumber,
  getTypeName,
} from './shared-validator.utils';

describe('Shared Validator Utils', () => {
  describe('isNonEmptyString', () => {
    it('should return true for non-empty string', () => {
      expect(isNonEmptyString('hello')).toBe(true);
      expect(isNonEmptyString('a')).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(isNonEmptyString('')).toBe(false);
    });

    it('should return false for non-string types', () => {
      expect(isNonEmptyString(123)).toBe(false);
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
      expect(isNonEmptyString([])).toBe(false);
      expect(isNonEmptyString({})).toBe(false);
    });
  });

  describe('isString', () => {
    it('should return true for any string (including empty)', () => {
      expect(isString('hello')).toBe(true);
      expect(isString('')).toBe(true);
    });

    it('should return false for non-string types', () => {
      expect(isString(123)).toBe(false);
      expect(isString(null)).toBe(false);
      expect(isString(undefined)).toBe(false);
    });
  });

  describe('isValidNumber', () => {
    it('should return true for valid numbers', () => {
      expect(isValidNumber(0)).toBe(true);
      expect(isValidNumber(123)).toBe(true);
      expect(isValidNumber(-456)).toBe(true);
      expect(isValidNumber(3.14)).toBe(true);
    });

    it('should return false for NaN', () => {
      expect(isValidNumber(NaN)).toBe(false);
    });

    it('should return false for non-number types', () => {
      expect(isValidNumber('123')).toBe(false);
      expect(isValidNumber(null)).toBe(false);
      expect(isValidNumber(undefined)).toBe(false);
    });
  });

  describe('isNonEmptyArray', () => {
    it('should return true for non-empty arrays', () => {
      expect(isNonEmptyArray([1])).toBe(true);
      expect(isNonEmptyArray([1, 2, 3])).toBe(true);
      expect(isNonEmptyArray(['a', 'b'])).toBe(true);
    });

    it('should return false for empty array', () => {
      expect(isNonEmptyArray([])).toBe(false);
    });

    it('should return false for non-array types', () => {
      expect(isNonEmptyArray('array')).toBe(false);
      expect(isNonEmptyArray({})).toBe(false);
      expect(isNonEmptyArray(null)).toBe(false);
    });
  });

  describe('isNonNullObject', () => {
    it('should return true for objects', () => {
      expect(isNonNullObject({})).toBe(true);
      expect(isNonNullObject({ a: 1 })).toBe(true);
    });

    it('should return false for null', () => {
      expect(isNonNullObject(null)).toBe(false);
    });

    it('should return false for arrays', () => {
      expect(isNonNullObject([])).toBe(false);
      expect(isNonNullObject([1, 2])).toBe(false);
    });

    it('should return false for non-object types', () => {
      expect(isNonNullObject('object')).toBe(false);
      expect(isNonNullObject(123)).toBe(false);
      expect(isNonNullObject(undefined)).toBe(false);
    });
  });

  describe('validateIdFormat', () => {
    it('should validate file IDs', () => {
      expect(validateIdFormat('file-abc123', 'file-', 1)).toBe(true);
      expect(validateIdFormat('file-xyz789', 'file-', 5)).toBe(true);
    });

    it('should validate vector store IDs', () => {
      expect(validateIdFormat('vs_abc123', 'vs_', 1)).toBe(true);
      expect(validateIdFormat('vs_x', 'vs_', 1)).toBe(true);
    });

    it('should validate prompt IDs', () => {
      expect(validateIdFormat('pmpt_abc123', 'pmpt_', 1)).toBe(true);
    });

    it('should reject IDs without prefix', () => {
      expect(validateIdFormat('abc123', 'file-', 1)).toBe(false);
    });

    it('should reject IDs with insufficient content after prefix', () => {
      expect(validateIdFormat('file-', 'file-', 1)).toBe(false);
      expect(validateIdFormat('file-a', 'file-', 5)).toBe(false);
    });

    it('should reject non-string IDs', () => {
      expect(validateIdFormat(123, 'file-', 1)).toBe(false);
      expect(validateIdFormat(null, 'file-', 1)).toBe(false);
    });

    it('should use default minContentLength of 1', () => {
      expect(validateIdFormat('vs_x', 'vs_')).toBe(true);
      expect(validateIdFormat('vs_', 'vs_')).toBe(false);
    });
  });

  describe('isStringLengthInRange', () => {
    it('should validate string within range', () => {
      expect(isStringLengthInRange('hello', 1, 10)).toBe(true);
      expect(isStringLengthInRange('a', 1, 1)).toBe(true);
      expect(isStringLengthInRange('abcdefghij', 10, 10)).toBe(true);
    });

    it('should reject string outside range', () => {
      expect(isStringLengthInRange('', 1, 10)).toBe(false);
      expect(isStringLengthInRange('hello', 10, 20)).toBe(false);
      expect(isStringLengthInRange('a', 2, 5)).toBe(false);
    });

    it('should reject non-string types', () => {
      expect(isStringLengthInRange(123, 1, 10)).toBe(false);
      expect(isStringLengthInRange(null, 1, 10)).toBe(false);
    });
  });

  describe('allElementsMatch', () => {
    it('should return true when all elements match predicate', () => {
      expect(allElementsMatch(['a', 'b', 'c'], isString)).toBe(true);
      expect(allElementsMatch([1, 2, 3], isValidNumber)).toBe(true);
    });

    it('should return false when some elements do not match', () => {
      expect(allElementsMatch(['a', 1, 'c'], isString)).toBe(false);
      expect(allElementsMatch([1, 'two', 3], isValidNumber)).toBe(false);
    });

    it('should return true for empty array', () => {
      expect(allElementsMatch([], isString)).toBe(true);
    });

    it('should return false for non-array types', () => {
      expect(allElementsMatch('array', isString)).toBe(false);
      expect(allElementsMatch({}, isString)).toBe(false);
    });
  });

  describe('hasArrayLength', () => {
    it('should return true for array with exact length', () => {
      expect(hasArrayLength([1, 2, 3], 3)).toBe(true);
      expect(hasArrayLength([], 0)).toBe(true);
      expect(hasArrayLength(['a'], 1)).toBe(true);
    });

    it('should return false for array with different length', () => {
      expect(hasArrayLength([1, 2], 3)).toBe(false);
      expect(hasArrayLength([1, 2, 3], 2)).toBe(false);
    });

    it('should return false for non-array types', () => {
      expect(hasArrayLength('array', 5)).toBe(false);
      expect(hasArrayLength({}, 0)).toBe(false);
    });
  });

  describe('isValidMetadata', () => {
    it('should validate correct metadata', () => {
      expect(isValidMetadata({ key1: 'value1', key2: 'value2' })).toBe(true);
      expect(isValidMetadata({})).toBe(true);
    });

    it('should reject too many keys', () => {
      const metadata: Record<string, string> = {};
      for (let i = 0; i < 17; i++) {
        metadata[`key${i}`] = 'value';
      }
      expect(isValidMetadata(metadata, 16)).toBe(false);
    });

    it('should reject keys that are too long', () => {
      const longKey = 'a'.repeat(65);
      expect(isValidMetadata({ [longKey]: 'value' }, 16, 64)).toBe(false);
    });

    it('should reject values that are too long', () => {
      const longValue = 'a'.repeat(513);
      expect(isValidMetadata({ key: longValue }, 16, 64, 512)).toBe(false);
    });

    it('should reject non-string values', () => {
      expect(isValidMetadata({ key: 123 as any })).toBe(false);
      expect(isValidMetadata({ key: null as any })).toBe(false);
    });

    it('should reject non-object types', () => {
      expect(isValidMetadata('metadata')).toBe(false);
      expect(isValidMetadata([])).toBe(false);
      expect(isValidMetadata(null)).toBe(false);
    });
  });

  describe('isNumberInRange', () => {
    it('should validate number within range', () => {
      expect(isNumberInRange(5, 1, 10)).toBe(true);
      expect(isNumberInRange(1, 1, 10)).toBe(true);
      expect(isNumberInRange(10, 1, 10)).toBe(true);
    });

    it('should reject number outside range', () => {
      expect(isNumberInRange(0, 1, 10)).toBe(false);
      expect(isNumberInRange(11, 1, 10)).toBe(false);
    });

    it('should reject non-number types', () => {
      expect(isNumberInRange('5', 1, 10)).toBe(false);
      expect(isNumberInRange(NaN, 1, 10)).toBe(false);
    });
  });

  describe('isPositiveNumber', () => {
    it('should return true for positive numbers', () => {
      expect(isPositiveNumber(1)).toBe(true);
      expect(isPositiveNumber(0.1)).toBe(true);
      expect(isPositiveNumber(1000)).toBe(true);
    });

    it('should return false for zero', () => {
      expect(isPositiveNumber(0)).toBe(false);
    });

    it('should return false for negative numbers', () => {
      expect(isPositiveNumber(-1)).toBe(false);
      expect(isPositiveNumber(-0.1)).toBe(false);
    });

    it('should return false for non-number types', () => {
      expect(isPositiveNumber('1')).toBe(false);
      expect(isPositiveNumber(NaN)).toBe(false);
    });
  });

  describe('getTypeName', () => {
    it('should return "string" for strings', () => {
      expect(getTypeName('hello')).toBe('string');
      expect(getTypeName('')).toBe('string');
    });

    it('should return "number" for numbers', () => {
      expect(getTypeName(123)).toBe('number');
      expect(getTypeName(0)).toBe('number');
    });

    it('should return "array" for arrays', () => {
      expect(getTypeName([])).toBe('array');
      expect(getTypeName([1, 2, 3])).toBe('array');
    });

    it('should return "object" for objects', () => {
      expect(getTypeName({})).toBe('object');
      expect(getTypeName({ a: 1 })).toBe('object');
    });

    it('should return "null" for null', () => {
      expect(getTypeName(null)).toBe('null');
    });

    it('should return "undefined" for undefined', () => {
      expect(getTypeName(undefined)).toBe('undefined');
    });

    it('should return "boolean" for booleans', () => {
      expect(getTypeName(true)).toBe('boolean');
      expect(getTypeName(false)).toBe('boolean');
    });
  });
});
