import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import OpenAI from 'openai';
import { APIError } from 'openai/error';
import { LoggerService } from '../services/logger.service';
import {
  EnhancedErrorResponse,
  ErrorCode,
  ImageErrorCode,
  NetworkErrorCode,
  IMAGE_ERROR_CODE_MAPPINGS,
  NETWORK_ERROR_CODE_MAPPINGS,
  RateLimitInfo,
} from '../../openai/interfaces/error-codes.interface';

/**
 * Global exception filter for OpenAI API interactions
 *
 * This NestJS exception filter provides comprehensive error handling for all OpenAI API
 * interactions, transforming raw OpenAI SDK exceptions into user-friendly, actionable
 * error responses with hints, error codes, and rate limit information.
 *
 * **Architecture:**
 * Uses `@Catch()` decorator to catch ALL exceptions (OpenAI, NestJS, Network, Unknown).
 * Employs `instanceof` checks from OpenAI SDK for reliable error type detection.
 * Returns EnhancedErrorResponse with standardized structure across all error types.
 *
 * **Error Categories Handled:**
 *
 * 1. **OpenAI SDK Errors** (via instanceof checks):
 *    - `RateLimitError` (429) - Rate limits with retry-after headers and detailed quota info
 *    - `AuthenticationError` (401) - Invalid API keys with verification hints
 *    - `PermissionDeniedError` (403) - Insufficient permissions with access hints
 *    - `NotFoundError` (404) - Missing resources with validation hints
 *    - `BadRequestError` (400) - Invalid parameters with specific error codes
 *    - `InternalServerError` (500+) - OpenAI server issues with retry guidance
 *    - `APIConnectionTimeoutError` (504) - Timeout errors with retry hints
 *    - Generic `APIError` - Fallback for unclassified API errors
 *
 * 2. **Image-Specific Errors**:
 *    Detects 15 image error codes using IMAGE_ERROR_CODE_MAPPINGS:
 *    - invalid_image_size, invalid_image_format, invalid_image_quality
 *    - invalid_image_model, invalid_image_background, invalid_input_fidelity
 *    - invalid_output_compression, invalid_partial_images, unsupported_image_feature
 *    - content_policy_violation_image, image_generation_failed, invalid_image_prompt
 *    - image_too_large, invalid_image_dimensions, image_quota_exceeded
 *
 * 3. **Network Errors**:
 *    Handles common network failures using NETWORK_ERROR_CODE_MAPPINGS:
 *    - ECONNRESET, ETIMEDOUT, ECONNREFUSED, ENETUNREACH, ENOTFOUND
 *
 * 4. **NestJS HTTP Exceptions**:
 *    Preserves NestJS exception structure for framework-level errors
 *
 * 5. **Unknown Errors**:
 *    Catches and logs unexpected errors with full stack traces for investigation
 *
 * **Enhanced Error Response Structure:**
 * ```typescript
 * {
 *   statusCode: 429,
 *   timestamp: "2025-01-12T10:30:00.000Z",
 *   path: "/api/responses",
 *   message: "Rate limit exceeded",
 *   request_id: "req_abc123",
 *   error_code: "rate_limit_error",
 *   parameter: "model",  // Parameter that caused error
 *   retry_after_seconds: 60,
 *   rate_limit_info: {
 *     limit_requests: 10000,
 *     remaining_requests: 0,
 *     reset_requests: "60s",
 *     limit_tokens: 2000000,
 *     remaining_tokens: 150000,
 *     reset_tokens: "1s"
 *   },
 *   hint: "Please wait before making another request...",
 *   openai_error: {
 *     type: "rate_limit_error",
 *     message: "Rate limit exceeded for requests",
 *     full_error: {...}  // Complete OpenAI exception object
 *   }
 * }
 * ```
 *
 * **Rate Limit Header Extraction:**
 * Extracts detailed rate limit information from OpenAI response headers:
 * - x-ratelimit-limit-requests, x-ratelimit-remaining-requests
 * - x-ratelimit-reset-requests, x-ratelimit-limit-tokens
 * - x-ratelimit-remaining-tokens, x-ratelimit-reset-tokens
 * Sets Retry-After header in HTTP response for client retry logic.
 *
 * **Error Code Extraction:**
 * Sophisticated extraction logic for OpenAI error codes:
 * 1. Checks top-level `code` property
 * 2. Checks nested `error.code` property
 * 3. Parses JSON from error message (OpenAI SDK sometimes embeds JSON)
 * 4. Safely handles all extraction failures with type guards
 *
 * **Parameter Extraction:**
 * Identifies which request parameter caused validation errors:
 * - Checks top-level `param` property
 * - Checks nested `error.param` property
 * - Parses from JSON in error message
 * - Returns null if no parameter identified
 *
 * **Type Safety:**
 * - Uses `instanceof` checks for reliable error type detection (no string matching)
 * - Type guards for all property access (`hasCode`, `isImageErrorCode`)
 * - Properly handles both Headers objects and Record<string, string[]>
 * - No `any` types - 100% type-safe with TypeScript strict mode
 *
 * **Logging:**
 * All errors are logged via LoggerService with full context:
 * - Request URL, body, timestamp
 * - Error response with all fields
 * - Original exception object for debugging
 *
 * **Usage:**
 * Applied globally using `app.useGlobalFilters(new OpenAIExceptionFilter(loggerService))`
 * or per-controller with `@UseFilters(OpenAIExceptionFilter)`.
 *
 * **Dependencies:**
 * - OpenAI SDK - For error class types and instanceof checks
 * - LoggerService - For structured error logging
 * - error-codes.interface - For IMAGE_ERROR_CODE_MAPPINGS and NETWORK_ERROR_CODE_MAPPINGS
 *
 * @see {@link https://platform.openai.com/docs/guides/error-codes}
 * @see {@link https://docs.nestjs.com/exception-filters}
 */
@Catch()
export class OpenAIExceptionFilter implements ExceptionFilter {
  constructor(private readonly loggerService: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: EnhancedErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: 'Internal server error',
    };

    // Handle HttpException (NestJS exceptions)
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      errorResponse = {
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        message: exception.message,
        error: exception.getResponse(),
      };
    }
    // Handle OpenAI SDK errors using instanceof enhancement)
    else if (exception instanceof OpenAI.APIError) {
      const requestId = exception.requestID || 'unknown';
      errorResponse = this.handleOpenAIAPIError(
        exception as APIError,
        request,
        requestId,
      );
      status = errorResponse.statusCode;

      // Set Retry-After header for rate limit errors
      if (errorResponse.retry_after_seconds) {
        response.setHeader(
          'Retry-After',
          errorResponse.retry_after_seconds.toString(),
        );
      }
    }
    // Handle network errors (timeout, connection refused, etc.)
    else if (this.hasCode(exception)) {
      const networkCode = exception.code as NetworkErrorCode;
      errorResponse = this.handleNetworkError(networkCode, request);
      status = errorResponse.statusCode;
    }
    // Handle any other errors
    else {
      errorResponse = {
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        message: this.getErrorMessage(exception),
        error: this.getErrorName(exception),
        // Include full error details for investigation
        full_error: {
          message: this.getErrorMessage(exception),
          name: this.getErrorName(exception),
          stack: this.getErrorStack(exception),
        },
      };
    }

    // Log the error with full details
    this.loggerService.logOpenAIInteraction({
      timestamp: new Date().toISOString(),
      api: this.extractApiType(request.url),
      endpoint: request.url,
      request: request.body as Record<string, unknown>,
      error: {
        ...errorResponse,
        original_error: exception,
      },
      metadata: {},
    });

    response.status(status).json(errorResponse);
  }

  /**
   * Main handler for OpenAI SDK errors using instanceof checks
   * Routes to specific error type handlers based on error class
   */
  private handleOpenAIAPIError(
    exception: APIError,
    request: Request,
    requestId: string,
  ): EnhancedErrorResponse {
    // Check specific error types using instanceof
    if (exception instanceof OpenAI.RateLimitError) {
      return this.handleRateLimitError(exception, request, requestId);
    } else if (exception instanceof OpenAI.AuthenticationError) {
      return this.handleAuthenticationError(exception, request, requestId);
    } else if (exception instanceof OpenAI.InternalServerError) {
      return this.handleInternalServerError(exception, request, requestId);
    } else if (
      exception instanceof OpenAI.BadRequestError ||
      exception.status === 400
    ) {
      return this.handleBadRequestError(exception, request, requestId);
    } else if (exception instanceof OpenAI.PermissionDeniedError) {
      return this.handlePermissionDeniedError(exception, request, requestId);
    } else if (exception instanceof OpenAI.NotFoundError) {
      return this.handleNotFoundError(exception, request, requestId);
    } else if (exception instanceof OpenAI.APIConnectionTimeoutError) {
      return this.handleTimeoutError(exception, request, requestId);
    } else {
      // Generic APIError fallback
      return this.handleGenericAPIError(exception, request, requestId);
    }
  }

  /**
   * Handle 429 Rate Limit errors with rate limit header extraction
   */
  private handleRateLimitError(
    exception: InstanceType<typeof OpenAI.RateLimitError>,
    request: Request,
    requestId: string,
  ): EnhancedErrorResponse {
    // Extract retry-after header (handle both Headers object and Record)
    let retryAfter: number | string = 60;
    if (exception.headers instanceof Headers) {
      retryAfter = exception.headers.get('retry-after') || 60;
    } else if (exception.headers) {
      const retryAfterHeader = exception.headers['retry-after'];
      retryAfter = Array.isArray(retryAfterHeader)
        ? retryAfterHeader[0] || 60
        : retryAfterHeader || 60;
    }

    // Extract rate limit headers
    const rateLimitInfo = this.extractRateLimitInfo(exception.headers);

    return {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: 'Rate limit exceeded',
      request_id: requestId,
      error_code: 'rate_limit_error',
      retry_after_seconds: retryAfter,
      rate_limit_info: rateLimitInfo,
      hint: 'Please wait before making another request. Check rate_limit_info for detailed limits.',
      openai_error: {
        type: 'rate_limit_error',
        message: exception.message,
        full_error: exception,
      },
    };
  }

  /**
   * Handle 401 Authentication errors
   */
  private handleAuthenticationError(
    exception: InstanceType<typeof OpenAI.AuthenticationError>,
    request: Request,
    requestId: string,
  ): EnhancedErrorResponse {
    return {
      statusCode: HttpStatus.UNAUTHORIZED,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: 'Authentication failed with OpenAI API',
      request_id: requestId,
      error_code: 'authentication_error',
      hint: 'Check your OPENAI_API_KEY environment variable. Ensure it starts with "sk-" and is valid.',
      openai_error: {
        type: 'authentication_error',
        message: exception.message,
        full_error: exception,
      },
    };
  }

  /**
   * Handle 500+ Internal Server errors
   */
  private handleInternalServerError(
    exception: InstanceType<typeof OpenAI.InternalServerError>,
    request: Request,
    requestId: string,
  ): EnhancedErrorResponse {
    return {
      statusCode: HttpStatus.BAD_GATEWAY,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: 'OpenAI API server error',
      request_id: requestId,
      error_code: 'server_error',
      hint: 'This is an issue with OpenAI servers. Retry with exponential backoff.',
      openai_error: {
        type: 'server_error',
        message: exception.message,
        full_error: exception,
      },
    };
  }

  /**
   * Handle 400 Bad Request errors with image-specific error code detection
   */
  private handleBadRequestError(
    exception: APIError,
    request: Request,
    requestId: string,
  ): EnhancedErrorResponse {
    // Extract error code from exception
    const errorCode = this.extractErrorCode(exception);
    const parameter = this.extractParameter(exception);

    // Check if it's an image-specific error code
    if (errorCode && this.isImageErrorCode(errorCode)) {
      const imageErrorMapping = IMAGE_ERROR_CODE_MAPPINGS[errorCode];
      return {
        statusCode: imageErrorMapping.status,
        timestamp: new Date().toISOString(),
        path: request.url,
        message: imageErrorMapping.message,
        request_id: requestId,
        error_code: errorCode,
        parameter,
        hint: imageErrorMapping.hint,
        openai_error: {
          type: 'invalid_request_error',
          code: errorCode,
          param: parameter,
          message: exception.message,
          full_error: exception,
        },
      };
    }

    // Generic bad request error
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: 'Invalid request to OpenAI API',
      request_id: requestId,
      error_code: (errorCode as ErrorCode) || 'invalid_request_error',
      parameter,
      hint: 'Check your request parameters. See openai_error for details.',
      openai_error: {
        type: 'invalid_request_error',
        code: errorCode,
        param: parameter,
        message: exception.message,
        full_error: exception,
      },
    };
  }

  /**
   * Handle 403 Permission Denied errors
   */
  private handlePermissionDeniedError(
    exception: InstanceType<typeof OpenAI.PermissionDeniedError>,
    request: Request,
    requestId: string,
  ): EnhancedErrorResponse {
    return {
      statusCode: HttpStatus.FORBIDDEN,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: 'Permission denied for OpenAI API resource',
      request_id: requestId,
      error_code: 'permission_denied_error',
      hint: 'Your API key does not have access to this resource or feature.',
      openai_error: {
        type: 'permission_denied_error',
        message: exception.message,
        full_error: exception,
      },
    };
  }

  /**
   * Handle 404 Not Found errors
   */
  private handleNotFoundError(
    exception: InstanceType<typeof OpenAI.NotFoundError>,
    request: Request,
    requestId: string,
  ): EnhancedErrorResponse {
    return {
      statusCode: HttpStatus.NOT_FOUND,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: 'Resource not found',
      request_id: requestId,
      error_code: 'not_found_error',
      hint: 'The requested resource does not exist. Check the resource ID or URL.',
      openai_error: {
        type: 'not_found_error',
        message: exception.message,
        full_error: exception,
      },
    };
  }

  /**
   * Handle timeout errors
   */
  private handleTimeoutError(
    exception: InstanceType<typeof OpenAI.APIConnectionTimeoutError>,
    request: Request,
    requestId: string,
  ): EnhancedErrorResponse {
    return {
      statusCode: HttpStatus.GATEWAY_TIMEOUT,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: 'Request to OpenAI API timed out',
      request_id: requestId,
      error_code: 'timeout_error',
      hint: 'The request exceeded the timeout limit. Try again or increase the timeout setting.',
      openai_error: {
        type: 'timeout_error',
        message: exception.message,
        full_error: exception,
      },
    };
  }

  /**
   * Handle generic API errors (fallback)
   */
  private handleGenericAPIError(
    exception: APIError,
    request: Request,
    requestId: string,
  ): EnhancedErrorResponse {
    return {
      statusCode: exception.status || HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: exception.message || 'Unknown OpenAI API error',
      request_id: requestId,
      error_code: 'api_error',
      openai_error: {
        type: 'api_error',
        message: exception.message,
        full_error: exception,
      },
    };
  }

  /**
   * Handle network errors
   */
  private handleNetworkError(
    code: NetworkErrorCode,
    request: Request,
  ): EnhancedErrorResponse {
    const mapping = NETWORK_ERROR_CODE_MAPPINGS[code];

    if (mapping) {
      return {
        statusCode: mapping.status,
        timestamp: new Date().toISOString(),
        path: request.url,
        message: mapping.message,
        error_code: code,
        hint: mapping.hint,
      };
    }

    // Fallback for unmapped network errors
    return {
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: 'Network error communicating with OpenAI',
      error_code: code,
      hint: 'Check your network connection and try again.',
    };
  }

  /**
   * Extract rate limit headers from OpenAI response
   */
  private extractRateLimitInfo(
    headers?: Headers | Record<string, string | string[]>,
  ): RateLimitInfo | undefined {
    if (!headers) return undefined;

    const getHeader = (key: string): string | number | undefined => {
      // Handle Headers object (Web API)
      if (headers instanceof Headers) {
        const value = headers.get(key);
        return value || undefined;
      }
      // Handle Record object
      const value = headers[key];
      if (Array.isArray(value)) return value[0];
      return value;
    };

    return {
      limit_requests: getHeader('x-ratelimit-limit-requests'),
      remaining_requests: getHeader('x-ratelimit-remaining-requests'),
      reset_requests: getHeader('x-ratelimit-reset-requests'),
      limit_tokens: getHeader('x-ratelimit-limit-tokens'),
      remaining_tokens: getHeader('x-ratelimit-remaining-tokens'),
      reset_tokens: getHeader('x-ratelimit-reset-tokens'),
    };
  }

  /**
   * Extract error code from OpenAI exception
   */
  private extractErrorCode(exception: APIError): string | undefined {
    // OpenAI SDK wraps the error in various ways, try all approaches

    // Try to extract from top-level code property
    if ('code' in exception && typeof exception.code === 'string') {
      return exception.code;
    }

    // Try to extract from error.code (nested error object)
    if ('error' in exception) {
      const errorObj = (exception as { error?: unknown }).error;
      if (
        errorObj &&
        typeof errorObj === 'object' &&
        'code' in errorObj &&
        typeof (errorObj as { code?: string }).code === 'string'
      ) {
        return (errorObj as { code: string }).code;
      }
    }

    // Try to parse from the error message (OpenAI SDK sometimes includes JSON in the message)
    try {
      const message = exception.message;
      if (message && typeof message === 'string') {
        // Check if message contains JSON
        const jsonMatch = message.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed: unknown = JSON.parse(jsonMatch[0]);
          // Type-safe extraction with proper type guards
          if (
            typeof parsed === 'object' &&
            parsed !== null &&
            'error' in parsed
          ) {
            const errorField = (parsed as { error: unknown }).error;
            if (
              typeof errorField === 'object' &&
              errorField !== null &&
              'code' in errorField &&
              typeof (errorField as { code: unknown }).code === 'string'
            ) {
              return (errorField as { code: string }).code;
            }
          }
        }
      }
    } catch {
      // Ignore JSON parsing errors
    }

    return undefined;
  }

  /**
   * Extract parameter that caused the error
   */
  private extractParameter(exception: APIError): string | null {
    // Try to extract from top-level param property
    if (
      'param' in exception &&
      (typeof exception.param === 'string' || exception.param === null)
    ) {
      return exception.param || null;
    }

    // Try to extract from error.param (nested error object)
    if ('error' in exception) {
      const errorObj = (exception as { error?: unknown }).error;
      if (
        errorObj &&
        typeof errorObj === 'object' &&
        'param' in errorObj &&
        (typeof (errorObj as { param?: string | null }).param === 'string' ||
          (errorObj as { param?: string | null }).param === null)
      ) {
        return (errorObj as { param: string | null }).param || null;
      }
    }

    // Try to parse from the error message
    try {
      const message = exception.message;
      if (message && typeof message === 'string') {
        const jsonMatch = message.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed: unknown = JSON.parse(jsonMatch[0]);
          // Type-safe extraction with proper type guards
          if (
            typeof parsed === 'object' &&
            parsed !== null &&
            'error' in parsed
          ) {
            const errorField = (parsed as { error: unknown }).error;
            if (
              typeof errorField === 'object' &&
              errorField !== null &&
              'param' in errorField
            ) {
              const paramValue = (errorField as { param: unknown }).param;
              if (typeof paramValue === 'string' || paramValue === null) {
                return paramValue;
              }
            }
          }
        }
      }
    } catch {
      // Ignore JSON parsing errors
    }

    return null;
  }

  /**
   * Check if error code is an image-specific error
   */
  private isImageErrorCode(code: string): code is ImageErrorCode {
    return code in IMAGE_ERROR_CODE_MAPPINGS;
  }

  private extractApiType(url: string): 'responses' | 'images' | 'videos' {
    if (url.includes('/images')) return 'images';
    if (url.includes('/videos')) return 'videos';
    return 'responses';
  }

  private hasCode(exception: unknown): exception is { code: string } {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception &&
      typeof (exception as { code: string }).code === 'string'
    );
  }

  private getErrorMessage(exception: unknown): string {
    if (
      typeof exception === 'object' &&
      exception !== null &&
      'message' in exception &&
      typeof (exception as { message: string }).message === 'string'
    ) {
      return (exception as { message: string }).message;
    }
    return 'An unexpected error occurred';
  }

  private getErrorName(exception: unknown): string {
    if (
      typeof exception === 'object' &&
      exception !== null &&
      'name' in exception &&
      typeof (exception as { name: string }).name === 'string'
    ) {
      return (exception as { name: string }).name;
    }
    return 'Error';
  }

  private getErrorStack(exception: unknown): string | undefined {
    if (
      typeof exception === 'object' &&
      exception !== null &&
      'stack' in exception &&
      typeof (exception as { stack: string }).stack === 'string'
    ) {
      return (exception as { stack: string }).stack;
    }
    return undefined;
  }
}
