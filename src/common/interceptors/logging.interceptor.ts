import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { LoggerService } from '../services/logger.service';
import { PricingService } from '../services/pricing.service';
import type { Request } from 'express';

interface OpenAIResponse {
  model?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    input_tokens_details?: {
      cached_tokens?: number;
    };
    output_tokens_details?: {
      reasoning_tokens?: number;
    };
    // Legacy field names (for compatibility)
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

interface VideoResponse {
  id?: string;
  status?: 'queued' | 'in_progress' | 'completed' | 'failed';
  progress?: number;
  model?: string;
  seconds?: string;
  size?: string;
  created_at?: number;
  completed_at?: number | null;
  expires_at?: number | null;
  remixed_from_video_id?: string | null;
  error?: {
    code?: string;
    message?: string;
  } | null;
}

interface ErrorWithStatus {
  message: string;
  status?: number;
  response?: unknown;
  stack?: string;
}

/**
 * Logging interceptor for OpenAI API interactions
 *
 * This NestJS interceptor provides comprehensive logging for all OpenAI API requests
 * and responses, creating a complete audit trail of interactions. Logs are written to
 * date-organized files in JSON format for easy analysis and debugging.
 *
 * **Request Flow:**
 * 1. Intercepts HTTP request before it reaches the controller
 * 2. Records start time for latency calculation
 * 3. Detects API type from URL (responses/images/videos)
 * 4. Detects streaming mode from URL (/stream endpoints)
 * 5. Executes the request handler
 * 6. On success: Logs request, response, latency, tokens, cost estimate
 * 7. On error: Logs request, error details, latency
 *
 * **Logging Behavior:**
 * - **Non-streaming endpoints**: Logs complete request/response after completion
 * - **Streaming endpoints**: Skips logging (delegated to service layer for event-by-event logging)
 * - **Errors**: Logs all failed requests with error details and stack traces
 *
 * **Log File Organization:**
 * - Location: `logs/YYYY-MM-DD/{api}.log`
 * - Format: JSON with timestamp, api, endpoint, request, response, metadata
 * - Rotation: Daily based on date
 *
 * **Logged Metadata:**
 * - `latency_ms` - Request duration in milliseconds
 * - `tokens_used` - Total tokens consumed (input + output)
 * - `cost_estimate` - Estimated cost in USD based on GPT-5 pricing
 *
 * **Cost Estimation:**
 * Uses PricingService for accurate multi-model cost estimation:
 * - Supports 6 models: gpt-4o, gpt-4o-mini, o1, o3-mini, gpt-5, gpt-image-1
 * - Handles all token types: input, output, reasoning, cached
 * - Pricing updated as of January 2025
 *
 * **Usage:**
 * Applied globally or per-controller using `@UseInterceptors(LoggingInterceptor)`.
 * Automatically registered for all OpenAI endpoints in the application.
 *
 * **Dependencies:**
 * - LoggerService - Handles file writing and log formatting
 * - PricingService - Provides multi-model cost estimation
 * - RxJS operators - tap() for success logging, catchError() for error logging
 *
 * @see {@link LoggerService}
 * @see {@link PricingService}
 * @see {@link https://docs.nestjs.com/interceptors}
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly loggerService: LoggerService,
    private readonly pricingService: PricingService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const startTime = Date.now();

    // Extract API type from URL (with null safety)
    const url: string = request.url || '/unknown';
    let api: 'responses' | 'images' | 'videos' = 'responses';
    if (url.includes('/images')) {
      api = 'images';
    } else if (url.includes('/videos')) {
      api = 'videos';
    }

    // Check if this is a streaming endpoint
    const isStreaming = url.includes('/stream');

    const requestBody = (request.body as Record<string, unknown>) || {};

    return next.handle().pipe(
      tap((response: unknown) => {
        // Skip logging for streaming endpoints (service handles it)
        if (isStreaming) {
          return;
        }

        const latency = Date.now() - startTime;
        const openAIResponse = (response as OpenAIResponse) || {};

        // Build metadata based on API type
        const baseMetadata: Record<string, unknown> = {
          latency_ms: latency,
        };

        // Add video-specific metadata if this is a Videos API call
        if (api === 'videos') {
          const videoMetadata = this.extractVideoMetadata(
            response as VideoResponse,
          );
          Object.assign(baseMetadata, videoMetadata);
        } else {
          // Add token/cost metadata for Responses/Images APIs
          baseMetadata.tokens_used = openAIResponse?.usage?.total_tokens;
          baseMetadata.cost_estimate = this.estimateCost(
            openAIResponse,
            requestBody,
          );
        }

        // Log the successful interaction
        this.loggerService.logOpenAIInteraction({
          timestamp: new Date().toISOString(),
          api,
          endpoint: url,
          request: requestBody,
          response,
          metadata: baseMetadata,
        });
      }),
      catchError((error: unknown) => {
        const latency = Date.now() - startTime;
        const errorWithStatus = error as ErrorWithStatus;

        // Extract response data if it exists
        let responseData: unknown = errorWithStatus.response;
        if (
          typeof errorWithStatus.response === 'object' &&
          errorWithStatus.response !== null &&
          'data' in errorWithStatus.response
        ) {
          responseData = (errorWithStatus.response as { data: unknown }).data;
        }

        // Log the failed interaction
        this.loggerService.logOpenAIInteraction({
          timestamp: new Date().toISOString(),
          api,
          endpoint: url,
          request: requestBody,
          error: {
            message: errorWithStatus.message || 'Unknown error',
            status: errorWithStatus.status,
            response: responseData,
            stack: errorWithStatus.stack,
          },
          metadata: {
            latency_ms: latency,
          },
        });

        return throwError(() => error);
      }),
    );
  }

  /**
   * Estimate cost using PricingService
   *
   * Supports all token types and multiple models. Falls back to gpt-4o if model
   * is not specified or not found.
   *
   * @param response - OpenAI API response with usage data
   * @param requestBody - Request body to extract model from
   * @returns Estimated cost in USD
   */
  private estimateCost(
    response: OpenAIResponse | null | undefined,
    requestBody: Record<string, unknown>,
  ): number {
    if (!response || !response.usage) return 0;

    // Extract model from response (preferred) or request body
    const model = response.model || (requestBody.model as string) || 'gpt-4o';

    // Normalize usage fields (handle both new and legacy field names)
    const usage = {
      input_tokens:
        response.usage.input_tokens || response.usage.prompt_tokens || 0,
      output_tokens:
        response.usage.output_tokens || response.usage.completion_tokens || 0,
      total_tokens: response.usage.total_tokens,
      input_tokens_details: response.usage.input_tokens_details,
      output_tokens_details: response.usage.output_tokens_details,
    };

    return this.pricingService.calculateCost(usage, model);
  }

  /**
   * Extract video-specific metadata from Videos API response
   *
   * Extracts relevant fields from a Videos.Video object for logging purposes.
   * Returns only the fields that provide value for logging and debugging.
   *
   * @param response - Videos API response object
   * @returns Metadata object with video-specific fields
   */
  private extractVideoMetadata(
    response: VideoResponse | null | undefined,
  ): Record<string, unknown> {
    if (!response) return {};

    const metadata: Record<string, unknown> = {};

    // Core video identification
    if (response.id) metadata.video_id = response.id;
    if (response.model) metadata.model = response.model;

    // Video generation status
    if (response.status) metadata.status = response.status;
    if (typeof response.progress === 'number')
      metadata.progress_percentage = response.progress;

    // Video parameters
    if (response.seconds) metadata.seconds = response.seconds;
    if (response.size) metadata.size = response.size;

    // Timestamps (convert Unix seconds to ISO if needed for consistency)
    if (response.created_at) metadata.created_at = response.created_at;
    if (response.completed_at) metadata.completed_at = response.completed_at;
    if (response.expires_at) metadata.expires_at = response.expires_at;

    // Calculate timing metrics if completed
    if (
      response.status === 'completed' &&
      response.created_at &&
      response.completed_at
    ) {
      const generationTimeSeconds = response.completed_at - response.created_at;
      metadata.generation_time_ms = generationTimeSeconds * 1000;
    }

    // Remix information
    if (response.remixed_from_video_id) {
      metadata.remixed_from_video_id = response.remixed_from_video_id;
    }

    // Error information (if generation failed)
    if (response.status === 'failed' && response.error) {
      metadata.error_code = response.error.code;
      metadata.error_message = response.error.message;
    }

    return metadata;
  }
}
