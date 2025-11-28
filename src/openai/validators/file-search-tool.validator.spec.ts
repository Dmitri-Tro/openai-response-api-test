import { IsFileSearchToolConstraint } from './file-search-tool.validator';

describe('IsFileSearchToolConstraint', () => {
  let constraint: IsFileSearchToolConstraint;

  beforeEach(() => {
    constraint = new IsFileSearchToolConstraint();
  });

  describe('vector_store_ids validation', () => {
    it('should accept valid vector store IDs', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: ['vs_abc123', 'vs_def456'],
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should accept single vector store ID', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: ['vs_abc123'],
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should reject non-array vector_store_ids', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: 'vs_abc123',
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject empty vector_store_ids array', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: [],
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject IDs not starting with "vs_"', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: ['abc123'],
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject IDs with wrong prefix', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: ['file_abc123'],
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject non-string IDs', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: [123, 456],
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject mixed valid and invalid IDs', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: ['vs_abc123', 'invalid'],
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject null vector_store_ids', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: null,
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject undefined vector_store_ids', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: undefined,
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });
  });

  describe('max_num_results validation', () => {
    it('should accept valid minimum value (1)', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: ['vs_abc123'],
          max_num_results: 1,
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should accept valid maximum value (50)', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: ['vs_abc123'],
          max_num_results: 50,
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should accept valid mid-range value', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: ['vs_abc123'],
          max_num_results: 25,
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should reject value below minimum (0)', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: ['vs_abc123'],
          max_num_results: 0,
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject negative values', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: ['vs_abc123'],
          max_num_results: -5,
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject value above maximum (51)', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: ['vs_abc123'],
          max_num_results: 51,
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject very large values (100)', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: ['vs_abc123'],
          max_num_results: 100,
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject non-numeric string values', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: ['vs_abc123'],
          max_num_results: '10',
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject null', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: ['vs_abc123'],
          max_num_results: null,
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject float values', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: ['vs_abc123'],
          max_num_results: 10.5,
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should accept undefined (optional parameter)', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: ['vs_abc123'],
          max_num_results: undefined,
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should accept when parameter is omitted', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: ['vs_abc123'],
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });
  });

  describe('ranking_options validation', () => {
    describe('ranker validation', () => {
      it('should accept "auto"', () => {
        const tools = [
          {
            type: 'file_search',
            vector_store_ids: ['vs_abc123'],
            ranking_options: {
              ranker: 'auto',
            },
          },
        ];
        expect(constraint.validate(tools)).toBe(true);
      });

      it('should accept "default-2024-11-15"', () => {
        const tools = [
          {
            type: 'file_search',
            vector_store_ids: ['vs_abc123'],
            ranking_options: {
              ranker: 'default-2024-11-15',
            },
          },
        ];
        expect(constraint.validate(tools)).toBe(true);
      });

      it('should reject invalid ranker value', () => {
        const tools = [
          {
            type: 'file_search',
            vector_store_ids: ['vs_abc123'],
            ranking_options: {
              ranker: 'custom',
            },
          },
        ];
        expect(constraint.validate(tools)).toBe(false);
      });

      it('should reject non-string ranker', () => {
        const tools = [
          {
            type: 'file_search',
            vector_store_ids: ['vs_abc123'],
            ranking_options: {
              ranker: 123,
            },
          },
        ];
        expect(constraint.validate(tools)).toBe(false);
      });

      it('should accept undefined ranker (optional)', () => {
        const tools = [
          {
            type: 'file_search',
            vector_store_ids: ['vs_abc123'],
            ranking_options: {
              ranker: undefined,
            },
          },
        ];
        expect(constraint.validate(tools)).toBe(true);
      });
    });

    describe('score_threshold validation', () => {
      it('should accept minimum value (0)', () => {
        const tools = [
          {
            type: 'file_search',
            vector_store_ids: ['vs_abc123'],
            ranking_options: {
              score_threshold: 0,
            },
          },
        ];
        expect(constraint.validate(tools)).toBe(true);
      });

      it('should accept maximum value (1)', () => {
        const tools = [
          {
            type: 'file_search',
            vector_store_ids: ['vs_abc123'],
            ranking_options: {
              score_threshold: 1,
            },
          },
        ];
        expect(constraint.validate(tools)).toBe(true);
      });

      it('should accept mid-range value (0.7)', () => {
        const tools = [
          {
            type: 'file_search',
            vector_store_ids: ['vs_abc123'],
            ranking_options: {
              score_threshold: 0.7,
            },
          },
        ];
        expect(constraint.validate(tools)).toBe(true);
      });

      it('should reject negative value', () => {
        const tools = [
          {
            type: 'file_search',
            vector_store_ids: ['vs_abc123'],
            ranking_options: {
              score_threshold: -0.1,
            },
          },
        ];
        expect(constraint.validate(tools)).toBe(false);
      });

      it('should reject value above 1', () => {
        const tools = [
          {
            type: 'file_search',
            vector_store_ids: ['vs_abc123'],
            ranking_options: {
              score_threshold: 1.5,
            },
          },
        ];
        expect(constraint.validate(tools)).toBe(false);
      });

      it('should reject non-numeric value', () => {
        const tools = [
          {
            type: 'file_search',
            vector_store_ids: ['vs_abc123'],
            ranking_options: {
              score_threshold: '0.7',
            },
          },
        ];
        expect(constraint.validate(tools)).toBe(false);
      });

      it('should accept undefined (optional)', () => {
        const tools = [
          {
            type: 'file_search',
            vector_store_ids: ['vs_abc123'],
            ranking_options: {
              score_threshold: undefined,
            },
          },
        ];
        expect(constraint.validate(tools)).toBe(true);
      });
    });

    it('should accept complete ranking_options', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: ['vs_abc123'],
          ranking_options: {
            ranker: 'auto',
            score_threshold: 0.7,
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should reject non-object ranking_options', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: ['vs_abc123'],
          ranking_options: 'invalid',
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should reject null ranking_options', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: ['vs_abc123'],
          ranking_options: null,
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should accept undefined ranking_options (optional)', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: ['vs_abc123'],
          ranking_options: undefined,
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should accept when ranking_options is omitted', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: ['vs_abc123'],
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });
  });

  describe('integration with other tool types', () => {
    it('should allow mixed tool arrays', () => {
      const tools = [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get weather',
            parameters: {},
          },
        },
        {
          type: 'file_search',
          vector_store_ids: ['vs_abc123'],
          max_num_results: 10,
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should validate only file_search tools', () => {
      const tools = [
        {
          type: 'function',
          function: {
            name: 'invalid_function',
            // Missing required fields, but should not be validated
          },
        },
        {
          type: 'file_search',
          vector_store_ids: ['vs_abc123'],
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should accept multiple file_search tools', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: ['vs_abc123'],
          max_num_results: 10,
        },
        {
          type: 'file_search',
          vector_store_ids: ['vs_def456'],
          max_num_results: 5,
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should reject if any file_search tool is invalid', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: ['vs_abc123'],
        },
        {
          type: 'file_search',
          vector_store_ids: [], // Invalid: empty array
        },
      ];
      expect(constraint.validate(tools)).toBe(false);
    });

    it('should ignore non-file_search tools in validation', () => {
      const tools = [
        {
          type: 'web_search',
          // Any configuration for web_search is allowed
        },
        {
          type: 'code_interpreter',
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should return true for non-array (handled by @IsArray)', () => {
      const tools = 'not an array';
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should accept empty tools array', () => {
      const tools: unknown[] = [];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should handle null tools', () => {
      const tools = null;
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should handle undefined tools', () => {
      const tools = undefined;
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should handle tools without type property', () => {
      const tools = [
        {
          some_field: 'value',
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });

    it('should accept complete valid configuration', () => {
      const tools = [
        {
          type: 'file_search',
          vector_store_ids: ['vs_abc123', 'vs_def456', 'vs_ghi789'],
          max_num_results: 25,
          ranking_options: {
            ranker: 'default-2024-11-15',
            score_threshold: 0.85,
          },
        },
      ];
      expect(constraint.validate(tools)).toBe(true);
    });
  });

  describe('defaultMessage', () => {
    it('should return detailed error message', () => {
      const message = constraint.defaultMessage();
      expect(message).toContain('Invalid file_search tool configuration');
      expect(message).toContain('vector_store_ids');
      expect(message).toContain('max_num_results');
      expect(message).toContain('ranking_options');
    });
  });
});
