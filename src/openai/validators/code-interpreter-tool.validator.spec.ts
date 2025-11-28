import { IsCodeInterpreterToolConstraint } from './code-interpreter-tool.validator';

describe('IsCodeInterpreterToolConstraint', () => {
  let constraint: IsCodeInterpreterToolConstraint;

  beforeEach(() => {
    constraint = new IsCodeInterpreterToolConstraint();
  });

  describe('basic tool validation', () => {
    it('should accept code_interpreter without container', () => {
      const tools = [
        {
          type: 'code_interpreter',
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should accept code_interpreter with valid container', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: 'auto',
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should ignore non-code_interpreter tools', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: ['vs_abc123'],
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should handle non-array input', () => {
      const tools = 'not an array';
      expect(constraint.validate(tools)).toBe(true); // Let @IsArray handle
    });

    it('should handle null input', () => {
      const tools = null;
      expect(constraint.validate(tools)).toBe(true); // Let @IsArray handle
    });

    it('should handle undefined input', () => {
      const tools = undefined;
      expect(constraint.validate(tools)).toBe(true); // Let @IsArray handle
    });

    it('should handle empty array', () => {
      const tools: unknown[] = [];
      expect(constraint.validate(tools)).toBe(true);
    });
  });

  describe('container.type validation', () => {
    it('should accept container.type = "auto"', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: 'auto',
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should reject container.type = "manual"', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: 'manual',
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject container.type = "persistent"', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: 'persistent',
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject container.type = empty string', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: '',
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject container without type field', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {},
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject container.type = null', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: null,
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject container.type = undefined', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: undefined,
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject container.type = number', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: 123,
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject container.type = object', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: {},
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject container.type = array', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: [],
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });
  });

  describe('container structure validation', () => {
    it('should reject null container', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: null,
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should accept string container (container ID)', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: 'container_abc123xyz789',
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should accept container ID with proper prefix', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: 'container_def456uvw012',
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should reject empty string container', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: '',
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject array container', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: ['auto'],
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject number container', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: 123,
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should accept undefined container (optional)', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: undefined,
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });
  });

  describe('file_ids validation', () => {
    it('should accept single valid file_id', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: 'auto',
            file_ids: ['file-abc123xyz789012345678901'],
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should accept multiple valid file_ids', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: 'auto',
            file_ids: [
              'file-abc123xyz789012345678901',
              'file-def456uvw345678901234567',
              'file-ghi789rst901234567890123',
            ],
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should accept file_ids with exactly 24 characters after prefix', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: 'auto',
            file_ids: ['file-123456789012345678901234'], // "file-" + 24 chars
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should accept file_ids with more than 24 characters (OpenAI may vary)', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: 'auto',
            file_ids: ['file-abcdefghijklmnopqrstuvwxyz1234567890'], // Longer
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should accept file_ids with alphanumeric characters', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: 'auto',
            file_ids: ['file-aBcDeF123456XyZ0987654321'],
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should reject empty file_ids array', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: 'auto',
            file_ids: [],
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject file_ids not starting with "file-"', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: 'auto',
            file_ids: ['abc123xyz789012345678901'],
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject file_ids with wrong prefix', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: 'auto',
            file_ids: ['vs_abc123xyz789012345678901'], // Wrong prefix
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject file_ids with "files-" prefix', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: 'auto',
            file_ids: ['files-abc123xyz789012345678901'], // Plural, wrong
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject non-string file_ids', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: 'auto',
            file_ids: [123, 456],
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject file_ids with objects', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: 'auto',
            file_ids: [{ id: 'file-abc123' }],
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject mixed valid and invalid file_ids', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: 'auto',
            file_ids: ['file-abc123xyz789012345678901', 'invalid'],
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject non-array file_ids', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: 'auto',
            file_ids: 'file-abc123xyz789012345678901', // String instead of array
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject null file_ids', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: 'auto',
            file_ids: null,
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should accept undefined file_ids (optional)', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: 'auto',
            file_ids: undefined,
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should accept container without file_ids field (optional)', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: 'auto',
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });
  });

  describe('integration with other tools', () => {
    it('should validate mixed tool array (code_interpreter + file_search)', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: { type: 'auto' },
        },
        {
          type: 'file_search',
          vector_store_ids: ['vs_abc123'],
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should validate mixed tool array (code_interpreter + web_search)', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: 'auto',
            file_ids: ['file-abc123xyz789012345678901'],
          },
        },
        {
          type: 'web_search',
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should validate mixed tool array (code_interpreter + function)', () => {
      const tools = [
        {
          type: 'code_interpreter',
        },
        {
          type: 'function',
          function: {
            name: 'get_weather',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string' },
              },
            },
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should validate all tools together', () => {
      const tools = [
        { type: 'code_interpreter', container: { type: 'auto' } },
        { type: 'file_search', vector_store_ids: ['vs_abc123'] },
        { type: 'web_search' },
        {
          type: 'function',
          function: {
            name: 'calculate',
            parameters: { type: 'object' },
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should fail if code_interpreter has invalid container', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: { type: 'invalid' }, // Invalid
        },
        {
          type: 'web_search', // Valid tool
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should validate multiple code_interpreter tools', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: 'auto',
            file_ids: ['file-abc123xyz789012345678901'],
          },
        },
        {
          type: 'code_interpreter',
          container: {
            type: 'auto',
            file_ids: ['file-def456uvw345678901234567'],
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle tool with null type', () => {
      const tools = [
        {
          type: null,
          container: { type: 'auto' },
        },
      ];
      expect(constraint.validate(tools)).toBe(true); // Ignores non-code_interpreter
    });

    it('should handle tool with undefined type', () => {
      const tools = [
        {
          type: undefined,
          container: { type: 'auto' },
        },
      ];
      expect(constraint.validate(tools)).toBe(true); // Ignores non-code_interpreter
    });

    it('should handle tool without type field', () => {
      const tools = [
        {
          container: { type: 'auto' },
        },
      ];
      expect(constraint.validate(tools)).toBe(true); // Ignores non-code_interpreter
    });

    it('should handle null tool in array', () => {
      const tools = [null];
      expect(constraint.validate(tools)).toBe(true); // Ignores null
    });

    it('should handle undefined tool in array', () => {
      const tools = [undefined];
      expect(constraint.validate(tools)).toBe(true); // Ignores undefined
    });

    it('should handle string in tools array', () => {
      const tools = ['not an object'];
      expect(constraint.validate(tools)).toBe(true); // Ignores non-objects
    });

    it('should handle number in tools array', () => {
      const tools = [123];
      expect(constraint.validate(tools)).toBe(true); // Ignores non-objects
    });

    it('should handle mixed valid and invalid tools', () => {
      const tools = [
        null,
        { type: 'code_interpreter', container: { type: 'auto' } },
        undefined,
        { type: 'web_search' },
        'string',
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should reject if any code_interpreter is invalid', () => {
      const tools = [
        { type: 'code_interpreter', container: { type: 'auto' } }, // Valid
        { type: 'code_interpreter', container: { type: 'manual' } }, // Invalid
      ];
      expect(constraint.validate(tools)).toBe(false);
    });
  });

  describe('defaultMessage', () => {
    it('should return helpful error message', () => {
      const message = constraint.defaultMessage();
      expect(message).toContain('code_interpreter');
      expect(message).toContain('container');
      expect(message).toContain('auto');
      expect(message).toContain('file_ids');
      expect(message).toContain('file-');
    });
  });

  describe('complex scenarios', () => {
    it('should accept code_interpreter with all valid optional fields', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: 'auto',
            file_ids: [
              'file-abc123xyz789012345678901',
              'file-def456uvw345678901234567',
              'file-ghi789rst901234567890123',
            ],
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should accept minimal code_interpreter configuration', () => {
      const tools = [
        {
          type: 'code_interpreter',
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should reject code_interpreter with invalid container and valid file_ids', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: 'manual', // Invalid
            file_ids: ['file-abc123xyz789012345678901'], // Valid
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject code_interpreter with valid container and invalid file_ids', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: 'auto', // Valid
            file_ids: ['invalid-id'], // Invalid
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should handle deeply nested invalid structures', () => {
      const tools = [
        {
          type: 'code_interpreter',
          container: {
            type: 'auto',
            file_ids: [
              'file-valid123xyz789012345678',
              {
                // Nested object instead of string
                id: 'file-nested',
              },
            ],
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });
  });
});
