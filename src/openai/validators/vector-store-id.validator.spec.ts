import { IsVectorStoreIdConstraint } from './vector-store-id.validator';

describe('IsVectorStoreIdConstraint', () => {
  let constraint: IsVectorStoreIdConstraint;

  beforeEach(() => {
    constraint = new IsVectorStoreIdConstraint();
  });

  describe('valid vector store IDs', () => {
    it('should accept valid vector store ID with short suffix', () => {
      expect(constraint.validate('vs_abc')).toBe(true);
    });

    it('should accept valid vector store ID with long suffix', () => {
      expect(constraint.validate('vs_abc123xyz789def456')).toBe(true);
    });

    it('should accept vector store ID with alphanumeric suffix', () => {
      expect(constraint.validate('vs_test123')).toBe(true);
    });

    it('should accept vector store ID with underscores in suffix', () => {
      expect(constraint.validate('vs_test_store_123')).toBe(true);
    });

    it('should accept vector store ID with hyphens in suffix', () => {
      expect(constraint.validate('vs_test-store-123')).toBe(true);
    });

    it('should accept vector store ID with mixed case', () => {
      expect(constraint.validate('vs_TestStore123')).toBe(true);
    });
  });

  describe('invalid vector store IDs', () => {
    it('should reject non-string value', () => {
      expect(constraint.validate(123)).toBe(false);
      expect(constraint.validate(true)).toBe(false);
      expect(constraint.validate(null)).toBe(false);
      expect(constraint.validate(undefined)).toBe(false);
    });

    it('should reject object', () => {
      expect(constraint.validate({ id: 'vs_abc123' })).toBe(false);
    });

    it('should reject array', () => {
      expect(constraint.validate(['vs_abc123'])).toBe(false);
    });

    it('should reject empty string', () => {
      expect(constraint.validate('')).toBe(false);
    });

    it('should reject string without vs_ prefix', () => {
      expect(constraint.validate('abc123')).toBe(false);
    });

    it('should reject string with file_ prefix', () => {
      expect(constraint.validate('file_abc123')).toBe(false);
    });

    it('should reject string with different prefix', () => {
      expect(constraint.validate('store_abc123')).toBe(false);
    });

    it('should reject only "vs_" without suffix', () => {
      expect(constraint.validate('vs_')).toBe(false);
    });

    it('should reject "vs" without underscore', () => {
      expect(constraint.validate('vs')).toBe(false);
    });

    it('should reject "vs" with suffix but no underscore', () => {
      expect(constraint.validate('vsabc123')).toBe(false);
    });

    it('should reject string with vs_ in middle', () => {
      expect(constraint.validate('prefix_vs_abc123')).toBe(false);
    });

    it('should reject string with vs_ at end', () => {
      expect(constraint.validate('abc123_vs_')).toBe(false);
    });

    it('should reject string with uppercase VS_', () => {
      expect(constraint.validate('VS_abc123')).toBe(false);
    });

    it('should reject string with mixed case prefix', () => {
      expect(constraint.validate('Vs_abc123')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should accept minimum valid length (4 characters)', () => {
      expect(constraint.validate('vs_a')).toBe(true);
    });

    it('should accept very long vector store ID', () => {
      const longId = 'vs_' + 'a'.repeat(100);
      expect(constraint.validate(longId)).toBe(true);
    });

    it('should accept ID with whitespace after prefix', () => {
      // Validator only checks prefix and length, not content validity
      expect(constraint.validate('vs_ ')).toBe(true);
    });

    it('should accept ID with special characters after prefix', () => {
      // Validator only checks prefix and length, not character restrictions
      expect(constraint.validate('vs_!@#$')).toBe(true);
    });
  });

  describe('defaultMessage', () => {
    it('should return descriptive error message', () => {
      const message = constraint.defaultMessage();
      expect(message).toContain('Vector store ID');
      expect(message).toContain('vs_');
      expect(message).toContain('string');
    });
  });
});
