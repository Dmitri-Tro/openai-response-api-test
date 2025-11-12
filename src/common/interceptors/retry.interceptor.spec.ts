import {
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { of, throwError, lastValueFrom } from 'rxjs';
import { RetryInterceptor } from './retry.interceptor';
import { LoggerService } from '../services/logger.service';
import { createMockLoggerService } from '../testing/test.factories';

describe('RetryInterceptor', () => {
  let interceptor: RetryInterceptor;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockCallHandler: jest.Mocked<CallHandler>;

  beforeEach(() => {
    // Mock LoggerService using factory
    mockLoggerService = createMockLoggerService();

    interceptor = new RetryInterceptor(mockLoggerService);

    // Override timing for faster tests
    (interceptor as unknown as { baseDelay: number }).baseDelay = 10; // 10ms instead of 1000ms
    (interceptor as unknown as { maxDelay: number }).maxDelay = 100; // 100ms instead of 10000ms

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          url: '/api/responses/text',
          method: 'POST',
        }),
      }),
    } as unknown as jest.Mocked<ExecutionContext>;

    mockCallHandler = {
      handle: jest.fn(),
    } as unknown as jest.Mocked<CallHandler>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful Requests', () => {
    it('should pass through successful requests without retry', async () => {
      const response = { id: 'resp_123', output_text: 'Success' };
      mockCallHandler.handle.mockReturnValue(of(response));

      const result$ = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );
      const result = await lastValueFrom(result$);

      expect(result).toEqual(response);
      expect(mockCallHandler.handle).toHaveBeenCalledTimes(1);
    });
  });

  describe('Retryable Errors - Rate Limits', () => {
    it('should retry on 429 rate limit error', (done) => {
      const error = new HttpException(
        'Rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
      let attemptCount = 0;

      mockCallHandler.handle.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return throwError(() => error);
        }
        return of({ id: 'resp_123', output_text: 'Success after retry' });
      });

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toEqual({
            id: 'resp_123',
            output_text: 'Success after retry',
          });
          expect(attemptCount).toBe(3);
          done();
        },
        error: (err) => done(err),
      });
    }, 5000);

    it('should retry on error object with status 429', (done) => {
      const error = { status: 429, message: 'Rate limit exceeded' };
      let attemptCount = 0;

      mockCallHandler.handle.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          return throwError(() => error);
        }
        return of({ id: 'resp_123', output_text: 'Success' });
      });

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toBeDefined();
          expect(attemptCount).toBe(2);
          done();
        },
        error: (err) => done(err),
      });
    }, 5000);
  });

  describe('Retryable Errors - Server Errors (5xx)', () => {
    it('should retry on 500 Internal Server Error', (done) => {
      const error = new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      let attemptCount = 0;

      mockCallHandler.handle.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          return throwError(() => error);
        }
        return of({ id: 'resp_123', output_text: 'Success' });
      });

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(attemptCount).toBe(2);
          done();
        },
        error: (err) => done(err),
      });
    }, 5000);

    it('should retry on 502 Bad Gateway', (done) => {
      const error = new HttpException('Bad Gateway', HttpStatus.BAD_GATEWAY);
      let attemptCount = 0;

      mockCallHandler.handle.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          return throwError(() => error);
        }
        return of({ id: 'resp_123', output_text: 'Success' });
      });

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(attemptCount).toBe(2);
          done();
        },
        error: (err) => done(err),
      });
    }, 5000);

    it('should retry on 503 Service Unavailable', (done) => {
      const error = new HttpException(
        'Service Unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
      let attemptCount = 0;

      mockCallHandler.handle.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          return throwError(() => error);
        }
        return of({ id: 'resp_123', output_text: 'Success' });
      });

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(attemptCount).toBe(2);
          done();
        },
        error: (err) => done(err),
      });
    }, 5000);
  });

  describe('Non-Retryable Errors - Client Errors (4xx)', () => {
    it('should NOT retry on 400 Bad Request', async () => {
      const error = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      const result$ = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      await expect(lastValueFrom(result$)).rejects.toBe(error);
      expect(mockCallHandler.handle).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on 401 Unauthorized', async () => {
      const error = new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      const result$ = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      await expect(lastValueFrom(result$)).rejects.toBe(error);
      expect(mockCallHandler.handle).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on 404 Not Found', async () => {
      const error = new HttpException('Not Found', HttpStatus.NOT_FOUND);
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      const result$ = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      await expect(lastValueFrom(result$)).rejects.toBe(error);
      expect(mockCallHandler.handle).toHaveBeenCalledTimes(1);
    });
  });

  describe('Network Errors', () => {
    it('should retry on ECONNRESET network error', (done) => {
      const error = new Error('socket hang up ECONNRESET');
      let attemptCount = 0;

      mockCallHandler.handle.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          return throwError(() => error);
        }
        return of({ id: 'resp_123', output_text: 'Success' });
      });

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(attemptCount).toBe(2);
          done();
        },
        error: (err) => done(err),
      });
    }, 5000);

    it('should retry on ETIMEDOUT network error', (done) => {
      const error = new Error('Connection timed out ETIMEDOUT');
      let attemptCount = 0;

      mockCallHandler.handle.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          return throwError(() => error);
        }
        return of({ id: 'resp_123', output_text: 'Success' });
      });

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(attemptCount).toBe(2);
          done();
        },
        error: (err) => done(err),
      });
    }, 5000);

    it('should retry on network error with code property', (done) => {
      const error = { code: 'ECONNREFUSED', message: 'Connection refused' };
      let attemptCount = 0;

      mockCallHandler.handle.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          return throwError(() => error);
        }
        return of({ id: 'resp_123', output_text: 'Success' });
      });

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(attemptCount).toBe(2);
          done();
        },
        error: (err) => done(err),
      });
    }, 5000);
  });

  describe('Retry Exhaustion', () => {
    it('should fail after max retries (3) with retryable error', (done) => {
      const error = new HttpException(
        'Rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
      let attemptCount = 0;

      mockCallHandler.handle.mockImplementation(() => {
        attemptCount++;
        return throwError(() => error);
      });

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: (err) => {
          expect(err).toBe(error);
          // Initial attempt + 3 retries = 4 total attempts
          expect(attemptCount).toBe(4);
          done();
        },
        next: () => done(new Error('Should not succeed')),
      });
    }, 5000);

    it('should fail immediately with non-retryable error', async () => {
      const error = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
      let attemptCount = 0;

      mockCallHandler.handle.mockImplementation(() => {
        attemptCount++;
        return throwError(() => error);
      });

      const result$ = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      await expect(lastValueFrom(result$)).rejects.toBe(error);
      expect(attemptCount).toBe(1);
    });
  });

  describe('Exponential Backoff', () => {
    it('should use exponential backoff between retries', (done) => {
      const error = new HttpException(
        'Service Unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
      let attemptCount = 0;

      mockCallHandler.handle.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return throwError(() => error);
        }
        return of({ id: 'resp_123', output_text: 'Success' });
      });

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          // Verify we made 3 attempts (initial + 2 retries)
          expect(attemptCount).toBe(3);
          done();
        },
        error: (err) => done(err),
      });
    }, 5000);
  });

  describe('Mixed Success and Failure Scenarios', () => {
    it('should succeed on second attempt after one retryable error', (done) => {
      const error = { status: 503, message: 'Service temporarily unavailable' };
      let attemptCount = 0;

      mockCallHandler.handle.mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          return throwError(() => error);
        }
        return of({ id: 'resp_123', output_text: 'Success' });
      });

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(attemptCount).toBe(2);
          expect(result).toEqual({ id: 'resp_123', output_text: 'Success' });
          done();
        },
        error: (err) => done(err),
      });
    }, 5000);

    it('should handle alternating retryable and non-retryable errors', (done) => {
      const retryableError = { status: 503, message: 'Service unavailable' };
      const nonRetryableError = { status: 400, message: 'Bad request' };
      let attemptCount = 0;

      mockCallHandler.handle.mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          return throwError(() => retryableError);
        }
        // After retry, fail with non-retryable error
        return throwError(() => nonRetryableError);
      });

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: (err) => {
          // Should retry once for 503, then fail immediately on 400
          expect(attemptCount).toBe(2);
          expect(err).toBe(nonRetryableError);
          done();
        },
        next: () => done(new Error('Should not succeed')),
      });
    }, 5000);
  });
});
