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
import { PricingService } from '../services/pricing.service';
import { createMockLoggerService } from '../testing/test.factories';

/**
 * Edge Case Tests for Interceptors
 * Tests boundary conditions, error scenarios, and special cases
 */
describe('Interceptors - Edge Cases', () => {
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockPricingService: jest.Mocked<PricingService>;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockCallHandler: jest.Mocked<CallHandler>;
  let handleSpy: jest.Mock;
  let logOpenAIInteractionSpy: jest.Mock;

  beforeEach(() => {
    // Create spies first
    logOpenAIInteractionSpy = jest.fn();
    handleSpy = jest.fn();

    // Create mock logger and override with our spy
    mockLoggerService = createMockLoggerService();
    mockLoggerService.logOpenAIInteraction = logOpenAIInteractionSpy;

    // Mock PricingService
    mockPricingService = {
      calculateCost: jest.fn().mockReturnValue(0.00001),
      estimateCost: jest.fn().mockReturnValue(0.00001),
      getModelPricing: jest.fn(),
      getSupportedModels: jest.fn(),
      isModelSupported: jest.fn(),
    } as unknown as jest.Mocked<PricingService>;

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
      handle: handleSpy,
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

        handleSpy.mockImplementation(() => {
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
            next: () => {
              done(new Error('Should not succeed'));
            },
          });
      }, 5000);

      it('should succeed on exactly the 3rd retry attempt', (done) => {
        const error = new HttpException(
          'Rate limit',
          HttpStatus.TOO_MANY_REQUESTS,
        );
        let attemptCount = 0;

        handleSpy.mockImplementation(() => {
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
            error: (err) => {
              done(err);
            },
          });
      }, 5000);

      it('should handle status code exactly at boundary (429)', (done) => {
        const error = new HttpException('Rate limit', 429);
        let retried = false;

        handleSpy.mockImplementation(() => {
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
            error: (err) => {
              done(err);
            },
          });
      }, 5000);

      it('should handle status code at 5xx boundary (500)', (done) => {
        const error = new HttpException('Server error', 500);
        let retried = false;

        handleSpy.mockImplementation(() => {
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
            error: (err) => {
              done(err);
            },
          });
      }, 5000);

      it('should NOT retry status code just below 5xx (499)', async () => {
        const error = new HttpException('Client error', 499);
        handleSpy.mockReturnValue(throwError(() => error));

        const result$ = retryInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );

        await expect(lastValueFrom(result$)).rejects.toBe(error);
        expect(handleSpy).toHaveBeenCalledTimes(1);
      });

      it('should handle status code at upper 5xx boundary (599)', (done) => {
        const error = new HttpException('Server error', 599);
        let retried = false;

        handleSpy.mockImplementation(() => {
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
            error: (err) => {
              done(err);
            },
          });
      }, 5000);
    });

    describe('Error Object Variations', () => {
      it('should handle error with status property (object, not HttpException)', (done) => {
        const error = { status: 503, message: 'Service unavailable' };
        let retried = false;

        handleSpy.mockImplementation(() => {
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
            error: (err) => {
              done(err);
            },
          });
      }, 5000);

      it('should handle error with code property (network error)', (done) => {
        const error = { code: 'ETIMEDOUT', message: 'Connection timeout' };
        let retried = false;

        handleSpy.mockImplementation(() => {
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
            error: (err) => {
              done(err);
            },
          });
      }, 5000);

      it('should handle Error object with network code in message', (done) => {
        const error = new Error('Request failed: ECONNRESET');
        let retried = false;

        handleSpy.mockImplementation(() => {
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
            error: (err) => {
              done(err);
            },
          });
      }, 5000);

      it('should handle null error', async () => {
        handleSpy.mockReturnValue(throwError(() => null));

        const result$ = retryInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );

        await expect(lastValueFrom(result$)).rejects.toBe(null);
        expect(handleSpy).toHaveBeenCalledTimes(1);
      });

      it('should handle undefined error', async () => {
        handleSpy.mockReturnValue(throwError(() => undefined));

        const result$ = retryInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );

        await expect(lastValueFrom(result$)).rejects.toBe(undefined);
        expect(handleSpy).toHaveBeenCalledTimes(1);
      });

      it('should handle string error', async () => {
        handleSpy.mockReturnValue(throwError(() => 'String error'));

        const result$ = retryInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );

        await expect(lastValueFrom(result$)).rejects.toBe('String error');
        expect(handleSpy).toHaveBeenCalledTimes(1);
      });

      it('should handle number error', async () => {
        handleSpy.mockReturnValue(throwError(() => 404));

        const result$ = retryInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );

        await expect(lastValueFrom(result$)).rejects.toBe(404);
        expect(handleSpy).toHaveBeenCalledTimes(1);
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

          handleSpy.mockImplementation(() => {
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
              error: (err) => {
                done(err);
              },
            });
        }, 5000);
      });
    });
  });

  describe('LoggingInterceptor - Edge Cases', () => {
    let loggingInterceptor: LoggingInterceptor;

    beforeEach(() => {
      loggingInterceptor = new LoggingInterceptor(
        mockLoggerService,
        mockPricingService,
      );
    });

    describe('Response Body Variations', () => {
      it('should handle null response body', async () => {
        handleSpy.mockReturnValue(of(null));

        const result$ = loggingInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );
        const result = await lastValueFrom(result$);

        expect(result).toBe(null);
        expect(logOpenAIInteractionSpy).toHaveBeenCalled();
      });

      it('should handle undefined response body', async () => {
        handleSpy.mockReturnValue(of(undefined));

        const result$ = loggingInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );
        const result = await lastValueFrom(result$);

        expect(result).toBe(undefined);
        expect(logOpenAIInteractionSpy).toHaveBeenCalled();
      });

      it('should handle empty object response', async () => {
        handleSpy.mockReturnValue(of({}));

        const result$ = loggingInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );
        const result = await lastValueFrom(result$);

        expect(result).toEqual({});
        expect(logOpenAIInteractionSpy).toHaveBeenCalled();
      });

      it('should handle very large response body', async () => {
        const largeResponse = {
          id: 'resp_123',
          output_text: 'x'.repeat(100000), // 100k characters
          usage: { total_tokens: 50000 },
        };

        handleSpy.mockReturnValue(of(largeResponse));

        const result$ = loggingInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );
        const result = await lastValueFrom(result$);

        expect(result).toEqual(largeResponse);
        expect(logOpenAIInteractionSpy).toHaveBeenCalled();
      });

      it('should handle response with special characters', async () => {
        const specialResponse = {
          id: 'resp_123',
          output_text: '🔥 Unicode: 你好世界 \n\t Special: <>&"\'',
        };

        handleSpy.mockReturnValue(of(specialResponse));

        const result$ = loggingInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );
        const result = await lastValueFrom(result$);

        expect(result).toEqual(specialResponse);
        expect(logOpenAIInteractionSpy).toHaveBeenCalled();
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

        handleSpy.mockReturnValue(of({ id: 'resp_123' }));

        const result$ = loggingInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );
        const result = await lastValueFrom(result$);

        expect(result).toEqual({ id: 'resp_123' });
        expect(logOpenAIInteractionSpy).toHaveBeenCalled();
      });

      it('should handle request with missing body', async () => {
        mockExecutionContext.switchToHttp().getRequest = jest
          .fn()
          .mockReturnValue({
            url: '/api/responses/text',
            method: 'POST',
          });

        handleSpy.mockReturnValue(of({ id: 'resp_123' }));

        const result$ = loggingInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );
        const result = await lastValueFrom(result$);

        expect(result).toEqual({ id: 'resp_123' });
        expect(logOpenAIInteractionSpy).toHaveBeenCalled();
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

        handleSpy.mockReturnValue(of({ id: 'resp_123' }));

        const result$ = loggingInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );
        const result = await lastValueFrom(result$);

        expect(result).toEqual({ id: 'resp_123' });
        expect(logOpenAIInteractionSpy).toHaveBeenCalled();
      });
    });

    describe('Error Handling', () => {
      it('should log errors with complete stack traces', async () => {
        const error = new Error('Test error');
        error.stack = 'Error: Test error\n  at test.ts:123:45';

        handleSpy.mockReturnValue(throwError(() => error));

        const result$ = loggingInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );

        await expect(lastValueFrom(result$)).rejects.toThrow('Test error');
        expect(logOpenAIInteractionSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              message: 'Test error',
              stack: expect.stringContaining('test.ts:123:45') as string,
            }) as { message: string; stack: string },
          }),
        );
      });

      it('should handle errors without stack traces', async () => {
        const error = new Error('Test error');
        delete error.stack;

        handleSpy.mockReturnValue(throwError(() => error));

        const result$ = loggingInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );

        await expect(lastValueFrom(result$)).rejects.toThrow('Test error');
        expect(logOpenAIInteractionSpy).toHaveBeenCalled();
      });
    });
  });
});
