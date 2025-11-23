import { IsMetadataConstraint } from './metadata.validator';

describe('IsMetadataConstraint', () => {
  let constraint: IsMetadataConstraint;

  beforeEach(() => {
    constraint = new IsMetadataConstraint();
  });

  describe('basic validation', () => {
    it('should accept undefined (optional field)', () => {
      expect(constraint.validate(undefined)).toBe(true);
    });

    it('should accept null', () => {
      expect(constraint.validate(null)).toBe(true);
    });

    it('should reject non-object', () => {
      expect(constraint.validate('metadata')).toBe(false);
      expect(constraint.validate(123)).toBe(false);
      expect(constraint.validate(true)).toBe(false);
    });

    it('should reject array', () => {
      expect(constraint.validate([])).toBe(false);
      expect(constraint.validate(['key', 'value'])).toBe(false);
    });
  });

  describe('valid metadata', () => {
    it('should accept empty object', () => {
      expect(constraint.validate({})).toBe(true);
    });

    it('should accept single key-value pair', () => {
      expect(constraint.validate({ category: 'documentation' })).toBe(true);
    });

    it('should accept multiple key-value pairs', () => {
      expect(
        constraint.validate({
          category: 'documentation',
          priority: 'high',
          language: 'en',
        }),
      ).toBe(true);
    });

    it('should accept exactly 16 key-value pairs (maximum)', () => {
      const metadata: Record<string, string> = {};
      for (let i = 1; i <= 16; i++) {
        metadata[`key${i}`] = `value${i}`;
      }
      expect(constraint.validate(metadata)).toBe(true);
    });

    it('should accept key with maximum length (64 chars)', () => {
      const longKey = 'a'.repeat(64);
      expect(constraint.validate({ [longKey]: 'value' })).toBe(true);
    });

    it('should accept value with maximum length (512 chars)', () => {
      const longValue = 'a'.repeat(512);
      expect(constraint.validate({ key: longValue })).toBe(true);
    });

    it('should accept keys and values at maximum length', () => {
      const longKey = 'k'.repeat(64);
      const longValue = 'v'.repeat(512);
      expect(constraint.validate({ [longKey]: longValue })).toBe(true);
    });

    it('should accept empty string values', () => {
      expect(constraint.validate({ key: '' })).toBe(true);
    });

    it('should accept keys with special characters', () => {
      expect(
        constraint.validate({
          'key-with-dashes': 'value',
          key_with_underscores: 'value',
          'key.with.dots': 'value',
        }),
      ).toBe(true);
    });
  });

  describe('maximum pairs validation', () => {
    it('should reject more than 16 key-value pairs', () => {
      const metadata: Record<string, string> = {};
      for (let i = 1; i <= 17; i++) {
        metadata[`key${i}`] = `value${i}`;
      }
      expect(constraint.validate(metadata)).toBe(false);
    });

    it('should reject 20 key-value pairs', () => {
      const metadata: Record<string, string> = {};
      for (let i = 1; i <= 20; i++) {
        metadata[`key${i}`] = `value${i}`;
      }
      expect(constraint.validate(metadata)).toBe(false);
    });
  });

  describe('key length validation', () => {
    it('should reject key exceeding 64 characters', () => {
      const longKey = 'a'.repeat(65);
      expect(constraint.validate({ [longKey]: 'value' })).toBe(false);
    });

    it('should reject key with 100 characters', () => {
      const longKey = 'a'.repeat(100);
      expect(constraint.validate({ [longKey]: 'value' })).toBe(false);
    });

    it('should reject when one of multiple keys exceeds limit', () => {
      const longKey = 'a'.repeat(65);
      expect(
        constraint.validate({
          validKey: 'value',
          [longKey]: 'value',
          anotherValidKey: 'value',
        }),
      ).toBe(false);
    });
  });

  describe('value type validation', () => {
    it('should reject number values', () => {
      expect(constraint.validate({ key: 123 })).toBe(false);
    });

    it('should reject boolean values', () => {
      expect(constraint.validate({ key: true })).toBe(false);
      expect(constraint.validate({ key: false })).toBe(false);
    });

    it('should reject null values', () => {
      expect(constraint.validate({ key: null })).toBe(false);
    });

    it('should reject undefined values', () => {
      expect(constraint.validate({ key: undefined })).toBe(false);
    });

    it('should reject object values', () => {
      expect(constraint.validate({ key: { nested: 'object' } })).toBe(false);
    });

    it('should reject array values', () => {
      expect(constraint.validate({ key: ['array'] })).toBe(false);
    });

    it('should reject when one of multiple values is not string', () => {
      expect(
        constraint.validate({
          validKey: 'string value',
          invalidKey: 123,
          anotherValidKey: 'another string',
        }),
      ).toBe(false);
    });
  });

  describe('value length validation', () => {
    it('should reject value exceeding 512 characters', () => {
      const longValue = 'a'.repeat(513);
      expect(constraint.validate({ key: longValue })).toBe(false);
    });

    it('should reject value with 1000 characters', () => {
      const longValue = 'a'.repeat(1000);
      expect(constraint.validate({ key: longValue })).toBe(false);
    });

    it('should reject when one of multiple values exceeds limit', () => {
      const longValue = 'a'.repeat(513);
      expect(
        constraint.validate({
          validKey: 'short value',
          invalidKey: longValue,
          anotherValidKey: 'another short value',
        }),
      ).toBe(false);
    });
  });

  describe('complex scenarios', () => {
    it('should reject metadata with multiple violations', () => {
      const longKey = 'k'.repeat(65);
      const longValue = 'v'.repeat(513);
      expect(
        constraint.validate({
          validKey: 'value',
          [longKey]: longValue,
          numberKey: 123,
        }),
      ).toBe(false);
    });

    it('should accept metadata at all limits', () => {
      const metadata: Record<string, string> = {};
      const maxKey = 'k'.repeat(64);
      const maxValue = 'v'.repeat(512);

      for (let i = 1; i <= 15; i++) {
        metadata[`key${i}`] = `value${i}`;
      }
      metadata[maxKey] = maxValue;

      expect(constraint.validate(metadata)).toBe(true);
    });
  });

  describe('defaultMessage', () => {
    it('should return descriptive error message', () => {
      const message = constraint.defaultMessage();
      expect(message).toContain('metadata');
      expect(message).toContain('16');
      expect(message).toContain('64');
      expect(message).toContain('512');
    });
  });
});
