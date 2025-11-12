import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { LoggerService } from '../services/logger.service';
import type { Request } from 'express';

interface OpenAIResponse {
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
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
 * Uses GPT-5 pricing model (as of August 2025):
 * - Input tokens: $1.25 per 1M tokens
 * - Output tokens: $10 per 1M tokens
 *
 * **Usage:**
 * Applied globally or per-controller using `@UseInterceptors(LoggingInterceptor)`.
 * Automatically registered for all OpenAI endpoints in the application.
 *
 * **Dependencies:**
 * - LoggerService - Handles file writing and log formatting
 * - RxJS operators - tap() for success logging, catchError() for error logging
 *
 * @see {@link LoggerService}
 * @see {@link https://docs.nestjs.com/interceptors}
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly loggerService: LoggerService) {}

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

        // Log the successful interaction
        this.loggerService.logOpenAIInteraction({
          timestamp: new Date().toISOString(),
          api,
          endpoint: url,
          request: requestBody,
          response,
          metadata: {
            latency_ms: latency,
            tokens_used: openAIResponse?.usage?.total_tokens,
            cost_estimate: this.estimateCost(openAIResponse),
          },
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

  private estimateCost(response: OpenAIResponse | null | undefined): number {
    // Rough cost estimation based on token usage
    // These are rates for GPT-5 model (as of August 2025)
    if (!response || !response.usage) return 0;

    const inputTokens = response.usage.prompt_tokens || 0;
    const outputTokens = response.usage.completion_tokens || 0;

    // GPT-5 pricing: $1.25/1M input tokens, $10/1M output tokens
    const inputCostPer1K = 0.00125;
    const outputCostPer1K = 0.01;

    return (
      (inputTokens / 1000) * inputCostPer1K +
      (outputTokens / 1000) * outputCostPer1K
    );
  }
}
