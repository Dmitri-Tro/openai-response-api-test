import { IsChunkingStrategyConstraint } from './chunking-strategy.validator';

describe('IsChunkingStrategyConstraint', () => {
  let constraint: IsChunkingStrategyConstraint;

  beforeEach(() => {
    constraint = new IsChunkingStrategyConstraint();
  });

  describe('basic validation', () => {
    it('should accept undefined (optional field)', () => {
      expect(constraint.validate(undefined)).toBe(true);
    });

    it('should reject null', () => {
      expect(constraint.validate(null)).toBe(false);
    });

    it('should reject non-object', () => {
      expect(constraint.validate('auto')).toBe(false);
      expect(constraint.validate(123)).toBe(false);
      expect(constraint.validate(true)).toBe(false);
    });

    it('should reject array', () => {
      expect(constraint.validate([])).toBe(false);
    });

    it('should reject object without type field', () => {
      expect(constraint.validate({})).toBe(false);
    });

    it('should reject object with non-string type', () => {
      expect(constraint.validate({ type: 123 })).toBe(false);
    });

    it('should reject invalid type value', () => {
      expect(constraint.validate({ type: 'invalid' })).toBe(false);
      expect(constraint.validate({ type: 'manual' })).toBe(false);
    });
  });

  describe('auto chunking strategy', () => {
    it('should accept valid auto strategy', () => {
      expect(constraint.validate({ type: 'auto' })).toBe(true);
    });

    it('should reject auto strategy with extra fields', () => {
      expect(constraint.validate({ type: 'auto', extra: 'field' })).toBe(false);
    });

    it('should reject auto strategy with static field', () => {
      expect(
        constraint.validate({
          type: 'auto',
          static: { max_chunk_size_tokens: 800, chunk_overlap_tokens: 400 },
        }),
      ).toBe(false);
    });
  });

  describe('static chunking strategy - valid cases', () => {
    it('should accept valid static strategy with minimum chunk size', () => {
      expect(
        constraint.validate({
          type: 'static',
          static: {
            max_chunk_size_tokens: 100,
            chunk_overlap_tokens: 50,
          },
        }),
      ).toBe(true);
    });

    it('should accept valid static strategy with maximum chunk size', () => {
      expect(
        constraint.validate({
          type: 'static',
          static: {
            max_chunk_size_tokens: 4096,
            chunk_overlap_tokens: 2048,
          },
        }),
      ).toBe(true);
    });

    it('should accept valid static strategy with typical values', () => {
      expect(
        constraint.validate({
          type: 'static',
          static: {
            max_chunk_size_tokens: 800,
            chunk_overlap_tokens: 400,
          },
        }),
      ).toBe(true);
    });

    it('should accept static strategy with zero overlap', () => {
      expect(
        constraint.validate({
          type: 'static',
          static: {
            max_chunk_size_tokens: 1000,
            chunk_overlap_tokens: 0,
          },
        }),
      ).toBe(true);
    });

    it('should accept static strategy with overlap equal to half', () => {
      expect(
        constraint.validate({
          type: 'static',
          static: {
            max_chunk_size_tokens: 1000,
            chunk_overlap_tokens: 500,
          },
        }),
      ).toBe(true);
    });
  });

  describe('static chunking strategy - missing fields', () => {
    it('should reject static strategy without static field', () => {
      expect(constraint.validate({ type: 'static' })).toBe(false);
    });

    it('should reject static field as non-object', () => {
      expect(constraint.validate({ type: 'static', static: 'config' })).toBe(
        false,
      );
    });

    it('should reject static field as null', () => {
      expect(constraint.validate({ type: 'static', static: null })).toBe(false);
    });

    it('should reject static field as array', () => {
      expect(constraint.validate({ type: 'static', static: [] })).toBe(false);
    });

    it('should reject missing max_chunk_size_tokens', () => {
      expect(
        constraint.validate({
          type: 'static',
          static: { chunk_overlap_tokens: 400 },
        }),
      ).toBe(false);
    });

    it('should reject missing chunk_overlap_tokens', () => {
      expect(
        constraint.validate({
          type: 'static',
          static: { max_chunk_size_tokens: 800 },
        }),
      ).toBe(false);
    });
  });

  describe('static chunking strategy - max_chunk_size_tokens validation', () => {
    it('should reject non-number max_chunk_size_tokens', () => {
      expect(
        constraint.validate({
          type: 'static',
          static: {
            max_chunk_size_tokens: '800',
            chunk_overlap_tokens: 400,
          },
        }),
      ).toBe(false);
    });

    it('should reject float max_chunk_size_tokens', () => {
      expect(
        constraint.validate({
          type: 'static',
          static: {
            max_chunk_size_tokens: 800.5,
            chunk_overlap_tokens: 400,
          },
        }),
      ).toBe(false);
    });

    it('should reject max_chunk_size_tokens below minimum (99)', () => {
      expect(
        constraint.validate({
          type: 'static',
          static: {
            max_chunk_size_tokens: 99,
            chunk_overlap_tokens: 40,
          },
        }),
      ).toBe(false);
    });

    it('should reject max_chunk_size_tokens above maximum (4097)', () => {
      expect(
        constraint.validate({
          type: 'static',
          static: {
            max_chunk_size_tokens: 4097,
            chunk_overlap_tokens: 2000,
          },
        }),
      ).toBe(false);
    });

    it('should reject negative max_chunk_size_tokens', () => {
      expect(
        constraint.validate({
          type: 'static',
          static: {
            max_chunk_size_tokens: -100,
            chunk_overlap_tokens: 0,
          },
        }),
      ).toBe(false);
    });
  });

  describe('static chunking strategy - chunk_overlap_tokens validation', () => {
    it('should reject non-number chunk_overlap_tokens', () => {
      expect(
        constraint.validate({
          type: 'static',
          static: {
            max_chunk_size_tokens: 800,
            chunk_overlap_tokens: '400',
          },
        }),
      ).toBe(false);
    });

    it('should reject float chunk_overlap_tokens', () => {
      expect(
        constraint.validate({
          type: 'static',
          static: {
            max_chunk_size_tokens: 800,
            chunk_overlap_tokens: 400.5,
          },
        }),
      ).toBe(false);
    });

    it('should reject negative chunk_overlap_tokens', () => {
      expect(
        constraint.validate({
          type: 'static',
          static: {
            max_chunk_size_tokens: 800,
            chunk_overlap_tokens: -100,
          },
        }),
      ).toBe(false);
    });

    it('should reject overlap exceeding half of max chunk size', () => {
      expect(
        constraint.validate({
          type: 'static',
          static: {
            max_chunk_size_tokens: 800,
            chunk_overlap_tokens: 401,
          },
        }),
      ).toBe(false);
    });

    it('should reject overlap equal to max chunk size', () => {
      expect(
        constraint.validate({
          type: 'static',
          static: {
            max_chunk_size_tokens: 800,
            chunk_overlap_tokens: 800,
          },
        }),
      ).toBe(false);
    });

    it('should reject overlap greater than max chunk size', () => {
      expect(
        constraint.validate({
          type: 'static',
          static: {
            max_chunk_size_tokens: 800,
            chunk_overlap_tokens: 1000,
          },
        }),
      ).toBe(false);
    });
  });

  describe('defaultMessage', () => {
    it('should return descriptive error message', () => {
      const message = constraint.defaultMessage();
      expect(message).toContain('chunking strategy');
      expect(message).toContain('auto');
      expect(message).toContain('static');
      expect(message).toContain('100-4096');
    });
  });
});
