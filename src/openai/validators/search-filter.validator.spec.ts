import { IsSearchFilterConstraint } from './search-filter.validator';

describe('IsSearchFilterConstraint', () => {
  let constraint: IsSearchFilterConstraint;

  beforeEach(() => {
    constraint = new IsSearchFilterConstraint();
  });

  describe('basic validation', () => {
    it('should accept undefined (optional field)', () => {
      expect(constraint.validate(undefined)).toBe(true);
    });

    it('should reject null', () => {
      expect(constraint.validate(null)).toBe(false);
    });

    it('should reject non-object', () => {
      expect(constraint.validate('filter')).toBe(false);
      expect(constraint.validate(123)).toBe(false);
      expect(constraint.validate(true)).toBe(false);
    });

    it('should reject array', () => {
      expect(constraint.validate([])).toBe(false);
    });

    it('should reject object without type field', () => {
      expect(constraint.validate({ key: 'category', value: 'docs' })).toBe(
        false,
      );
    });

    it('should reject object with non-string type', () => {
      expect(
        constraint.validate({ key: 'category', type: 123, value: 'docs' }),
      ).toBe(false);
    });
  });

  describe('comparison filter - valid cases', () => {
    it('should accept valid eq filter with string value', () => {
      expect(
        constraint.validate({
          key: 'category',
          type: 'eq',
          value: 'documentation',
        }),
      ).toBe(true);
    });

    it('should accept valid ne filter with number value', () => {
      expect(
        constraint.validate({
          key: 'priority',
          type: 'ne',
          value: 5,
        }),
      ).toBe(true);
    });

    it('should accept valid gt filter', () => {
      expect(
        constraint.validate({
          key: 'year',
          type: 'gt',
          value: 2023,
        }),
      ).toBe(true);
    });

    it('should accept valid gte filter', () => {
      expect(
        constraint.validate({
          key: 'score',
          type: 'gte',
          value: 0.5,
        }),
      ).toBe(true);
    });

    it('should accept valid lt filter', () => {
      expect(
        constraint.validate({
          key: 'count',
          type: 'lt',
          value: 100,
        }),
      ).toBe(true);
    });

    it('should accept valid lte filter', () => {
      expect(
        constraint.validate({
          key: 'size',
          type: 'lte',
          value: 1024,
        }),
      ).toBe(true);
    });

    it('should accept filter with boolean value', () => {
      expect(
        constraint.validate({
          key: 'active',
          type: 'eq',
          value: true,
        }),
      ).toBe(true);
    });

    it('should accept filter with array of strings', () => {
      expect(
        constraint.validate({
          key: 'tags',
          type: 'eq',
          value: ['tag1', 'tag2'],
        }),
      ).toBe(true);
    });

    it('should accept filter with array of numbers', () => {
      expect(
        constraint.validate({
          key: 'ids',
          type: 'eq',
          value: [1, 2, 3],
        }),
      ).toBe(true);
    });
  });

  describe('comparison filter - invalid cases', () => {
    it('should reject missing key field', () => {
      expect(
        constraint.validate({
          type: 'eq',
          value: 'documentation',
        }),
      ).toBe(false);
    });

    it('should reject missing value field', () => {
      expect(
        constraint.validate({
          key: 'category',
          type: 'eq',
        }),
      ).toBe(false);
    });

    it('should reject empty key', () => {
      expect(
        constraint.validate({
          key: '',
          type: 'eq',
          value: 'documentation',
        }),
      ).toBe(false);
    });

    it('should reject non-string key', () => {
      expect(
        constraint.validate({
          key: 123,
          type: 'eq',
          value: 'documentation',
        }),
      ).toBe(false);
    });

    it('should reject invalid operator', () => {
      expect(
        constraint.validate({
          key: 'category',
          type: 'equals',
          value: 'docs',
        }),
      ).toBe(false);
    });

    it('should reject unsupported operator', () => {
      expect(
        constraint.validate({
          key: 'tags',
          type: 'in',
          value: ['tag1', 'tag2'],
        }),
      ).toBe(false);
    });

    it('should reject object value', () => {
      expect(
        constraint.validate({
          key: 'category',
          type: 'eq',
          value: { nested: 'object' },
        }),
      ).toBe(false);
    });

    it('should reject null value', () => {
      expect(
        constraint.validate({
          key: 'category',
          type: 'eq',
          value: null,
        }),
      ).toBe(false);
    });

    it('should reject undefined value', () => {
      expect(
        constraint.validate({
          key: 'category',
          type: 'eq',
          value: undefined,
        }),
      ).toBe(false);
    });

    it('should reject empty array value', () => {
      expect(
        constraint.validate({
          key: 'tags',
          type: 'eq',
          value: [],
        }),
      ).toBe(false);
    });

    it('should reject array with non-primitive values', () => {
      expect(
        constraint.validate({
          key: 'data',
          type: 'eq',
          value: [{ nested: 'object' }],
        }),
      ).toBe(false);
    });

    it('should reject array with mixed types including objects', () => {
      expect(
        constraint.validate({
          key: 'data',
          type: 'eq',
          value: ['string', 123, { nested: 'object' }],
        }),
      ).toBe(false);
    });
  });

  describe('compound filter - valid cases', () => {
    it('should accept valid and filter', () => {
      expect(
        constraint.validate({
          type: 'and',
          filters: [
            { key: 'category', type: 'eq', value: 'docs' },
            { key: 'year', type: 'gte', value: 2024 },
          ],
        }),
      ).toBe(true);
    });

    it('should accept valid or filter', () => {
      expect(
        constraint.validate({
          type: 'or',
          filters: [
            { key: 'priority', type: 'eq', value: 'high' },
            { key: 'urgent', type: 'eq', value: true },
          ],
        }),
      ).toBe(true);
    });

    it('should accept nested compound filters', () => {
      expect(
        constraint.validate({
          type: 'and',
          filters: [
            { key: 'category', type: 'eq', value: 'docs' },
            {
              type: 'or',
              filters: [
                { key: 'lang', type: 'eq', value: 'en' },
                { key: 'lang', type: 'eq', value: 'es' },
              ],
            },
          ],
        }),
      ).toBe(true);
    });

    it('should accept deeply nested compound filters', () => {
      expect(
        constraint.validate({
          type: 'and',
          filters: [
            { key: 'active', type: 'eq', value: true },
            {
              type: 'or',
              filters: [
                {
                  type: 'and',
                  filters: [
                    { key: 'category', type: 'eq', value: 'docs' },
                    { key: 'year', type: 'gte', value: 2024 },
                  ],
                },
                { key: 'featured', type: 'eq', value: true },
              ],
            },
          ],
        }),
      ).toBe(true);
    });

    it('should accept compound filter with single filter', () => {
      expect(
        constraint.validate({
          type: 'and',
          filters: [{ key: 'category', type: 'eq', value: 'docs' }],
        }),
      ).toBe(true);
    });

    it('should accept compound filter with many filters', () => {
      expect(
        constraint.validate({
          type: 'and',
          filters: [
            { key: 'a', type: 'eq', value: '1' },
            { key: 'b', type: 'eq', value: '2' },
            { key: 'c', type: 'eq', value: '3' },
            { key: 'd', type: 'eq', value: '4' },
            { key: 'e', type: 'eq', value: '5' },
          ],
        }),
      ).toBe(true);
    });
  });

  describe('compound filter - invalid cases', () => {
    it('should reject compound filter without filters field', () => {
      expect(
        constraint.validate({
          type: 'and',
        }),
      ).toBe(false);
    });

    it('should reject compound filter with non-array filters', () => {
      expect(
        constraint.validate({
          type: 'and',
          filters: 'not an array',
        }),
      ).toBe(false);
    });

    it('should reject compound filter with empty filters array', () => {
      expect(
        constraint.validate({
          type: 'and',
          filters: [],
        }),
      ).toBe(false);
    });

    it('should reject compound filter with invalid nested filter', () => {
      expect(
        constraint.validate({
          type: 'and',
          filters: [
            { key: 'category', type: 'eq', value: 'docs' },
            { key: 'invalid' }, // Missing type and value
          ],
        }),
      ).toBe(false);
    });

    it('should reject invalid compound type', () => {
      expect(
        constraint.validate({
          type: 'not',
          filters: [{ key: 'category', type: 'eq', value: 'docs' }],
        }),
      ).toBe(false);
    });

    it('should reject compound filter with mixed valid and invalid filters', () => {
      expect(
        constraint.validate({
          type: 'or',
          filters: [
            { key: 'valid', type: 'eq', value: 'docs' },
            { key: 'invalid', type: 'invalid_op', value: 'data' },
          ],
        }),
      ).toBe(false);
    });
  });

  describe('defaultMessage', () => {
    it('should return descriptive error message', () => {
      const message = constraint.defaultMessage();
      expect(message).toContain('search filter');
      expect(message).toContain('ComparisonFilter');
      expect(message).toContain('CompoundFilter');
      expect(message).toContain('and');
      expect(message).toContain('or');
    });
  });
});
