import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';
import { LoggerService } from '../services/logger.service';
import { PricingService } from '../services/pricing.service';
import { createMockLoggerService } from '../testing/test.factories';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let pricingService: PricingService;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  beforeEach(async () => {
    // Mock LoggerService using factory
    mockLoggerService = createMockLoggerService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoggingInterceptor,
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
        PricingService, // Use real PricingService for integration tests
      ],
    }).compile();

    interceptor = module.get<LoggingInterceptor>(LoggingInterceptor);
    pricingService = module.get<PricingService>(PricingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('intercept - Success cases', () => {
    it('should log successful responses API call', (done) => {
      const mockRequest = {
        url: '/api/responses/text',
        body: { input: 'test message' },
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      const mockResponse = {
        id: 'resp_123',
        output_text: 'Response text',
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      mockCallHandler = {
        handle: jest.fn().mockReturnValue(of(mockResponse)),
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (response) => {
          expect(response).toEqual(mockResponse);
          expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
            expect.objectContaining({
              api: 'responses',
              endpoint: '/api/responses/text',
              request: { input: 'test message' },
              response: mockResponse,
              metadata: expect.objectContaining({
                latency_ms: expect.any(Number),
                tokens_used: 30,
                cost_estimate: expect.any(Number),
              }),
            }),
          );
          done();
        },
        error: done,
      });
    });

    it('should detect images API from URL', (done) => {
      const mockRequest = {
        url: '/api/images/generate',
        body: { prompt: 'test image' },
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      const mockResponse = {
        id: 'img_123',
        data: [{ url: 'https://example.com/image.png' }],
      };

      mockCallHandler = {
        handle: jest.fn().mockReturnValue(of(mockResponse)),
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
            expect.objectContaining({
              api: 'images',
            }),
          );
          done();
        },
        error: done,
      });
    });

    it('should detect videos API from URL', (done) => {
      const mockRequest = {
        url: '/api/videos/generate',
        body: { prompt: 'test video' },
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      const mockResponse = {
        id: 'vid_123',
        status: 'processing',
      };

      mockCallHandler = {
        handle: jest.fn().mockReturnValue(of(mockResponse)),
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
            expect.objectContaining({
              api: 'videos',
            }),
          );
          done();
        },
        error: done,
      });
    });

    it('should skip logging for streaming endpoints', (done) => {
      const mockRequest = {
        url: '/api/responses/text/stream',
        body: { input: 'streaming test' },
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      const mockResponse = {
        data: 'streaming response',
      };

      mockCallHandler = {
        handle: jest.fn().mockReturnValue(of(mockResponse)),
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (response) => {
          expect(response).toEqual(mockResponse);
          expect(mockLoggerService.logOpenAIInteraction).not.toHaveBeenCalled();
          done();
        },
        error: done,
      });
    });

    it('should calculate cost estimate correctly', (done) => {
      const mockRequest = {
        url: '/api/responses/text',
        body: { input: 'test', model: 'gpt-5' },
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      const mockResponse = {
        model: 'gpt-5',
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 2000,
          total_tokens: 3000,
        },
      };

      mockCallHandler = {
        handle: jest.fn().mockReturnValue(of(mockResponse)),
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          const calls = mockLoggerService.logOpenAIInteraction.mock.calls;
          expect(calls.length).toBeGreaterThan(0);
          const lastCall = calls[calls.length - 1][0];
          // GPT-5 Cost: (1000/1_000_000)*0.00125 + (2000/1_000_000)*0.01 = 0.00000125 + 0.00002 = 0.00002125
          expect(lastCall.metadata.cost_estimate).toBeCloseTo(0.00002125, 10);
          done();
        },
        error: done,
      });
    });

    it('should handle response without usage', (done) => {
      const mockRequest = {
        url: '/api/responses/text',
        body: { input: 'test' },
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      const mockResponse = {
        id: 'resp_no_usage',
        output_text: 'Response',
      };

      mockCallHandler = {
        handle: jest.fn().mockReturnValue(of(mockResponse)),
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
            expect.objectContaining({
              metadata: expect.objectContaining({
                tokens_used: undefined,
                cost_estimate: 0,
              }),
            }),
          );
          done();
        },
        error: done,
      });
    });
  });

  describe('intercept - Error cases', () => {
    it('should log errors with status and message', (done) => {
      const mockRequest = {
        url: '/api/responses/text',
        body: { input: 'test error' },
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      const mockError = {
        message: 'API Error',
        status: 400,
        stack: 'Error stack trace',
      };

      mockCallHandler = {
        handle: jest.fn().mockReturnValue(throwError(() => mockError)),
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          done(new Error('Should not reach here'));
        },
        error: (error) => {
          expect(error).toEqual(mockError);
          expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
            expect.objectContaining({
              api: 'responses',
              endpoint: '/api/responses/text',
              request: { input: 'test error' },
              error: expect.objectContaining({
                message: 'API Error',
                status: 400,
                stack: 'Error stack trace',
              }),
              metadata: expect.objectContaining({
                latency_ms: expect.any(Number),
              }),
            }),
          );
          done();
        },
      });
    });

    it('should handle errors without status', (done) => {
      const mockRequest = {
        url: '/api/responses/text',
        body: { input: 'test' },
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      const mockError = {
        message: 'Unknown error',
      };

      mockCallHandler = {
        handle: jest.fn().mockReturnValue(throwError(() => mockError)),
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          done(new Error('Should not reach here'));
        },
        error: () => {
          expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
            expect.objectContaining({
              error: expect.objectContaining({
                message: 'Unknown error',
                status: undefined,
              }),
            }),
          );
          done();
        },
      });
    });

    it('should extract nested response data from errors', (done) => {
      const mockRequest = {
        url: '/api/responses/text',
        body: { input: 'test' },
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      const mockError = {
        message: 'API Error',
        status: 500,
        response: {
          data: {
            error: {
              type: 'server_error',
              message: 'Internal server error',
            },
          },
        },
      };

      mockCallHandler = {
        handle: jest.fn().mockReturnValue(throwError(() => mockError)),
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          done(new Error('Should not reach here'));
        },
        error: () => {
          expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
            expect.objectContaining({
              error: expect.objectContaining({
                response: {
                  error: {
                    type: 'server_error',
                    message: 'Internal server error',
                  },
                },
              }),
            }),
          );
          done();
        },
      });
    });

    it('should handle unknown error types', (done) => {
      const mockRequest = {
        url: '/api/responses/text',
        body: { input: 'test' },
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      const mockError = {}; // Empty error object

      mockCallHandler = {
        handle: jest.fn().mockReturnValue(throwError(() => mockError)),
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          done(new Error('Should not reach here'));
        },
        error: () => {
          expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
            expect.objectContaining({
              error: expect.objectContaining({
                message: 'Unknown error',
              }),
            }),
          );
          done();
        },
      });
    });

    it('should measure latency for errors', (done) => {
      const mockRequest = {
        url: '/api/responses/text',
        body: { input: 'test' },
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      const mockError = new Error('Test error');

      mockCallHandler = {
        handle: jest.fn().mockReturnValue(throwError(() => mockError)),
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          done(new Error('Should not reach here'));
        },
        error: () => {
          const logCall =
            mockLoggerService.logOpenAIInteraction.mock.calls[0][0];
          expect(logCall.metadata?.latency_ms).toBeGreaterThanOrEqual(0);
          done();
        },
      });
    });
  });

  describe('estimateCost (private method)', () => {
    it('should calculate cost for typical usage', (done) => {
      const mockRequest = {
        url: '/api/responses/text',
        body: { input: 'test', model: 'gpt-5' },
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      const mockResponse = {
        model: 'gpt-5',
        usage: {
          prompt_tokens: 500,
          completion_tokens: 1500,
          total_tokens: 2000,
        },
      };

      mockCallHandler = {
        handle: jest.fn().mockReturnValue(of(mockResponse)),
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          const calls = mockLoggerService.logOpenAIInteraction.mock.calls;
          expect(calls.length).toBeGreaterThan(0);
          const lastCall = calls[calls.length - 1][0];
          // GPT-5 Cost: (500/1_000_000)*0.00125 + (1500/1_000_000)*0.01 = 0.000000625 + 0.000015 = 0.000015625
          expect(lastCall.metadata.cost_estimate).toBeCloseTo(0.000015625, 10);
          done();
        },
        error: done,
      });
    });

    it('should return 0 cost for missing tokens', (done) => {
      const mockRequest = {
        url: '/api/responses/text',
        body: { input: 'test' },
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      const mockResponse = {
        usage: {},
      };

      mockCallHandler = {
        handle: jest.fn().mockReturnValue(of(mockResponse)),
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
            expect.objectContaining({
              metadata: expect.objectContaining({
                cost_estimate: 0,
              }),
            }),
          );
          done();
        },
        error: done,
      });
    });
  });
});
