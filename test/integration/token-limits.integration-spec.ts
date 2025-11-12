/**
 * Integration Tests: Token Limits Edge Cases
 *
 * Tests edge cases and boundary conditions related to token limits:
 * - Requests approaching or exceeding max_output_tokens
 * - Context length limits and truncation
 * - Token counting and usage tracking with limits
 * - Finish reasons related to token limits (length vs stop)
 * - Different token limits for different models
 * - Token limits with reasoning models (o-series)
 * - Token limits with prompt caching
 * - Incomplete responses due to token limits
 *
 * These tests verify proper handling of token limit scenarios.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
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

describe('Token Limits Edge Cases Integration', () => {
  let module: TestingModule;
  let service: OpenAIResponsesService;
  let controller: ResponsesController;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockClient: jest.Mocked<OpenAI>;

  beforeAll(async () => {
    process.env.OPENAI_API_KEY = 'sk-test-token-limits-key';
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

  describe('Max Output Tokens Limits', () => {
    it('should handle response truncated due to max_output_tokens', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Write a long essay',
        max_output_tokens: 100,
      };

      const mockResponse = createMockOpenAIResponse({
        output_text: 'This is a truncated response...',
        status: 'incomplete',
        status_details: {
          type: 'max_tokens',
          reason: 'max_output_tokens_reached',
        },
        usage: {
          input_tokens: 20,
          output_tokens: 100, // Exactly at limit
          total_tokens: 120,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      // Act
      const result = await controller.createTextResponse(dto);

      // Assert
      expect(result.status).toBe('incomplete');
      expect(result.status_details?.type).toBe('max_tokens');
      expect(result.usage.output_tokens).toBe(100);
      expect(mockClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          max_output_tokens: 100,
        }),
      );
    });

    it('should handle very small max_output_tokens (minimal response)', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Say hi',
        max_output_tokens: 1, // Only 1 token output
      };

      const mockResponse = createMockOpenAIResponse({
        output_text: 'Hi',
        status: 'completed',
        usage: {
          input_tokens: 10,
          output_tokens: 1,
          total_tokens: 11,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      // Act
      const result = await controller.createTextResponse(dto);

      // Assert
      expect(result.usage.output_tokens).toBe(1);
      expect(result.output_text).toBe('Hi');
    });

    it('should handle large max_output_tokens (4096)', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Write a comprehensive guide',
        max_output_tokens: 4096,
      };

      const mockResponse = createMockOpenAIResponse({
        output_text: 'A very long comprehensive guide...',
        status: 'completed',
        usage: {
          input_tokens: 50,
          output_tokens: 4000, // Under limit, completed naturally
          total_tokens: 4050,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      // Act
      const result = await controller.createTextResponse(dto);

      // Assert
      expect(result.status).toBe('completed');
      expect(result.usage.output_tokens).toBeLessThan(4096);
      expect(mockClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          max_output_tokens: 4096,
        }),
      );
    });

    it('should track token usage when reaching exactly max_output_tokens', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Generate content',
        max_output_tokens: 500,
      };

      const mockResponse = createMockOpenAIResponse({
        output_text: 'Generated content that reaches exactly 500 tokens...',
        status: 'incomplete',
        status_details: {
          type: 'max_tokens',
          reason: 'max_output_tokens_reached',
        },
        usage: {
          input_tokens: 30,
          output_tokens: 500, // Exactly at limit
          total_tokens: 530,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      // Act
      await controller.createTextResponse(dto);

      // Assert - Verify usage logging
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            tokens_used: 530,
          }),
        }),
      );
    });
  });

  describe('Context Length Limits', () => {
    it('should handle very long input approaching context window', async () => {
      // Arrange - Simulating a request with very long input
      const longInput = 'A'.repeat(10000); // Very long input string
      const dto: CreateTextResponseDto = {
        input: longInput,
        max_output_tokens: 100,
      };

      const mockResponse = createMockOpenAIResponse({
        output_text: 'Response to very long input',
        usage: {
          input_tokens: 2500, // Large input token count
          output_tokens: 100,
          total_tokens: 2600,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      // Act
      const result = await controller.createTextResponse(dto);

      // Assert
      expect(result.usage.input_tokens).toBeGreaterThan(1000);
      expect(result.usage.total_tokens).toBeGreaterThan(2000);
    });

    it('should handle context_length_exceeded error', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'A'.repeat(50000), // Extremely long input
        max_output_tokens: 4096,
      };

      const contextError = new OpenAI.BadRequestError(
        400,
        {
          error: {
            message:
              "This model's maximum context length is 128000 tokens. However, your messages resulted in 150000 tokens.",
            type: 'invalid_request_error',
            code: 'context_length_exceeded',
            param: 'messages',
          },
        },
        "This model's maximum context length is 128000 tokens",
        new Headers(),
      );

      jest
        .spyOn(mockClient.responses, 'create')
        .mockRejectedValueOnce(contextError);

      // Act & Assert
      await expect(controller.createTextResponse(dto)).rejects.toThrow(
        OpenAI.BadRequestError,
      );

      // Verify error contains context length information
      try {
        await controller.createTextResponse(dto);
      } catch (error) {
        if (error instanceof OpenAI.BadRequestError) {
          expect(error.status).toBe(400);
          expect(error.message).toContain('context length');
        }
      }
    });

    it('should handle different models with different context windows', async () => {
      // Arrange - gpt-4o with 128k context window
      const dto: CreateTextResponseDto = {
        input: 'Test with large context',
        model: 'gpt-4o',
        max_output_tokens: 16000, // Large output
      };

      const mockResponse = createMockOpenAIResponse({
        model: 'gpt-4o',
        output_text: 'Response from gpt-4o with large context',
        usage: {
          input_tokens: 50,
          output_tokens: 15000,
          total_tokens: 15050,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      // Act
      const result = await controller.createTextResponse(dto);

      // Assert
      expect(result.model).toBe('gpt-4o');
      expect(result.usage.total_tokens).toBeGreaterThan(10000);
    });
  });

  describe('Token Limits with Reasoning Models', () => {
    it('should handle reasoning tokens exceeding output limit for o-series', async () => {
      // Arrange - o1-preview uses reasoning tokens
      const dto: CreateTextResponseDto = {
        input: 'Solve complex problem',
        model: 'o1-preview',
        max_output_tokens: 5000,
      };

      const mockResponse = createMockOpenAIResponse({
        model: 'o1-preview',
        output_text: 'Solution after reasoning...',
        status: 'incomplete',
        status_details: {
          type: 'max_tokens',
          reason: 'max_output_tokens_reached',
        },
        usage: {
          input_tokens: 100,
          output_tokens: 5000, // At limit
          total_tokens: 5100,
          output_tokens_details: {
            reasoning_tokens: 4000, // Most tokens used for reasoning
          },
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      // Act
      const result = await controller.createTextResponse(dto);

      // Assert
      expect(result.status).toBe('incomplete');
      expect(result.usage.output_tokens).toBe(5000);
      expect(result.usage.output_tokens_details?.reasoning_tokens).toBe(4000);

      // Verify reasoning tokens were logged
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            reasoning_tokens: 4000,
          }),
        }),
      );
    });

    it('should handle o-series model with very high reasoning token usage', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Complex mathematical proof',
        model: 'o1',
        max_output_tokens: 10000,
      };

      const mockResponse = createMockOpenAIResponse({
        model: 'o1',
        output_text: 'Proof completed',
        usage: {
          input_tokens: 200,
          output_tokens: 9500,
          total_tokens: 9700,
          output_tokens_details: {
            reasoning_tokens: 9000, // 95% reasoning
          },
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      // Act
      const result = await controller.createTextResponse(dto);

      // Assert
      expect(result.usage.output_tokens_details?.reasoning_tokens).toBe(9000);
      expect(
        result.usage.output_tokens_details?.reasoning_tokens,
      ).toBeGreaterThan(result.usage.output_tokens * 0.9);
    });
  });

  describe('Token Limits with Prompt Caching', () => {
    it('should handle cached tokens with token limits', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Continue from cached context',
        prompt_cache_key: 'cache_123',
        max_output_tokens: 1000,
      };

      const mockResponse = createMockOpenAIResponse({
        output_text: 'Response using cached tokens',
        usage: {
          input_tokens: 500,
          output_tokens: 1000, // At limit
          total_tokens: 1500,
          input_tokens_details: {
            cached_tokens: 400, // Most input was cached
          },
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      // Act
      const result = await controller.createTextResponse(dto);

      // Assert
      expect(result.usage.input_tokens_details?.cached_tokens).toBe(400);
      expect(result.usage.output_tokens).toBe(1000);

      // Verify cached tokens were logged
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            cached_tokens: 400,
            tokens_used: 1500,
          }),
        }),
      );
    });

    it('should handle high cache hit rate with token limits', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Query with 90% cache hit',
        prompt_cache_key: 'cache_high_hit',
        max_output_tokens: 500,
      };

      const mockResponse = createMockOpenAIResponse({
        output_text: 'Response with high cache usage',
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          total_tokens: 1500,
          input_tokens_details: {
            cached_tokens: 900, // 90% cached
          },
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      // Act
      const result = await controller.createTextResponse(dto);

      // Assert
      const cacheHitRate =
        (result.usage.input_tokens_details?.cached_tokens || 0) /
        result.usage.input_tokens;
      expect(cacheHitRate).toBeGreaterThan(0.8);
    });
  });

  describe('Finish Reasons and Token Limits', () => {
    it('should distinguish between finish_reason length vs stop', async () => {
      // Arrange - Response stopped naturally (not truncated)
      const dto: CreateTextResponseDto = {
        input: 'Say hello',
        max_output_tokens: 1000,
      };

      const mockResponse = createMockOpenAIResponse({
        output_text: 'Hello!',
        status: 'completed',
        usage: {
          input_tokens: 10,
          output_tokens: 5, // Well under limit
          total_tokens: 15,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      // Act
      const result = await controller.createTextResponse(dto);

      // Assert - Completed naturally, not due to token limit
      expect(result.status).toBe('completed');
      expect(result.usage.output_tokens).toBeLessThan(1000);
    });

    it('should handle incomplete status when token limit reached', async () => {
      // Arrange - Response truncated by token limit
      const dto: CreateTextResponseDto = {
        input: 'Write a very long story',
        max_output_tokens: 200,
      };

      const mockResponse = createMockOpenAIResponse({
        output_text: 'Once upon a time... [truncated]',
        status: 'incomplete',
        status_details: {
          type: 'max_tokens',
          reason: 'max_output_tokens_reached',
        },
        usage: {
          input_tokens: 30,
          output_tokens: 200, // Exactly at limit
          total_tokens: 230,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      // Act
      const result = await controller.createTextResponse(dto);

      // Assert
      expect(result.status).toBe('incomplete');
      expect(result.status_details?.type).toBe('max_tokens');
      expect(result.usage.output_tokens).toBe(200);
    });
  });

  describe('Token Usage Tracking with Limits', () => {
    it('should accurately track tokens when approaching limit', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Generate text',
        max_output_tokens: 300,
      };

      const mockResponse = createMockOpenAIResponse({
        output_text: 'Generated text approaching limit...',
        usage: {
          input_tokens: 25,
          output_tokens: 295, // Just under limit
          total_tokens: 320,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      // Act
      const result = await controller.createTextResponse(dto);

      // Assert
      expect(result.usage.output_tokens).toBe(295);
      expect(result.usage.output_tokens).toBeLessThan(300);
      expect(result.usage.total_tokens).toBe(320);
    });

    it('should track combined input + output approaching total model limit', async () => {
      // Arrange - Simulating near context window limit
      const dto: CreateTextResponseDto = {
        input: 'A'.repeat(20000), // Large input
        max_output_tokens: 4000,
      };

      const mockResponse = createMockOpenAIResponse({
        output_text: 'Response to large input',
        usage: {
          input_tokens: 5000,
          output_tokens: 4000,
          total_tokens: 9000, // High total usage
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      // Act
      const result = await controller.createTextResponse(dto);

      // Assert
      expect(result.usage.total_tokens).toBeGreaterThan(8000);
      expect(result.usage.input_tokens).toBeGreaterThan(4000);
    });

    it('should handle zero output tokens (edge case)', async () => {
      // Arrange - Request with max_output_tokens: 0 (should be rejected)
      const dto: CreateTextResponseDto = {
        input: 'Test with zero output',
        max_output_tokens: 0,
      };

      const zeroTokenError = new OpenAI.BadRequestError(
        400,
        {
          error: {
            message: 'max_output_tokens must be at least 1',
            type: 'invalid_request_error',
            param: 'max_output_tokens',
          },
        },
        'max_output_tokens must be at least 1',
        new Headers(),
      );

      jest
        .spyOn(mockClient.responses, 'create')
        .mockRejectedValueOnce(zeroTokenError);

      // Act & Assert
      await expect(controller.createTextResponse(dto)).rejects.toThrow(
        OpenAI.BadRequestError,
      );
    });
  });

  describe('Model-Specific Token Limits', () => {
    it('should handle gpt-5 with higher token limits', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Generate comprehensive analysis',
        model: 'gpt-5',
        max_output_tokens: 8000, // High limit for advanced model
      };

      const mockResponse = createMockOpenAIResponse({
        model: 'gpt-5',
        output_text: 'Comprehensive analysis...',
        usage: {
          input_tokens: 100,
          output_tokens: 7500,
          total_tokens: 7600,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      // Act
      const result = await controller.createTextResponse(dto);

      // Assert
      expect(result.model).toBe('gpt-5');
      expect(result.usage.output_tokens).toBeGreaterThan(7000);
    });

    it('should handle token limit differences between gpt-4o and gpt-4o-mini', async () => {
      // Arrange - gpt-4o-mini typically has lower max output
      const dto: CreateTextResponseDto = {
        input: 'Generate content',
        model: 'gpt-4o-mini',
        max_output_tokens: 4096,
      };

      const mockResponse = createMockOpenAIResponse({
        model: 'gpt-4o-mini',
        output_text: 'Content from mini model',
        usage: {
          input_tokens: 50,
          output_tokens: 2000,
          total_tokens: 2050,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      // Act
      const result = await controller.createTextResponse(dto);

      // Assert
      expect(result.model).toBe('gpt-4o-mini');
      expect(result.usage.output_tokens).toBeLessThanOrEqual(4096);
    });
  });
});
