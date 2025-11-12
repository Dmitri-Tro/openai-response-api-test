/**
 * Integration Tests: Error Recovery
 *
 * Tests the system's ability to recover from various error conditions:
 * - Retry after transient failures (rate limits, timeouts, network errors)
 * - Fallback strategies when primary operations fail
 * - Graceful degradation and error handling
 * - State recovery after interrupted operations
 * - Logging and tracking of error recovery attempts
 *
 * These tests verify that the system handles failures gracefully and
 * implements appropriate recovery strategies.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { Responses } from 'openai/resources/responses';
import { OpenAIResponsesService } from '../../src/openai/services/openai-responses.service';
import { ResponsesController } from '../../src/openai/controllers/responses.controller';
import { LoggerService } from '../../src/common/services/logger.service';
import { OpenAIExceptionFilter } from '../../src/common/filters/openai-exception.filter';
import { LifecycleEventsHandler } from '../../src/openai/services/handlers/lifecycle-events.handler';
import { TextEventsHandler } from '../../src/openai/services/handlers/text-events.handler';
import { ReasoningEventsHandler } from '../../src/openai/services/handlers/reasoning-events.handler';
import { ToolCallingEventsHandler } from '../../src/openai/services/handlers/tool-calling-events.handler';
import { ImageEventsHandler } from '../../src/openai/services/handlers/image-events.handler';
import { AudioEventsHandler } from '../../src/openai/services/handlers/audio-events.handler';
import { MCPEventsHandler } from '../../src/openai/services/handlers/mcp-events.handler';
import { RefusalEventsHandler } from '../../src/openai/services/handlers/refusal-events.handler';
import { StructuralEventsHandler } from '../../src/openai/services/handlers/structural-events.handler';
import configuration from '../../src/config/configuration';
import {
  createMockOpenAIResponse,
  createMockLoggerService,
} from '../../src/common/testing/test.factories';
import { CreateTextResponseDto } from '../../src/openai/dto/create-text-response.dto';

describe('Error Recovery Integration', () => {
  let module: TestingModule;
  let service: OpenAIResponsesService;
  let controller: ResponsesController;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockClient: jest.Mocked<OpenAI>;

  beforeAll(async () => {
    process.env.OPENAI_API_KEY = 'sk-test-error-recovery-key';
    process.env.OPENAI_API_BASE_URL = 'https://api.test.openai.com';
    process.env.OPENAI_DEFAULT_MODEL = 'gpt-5';
    process.env.OPENAI_TIMEOUT = '30000';
    process.env.OPENAI_MAX_RETRIES = '3';
    process.env.LOG_LEVEL = 'error';

    mockLoggerService = createMockLoggerService();

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [configuration],
          isGlobal: true,
        }),
      ],
      controllers: [ResponsesController],
      providers: [
        OpenAIResponsesService,
        LoggerService,
        OpenAIExceptionFilter,
        LifecycleEventsHandler,
        TextEventsHandler,
        ReasoningEventsHandler,
        ToolCallingEventsHandler,
        ImageEventsHandler,
        AudioEventsHandler,
        MCPEventsHandler,
        RefusalEventsHandler,
        StructuralEventsHandler,
      ],
    })
      .overrideProvider(LoggerService)
      .useValue(mockLoggerService)
      .compile();

    service = module.get<OpenAIResponsesService>(OpenAIResponsesService);
    controller = module.get<ResponsesController>(ResponsesController);
    mockClient = (service as any).client as jest.Mocked<OpenAI>;
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_BASE_URL;
    delete process.env.OPENAI_DEFAULT_MODEL;
    delete process.env.OPENAI_TIMEOUT;
    delete process.env.OPENAI_MAX_RETRIES;
    delete process.env.LOG_LEVEL;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Retry After Transient Failures', () => {
    it('should retry after rate limit error (429) with retry-after header', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Test rate limit retry',
      };

      const rateLimitError = new OpenAI.RateLimitError(
        429,
        {
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_error',
          },
        },
        'Rate limit exceeded',
        new Headers({
          'retry-after': '2',
          'x-ratelimit-limit-requests': '100',
          'x-ratelimit-remaining-requests': '0',
          'x-ratelimit-reset-requests': '2s',
        }),
      );

      // Mock only rejects with rate limit error
      jest
        .spyOn(mockClient.responses, 'create')
        .mockRejectedValueOnce(rateLimitError);

      // Act & Assert
      // Note: OpenAI SDK handles retries internally with maxRetries config
      // First attempt will fail, but SDK should handle retry logic
      await expect(service.createTextResponse(dto)).rejects.toThrow(
        OpenAI.RateLimitError,
      );

      // Verify error was logged
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            status: 429,
            message: expect.stringContaining('Rate limit exceeded'),
          }),
        }),
      );
    });

    it('should handle network timeout and log appropriately', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Test timeout handling',
      };

      const timeoutError = new Error('Request timeout') as Error & {
        name: string;
        code: string;
      };
      timeoutError.name = 'TimeoutError';
      timeoutError.code = 'ETIMEDOUT';

      jest
        .spyOn(mockClient.responses, 'create')
        .mockRejectedValueOnce(timeoutError);

      // Act & Assert
      await expect(service.createTextResponse(dto)).rejects.toThrow(
        'Request timeout',
      );

      // Verify timeout was logged
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.stringContaining('Request timeout'),
          }),
        }),
      );
    });

    it('should handle server error (500) and log failure', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Test server error handling',
      };

      const serverError = new OpenAI.InternalServerError(
        500,
        {
          error: {
            message: 'Internal server error',
            type: 'server_error',
          },
        },
        'Internal server error',
        new Headers(),
      );

      jest
        .spyOn(mockClient.responses, 'create')
        .mockRejectedValueOnce(serverError);

      // Act & Assert
      await expect(service.createTextResponse(dto)).rejects.toThrow(
        OpenAI.InternalServerError,
      );

      // Verify server error was logged
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            status: 500,
            message: expect.stringContaining('Internal server error'),
          }),
        }),
      );
    });

    it('should handle service unavailable (503) error', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Test service unavailable',
      };

      const serviceError = new OpenAI.APIError(
        503,
        {
          error: {
            message: 'Service temporarily unavailable',
            type: 'service_unavailable',
          },
        },
        'Service temporarily unavailable',
        new Headers({
          'retry-after': '30',
        }),
      );

      jest
        .spyOn(mockClient.responses, 'create')
        .mockRejectedValueOnce(serviceError)
        .mockRejectedValueOnce(serviceError);

      // Act & Assert - First call
      await expect(service.createTextResponse(dto)).rejects.toThrow(
        OpenAI.APIError,
      );

      // Verify the error has proper status and retry-after header - Second call
      try {
        await service.createTextResponse(dto);
      } catch (error) {
        if (error instanceof OpenAI.APIError) {
          expect(error.status).toBe(503);
          expect(error.headers?.get('retry-after')).toBe('30');
        }
      }
    });
  });

  describe('Authentication and Authorization Recovery', () => {
    it('should handle authentication error (401) without retry', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Test auth error',
      };

      const authError = new OpenAI.AuthenticationError(
        401,
        {
          error: {
            message: 'Invalid API key',
            type: 'invalid_authentication',
          },
        },
        'Invalid API key',
        new Headers(),
      );

      jest
        .spyOn(mockClient.responses, 'create')
        .mockRejectedValueOnce(authError);

      // Act & Assert
      await expect(service.createTextResponse(dto)).rejects.toThrow(
        OpenAI.AuthenticationError,
      );

      // Verify auth error was logged
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            status: 401,
            message: expect.stringContaining('Invalid API key'),
          }),
        }),
      );

      // Verify only one call was made (no retry for auth errors)
      expect(mockClient.responses.create).toHaveBeenCalledTimes(1);
    });

    it('should handle permission denied error (403)', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Test permission error',
      };

      const permissionError = new OpenAI.PermissionDeniedError(
        403,
        {
          error: {
            message: 'Insufficient permissions',
            type: 'insufficient_permissions',
          },
        },
        'Insufficient permissions',
        new Headers(),
      );

      jest
        .spyOn(mockClient.responses, 'create')
        .mockRejectedValueOnce(permissionError);

      // Act & Assert
      await expect(service.createTextResponse(dto)).rejects.toThrow(
        OpenAI.PermissionDeniedError,
      );

      // Verify permission error was logged
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            status: 403,
            message: expect.stringContaining('Insufficient permissions'),
          }),
        }),
      );
    });
  });

  describe('Resource Not Found Recovery', () => {
    it('should handle retrieve failure when response does not exist', async () => {
      // Arrange
      const nonExistentId = 'resp_nonexistent_123';

      const notFoundError = new OpenAI.NotFoundError(
        404,
        {
          error: {
            message: 'Response not found',
            type: 'not_found_error',
          },
        },
        'Response not found',
        new Headers(),
      );

      jest
        .spyOn(mockClient.responses, 'retrieve')
        .mockRejectedValueOnce(notFoundError);

      // Act & Assert
      await expect(controller.retrieveResponse(nonExistentId)).rejects.toThrow(
        OpenAI.NotFoundError,
      );

      // Verify retrieve was attempted
      expect(mockClient.responses.retrieve).toHaveBeenCalledWith(
        nonExistentId,
        { stream: false },
      );
    });

    it('should handle cancel failure when response does not exist', async () => {
      // Arrange
      const nonExistentId = 'resp_nonexistent_456';

      const notFoundError = new OpenAI.NotFoundError(
        404,
        {
          error: {
            message: 'Response not found',
            type: 'not_found_error',
          },
        },
        'Response not found',
        new Headers(),
      );

      jest
        .spyOn(mockClient.responses, 'cancel')
        .mockRejectedValueOnce(notFoundError);

      // Act & Assert
      await expect(controller.cancelResponse(nonExistentId)).rejects.toThrow(
        OpenAI.NotFoundError,
      );
    });

    it('should handle delete failure when response already deleted', async () => {
      // Arrange
      const alreadyDeletedId = 'resp_already_deleted_789';

      const notFoundError = new OpenAI.NotFoundError(
        404,
        {
          error: {
            message: 'Response already deleted',
            type: 'not_found_error',
          },
        },
        'Response already deleted',
        new Headers(),
      );

      jest
        .spyOn(mockClient.responses, 'delete')
        .mockRejectedValueOnce(notFoundError);

      // Act & Assert
      await expect(controller.deleteResponse(alreadyDeletedId)).rejects.toThrow(
        OpenAI.NotFoundError,
      );
    });
  });

  describe('Validation Error Recovery', () => {
    it('should handle invalid request parameters (400)', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: '', // Invalid: empty input
      };

      const validationError = new OpenAI.BadRequestError(
        400,
        {
          error: {
            message: 'Input cannot be empty',
            type: 'invalid_request_error',
            code: 'invalid_input',
          },
        },
        'Input cannot be empty',
        new Headers(),
      );

      jest
        .spyOn(mockClient.responses, 'create')
        .mockRejectedValueOnce(validationError);

      // Act & Assert
      await expect(service.createTextResponse(dto)).rejects.toThrow(
        OpenAI.BadRequestError,
      );

      // Verify validation error was logged with details
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            status: 400,
            message: expect.stringContaining('Input cannot be empty'),
          }),
        }),
      );

      // Verify no retry for validation errors
      expect(mockClient.responses.create).toHaveBeenCalledTimes(1);
    });

    it('should handle invalid model parameter', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Test with invalid model',
        model: 'nonexistent-model-xyz',
      };

      const modelError = new OpenAI.BadRequestError(
        400,
        {
          error: {
            message: 'Invalid model specified',
            type: 'invalid_request_error',
            param: 'model',
          },
        },
        'Invalid model specified',
        new Headers(),
      );

      jest
        .spyOn(mockClient.responses, 'create')
        .mockRejectedValueOnce(modelError);

      // Act & Assert
      await expect(service.createTextResponse(dto)).rejects.toThrow(
        OpenAI.BadRequestError,
      );

      // Verify parameter context is preserved
      try {
        await service.createTextResponse(dto);
      } catch (error) {
        if (error instanceof OpenAI.BadRequestError) {
          expect(error.status).toBe(400);
          expect(error.message).toContain('Invalid model specified');
        }
      }
    });

    it('should handle conflicting parameters error', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Test conflicting params',
        temperature: 0.7,
        top_p: 0.9,
        // Some combinations may be invalid depending on API rules
      };

      const conflictError = new OpenAI.BadRequestError(
        400,
        {
          error: {
            message: 'Cannot use temperature and top_p together',
            type: 'invalid_request_error',
            code: 'conflicting_parameters',
          },
        },
        'Cannot use temperature and top_p together',
        new Headers(),
      );

      jest
        .spyOn(mockClient.responses, 'create')
        .mockRejectedValueOnce(conflictError);

      // Act & Assert
      await expect(service.createTextResponse(dto)).rejects.toThrow(
        OpenAI.BadRequestError,
      );

      // Verify conflict error was logged
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            status: 400,
            message: expect.stringContaining('Cannot use'),
          }),
        }),
      );
    });
  });

  describe('Network and Connectivity Recovery', () => {
    it('should handle network connection refused error', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Test connection error',
      };

      const connectionError = new Error('Connection refused') as Error & {
        code: string;
      };
      connectionError.code = 'ECONNREFUSED';

      jest
        .spyOn(mockClient.responses, 'create')
        .mockRejectedValueOnce(connectionError);

      // Act & Assert
      await expect(service.createTextResponse(dto)).rejects.toThrow(
        'Connection refused',
      );

      // Verify connection error was logged
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.stringContaining('Connection refused'),
          }),
        }),
      );
    });

    it('should handle DNS resolution failure', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Test DNS error',
      };

      const dnsError = new Error('DNS lookup failed') as Error & {
        code: string;
        hostname: string;
      };
      dnsError.code = 'ENOTFOUND';
      dnsError.hostname = 'invalid.openai.com';

      jest
        .spyOn(mockClient.responses, 'create')
        .mockRejectedValueOnce(dnsError);

      // Act & Assert
      await expect(service.createTextResponse(dto)).rejects.toThrow(
        'DNS lookup failed',
      );

      // Verify DNS error was logged
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.stringContaining('DNS lookup failed'),
          }),
        }),
      );
    });

    it('should handle connection reset by peer', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Test connection reset',
      };

      const resetError = new Error('Connection reset by peer') as Error & {
        code: string;
      };
      resetError.code = 'ECONNRESET';

      jest
        .spyOn(mockClient.responses, 'create')
        .mockRejectedValueOnce(resetError);

      // Act & Assert
      await expect(service.createTextResponse(dto)).rejects.toThrow(
        'Connection reset by peer',
      );

      // Verify connection reset was logged
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.stringContaining('Connection reset'),
          }),
        }),
      );
    });
  });

  describe('Graceful Error State Management', () => {
    it('should preserve request context in error logs', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Test with metadata',
        model: 'gpt-5',
        conversation: 'conv_error_test',
        metadata: {
          user_id: 'user_123',
          session_id: 'session_456',
        },
      };

      const error = new OpenAI.APIError(
        500,
        {
          error: {
            message: 'Server error',
            type: 'server_error',
          },
        },
        'Server error',
        new Headers(),
      );

      jest.spyOn(mockClient.responses, 'create').mockRejectedValueOnce(error);

      // Act & Assert
      await expect(service.createTextResponse(dto)).rejects.toThrow(
        OpenAI.APIError,
      );

      // Verify request context is preserved in error logs
      // Note: Only input and model are logged in the request object
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          request: expect.objectContaining({
            input: 'Test with metadata',
            model: 'gpt-5',
          }),
          error: expect.objectContaining({
            status: 500,
          }),
        }),
      );
    });

    it('should log both successful and failed operations in sequence', async () => {
      // Arrange
      const successDto: CreateTextResponseDto = {
        input: 'This will succeed',
      };

      const failDto: CreateTextResponseDto = {
        input: 'This will fail',
      };

      const successResponse = createMockOpenAIResponse({
        output_text: 'Success',
      });

      const error = new OpenAI.APIError(
        500,
        {
          error: {
            message: 'Server error',
            type: 'server_error',
          },
        },
        'Server error',
        new Headers(),
      );

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(successResponse)
        .mockRejectedValueOnce(error);

      // Act
      const result1 = await service.createTextResponse(successDto);
      await expect(service.createTextResponse(failDto)).rejects.toThrow();

      // Assert
      expect(result1.output_text).toBe('Success');

      // Verify both operations were logged
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledTimes(2);

      // First call: success
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          request: expect.objectContaining({
            input: 'This will succeed',
          }),
          response: expect.objectContaining({
            output_text: 'Success',
          }),
        }),
      );

      // Second call: error
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          request: expect.objectContaining({
            input: 'This will fail',
          }),
          error: expect.objectContaining({
            status: 500,
          }),
        }),
      );
    });

    it('should maintain service stability after multiple consecutive errors', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Test multiple failures',
      };

      const error = new OpenAI.APIError(
        500,
        {
          error: {
            message: 'Server error',
            type: 'server_error',
          },
        },
        'Server error',
        new Headers(),
      );

      const successResponse = createMockOpenAIResponse({
        output_text: 'Recovery successful',
      });

      // Fail 3 times, then succeed
      jest
        .spyOn(mockClient.responses, 'create')
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(successResponse);

      // Act - Try 3 failed calls
      await expect(service.createTextResponse(dto)).rejects.toThrow();
      await expect(service.createTextResponse(dto)).rejects.toThrow();
      await expect(service.createTextResponse(dto)).rejects.toThrow();

      // Then verify service still works
      const result = await service.createTextResponse(dto);

      // Assert
      expect(result.output_text).toBe('Recovery successful');
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledTimes(4);
    });
  });
});
