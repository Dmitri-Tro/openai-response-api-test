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

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly loggerService: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const startTime = Date.now();

    // Extract API type from URL
    const url: string = request.url;
    let api: 'responses' | 'images' | 'videos' = 'responses';
    if (url.includes('/images')) {
      api = 'images';
    } else if (url.includes('/videos')) {
      api = 'videos';
    }

    const requestBody = request.body as Record<string, unknown>;

    return next.handle().pipe(
      tap((response: unknown) => {
        const latency = Date.now() - startTime;
        const openAIResponse = response as OpenAIResponse;

        // Log the successful interaction
        this.loggerService.logOpenAIInteraction({
          timestamp: new Date().toISOString(),
          api,
          endpoint: url,
          request: requestBody,
          response,
          metadata: {
            latency_ms: latency,
            tokens_used: openAIResponse.usage?.total_tokens,
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

  private estimateCost(response: OpenAIResponse): number {
    // Rough cost estimation based on token usage
    // These are approximate rates for GPT-4 models
    if (!response.usage) return 0;

    const inputTokens = response.usage.prompt_tokens || 0;
    const outputTokens = response.usage.completion_tokens || 0;

    // GPT-4 approximate pricing per 1K tokens
    const inputCostPer1K = 0.03;
    const outputCostPer1K = 0.06;

    return (
      (inputTokens / 1000) * inputCostPer1K +
      (outputTokens / 1000) * outputCostPer1K
    );
  }
}
