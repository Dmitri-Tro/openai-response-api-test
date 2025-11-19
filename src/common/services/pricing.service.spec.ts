import {
  PricingService,
  type ModelPricing,
  type TokenUsage,
} from './pricing.service';

describe('PricingService', () => {
  let service: PricingService;

  beforeEach(() => {
    service = new PricingService();
  });

  describe('getModelPricing', () => {
    it('should return pricing for gpt-4o', () => {
      const pricing = service.getModelPricing('gpt-4o');
      expect(pricing).toEqual({
        input: 0.0025,
        output: 0.01,
        cached: 0.00125,
      });
    });

    it('should return pricing for gpt-4o-mini', () => {
      const pricing = service.getModelPricing('gpt-4o-mini');
      expect(pricing).toEqual({
        input: 0.00015,
        output: 0.0006,
        cached: 0.000075,
      });
    });

    it('should return pricing for o1', () => {
      const pricing = service.getModelPricing('o1');
      expect(pricing).toEqual({
        input: 0.015,
        output: 0.06,
        reasoning: 0.06,
        cached: 0.0075,
      });
    });

    it('should return pricing for o3-mini', () => {
      const pricing = service.getModelPricing('o3-mini');
      expect(pricing).toEqual({
        input: 0.0011,
        output: 0.0044,
        reasoning: 0.0044,
        cached: 0.00055,
      });
    });

    it('should return pricing for gpt-5', () => {
      const pricing = service.getModelPricing('gpt-5');
      expect(pricing).toEqual({
        input: 0.00125,
        output: 0.01,
        reasoning: 0.01,
        cached: 0.000625,
      });
    });

    it('should return pricing for gpt-image-1', () => {
      const pricing = service.getModelPricing('gpt-image-1');
      expect(pricing).toEqual({
        input: 0.0025,
        output: 0.01,
        image: 0.04,
      });
    });

    it('should return null for unknown model', () => {
      const pricing = service.getModelPricing('unknown-model');
      expect(pricing).toBeNull();
    });

    it('should return null for empty string', () => {
      const pricing = service.getModelPricing('');
      expect(pricing).toBeNull();
    });
  });

  describe('calculateCost', () => {
    describe('gpt-4o model', () => {
      it('should calculate cost for input tokens only', () => {
        const cost = service.calculateCost(
          { input_tokens: 1_000_000 },
          'gpt-4o',
        );
        expect(cost).toBeCloseTo(0.0025, 6);
      });

      it('should calculate cost for output tokens only', () => {
        const cost = service.calculateCost(
          { output_tokens: 1_000_000 },
          'gpt-4o',
        );
        expect(cost).toBeCloseTo(0.01, 6);
      });

      it('should calculate cost for input + output tokens', () => {
        const cost = service.calculateCost(
          { input_tokens: 1_000, output_tokens: 500 },
          'gpt-4o',
        );
        // (1000/1M * 0.0025) + (500/1M * 0.01) = 0.0000025 + 0.000005 = 0.0000075
        expect(cost).toBeCloseTo(0.0000075, 10);
      });

      it('should calculate cost with cached tokens', () => {
        const cost = service.calculateCost(
          {
            input_tokens: 1_000,
            input_tokens_details: {
              cached_tokens: 2_000,
            },
            output_tokens: 500,
          },
          'gpt-4o',
        );
        // (1000/1M * 0.0025) + (2000/1M * 0.00125) + (500/1M * 0.01)
        // = 0.0000025 + 0.0000025 + 0.000005 = 0.00001
        expect(cost).toBeCloseTo(0.00001, 10);
      });

      it('should handle large token counts', () => {
        const cost = service.calculateCost(
          { input_tokens: 100_000, output_tokens: 50_000 },
          'gpt-4o',
        );
        // (100000/1M * 0.0025) + (50000/1M * 0.01) = 0.00025 + 0.0005 = 0.00075
        expect(cost).toBeCloseTo(0.00075, 6);
      });
    });

    describe('o1 model (with reasoning)', () => {
      it('should calculate cost with reasoning tokens', () => {
        const cost = service.calculateCost(
          {
            input_tokens: 1_000,
            output_tokens: 500,
            output_tokens_details: {
              reasoning_tokens: 3_000,
            },
          },
          'o1',
        );
        // (1000/1M * 0.015) + (500/1M * 0.06) + (3000/1M * 0.06)
        // = 0.000015 + 0.00003 + 0.00018 = 0.000225
        expect(cost).toBeCloseTo(0.000225, 10);
      });

      it('should handle reasoning tokens with cached input', () => {
        const cost = service.calculateCost(
          {
            input_tokens: 1_000,
            input_tokens_details: {
              cached_tokens: 5_000,
            },
            output_tokens: 500,
            output_tokens_details: {
              reasoning_tokens: 2_000,
            },
          },
          'o1',
        );
        // (1000/1M * 0.015) + (5000/1M * 0.0075) + (500/1M * 0.06) + (2000/1M * 0.06)
        // = 0.000015 + 0.0000375 + 0.00003 + 0.00012 = 0.0002025
        expect(cost).toBeCloseTo(0.0002025, 10);
      });

      it('should ignore reasoning tokens if model does not support them', () => {
        const cost = service.calculateCost(
          {
            input_tokens: 1_000,
            output_tokens: 500,
            output_tokens_details: {
              reasoning_tokens: 3_000, // Should be ignored for gpt-4o
            },
          },
          'gpt-4o',
        );
        // Only input + output, reasoning ignored
        expect(cost).toBeCloseTo(0.0000075, 10);
      });
    });

    describe('o3-mini model', () => {
      it('should calculate cost for o3-mini with all token types', () => {
        const cost = service.calculateCost(
          {
            input_tokens: 10_000,
            input_tokens_details: {
              cached_tokens: 5_000,
            },
            output_tokens: 3_000,
            output_tokens_details: {
              reasoning_tokens: 7_000,
            },
          },
          'o3-mini',
        );
        // (10000/1M * 0.0011) + (5000/1M * 0.00055) + (3000/1M * 0.0044) + (7000/1M * 0.0044)
        // = 0.000011 + 0.00000275 + 0.0000132 + 0.0000308 = 0.00005775
        expect(cost).toBeCloseTo(0.00005775, 10);
      });
    });

    describe('gpt-5 model', () => {
      it('should calculate cost for gpt-5 with reasoning', () => {
        const cost = service.calculateCost(
          {
            input_tokens: 5_000,
            output_tokens: 2_000,
            output_tokens_details: {
              reasoning_tokens: 4_000,
            },
          },
          'gpt-5',
        );
        // (5000/1M * 0.00125) + (2000/1M * 0.01) + (4000/1M * 0.01)
        // = 0.00000625 + 0.00002 + 0.00004 = 0.00006625
        expect(cost).toBeCloseTo(0.00006625, 10);
      });
    });

    describe('edge cases', () => {
      it('should return 0 for unknown model', () => {
        const cost = service.calculateCost(
          { input_tokens: 1_000, output_tokens: 500 },
          'unknown-model',
        );
        expect(cost).toBe(0);
      });

      it('should return 0 for null usage', () => {
        const cost = service.calculateCost(null, 'gpt-4o');
        expect(cost).toBe(0);
      });

      it('should return 0 for undefined usage', () => {
        const cost = service.calculateCost(undefined, 'gpt-4o');
        expect(cost).toBe(0);
      });

      it('should return 0 for empty usage object', () => {
        const cost = service.calculateCost({}, 'gpt-4o');
        expect(cost).toBe(0);
      });

      it('should handle zero tokens', () => {
        const cost = service.calculateCost(
          { input_tokens: 0, output_tokens: 0 },
          'gpt-4o',
        );
        expect(cost).toBe(0);
      });

      it('should handle missing token fields', () => {
        const cost = service.calculateCost(
          { input_tokens: 1_000 }, // No output_tokens
          'gpt-4o',
        );
        expect(cost).toBeCloseTo(0.0000025, 10);
      });

      it('should handle only cached tokens', () => {
        const cost = service.calculateCost(
          {
            input_tokens_details: {
              cached_tokens: 10_000,
            },
          },
          'gpt-4o',
        );
        // 10000/1M * 0.00125 = 0.0000125
        expect(cost).toBeCloseTo(0.0000125, 10);
      });
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost from Responses.Response usage', () => {
      const usage = {
        input_tokens: 1_000,
        output_tokens: 500,
        total_tokens: 1_500,
      };
      const cost = service.estimateCost(usage, 'gpt-4o');
      expect(cost).toBeCloseTo(0.0000075, 10);
    });

    it('should handle usage with cached tokens', () => {
      const usage = {
        input_tokens: 1_000,
        input_tokens_details: {
          cached_tokens: 2_000,
        },
        output_tokens: 500,
        total_tokens: 3_500,
      };
      const cost = service.estimateCost(usage, 'gpt-4o');
      expect(cost).toBeCloseTo(0.00001, 10);
    });

    it('should handle usage with reasoning tokens', () => {
      const usage = {
        input_tokens: 1_000,
        output_tokens: 500,
        output_tokens_details: {
          reasoning_tokens: 3_000,
        },
        total_tokens: 4_500,
      };
      const cost = service.estimateCost(usage, 'o1');
      expect(cost).toBeCloseTo(0.000225, 10);
    });

    it('should return 0 for undefined usage', () => {
      const cost = service.estimateCost(undefined, 'gpt-4o');
      expect(cost).toBe(0);
    });

    it('should match calculateCost for same input', () => {
      const usage: TokenUsage = {
        input_tokens: 5_000,
        output_tokens: 2_000,
        input_tokens_details: {
          cached_tokens: 1_000,
        },
      };

      const costFromCalculate = service.calculateCost(usage, 'gpt-4o');
      const costFromEstimate = service.estimateCost(usage, 'gpt-4o');

      expect(costFromEstimate).toBeCloseTo(costFromCalculate, 10);
    });
  });

  describe('getSupportedModels', () => {
    it('should return all supported models', () => {
      const models = service.getSupportedModels();
      expect(models).toEqual([
        'gpt-4o',
        'gpt-4o-mini',
        'o1',
        'o3-mini',
        'gpt-5',
        'gpt-image-1',
      ]);
    });

    it('should return array with 6 models', () => {
      const models = service.getSupportedModels();
      expect(models).toHaveLength(6);
    });
  });

  describe('isModelSupported', () => {
    it('should return true for gpt-4o', () => {
      expect(service.isModelSupported('gpt-4o')).toBe(true);
    });

    it('should return true for all supported models', () => {
      const models = service.getSupportedModels();
      models.forEach((model) => {
        expect(service.isModelSupported(model)).toBe(true);
      });
    });

    it('should return false for unknown model', () => {
      expect(service.isModelSupported('unknown-model')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(service.isModelSupported('')).toBe(false);
    });

    it('should return false for gpt-4 (not supported)', () => {
      expect(service.isModelSupported('gpt-4')).toBe(false);
    });
  });

  describe('real-world scenarios', () => {
    it('should calculate cost for typical chat conversation (gpt-4o)', () => {
      // Typical chat: 500 input tokens, 200 output tokens
      const cost = service.calculateCost(
        { input_tokens: 500, output_tokens: 200 },
        'gpt-4o',
      );
      // (500/1M * 0.0025) + (200/1M * 0.01) = 0.00000125 + 0.000002 = 0.00000325
      expect(cost).toBeCloseTo(0.00000325, 10);
    });

    it('should calculate cost for long document analysis with caching (gpt-4o)', () => {
      // Long document: 50k cached, 1k new input, 5k output
      const cost = service.calculateCost(
        {
          input_tokens: 1_000,
          input_tokens_details: {
            cached_tokens: 50_000,
          },
          output_tokens: 5_000,
        },
        'gpt-4o',
      );
      // (1000/1M * 0.0025) + (50000/1M * 0.00125) + (5000/1M * 0.01)
      // = 0.0000025 + 0.0000625 + 0.00005 = 0.000115
      expect(cost).toBeCloseTo(0.000115, 10);
    });

    it('should calculate cost for complex reasoning task (o1)', () => {
      // Complex task: 2k input, 10k reasoning, 1k output
      const cost = service.calculateCost(
        {
          input_tokens: 2_000,
          output_tokens: 1_000,
          output_tokens_details: {
            reasoning_tokens: 10_000,
          },
        },
        'o1',
      );
      // (2000/1M * 0.015) + (10000/1M * 0.06) + (1000/1M * 0.06)
      // = 0.00003 + 0.0006 + 0.00006 = 0.00069
      expect(cost).toBeCloseTo(0.00069, 10);
    });

    it('should calculate cost for budget-friendly task (gpt-4o-mini)', () => {
      // Budget task: 10k input, 5k output
      const cost = service.calculateCost(
        { input_tokens: 10_000, output_tokens: 5_000 },
        'gpt-4o-mini',
      );
      // (10000/1M * 0.00015) + (5000/1M * 0.0006) = 0.0000015 + 0.000003 = 0.0000045
      expect(cost).toBeCloseTo(0.0000045, 10);
    });
  });
});
