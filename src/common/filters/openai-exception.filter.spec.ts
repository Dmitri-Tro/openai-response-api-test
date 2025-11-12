import { Test, TestingModule } from '@nestjs/testing';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response, Request } from 'express';
import OpenAI from 'openai';
import { OpenAIExceptionFilter } from './openai-exception.filter';
import { LoggerService } from '../services/logger.service';
import { createMockLoggerService } from '../testing/test.factories';

describe('OpenAIExceptionFilter - Phase 2.10', () => {
  let filter: OpenAIExceptionFilter;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockResponse: Partial<Response>;
  let mockRequest: Partial<Request>;
  let mockArgumentsHost: ArgumentsHost;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let setHeaderMock: jest.Mock;

  beforeEach(async () => {
    // Create jest mocks
    statusMock = jest.fn();
    jsonMock = jest.fn();
    setHeaderMock = jest.fn();

    // Mock LoggerService using factory
    mockLoggerService = createMockLoggerService();

    // Mock Response with proper return chaining
    statusMock.mockReturnValue({ json: jsonMock });
    jsonMock.mockReturnValue({});
    setHeaderMock.mockReturnValue({});

    mockResponse = {
      status: statusMock as unknown as Response['status'],
      json: jsonMock as unknown as Response['json'],
      setHeader: setHeaderMock as unknown as Response['setHeader'],
    };

    // Mock Request
    mockRequest = {
      url: '/api/responses/text',
      body: { input: 'test' },
    };

    // Mock ArgumentsHost
    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenAIExceptionFilter,
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    filter = module.get<OpenAIExceptionFilter>(OpenAIExceptionFilter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('NestJS HttpException', () => {
    it('should handle standard HttpException', () => {
      const exception = new HttpException(
        'Bad request',
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Bad request',
        }),
      );
    });
  });

  describe('OpenAI SDK Errors - Rate Limit (Phase 2.10)', () => {
    it('should handle RateLimitError with request ID and rate limit headers', () => {
      const mockHeaders = new Headers();
      mockHeaders.set('retry-after', '120');
      mockHeaders.set('x-ratelimit-limit-requests', '500');
      mockHeaders.set('x-ratelimit-remaining-requests', '0');
      mockHeaders.set('x-ratelimit-reset-requests', '60');
      mockHeaders.set('x-ratelimit-limit-tokens', '150000');
      mockHeaders.set('x-ratelimit-remaining-tokens', '0');
      mockHeaders.set('x-ratelimit-reset-tokens', '120');

      const exception = new OpenAI.RateLimitError(
        429,
        { error: { message: 'Rate limit exceeded' } },
        'Rate limit exceeded',
        mockHeaders,
      );
      // Mock requestID property
      Object.defineProperty(exception, 'requestID', {
        value: 'req_123',
        writable: true,
      });

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.TOO_MANY_REQUESTS,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Retry-After', '120');
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded',
          request_id: 'req_123',
          error_code: 'rate_limit_error',
          retry_after_seconds: '120',
          rate_limit_info: expect.objectContaining({
            limit_requests: '500',
            remaining_requests: '0',
            limit_tokens: '150000',
            remaining_tokens: '0',
          }),
          hint: expect.stringContaining('rate_limit_info'),
        }),
      );
    });

    it('should handle RateLimitError with default retry-after when header missing', () => {
      const exception = new OpenAI.RateLimitError(
        429,
        { error: { message: 'Rate limit exceeded' } },
        'Rate limit exceeded',
        new Headers(),
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Retry-After', '60');
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          retry_after_seconds: 60,
        }),
      );
    });
  });

  describe('OpenAI SDK Errors - Authentication (Phase 2.10)', () => {
    it('should handle AuthenticationError with request ID', () => {
      const exception = new OpenAI.AuthenticationError(
        401,
        { error: { message: 'Invalid API key' } },
        'Invalid API key',
        new Headers(),
      );
      Object.defineProperty(exception, 'requestID', {
        value: 'req_456',
        writable: true,
      });

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.UNAUTHORIZED,
          message: 'Authentication failed with OpenAI API',
          request_id: 'req_456',
          error_code: 'authentication_error',
          hint: expect.stringContaining('OPENAI_API_KEY'),
        }),
      );
    });
  });

  describe('OpenAI SDK Errors - Internal Server Error (Phase 2.10)', () => {
    it('should handle InternalServerError with request ID', () => {
      const exception = new OpenAI.InternalServerError(
        500,
        { error: { message: 'Server error' } },
        'Server error',
        new Headers(),
      );
      Object.defineProperty(exception, 'requestID', {
        value: 'req_789',
        writable: true,
      });

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_GATEWAY);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_GATEWAY,
          message: 'OpenAI API server error',
          request_id: 'req_789',
          error_code: 'server_error',
          hint: expect.stringContaining('exponential backoff'),
        }),
      );
    });
  });

  describe('OpenAI SDK Errors - Bad Request with Image Error Codes (Phase 2.10)', () => {
    const imageErrorCases = [
      {
        code: 'invalid_image_format',
        message: 'Unsupported image format',
        hint: 'PNG, JPEG, or WebP',
      },
      {
        code: 'image_too_large',
        message: 'Image exceeds maximum size limit',
        hint: '20MB',
      },
      {
        code: 'image_file_not_found',
        message: 'Image file not found at URL',
        hint: '404',
      },
      {
        code: 'image_content_policy_violation',
        message: 'Image violates content policy',
        hint: 'violates OpenAI usage policies',
      },
      {
        code: 'vector_store_timeout',
        message: 'File search operation timed out',
        hint: 'search took too long',
      },
    ];

    imageErrorCases.forEach(({ code, message, hint }) => {
      it(`should handle BadRequestError with ${code} error code`, () => {
        const exception = new OpenAI.BadRequestError(
          400,
          {
            error: {
              message: 'Invalid request',
              code,
              param: 'image',
            },
          },
          'Invalid request',
          new Headers(),
        );
        Object.defineProperty(exception, 'requestID', {
          value: 'req_img',
          writable: true,
        });

        filter.catch(exception, mockArgumentsHost);

        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining(message),
            request_id: 'req_img',
            error_code: code,
            parameter: 'image',
            hint: expect.stringContaining(hint),
          }),
        );
      });
    });

    it('should extract parameter from error', () => {
      const exception = new OpenAI.BadRequestError(
        400,
        {
          error: {
            message: 'Invalid request',
            code: 'invalid_image',
            param: 'images[0].url',
          },
        },
        'Invalid request',
        new Headers(),
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          parameter: 'images[0].url',
        }),
      );
    });

    it('should handle BadRequestError without image-specific error code', () => {
      const exception = new OpenAI.BadRequestError(
        400,
        {
          error: {
            message: 'Invalid request',
            param: 'model',
          },
        },
        'Invalid request',
        new Headers(),
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Invalid request to OpenAI API',
          parameter: 'model',
          hint: expect.stringContaining('Check your request parameters'),
        }),
      );
    });
  });

  describe('OpenAI SDK Errors - Other Error Types (Phase 2.10)', () => {
    it('should handle PermissionDeniedError', () => {
      const exception = new OpenAI.PermissionDeniedError(
        403,
        { error: { message: 'Permission denied' } },
        'Permission denied',
        new Headers(),
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.FORBIDDEN,
          message: 'Permission denied for OpenAI API resource',
          error_code: 'permission_denied_error',
        }),
      );
    });

    it('should handle NotFoundError', () => {
      const exception = new OpenAI.NotFoundError(
        404,
        { error: { message: 'Not found' } },
        'Not found',
        new Headers(),
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Resource not found',
          error_code: 'not_found_error',
        }),
      );
    });

    it('should handle APIConnectionTimeoutError', () => {
      const exception = new OpenAI.APIConnectionTimeoutError({
        message: 'Request timed out',
      });

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.GATEWAY_TIMEOUT,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.GATEWAY_TIMEOUT,
          message: 'Request to OpenAI API timed out',
          error_code: 'timeout_error',
        }),
      );
    });
  });

  describe('Network Errors (Phase 2.10)', () => {
    const networkErrorCases = [
      { code: 'ECONNREFUSED', status: HttpStatus.SERVICE_UNAVAILABLE },
      { code: 'ETIMEDOUT', status: HttpStatus.GATEWAY_TIMEOUT },
      { code: 'ECONNRESET', status: HttpStatus.GATEWAY_TIMEOUT },
      { code: 'ENOTFOUND', status: HttpStatus.SERVICE_UNAVAILABLE },
      { code: 'EHOSTUNREACH', status: HttpStatus.SERVICE_UNAVAILABLE },
    ];

    networkErrorCases.forEach(({ code, status }) => {
      it(`should handle ${code} network error`, () => {
        const exception = { code, message: `Network error: ${code}` };

        filter.catch(exception, mockArgumentsHost);

        expect(mockResponse.status).toHaveBeenCalledWith(status);
        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: status,
            error_code: code,
            hint: expect.any(String),
          }),
        );
      });
    });
  });

  describe('Generic Errors', () => {
    it('should handle unknown errors', () => {
      const exception = new Error('Unknown error');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Unknown error',
          full_error: expect.objectContaining({
            message: 'Unknown error',
            name: 'Error',
          }),
        }),
      );
    });
  });

  describe('Logging Integration (Phase 2.10)', () => {
    it('should log all errors with original_error', () => {
      const exception = new Error('Test error');

      filter.catch(exception, mockArgumentsHost);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'responses',
          endpoint: '/api/responses/text',
          request: { input: 'test' },
          error: expect.objectContaining({
            original_error: exception,
          }),
        }),
      );
    });

    it('should log OpenAI errors with request ID', () => {
      const exception = new OpenAI.RateLimitError(
        429,
        { error: { message: 'Rate limit' } },
        'Rate limit',
        new Headers(),
      );
      Object.defineProperty(exception, 'requestID', {
        value: 'req_log',
        writable: true,
      });

      filter.catch(exception, mockArgumentsHost);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            request_id: 'req_log',
          }),
        }),
      );
    });
  });

  describe('Request ID Tracking (Phase 2.10)', () => {
    it('should use "unknown" when request ID is not available', () => {
      const exception = new OpenAI.BadRequestError(
        400,
        { error: { message: 'Bad request' } },
        'Bad request',
        new Headers(),
      );
      // Don't set requestID property

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          request_id: 'unknown',
        }),
      );
    });
  });

  describe('All 15 Image Error Codes (Phase 2.10 Coverage)', () => {
    const allImageErrors = [
      'vector_store_timeout',
      'invalid_image',
      'invalid_image_format',
      'invalid_base64_image',
      'invalid_image_url',
      'image_parse_error',
      'invalid_image_mode',
      'unsupported_image_media_type',
      'image_too_large',
      'image_too_small',
      'image_file_too_large',
      'empty_image_file',
      'image_content_policy_violation',
      'failed_to_download_image',
      'image_file_not_found',
    ];

    allImageErrors.forEach((code) => {
      it(`should handle ${code} error code`, () => {
        const exception = new OpenAI.BadRequestError(
          400,
          {
            error: {
              message: 'Image error',
              code,
            },
          },
          'Image error',
          new Headers(),
        );

        filter.catch(exception, mockArgumentsHost);

        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error_code: code,
            hint: expect.any(String),
          }),
        );
      });
    });
  });
});
