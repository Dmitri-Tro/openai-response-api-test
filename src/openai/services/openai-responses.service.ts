import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { Responses } from 'openai/resources/responses';
import { LoggerService } from '../../common/services/logger.service';
import { CreateTextResponseDto } from '../dto/create-text-response.dto';

/**
 * Service for interacting with OpenAI Responses API (SDK 6.2+)
 * Uses client.responses.create() instead of chat.completions
 * Handles both text generation and image generation with gpt-image-1
 */
@Injectable()
export class OpenAIResponsesService {
  private client: OpenAI;
  private defaultModel: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly loggerService: LoggerService,
  ) {
    const apiKey = this.configService.get<string>('openai.apiKey');
    const baseURL = this.configService.get<string>('openai.baseUrl');
    this.defaultModel =
      this.configService.get<string>('openai.defaultModel') || 'gpt-4o';

    this.client = new OpenAI({
      apiKey,
      baseURL,
      timeout: this.configService.get<number>('openai.timeout'),
      maxRetries: this.configService.get<number>('openai.maxRetries'),
    });
  }

  /**
   * Create a non-streaming text response using Responses API (SDK 6.2+)
   * @param dto - Text generation parameters
   * @returns OpenAI Response object
   */
  async createTextResponse(
    dto: CreateTextResponseDto,
  ): Promise<Responses.Response> {
    const startTime = Date.now();

    try {
      // Build request parameters for Responses API
      const params: Responses.ResponseCreateParamsNonStreaming = {
        model: dto.model || this.defaultModel,
        input: dto.input,
        stream: false,
      };

      // Add instructions if provided (replaces system message)
      if (dto.instructions) {
        params.instructions = dto.instructions;
      }

      // Add tools if provided
      if (dto.tools) {
        params.tools = dto.tools;
      }

      // Add response format if provided (text parameter in Responses API)
      if (dto.response_format) {
        params.text =
          dto.response_format as Responses.ResponseCreateParamsNonStreaming['text'];
      }

      // Make the API call using Responses API
      const response: Responses.Response =
        await this.client.responses.create(params);

      const latency = Date.now() - startTime;

      // Extract usage information if available
      const usage = this.extractUsage(response);

      // Log the full native OpenAI response
      this.loggerService.logOpenAIInteraction({
        timestamp: new Date().toISOString(),
        api: 'responses',
        endpoint: '/v1/responses',
        request: params as Record<string, unknown>,
        response: response,
        metadata: {
          latency_ms: latency,
          tokens_used: usage?.total_tokens,
          cost_estimate: this.estimateCost(usage),
          rate_limit_headers: {},
        },
      });

      return response;
    } catch (error) {
      const latency = Date.now() - startTime;

      // Type guard for errors with message property
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Type-safe error handling
      const errorDetails: Record<string, unknown> = {
        message: errorMessage,
      };

      if (
        typeof error === 'object' &&
        error !== null &&
        'type' in error &&
        typeof (error as { type: unknown }).type === 'string'
      ) {
        errorDetails.type = (error as { type: string }).type;
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof (error as { code: unknown }).code === 'string'
      ) {
        errorDetails.code = (error as { code: string }).code;
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        typeof (error as { status: unknown }).status === 'number'
      ) {
        errorDetails.status = (error as { status: number }).status;
      }

      // Log the error
      this.loggerService.logOpenAIInteraction({
        timestamp: new Date().toISOString(),
        api: 'responses',
        endpoint: '/v1/responses',
        request: {
          model: dto.model || this.defaultModel,
          input: dto.input,
        },
        error: {
          ...errorDetails,
          message: errorMessage,
          original_error: error,
        },
        metadata: {
          latency_ms: latency,
        },
      });

      throw error;
    }
  }

  /**
   * Extract usage information from response
   * Responses API has ResponseUsage with input_tokens and output_tokens
   */
  private extractUsage(response: Responses.Response): {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null {
    if (response.usage) {
      return {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.total_tokens,
      };
    }
    return null;
  }

  /**
   * Estimate cost based on token usage
   * Uses approximate GPT-4 pricing
   */
  private estimateCost(
    usage: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    } | null,
  ): number {
    if (!usage) return 0;

    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;

    // GPT-4 approximate pricing per 1K tokens
    // These values should be updated based on actual model pricing
    const inputCostPer1K = 0.03;
    const outputCostPer1K = 0.06;

    return (
      (inputTokens / 1000) * inputCostPer1K +
      (outputTokens / 1000) * outputCostPer1K
    );
  }
}
