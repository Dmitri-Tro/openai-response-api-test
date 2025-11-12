import {
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { of, throwError, lastValueFrom } from 'rxjs';
import { RetryInterceptor } from './retry.interceptor';
import { LoggingInterceptor } from './logging.interceptor';
import { LoggerService } from '../services/logger.service';
import { createMockLoggerService } from '../testing/test.factories';

/**
 * Edge Case Tests for Interceptors
 * Tests boundary conditions, error scenarios, and special cases
 */
describe('Interceptors - Edge Cases', () => {
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockCallHandler: jest.Mocked<CallHandler>;

  beforeEach(() => {
    mockLoggerService = createMockLoggerService();

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          url: '/api/responses/text',
          method: 'POST',
          body: { model: 'gpt-4o-mini', input: 'test' },
        }),
        getResponse: jest.fn().mockReturnValue({
          statusCode: 201,
        }),
      }),
      getClass: jest.fn(),
      getHandler: jest.fn(),
    } as unknown as jest.Mocked<ExecutionContext>;

    mockCallHandler = {
      handle: jest.fn(),
    } as unknown as jest.Mocked<CallHandler>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('RetryInterceptor - Edge Cases', () => {
    let retryInterceptor: RetryInterceptor;

    beforeEach(() => {
      retryInterceptor = new RetryInterceptor(mockLoggerService);
      // Override timing for faster tests
      (retryInterceptor as unknown as { baseDelay: number }).baseDelay = 10;
      (retryInterceptor as unknown as { maxDelay: number }).maxDelay = 100;
    });

    describe('Boundary Conditions', () => {
      it('should handle exactly 3 retries before failing', (done) => {
        const error = new HttpException(
          'Rate limit',
          HttpStatus.TOO_MANY_REQUESTS,
        );
        let attemptCount = 0;

        mockCallHandler.handle.mockImplementation(() => {
          attemptCount++;
          return throwError(() => error);
        });

        retryInterceptor
          .intercept(mockExecutionContext, mockCallHandler)
          .subscribe({
            error: () => {
              // Initial + 3 retries = 4 total
              expect(attemptCount).toBe(4);
              done();
            },
            next: () => done(new Error('Should not succeed')),
          });
      }, 5000);

      it('should succeed on exactly the 3rd retry attempt', (done) => {
        const error = new HttpException(
          'Rate limit',
          HttpStatus.TOO_MANY_REQUESTS,
        );
        let attemptCount = 0;

        mockCallHandler.handle.mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 4) {
            return throwError(() => error);
          }
          return of({ success: true });
        });

        retryInterceptor
          .intercept(mockExecutionContext, mockCallHandler)
          .subscribe({
            next: (result) => {
              expect(result).toEqual({ success: true });
              expect(attemptCount).toBe(4);
              done();
            },
            error: (err) => done(err),
          });
      }, 5000);

      it('should handle status code exactly at boundary (429)', (done) => {
        const error = new HttpException('Rate limit', 429);
        let retried = false;

        mockCallHandler.handle.mockImplementation(() => {
          if (!retried) {
            retried = true;
            return throwError(() => error);
          }
          return of({ success: true });
        });

        retryInterceptor
          .intercept(mockExecutionContext, mockCallHandler)
          .subscribe({
            next: (result) => {
              expect(result).toEqual({ success: true });
              expect(retried).toBe(true);
              done();
            },
            error: (err) => done(err),
          });
      }, 5000);

      it('should handle status code at 5xx boundary (500)', (done) => {
        const error = new HttpException('Server error', 500);
        let retried = false;

        mockCallHandler.handle.mockImplementation(() => {
          if (!retried) {
            retried = true;
            return throwError(() => error);
          }
          return of({ success: true });
        });

        retryInterceptor
          .intercept(mockExecutionContext, mockCallHandler)
          .subscribe({
            next: (result) => {
              expect(result).toEqual({ success: true });
              done();
            },
            error: (err) => done(err),
          });
      }, 5000);

      it('should NOT retry status code just below 5xx (499)', async () => {
        const error = new HttpException('Client error', 499);
        mockCallHandler.handle.mockReturnValue(throwError(() => error));

        const result$ = retryInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );

        await expect(lastValueFrom(result$)).rejects.toBe(error);
        expect(mockCallHandler.handle).toHaveBeenCalledTimes(1);
      });

      it('should handle status code at upper 5xx boundary (599)', (done) => {
        const error = new HttpException('Server error', 599);
        let retried = false;

        mockCallHandler.handle.mockImplementation(() => {
          if (!retried) {
            retried = true;
            return throwError(() => error);
          }
          return of({ success: true });
        });

        retryInterceptor
          .intercept(mockExecutionContext, mockCallHandler)
          .subscribe({
            next: () => {
              expect(retried).toBe(true);
              done();
            },
            error: (err) => done(err),
          });
      }, 5000);
    });

    describe('Error Object Variations', () => {
      it('should handle error with status property (object, not HttpException)', (done) => {
        const error = { status: 503, message: 'Service unavailable' };
        let retried = false;

        mockCallHandler.handle.mockImplementation(() => {
          if (!retried) {
            retried = true;
            return throwError(() => error);
          }
          return of({ success: true });
        });

        retryInterceptor
          .intercept(mockExecutionContext, mockCallHandler)
          .subscribe({
            next: () => {
              expect(retried).toBe(true);
              done();
            },
            error: (err) => done(err),
          });
      }, 5000);

      it('should handle error with code property (network error)', (done) => {
        const error = { code: 'ETIMEDOUT', message: 'Connection timeout' };
        let retried = false;

        mockCallHandler.handle.mockImplementation(() => {
          if (!retried) {
            retried = true;
            return throwError(() => error);
          }
          return of({ success: true });
        });

        retryInterceptor
          .intercept(mockExecutionContext, mockCallHandler)
          .subscribe({
            next: () => {
              expect(retried).toBe(true);
              done();
            },
            error: (err) => done(err),
          });
      }, 5000);

      it('should handle Error object with network code in message', (done) => {
        const error = new Error('Request failed: ECONNRESET');
        let retried = false;

        mockCallHandler.handle.mockImplementation(() => {
          if (!retried) {
            retried = true;
            return throwError(() => error);
          }
          return of({ success: true });
        });

        retryInterceptor
          .intercept(mockExecutionContext, mockCallHandler)
          .subscribe({
            next: () => {
              expect(retried).toBe(true);
              done();
            },
            error: (err) => done(err),
          });
      }, 5000);

      it('should handle null error', async () => {
        mockCallHandler.handle.mockReturnValue(throwError(() => null));

        const result$ = retryInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );

        await expect(lastValueFrom(result$)).rejects.toBe(null);
        expect(mockCallHandler.handle).toHaveBeenCalledTimes(1);
      });

      it('should handle undefined error', async () => {
        mockCallHandler.handle.mockReturnValue(throwError(() => undefined));

        const result$ = retryInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );

        await expect(lastValueFrom(result$)).rejects.toBe(undefined);
        expect(mockCallHandler.handle).toHaveBeenCalledTimes(1);
      });

      it('should handle string error', async () => {
        mockCallHandler.handle.mockReturnValue(
          throwError(() => 'String error'),
        );

        const result$ = retryInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );

        await expect(lastValueFrom(result$)).rejects.toBe('String error');
        expect(mockCallHandler.handle).toHaveBeenCalledTimes(1);
      });

      it('should handle number error', async () => {
        mockCallHandler.handle.mockReturnValue(throwError(() => 404));

        const result$ = retryInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );

        await expect(lastValueFrom(result$)).rejects.toBe(404);
        expect(mockCallHandler.handle).toHaveBeenCalledTimes(1);
      });
    });

    describe('Edge Case Network Errors', () => {
      const networkCodes = [
        'ECONNRESET',
        'ETIMEDOUT',
        'ECONNREFUSED',
        'ENETUNREACH',
        'ENOTFOUND',
      ];

      networkCodes.forEach((code) => {
        it(`should retry on network error: ${code}`, (done) => {
          const error = { code, message: `Network error: ${code}` };
          let retried = false;

          mockCallHandler.handle.mockImplementation(() => {
            if (!retried) {
              retried = true;
              return throwError(() => error);
            }
            return of({ success: true });
          });

          retryInterceptor
            .intercept(mockExecutionContext, mockCallHandler)
            .subscribe({
              next: () => {
                expect(retried).toBe(true);
                done();
              },
              error: (err) => done(err),
            });
        }, 5000);
      });
    });
  });

  describe('LoggingInterceptor - Edge Cases', () => {
    let loggingInterceptor: LoggingInterceptor;

    beforeEach(() => {
      loggingInterceptor = new LoggingInterceptor(mockLoggerService);
    });

    describe('Response Body Variations', () => {
      it('should handle null response body', async () => {
        mockCallHandler.handle.mockReturnValue(of(null));

        const result$ = loggingInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );
        const result = await lastValueFrom(result$);

        expect(result).toBe(null);
        expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalled();
      });

      it('should handle undefined response body', async () => {
        mockCallHandler.handle.mockReturnValue(of(undefined));

        const result$ = loggingInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );
        const result = await lastValueFrom(result$);

        expect(result).toBe(undefined);
        expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalled();
      });

      it('should handle empty object response', async () => {
        mockCallHandler.handle.mockReturnValue(of({}));

        const result$ = loggingInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );
        const result = await lastValueFrom(result$);

        expect(result).toEqual({});
        expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalled();
      });

      it('should handle very large response body', async () => {
        const largeResponse = {
          id: 'resp_123',
          output_text: 'x'.repeat(100000), // 100k characters
          usage: { total_tokens: 50000 },
        };

        mockCallHandler.handle.mockReturnValue(of(largeResponse));

        const result$ = loggingInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );
        const result = await lastValueFrom(result$);

        expect(result).toEqual(largeResponse);
        expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalled();
      });

      it('should handle response with special characters', async () => {
        const specialResponse = {
          id: 'resp_123',
          output_text: '🔥 Unicode: 你好世界 \n\t Special: <>&"\'',
        };

        mockCallHandler.handle.mockReturnValue(of(specialResponse));

        const result$ = loggingInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );
        const result = await lastValueFrom(result$);

        expect(result).toEqual(specialResponse);
        expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalled();
      });
    });

    describe('Request Variations', () => {
      it('should handle request with missing URL', async () => {
        mockExecutionContext.switchToHttp().getRequest = jest
          .fn()
          .mockReturnValue({
            method: 'POST',
            body: {},
          });

        mockCallHandler.handle.mockReturnValue(of({ id: 'resp_123' }));

        const result$ = loggingInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );
        const result = await lastValueFrom(result$);

        expect(result).toEqual({ id: 'resp_123' });
        expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalled();
      });

      it('should handle request with missing body', async () => {
        mockExecutionContext.switchToHttp().getRequest = jest
          .fn()
          .mockReturnValue({
            url: '/api/responses/text',
            method: 'POST',
          });

        mockCallHandler.handle.mockReturnValue(of({ id: 'resp_123' }));

        const result$ = loggingInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );
        const result = await lastValueFrom(result$);

        expect(result).toEqual({ id: 'resp_123' });
        expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalled();
      });

      it('should handle very long URL', async () => {
        const longUrl = '/api/responses/text?' + 'a=1&'.repeat(1000);

        mockExecutionContext.switchToHttp().getRequest = jest
          .fn()
          .mockReturnValue({
            url: longUrl,
            method: 'POST',
            body: {},
          });

        mockCallHandler.handle.mockReturnValue(of({ id: 'resp_123' }));

        const result$ = loggingInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );
        const result = await lastValueFrom(result$);

        expect(result).toEqual({ id: 'resp_123' });
        expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalled();
      });
    });

    describe('Error Handling', () => {
      it('should log errors with complete stack traces', async () => {
        const error = new Error('Test error');
        error.stack = 'Error: Test error\n  at test.ts:123:45';

        mockCallHandler.handle.mockReturnValue(throwError(() => error));

        const result$ = loggingInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );

        await expect(lastValueFrom(result$)).rejects.toThrow('Test error');
        expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              message: 'Test error',
              stack: expect.stringContaining('test.ts:123:45'),
            }),
          }),
        );
      });

      it('should handle errors without stack traces', async () => {
        const error = new Error('Test error');
        delete error.stack;

        mockCallHandler.handle.mockReturnValue(throwError(() => error));

        const result$ = loggingInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );

        await expect(lastValueFrom(result$)).rejects.toThrow('Test error');
        expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalled();
      });
    });
  });
});
