import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
} from '@nestjs/common';
import { Observable, throwError, timer, defer } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { LoggerService } from '../services/logger.service';

/**
 * Retry interceptor with exponential backoff for transient failures
 *
 * This NestJS interceptor provides automatic retry logic for OpenAI API calls that
 * fail due to transient errors. Uses exponential backoff with jitter to avoid
 * overwhelming the API during outages or rate limiting scenarios.
 *
 * **Retry Strategy:**
 * - **Max Retries**: 3 attempts (configurable via `maxRetries`)
 * - **Backoff Formula**: `min(maxDelay, baseDelay * 2^retryCount) + randomJitter`
 * - **Base Delay**: 1 second (1000ms)
 * - **Max Delay**: 10 seconds (10000ms)
 * - **Jitter**: Random 0-20% of delay to prevent thundering herd
 *
 * **Retry Decision Logic:**
 * Retries ONLY on transient errors:
 * - ✅ **Rate limits** (429 Too Many Requests)
 * - ✅ **Server errors** (500-599)
 * - ✅ **Network errors** (ECONNRESET, ETIMEDOUT, ECONNREFUSED, ENETUNREACH, ENOTFOUND)
 *
 * Does NOT retry on permanent errors:
 * - ❌ **Client errors** (400-499, except 429)
 * - ❌ **Authentication errors** (401, 403)
 * - ❌ **Validation errors** (422)
 *
 * **Exponential Backoff Example:**
 * - Retry 1: 1s + jitter (1000-1200ms)
 * - Retry 2: 2s + jitter (2000-2400ms)
 * - Retry 3: 4s + jitter (4000-4800ms)
 * - After 3 failures: Give up, propagate error
 *
 * **Logging:**
 * - Each retry attempt is logged with error details, status, and delay
 * - Final failure is logged after all retries exhausted
 * - Uses console.log for retry attempts, console.error for final failure
 *
 * **Request Flow:**
 * 1. Intercepts HTTP request before controller
 * 2. Executes request handler via `next.handle()`
 * 3. If error occurs: Checks if error is retryable
 * 4. If retryable: Calculates backoff delay and schedules retry
 * 5. If non-retryable: Immediately propagates error
 * 6. After max retries: Logs final failure and propagates error
 *
 * **Usage:**
 * Applied globally or per-controller using `@UseInterceptors(RetryInterceptor)`.
 * Should be applied BEFORE LoggingInterceptor to ensure retries are logged correctly.
 *
 * **Dependencies:**
 * - LoggerService - Used for structured logging (currently using console for simplicity)
 * - RxJS operators - retry() with delay function, catchError(), defer()
 *
 * **Best Practices:**
 * - Combine with circuit breaker pattern for production resilience
 * - Monitor retry rates to detect API degradation
 * - Adjust maxRetries and delays based on SLA requirements
 * - Use idempotency tokens to prevent duplicate operations
 *
 * @see {@link https://docs.nestjs.com/interceptors}
 * @see {@link https://platform.openai.com/docs/guides/error-codes}
 */
@Injectable()
export class RetryInterceptor implements NestInterceptor {
  private readonly maxRetries = 3;
  private readonly baseDelay = 1000; // 1 second
  private readonly maxDelay = 10000; // 10 seconds

  constructor(private readonly loggerService: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      url: string;
      method: string;
    }>();
    const endpoint = request.url;
    const method = request.method;

    return defer(() => next.handle()).pipe(
      retry({
        count: this.maxRetries,
        delay: (error: unknown, retryCount: number) => {
          // Only retry on transient errors
          if (!this.isRetryableError(error)) {
            // Throw error directly to stop retry chain immediately
            throw error;
          }

          // Calculate exponential backoff delay
          const delay = this.calculateBackoff(retryCount);

          // Log retry attempt
          this.logRetryAttempt(endpoint, method, error, retryCount, delay);

          // Return timer observable for delay
          return timer(delay);
        },
      }),
      catchError((error: unknown) => {
        // Log final failure after all retries exhausted
        this.logFinalFailure(endpoint, method, error);
        return throwError(() => error);
      }),
    );
  }

  /**
   * Determine if an error is retryable (transient)
   * Retries on: rate limits (429), server errors (5xx), network errors
   * Does not retry on: client errors (4xx except 429), authentication errors
   */
  private isRetryableError(error: unknown): boolean {
    // Check for HTTP exceptions
    if (error instanceof HttpException) {
      const status = error.getStatus();

      // Do NOT retry client errors (4xx) except rate limits
      if (status >= 400 && status < 500 && status !== 429) {
        return false;
      }

      // Retry on rate limit (429) and server errors (5xx)
      if (status === 429 || (status >= 500 && status < 600)) {
        return true;
      }

      return false;
    }

    // Check for error objects with status property
    if (this.hasErrorStatus(error)) {
      const status = error.status;

      // Do NOT retry client errors (4xx) except rate limits
      if (status >= 400 && status < 500 && status !== 429) {
        return false;
      }

      // Retry on rate limit (429) and server errors (5xx)
      if (status === 429 || (status >= 500 && status < 600)) {
        return true;
      }

      return false;
    }

    // Check for network errors (ECONNRESET, ETIMEDOUT, etc.)
    if (this.isNetworkError(error)) {
      return true;
    }

    // Default: do not retry
    return false;
  }

  /**
   * Calculate exponential backoff delay with jitter
   * Formula: min(maxDelay, baseDelay * 2^retryCount) + randomJitter
   */
  private calculateBackoff(retryCount: number): number {
    // Calculate exponential delay: baseDelay * 2^retryCount
    const exponentialDelay = this.baseDelay * Math.pow(2, retryCount);

    // Cap at maxDelay
    const cappedDelay = Math.min(exponentialDelay, this.maxDelay);

    // Add random jitter (0-20% of delay) to avoid thundering herd
    const jitter = Math.random() * 0.2 * cappedDelay;

    return Math.floor(cappedDelay + jitter);
  }

  /**
   * Log retry attempt with details
   */
  private logRetryAttempt(
    endpoint: string,
    method: string,
    error: unknown,
    retryCount: number,
    delay: number,
  ): void {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorStatus = this.hasErrorStatus(error) ? error.status : 'unknown';

    console.log(
      `[RetryInterceptor] Retry attempt ${retryCount}/${this.maxRetries} for ${method} ${endpoint}`,
      {
        error: errorMessage,
        status: errorStatus,
        delayMs: delay,
        timestamp: new Date().toISOString(),
      },
    );
  }

  /**
   * Log final failure after all retries exhausted
   */
  private logFinalFailure(
    endpoint: string,
    method: string,
    error: unknown,
  ): void {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorStatus = this.hasErrorStatus(error) ? error.status : 'unknown';

    console.error(
      `[RetryInterceptor] All retries exhausted for ${method} ${endpoint}`,
      {
        error: errorMessage,
        status: errorStatus,
        maxRetries: this.maxRetries,
        timestamp: new Date().toISOString(),
      },
    );
  }

  /**
   * Type guard to check if error has a status property
   */
  private hasErrorStatus(error: unknown): error is { status: number } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      typeof (error as Record<string, unknown>).status === 'number'
    );
  }

  /**
   * Check if error is a network error
   */
  private isNetworkError(error: unknown): boolean {
    if (error instanceof Error) {
      const networkErrors = [
        'ECONNRESET',
        'ETIMEDOUT',
        'ECONNREFUSED',
        'ENETUNREACH',
        'ENOTFOUND',
      ];

      return networkErrors.some((code) => error.message.includes(code));
    }

    // Check for error objects with code property
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as Record<string, unknown>).code === 'string'
    ) {
      const code = (error as { code: string }).code;
      const networkErrors = [
        'ECONNRESET',
        'ETIMEDOUT',
        'ECONNREFUSED',
        'ENETUNREACH',
        'ENOTFOUND',
      ];

      return networkErrors.includes(code);
    }

    return false;
  }
}
