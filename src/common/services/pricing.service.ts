import { Injectable } from '@nestjs/common';

/**
 * Pricing structure for a specific model
 */
export interface ModelPricing {
  /** Price per 1M input tokens in USD */
  input: number;
  /** Price per 1M output tokens in USD */
  output: number;
  /** Price per 1M reasoning tokens in USD (o-series models) */
  reasoning?: number;
  /** Price per 1M cached input tokens in USD (discounted) */
  cached?: number;
  /** Price per generated image in USD (image models) */
  image?: number;
}

/**
 * Token usage information matching OpenAI SDK ResponseUsage structure
 */
export interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  input_tokens_details?: {
    cached_tokens?: number;
  };
  output_tokens_details?: {
    reasoning_tokens?: number;
  };
}

/**
 * Centralized pricing service for OpenAI models
 *
 * Supports multiple models with different token types:
 * - Standard tokens: input, output
 * - Cached tokens: discounted input tokens (50% off)
 * - Reasoning tokens: o-series models (o1, o3, gpt-5)
 * - Image generation: gpt-image-1
 *
 * Pricing data as of January 2025.
 * Update MODEL_PRICING when OpenAI changes pricing.
 *
 * @see {@link https://openai.com/api/pricing/}
 */
@Injectable()
export class PricingService {
  /**
   * Model pricing data ($ per 1M tokens unless noted otherwise)
   * Updated: January 2025
   */
  private readonly MODEL_PRICING: Record<string, ModelPricing> = {
    'gpt-4o': {
      input: 0.0025, // $2.50 per 1M input tokens
      output: 0.01, // $10.00 per 1M output tokens
      cached: 0.00125, // $1.25 per 1M cached tokens (50% discount)
    },
    'gpt-4o-mini': {
      input: 0.00015, // $0.15 per 1M input tokens
      output: 0.0006, // $0.60 per 1M output tokens
      cached: 0.000075, // $0.075 per 1M cached tokens (50% discount)
    },
    o1: {
      input: 0.015, // $15.00 per 1M input tokens
      output: 0.06, // $60.00 per 1M output tokens
      reasoning: 0.06, // $60.00 per 1M reasoning tokens
      cached: 0.0075, // $7.50 per 1M cached tokens (50% discount)
    },
    'o3-mini': {
      input: 0.0011, // $1.10 per 1M input tokens
      output: 0.0044, // $4.40 per 1M output tokens
      reasoning: 0.0044, // $4.40 per 1M reasoning tokens
      cached: 0.00055, // $0.55 per 1M cached tokens (50% discount)
    },
    'gpt-5': {
      input: 0.00125, // $1.25 per 1M input tokens
      output: 0.01, // $10.00 per 1M output tokens
      reasoning: 0.01, // $10.00 per 1M reasoning tokens
      cached: 0.000625, // $0.625 per 1M cached tokens (50% discount)
    },
    'gpt-image-1': {
      input: 0.0025, // $2.50 per 1M input tokens
      output: 0.01, // $10.00 per 1M output tokens
      image: 0.04, // $0.04 per generated image
    },
  };

  /**
   * Get pricing information for a specific model
   *
   * @param model - Model name (e.g., 'gpt-4o', 'o1', 'gpt-image-1')
   * @returns ModelPricing object or null if model not found
   *
   * @example
   * const pricing = pricingService.getModelPricing('gpt-4o');
   * if (pricing) {
   *   console.log(`Input: $${pricing.input}/1M tokens`);
   *   console.log(`Output: $${pricing.output}/1M tokens`);
   *   if (pricing.cached) {
   *     console.log(`Cached: $${pricing.cached}/1M tokens`);
   *   }
   * }
   */
  getModelPricing(model: string): ModelPricing | null {
    return this.MODEL_PRICING[model] || null;
  }

  /**
   * Calculate cost based on token usage and model
   *
   * Supports all token types:
   * - input_tokens: Regular input tokens
   * - cached_input_tokens: Cached tokens (discounted)
   * - output_tokens: Generated output tokens
   * - reasoning_tokens: Reasoning tokens (o-series models)
   *
   * @param model - Model name
   * @param usage - Token usage information
   * @returns Estimated cost in USD
   *
   * @example
   * const cost = pricingService.calculateCost('gpt-4o', {
   *   input_tokens: 1000,
   *   output_tokens: 500,
   * });
   * console.log(`Cost: $${cost.toFixed(6)}`); // Cost: $0.000008
   */
  calculateCost(model: string, usage?: TokenUsage | null): number {
    const pricing = this.getModelPricing(model);
    if (!pricing || !usage) return 0;

    let cost = 0;

    // Input tokens (regular)
    if (usage.input_tokens !== undefined) {
      cost += (usage.input_tokens / 1_000_000) * pricing.input;
    }

    // Cached input tokens (discounted - typically 50% off)
    if (usage.input_tokens_details?.cached_tokens && pricing.cached) {
      cost +=
        (usage.input_tokens_details.cached_tokens / 1_000_000) * pricing.cached;
    }

    // Output tokens
    if (usage.output_tokens !== undefined) {
      cost += (usage.output_tokens / 1_000_000) * pricing.output;
    }

    // Reasoning tokens (o-series models: o1, o3-mini, gpt-5)
    if (usage.output_tokens_details?.reasoning_tokens && pricing.reasoning) {
      cost +=
        (usage.output_tokens_details.reasoning_tokens / 1_000_000) *
        pricing.reasoning;
    }

    return cost;
  }

  /**
   * Estimate cost from OpenAI Responses.Response usage field
   *
   * Convenience method with proper typing for Responses API.
   * Only uses fields that actually exist in the response data.
   *
   * @param model - Model name
   * @param usage - Usage field from Responses.Response (or any usage-like object)
   * @returns Estimated cost in USD
   *
   * @example
   * const response: Responses.Response = await client.responses.create({...});
   * const cost = pricingService.estimateCost(response.model, response.usage);
   * console.log(`Request cost: $${cost.toFixed(6)}`);
   */
  estimateCost(model: string, usage?: TokenUsage): number {
    if (!usage) return 0;
    return this.calculateCost(model, usage);
  }

  /**
   * Get all supported models
   *
   * @returns Array of model names
   */
  getSupportedModels(): string[] {
    return Object.keys(this.MODEL_PRICING);
  }

  /**
   * Check if a model is supported
   *
   * @param model - Model name to check
   * @returns true if model pricing is available
   */
  isModelSupported(model: string): boolean {
    return model in this.MODEL_PRICING;
  }
}
