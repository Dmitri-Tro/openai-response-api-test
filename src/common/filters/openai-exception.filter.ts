import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { LoggerService } from '../services/logger.service';

interface OpenAIErrorResponse {
  type: string;
  code?: string;
  param?: string | null;
  message: string;
}

interface OpenAIException {
  error?: OpenAIErrorResponse;
  message: string;
  headers?: Record<string, string | string[]>;
  code?: string;
  stack?: string;
}

interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string;
  error?: unknown;
  openai_error?: {
    type: string;
    code?: string;
    param?: string | null;
    message: string;
    full_error?: unknown;
  };
  retry_after_seconds?: number | string;
  hint?: string;
  error_code?: string;
  details?: string;
  full_error?: {
    message: string;
    name?: string;
    stack?: string;
  };
}

@Catch()
export class OpenAIExceptionFilter implements ExceptionFilter {
  constructor(private readonly loggerService: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: ErrorResponse = {
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
    // Handle OpenAI API errors
    else if (this.isOpenAIException(exception) && exception.error?.type) {
      const openAiError = exception.error;

      switch (openAiError.type) {
        case 'invalid_request_error':
          status = HttpStatus.BAD_REQUEST;
          errorResponse = {
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message: 'Invalid request to OpenAI API',
            openai_error: {
              type: openAiError.type,
              code: openAiError.code,
              param: openAiError.param,
              message: openAiError.message,
            },
          };
          break;

        case 'authentication_error':
          status = HttpStatus.UNAUTHORIZED;
          errorResponse = {
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message: 'Authentication failed with OpenAI API',
            openai_error: {
              type: openAiError.type,
              message: openAiError.message,
            },
            hint: 'Check your OPENAI_API_KEY environment variable',
          };
          break;

        case 'rate_limit_error': {
          status = HttpStatus.TOO_MANY_REQUESTS;
          const retryAfterHeader = exception.headers?.['retry-after'];
          const retryAfter: number | string = Array.isArray(retryAfterHeader)
            ? retryAfterHeader[0] || 60
            : retryAfterHeader || 60;
          errorResponse = {
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message: 'Rate limit exceeded',
            openai_error: {
              type: openAiError.type,
              message: openAiError.message,
            },
            retry_after_seconds: retryAfter,
            hint: 'Please wait before making another request',
          };
          response.setHeader('Retry-After', retryAfter.toString());
          break;
        }

        case 'api_error':
        case 'server_error':
          status = HttpStatus.BAD_GATEWAY;
          errorResponse = {
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message: 'OpenAI API server error',
            openai_error: {
              type: openAiError.type,
              message: openAiError.message,
            },
            hint: 'This is an issue with OpenAI servers. Please try again later.',
          };
          break;

        case 'service_unavailable':
          status = HttpStatus.SERVICE_UNAVAILABLE;
          errorResponse = {
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message: 'OpenAI service is temporarily unavailable',
            openai_error: {
              type: openAiError.type,
              message: openAiError.message,
            },
            hint: 'Please try again in a few moments',
          };
          break;

        default:
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          errorResponse = {
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message: 'Unknown OpenAI API error',
            openai_error: {
              type: openAiError.type,
              message: openAiError.message,
              full_error: openAiError,
            },
          };
      }
    }
    // Handle network errors (timeout, connection refused, etc.)
    else if (this.hasCode(exception)) {
      switch (exception.code) {
        case 'ECONNREFUSED':
          status = HttpStatus.SERVICE_UNAVAILABLE;
          errorResponse = {
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message: 'Cannot connect to OpenAI API',
            error_code: exception.code,
            hint: 'Check your internet connection and OpenAI API status',
          };
          break;

        case 'ETIMEDOUT':
        case 'ECONNRESET':
          status = HttpStatus.GATEWAY_TIMEOUT;
          errorResponse = {
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message: 'Request to OpenAI API timed out',
            error_code: exception.code,
            hint: 'The request took too long. Please try again.',
          };
          break;

        default:
          errorResponse = {
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message: 'Network error communicating with OpenAI',
            error_code: exception.code,
            details: this.getErrorMessage(exception),
          };
      }
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

  private extractApiType(url: string): 'responses' | 'images' | 'videos' {
    if (url.includes('/images')) return 'images';
    if (url.includes('/videos')) return 'videos';
    return 'responses';
  }

  private isOpenAIException(exception: unknown): exception is OpenAIException {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      'error' in exception &&
      typeof (exception as OpenAIException).error === 'object'
    );
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
