/**
 * Integration Tests: Service + Dependencies
 *
 * Tests the OpenAIResponsesService with its real dependencies:
 * - ConfigService (real - provides configuration)
 * - LoggerService (real - handles logging)
 * - Event Handlers (real - process streaming events)
 * - OpenAI Client (mocked - external API calls)
 *
 * These tests verify that the service correctly:
 * - Initializes with configuration values
 * - Uses logger for interaction tracking
 * - Coordinates with event handlers for streaming
 * - Handles OpenAI client responses and errors
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { Responses } from 'openai/resources/responses';
import { OpenAIResponsesService } from '../../src/openai/services/openai-responses.service';
import { LoggerService } from '../../src/common/services/logger.service';
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

describe('Service + Dependencies Integration', () => {
  let module: TestingModule;
  let service: OpenAIResponsesService;
  let configService: ConfigService;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockClient: jest.Mocked<OpenAI>;

  beforeAll(async () => {
    // Set test environment with specific config values
    process.env.OPENAI_API_KEY = 'sk-test-service-deps-key';
    process.env.OPENAI_API_BASE_URL = 'https://api.test.openai.com';
    process.env.OPENAI_DEFAULT_MODEL = 'gpt-5-test';
    process.env.OPENAI_TIMEOUT = '30000';
    process.env.OPENAI_MAX_RETRIES = '2';
    process.env.LOG_LEVEL = 'error';

    mockLoggerService = createMockLoggerService();

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [configuration],
          isGlobal: true,
        }),
      ],
      providers: [
        OpenAIResponsesService,
        LoggerService,
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
    configService = module.get<ConfigService>(ConfigService);

    // Get reference to the OpenAI client
    mockClient = (service as any).client as jest.Mocked<OpenAI>;
    jest.spyOn(mockClient.responses, 'create');
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

  describe('Service Initialization with Config', () => {
    it('should initialize with config values from ConfigService', () => {
      // Assert service uses config values for OpenAI client
      const client = (service as any).client as OpenAI;
      expect(client).toBeDefined();

      // Verify config values were read during initialization
      expect(configService.get('openai.apiKey')).toBe(
        'sk-test-service-deps-key',
      );
      expect(configService.get('openai.baseUrl')).toBe(
        'https://api.test.openai.com',
      );
      expect(configService.get('openai.defaultModel')).toBe('gpt-5-test');
      expect(configService.get('openai.timeout')).toBe(30000);
      expect(configService.get('openai.maxRetries')).toBe(2);
    });

    it('should use default model from config when model not specified in DTO', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Test without model',
        // model is not specified, should use default from config
      };

      const mockResponse = createMockOpenAIResponse({
        model: 'gpt-5-test',
        output_text: 'Response using default model',
      });

      (mockClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      // Act
      await service.createTextResponse(dto);

      // Assert - should use default model from config
      expect(mockClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5-test',
        }),
      );
    });

    it('should override default model when specified in DTO', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Test with custom model',
        model: 'gpt-4o',
      };

      const mockResponse = createMockOpenAIResponse({
        model: 'gpt-4o',
        output_text: 'Response using custom model',
      });

      (mockClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      // Act
      await service.createTextResponse(dto);

      // Assert - should use model from DTO
      expect(mockClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
        }),
      );
    });
  });

  describe('Service + Logger Integration', () => {
    it('should log successful API interaction with LoggerService', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Test logging',
        model: 'gpt-5',
      };

      const mockResponse = createMockOpenAIResponse({
        output_text: 'Logged response',
        usage: {
          input_tokens: 10,
          output_tokens: 15,
          total_tokens: 25,
        },
      });

      (mockClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      // Act
      await service.createTextResponse(dto);

      // Assert - verify logger was called with correct data
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'responses',
          endpoint: '/v1/responses',
          request: expect.objectContaining({
            model: 'gpt-5',
            input: 'Test logging',
          }),
          response: mockResponse,
          metadata: expect.objectContaining({
            tokens_used: 25,
            latency_ms: expect.any(Number),
          }),
        }),
      );
    });

    it('should log API errors through LoggerService', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Test error logging',
      };

      const apiError = new OpenAI.APIError(
        500,
        {
          error: {
            message: 'Service unavailable',
            type: 'api_error',
          },
        },
        'Service unavailable',
        new Headers(),
      );

      (mockClient.responses.create as jest.Mock).mockRejectedValue(apiError);

      // Act & Assert
      await expect(service.createTextResponse(dto)).rejects.toThrow(apiError);

      // Verify error was logged (error is logged under 'error' property, not metadata)
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'responses',
          endpoint: '/v1/responses',
          request: expect.any(Object),
          error: expect.objectContaining({
            status: 500,
            message: expect.stringContaining('Service unavailable'),
          }),
          metadata: expect.objectContaining({
            latency_ms: expect.any(Number),
          }),
        }),
      );
    });

    it('should include cached tokens in logged metadata', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Test with cache',
        prompt_cache_key: 'cache_123',
      };

      const mockResponse = createMockOpenAIResponse({
        output_text: 'Cached response',
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          total_tokens: 150,
          input_tokens_details: {
            cached_tokens: 80,
          },
        },
      });

      (mockClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      // Act
      await service.createTextResponse(dto);

      // Assert
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            tokens_used: 150,
            cached_tokens: 80,
          }),
        }),
      );
    });

    it('should include reasoning tokens in logged metadata for o-series models', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Complex reasoning task',
        model: 'o1-preview',
      };

      const mockResponse = createMockOpenAIResponse({
        model: 'o1-preview',
        output_text: 'Reasoning complete',
        usage: {
          input_tokens: 100,
          output_tokens: 300,
          total_tokens: 400,
          output_tokens_details: {
            reasoning_tokens: 200,
          },
        },
      });

      (mockClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      // Act
      await service.createTextResponse(dto);

      // Assert
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            tokens_used: 400,
            reasoning_tokens: 200,
          }),
        }),
      );
    });
  });

  describe('Service + OpenAI Client Integration', () => {
    it('should pass all DTO parameters to OpenAI client', async () => {
      // Arrange - Create DTO with many parameters
      const dto: CreateTextResponseDto = {
        input: 'Complex request',
        model: 'gpt-5',
        instructions: 'Be concise',
        max_output_tokens: 500,
        temperature: 0.7,
        top_p: 0.9,
        conversation: 'conv_123',
        store: true,
        metadata: {
          user_id: 'user_456',
        },
      };

      const mockResponse = createMockOpenAIResponse({
        output_text: 'Complex response',
      });

      (mockClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      // Act
      await service.createTextResponse(dto);

      // Assert - Verify all parameters passed through
      expect(mockClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5',
          input: 'Complex request',
          instructions: 'Be concise',
          max_output_tokens: 500,
          temperature: 0.7,
          top_p: 0.9,
          conversation: 'conv_123',
          store: true,
          metadata: {
            user_id: 'user_456',
          },
          stream: false,
        }),
      );
    });

    it('should handle OpenAI client timeout errors', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Timeout test',
      };

      const timeoutError = new Error('Request timeout') as Error & {
        name: string;
        code: string;
      };
      timeoutError.name = 'TimeoutError';
      timeoutError.code = 'ETIMEDOUT';

      (mockClient.responses.create as jest.Mock).mockRejectedValue(
        timeoutError,
      );

      // Act & Assert
      await expect(service.createTextResponse(dto)).rejects.toThrow(
        'Request timeout',
      );
    });

    it('should handle OpenAI client network errors', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Network error test',
      };

      const networkError = new Error('Network error') as Error & {
        code: string;
      };
      networkError.code = 'ECONNREFUSED';

      (mockClient.responses.create as jest.Mock).mockRejectedValue(
        networkError,
      );

      // Act & Assert
      await expect(service.createTextResponse(dto)).rejects.toThrow(
        'Network error',
      );
    });
  });

  describe('Service Helper Methods', () => {
    it('should extract usage data correctly', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Usage extraction test',
      };

      const mockResponse = createMockOpenAIResponse({
        output_text: 'Response',
        usage: {
          input_tokens: 50,
          output_tokens: 100,
          total_tokens: 150,
          input_tokens_details: {
            cached_tokens: 30,
          },
          output_tokens_details: {
            reasoning_tokens: 60,
          },
        },
      });

      (mockClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      // Act
      const response = await service.createTextResponse(dto);

      // Assert - Verify usage data is accessible
      expect(response.usage.input_tokens).toBe(50);
      expect(response.usage.output_tokens).toBe(100);
      expect(response.usage.total_tokens).toBe(150);
      expect(response.usage.input_tokens_details?.cached_tokens).toBe(30);
      expect(response.usage.output_tokens_details?.reasoning_tokens).toBe(60);
    });

    it('should handle responses without optional usage details', async () => {
      // Arrange
      const dto: CreateTextResponseDto = {
        input: 'Basic usage test',
      };

      const mockResponse = createMockOpenAIResponse({
        output_text: 'Response',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          // No input_tokens_details or output_tokens_details
        },
      });

      (mockClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      // Act
      const response = await service.createTextResponse(dto);

      // Assert - Should work without optional details
      expect(response.usage.total_tokens).toBe(30);
      expect(response.usage.input_tokens_details).toBeUndefined();
      expect(response.usage.output_tokens_details).toBeUndefined();
    });
  });
});
