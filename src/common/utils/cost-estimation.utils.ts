/**
 * Cost estimation utilities for OpenAI services
 *
 * Centralizes pricing logic to ensure consistency across the application.
 * Pricing data should be updated when OpenAI announces price changes.
 *
 * @see {@link https://openai.com/api/pricing/}
 */

export interface CostEstimate {
  model: string;
  pricing_tier: string;
  quantity: number;
  unit_type: 'characters' | 'tokens' | 'minutes' | 'images' | 'videos';
  cost_usd: number;
  pricing_url: 'https://openai.com/api/pricing/';
  last_verified: string;
}

/**
 * Create a standardized cost estimate object
 */
export function createCostEstimate(
  model: string,
  pricingTier: string,
  quantity: number,
  unitType: CostEstimate['unit_type'],
  costUsd: number,
): CostEstimate {
  return {
    model,
    pricing_tier: pricingTier,
    quantity,
    unit_type: unitType,
    cost_usd: Number(costUsd.toFixed(6)), // Precision to 6 decimal places
    pricing_url: 'https://openai.com/api/pricing/',
    last_verified: 'January 2025',
  };
}

/**
 * Calculate image generation cost
 */
export function calculateImageCost(
  model: string,
  size: string,
  quality: string = 'standard',
  n: number = 1,
): number {
  let costPerImage = 0;

  if (model === 'dall-e-3') {
    if (quality === 'hd') {
      if (size === '1024x1024') {
        costPerImage = 0.08;
      } else if (size === '1792x1024' || size === '1024x1792') {
        costPerImage = 0.12;
      } else {
        costPerImage = 0.08; // Default HD
      }
    } else {
      costPerImage = 0.04; // Standard
    }
  } else if (model === 'dall-e-2') {
    if (size === '1024x1024') {
      costPerImage = 0.02;
    } else if (size === '512x512') {
      costPerImage = 0.018;
    } else if (size === '256x256') {
      costPerImage = 0.016;
    } else {
      costPerImage = 0.02; // Default
    }
  } else if (model === 'gpt-image-1') {
    costPerImage = 0.02; // Flat rate
  } else {
    costPerImage = 0.02; // Fallback
  }

  return costPerImage * n;
}

/**
 * Calculate video generation cost
 */
export function calculateVideoCost(
  model: string,
  durationSeconds: number,
): number {
  // Estimated pricing (subject to change)
  const pricePerSecond = model === 'sora-2-pro' ? 0.4 : 0.125;
  return pricePerSecond * durationSeconds;
}

/**
 * Calculate speech (TTS) cost
 */
export function calculateSpeechCost(model: string, characters: number): number {
  const pricePer1k = model === 'tts-1-hd' ? 0.03 : 0.015;
  return (characters / 1000) * pricePer1k;
}

/**
 * Calculate transcription cost
 */
export function calculateTranscriptionCost(
  model: string,
  durationSeconds: number,
  usage?: { input_tokens?: number; output_tokens?: number },
): number {
  // Whisper-1 is $0.006 per minute
  if (model === 'whisper-1') {
    return (durationSeconds / 60) * 0.006;
  }

  // Token-based models (gpt-4o-transcribe)
  if (usage) {
    // Placeholder: actual token pricing varies by model
    // Using gpt-4o-audio-preview pricing as reference
    const inputCost = 0.00001; // $0.01 per 1K input tokens
    const outputCost = 0.00003; // $0.03 per 1K output tokens

    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;

    return inputTokens * inputCost + outputTokens * outputCost;
  }

  return 0.01;
}
