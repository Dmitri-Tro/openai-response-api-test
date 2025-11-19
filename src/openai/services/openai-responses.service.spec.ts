import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { Responses } from 'openai/resources/responses';
import { OpenAIResponsesService } from './openai-responses.service';
import { LoggerService } from '../../common/services/logger.service';
import { PricingService } from '../../common/services/pricing.service';
import { CreateTextResponseDto } from '../dto/create-text-response.dto';
import { CreateImageResponseDto } from '../dto/create-image-response.dto';
import { LifecycleEventsHandler } from './handlers/lifecycle-events.handler';
import { TextEventsHandler } from './handlers/text-events.handler';
import { ReasoningEventsHandler } from './handlers/reasoning-events.handler';
import { ToolCallingEventsHandler } from './handlers/tool-calling-events.handler';
import { ImageEventsHandler } from './handlers/image-events.handler';
import { AudioEventsHandler } from './handlers/audio-events.handler';
import { MCPEventsHandler } from './handlers/mcp-events.handler';
import { RefusalEventsHandler } from './handlers/refusal-events.handler';
import { StructuralEventsHandler } from './handlers/structural-events.handler';
import {
  createMockConfigService,
  createMockLoggerService,
  createMockOpenAIClient,
  createMockOpenAIResponse,
  createOpenAIError,
  injectMockOpenAIClient,
} from '../../common/testing/test.factories';

describe('OpenAIResponsesService', () => {
  let service: OpenAIResponsesService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let pricingService: PricingService;
  let mockOpenAIClient: jest.Mocked<OpenAI>;

  // Mock event handlers
  let mockLifecycleHandler: jest.Mocked<LifecycleEventsHandler>;
  let mockTextHandler: jest.Mocked<TextEventsHandler>;
  let mockReasoningHandler: jest.Mocked<ReasoningEventsHandler>;
  let mockToolCallingHandler: jest.Mocked<ToolCallingEventsHandler>;
  let mockImageHandler: jest.Mocked<ImageEventsHandler>;
  let mockAudioHandler: jest.Mocked<AudioEventsHandler>;
  let mockMCPHandler: jest.Mocked<MCPEventsHandler>;
  let mockRefusalHandler: jest.Mocked<RefusalEventsHandler>;
  let mockStructuralHandler: jest.Mocked<StructuralEventsHandler>;

  beforeEach(async () => {
    // Mock services using factories
    mockConfigService = createMockConfigService();
    // Override with OpenAI-specific config
    (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
      const config: Record<string, unknown> = {
        'openai.apiKey': 'test-api-key',
        'openai.baseUrl': 'https://api.openai.com/v1',
        'openai.defaultModel': 'gpt-5',
        'openai.timeout': 60000,
        'openai.maxRetries': 3,
      };
      return config[key];
    });

    mockLoggerService = createMockLoggerService();

    // Mock event handlers (only methods called by service)
    mockLifecycleHandler = {} as jest.Mocked<LifecycleEventsHandler>;
    mockTextHandler = {} as jest.Mocked<TextEventsHandler>;
    mockReasoningHandler = {} as jest.Mocked<ReasoningEventsHandler>;
    mockToolCallingHandler = {} as jest.Mocked<ToolCallingEventsHandler>;
    mockImageHandler = {} as jest.Mocked<ImageEventsHandler>;
    mockAudioHandler = {} as jest.Mocked<AudioEventsHandler>;
    mockMCPHandler = {} as jest.Mocked<MCPEventsHandler>;
    mockRefusalHandler = {} as jest.Mocked<RefusalEventsHandler>;
    mockStructuralHandler = {} as jest.Mocked<StructuralEventsHandler>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenAIResponsesService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
        PricingService, // Use real PricingService for integration tests
        {
          provide: LifecycleEventsHandler,
          useValue: mockLifecycleHandler,
        },
        {
          provide: TextEventsHandler,
          useValue: mockTextHandler,
        },
        {
          provide: ReasoningEventsHandler,
          useValue: mockReasoningHandler,
        },
        {
          provide: ToolCallingEventsHandler,
          useValue: mockToolCallingHandler,
        },
        {
          provide: ImageEventsHandler,
          useValue: mockImageHandler,
        },
        {
          provide: AudioEventsHandler,
          useValue: mockAudioHandler,
        },
        {
          provide: MCPEventsHandler,
          useValue: mockMCPHandler,
        },
        {
          provide: RefusalEventsHandler,
          useValue: mockRefusalHandler,
        },
        {
          provide: StructuralEventsHandler,
          useValue: mockStructuralHandler,
        },
      ],
    }).compile();

    service = module.get<OpenAIResponsesService>(OpenAIResponsesService);
    pricingService = module.get<PricingService>(PricingService);

    // Mock the OpenAI client using factory and helper
    mockOpenAIClient = createMockOpenAIClient();
    injectMockOpenAIClient(service, mockOpenAIClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTextResponse', () => {
    it('should create a non-streaming text response with basic parameters', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Hello, world!',
        model: 'gpt-5',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_123',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Hello! How can I help you today?',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: {},
          output_tokens_details: {},
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      const result = await service.createTextResponse(dto);

      expect(result).toEqual(mockResponse);
      expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5',
          input: 'Hello, world!',
          stream: false,
        }),
      );
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'responses',
          endpoint: '/v1/responses',
          metadata: expect.objectContaining({
            latency_ms: expect.any(Number),
            tokens_used: 30,
          }),
        }),
      );
    });

    it('should include instructions when provided', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test message',
        instructions: 'You are a helpful assistant',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_456',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response text',
        usage: {
          input_tokens: 5,
          output_tokens: 10,
          total_tokens: 15,
          input_tokens_details: {},
          output_tokens_details: {},
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          instructions: 'You are a helpful assistant',
        }),
      );
    });

    it('should include sampling parameters when provided', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test',
        temperature: 0.7,
        top_p: 0.9,
      };

      const mockResponse: Responses.Response = {
        id: 'resp_789',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 1,
          output_tokens: 2,
          total_tokens: 3,
          input_tokens_details: {},
          output_tokens_details: {},
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
          top_p: 0.9,
        }),
      );
    });

    it('should extract cached_tokens from usage details', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test with caching',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_cache',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          total_tokens: 150,
          input_tokens_details: {
            cached_tokens: 80,
          },
          output_tokens_details: {},
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            cached_tokens: 80,
          }),
        }),
      );
    });

    it('should extract reasoning_tokens from usage details', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Reasoning test',
        model: 'o1',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_reasoning',
        object: 'response',
        created: 1234567890,
        model: 'o1',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 50,
          output_tokens: 100,
          total_tokens: 150,
          input_tokens_details: {},
          output_tokens_details: {
            reasoning_tokens: 75,
          },
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            reasoning_tokens: 75,
          }),
        }),
      );
    });

    it('should include Phase 2.7 optimization parameters', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test',
        prompt_cache_key: 'test-cache-key',
        service_tier: 'scale',
        background: true,
        truncation: 'auto',
        safety_identifier: 'user-123',
        metadata: { request_id: 'req-456' },
      };

      const mockResponse: Responses.Response = {
        id: 'resp_opt',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: {},
          output_tokens_details: {},
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt_cache_key: 'test-cache-key',
          service_tier: 'scale',
          background: true,
          truncation: 'auto',
          safety_identifier: 'user-123',
          metadata: { request_id: 'req-456' },
        }),
      );
    });

    it('should handle errors and log them', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test error',
      };

      const mockError = new Error('API Error');
      mockOpenAIClient.responses.create.mockRejectedValue(mockError);

      await expect(service.createTextResponse(dto)).rejects.toThrow(
        'API Error',
      );

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'responses',
          endpoint: '/v1/responses',
          error: expect.objectContaining({
            message: 'API Error',
            original_error: mockError,
          }),
        }),
      );
    });

    it('should use default model when not provided', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test default model',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_default',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: {},
          output_tokens_details: {},
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5', // From config
        }),
      );
    });
  });

  describe('createImageResponse', () => {
    it('should create a non-streaming image response', async () => {
      const dto: CreateImageResponseDto = {
        input: 'A beautiful sunset',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_img_123',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'base64encodedimagedata',
        usage: {
          input_tokens: 5,
          output_tokens: 0,
          total_tokens: 5,
          input_tokens_details: {},
          output_tokens_details: {},
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      const result = await service.createImageResponse(dto);

      expect(result).toEqual(mockResponse);
      expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5',
          input: 'A beautiful sunset',
          stream: false,
          tools: expect.arrayContaining([
            expect.objectContaining({
              type: 'image_generation',
            }),
          ]),
        }),
      );
    });

    it('should include image-specific parameters (Phase 2.9)', async () => {
      const dto: CreateImageResponseDto = {
        input: 'A cat',
        image_model: 'gpt-image-1',
        image_quality: 'high',
        image_format: 'png',
        image_size: '1024x1024',
        image_moderation: 'auto',
        image_background: 'transparent',
        input_fidelity: 'high',
        output_compression: 90,
        partial_images: 2,
      };

      const mockResponse: Responses.Response = {
        id: 'resp_img_params',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'base64image',
        usage: {
          input_tokens: 10,
          output_tokens: 0,
          total_tokens: 10,
          input_tokens_details: {},
          output_tokens_details: {},
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createImageResponse(dto);

      const createCall = mockOpenAIClient.responses.create.mock.calls[0][0];
      const tools = createCall.tools as Array<Record<string, unknown>>;
      const imageGenTool = tools?.find(
        (t) => t.type === 'image_generation',
      ) as Record<string, unknown>;

      expect(imageGenTool).toBeDefined();
      expect(imageGenTool.model).toBe('gpt-image-1');
      expect(imageGenTool.quality).toBe('high');
      expect(imageGenTool.output_format).toBe('png');
      expect(imageGenTool.size).toBe('1024x1024');
      expect(imageGenTool.moderation).toBe('auto');
      expect(imageGenTool.background).toBe('transparent');
      expect(imageGenTool.input_fidelity).toBe('high');
      expect(imageGenTool.output_compression).toBe(90);
      expect(imageGenTool.partial_images).toBe(2);
    });

    it('should combine user tools with image_generation tool', async () => {
      const userTool: Responses.Tool = {
        type: 'function',
        function: {
          name: 'custom_function',
          description: 'Custom function',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      };

      const dto: CreateImageResponseDto = {
        input: 'Test with tools',
        tools: [userTool],
      };

      const mockResponse: Responses.Response = {
        id: 'resp_tools',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'base64',
        usage: {
          input_tokens: 5,
          output_tokens: 0,
          total_tokens: 5,
          input_tokens_details: {},
          output_tokens_details: {},
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createImageResponse(dto);

      const createCall = mockOpenAIClient.responses.create.mock.calls[0][0];
      expect(createCall.tools).toHaveLength(2);
      expect(createCall.tools).toContainEqual(userTool);
    });

    it('should handle image generation errors', async () => {
      const dto: CreateImageResponseDto = {
        input: 'Error test',
      };

      const mockError = new Error('Image generation failed');
      mockOpenAIClient.responses.create.mockRejectedValue(mockError);

      await expect(service.createImageResponse(dto)).rejects.toThrow(
        'Image generation failed',
      );

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: '/v1/responses (gpt-image-1)',
          error: expect.objectContaining({
            message: 'Image generation failed',
          }),
        }),
      );
    });

    it('should test individual image parameter - image_quality variations', async () => {
      const qualities: Array<'low' | 'medium' | 'high' | 'auto'> = [
        'low',
        'medium',
        'high',
        'auto',
      ];

      for (const quality of qualities) {
        const dto: CreateImageResponseDto = {
          input: 'Test quality',
          image_quality: quality,
        };

        const mockResponse: Responses.Response = {
          id: `resp_${quality}`,
          object: 'response',
          created: 1234567890,
          model: 'gpt-5',
          status: 'completed',
          output_text: 'image',
          usage: {
            input_tokens: 1,
            output_tokens: 0,
            total_tokens: 1,
            input_tokens_details: {},
            output_tokens_details: {},
          },
        };

        mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);
        await service.createImageResponse(dto);

        const createCall =
          mockOpenAIClient.responses.create.mock.calls[
            mockOpenAIClient.responses.create.mock.calls.length - 1
          ][0];
        const tools = createCall.tools as Array<Record<string, unknown>>;
        const imageGenTool = tools?.find(
          (t) => t.type === 'image_generation',
        ) as Record<string, unknown>;

        expect(imageGenTool.quality).toBe(quality);
      }
    });

    it('should test individual image parameter - image_format variations', async () => {
      const formats: Array<'png' | 'webp' | 'jpeg'> = ['png', 'webp', 'jpeg'];

      for (const format of formats) {
        const dto: CreateImageResponseDto = {
          input: 'Test format',
          image_format: format,
        };

        const mockResponse: Responses.Response = {
          id: `resp_${format}`,
          object: 'response',
          created: 1234567890,
          model: 'gpt-5',
          status: 'completed',
          output_text: 'image',
          usage: {
            input_tokens: 1,
            output_tokens: 0,
            total_tokens: 1,
            input_tokens_details: {},
            output_tokens_details: {},
          },
        };

        mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);
        await service.createImageResponse(dto);

        const createCall =
          mockOpenAIClient.responses.create.mock.calls[
            mockOpenAIClient.responses.create.mock.calls.length - 1
          ][0];
        const tools = createCall.tools as Array<Record<string, unknown>>;
        const imageGenTool = tools?.find(
          (t) => t.type === 'image_generation',
        ) as Record<string, unknown>;

        expect(imageGenTool.output_format).toBe(format);
      }
    });

    it('should test boundary values for output_compression', async () => {
      const compressionValues = [0, 50, 100];

      for (const compression of compressionValues) {
        const dto: CreateImageResponseDto = {
          input: 'Test compression',
          output_compression: compression,
        };

        const mockResponse: Responses.Response = {
          id: `resp_comp_${compression}`,
          object: 'response',
          created: 1234567890,
          model: 'gpt-5',
          status: 'completed',
          output_text: 'image',
          usage: {
            input_tokens: 1,
            output_tokens: 0,
            total_tokens: 1,
            input_tokens_details: {},
            output_tokens_details: {},
          },
        };

        mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);
        await service.createImageResponse(dto);

        const createCall =
          mockOpenAIClient.responses.create.mock.calls[
            mockOpenAIClient.responses.create.mock.calls.length - 1
          ][0];
        const tools = createCall.tools as Array<Record<string, unknown>>;
        const imageGenTool = tools?.find(
          (t) => t.type === 'image_generation',
        ) as Record<string, unknown>;

        expect(imageGenTool.output_compression).toBe(compression);
      }
    });

    it('should test boundary values for partial_images', async () => {
      const partialValues = [0, 1, 2, 3];

      for (const partial of partialValues) {
        const dto: CreateImageResponseDto = {
          input: 'Test partial',
          partial_images: partial,
        };

        const mockResponse: Responses.Response = {
          id: `resp_partial_${partial}`,
          object: 'response',
          created: 1234567890,
          model: 'gpt-5',
          status: 'completed',
          output_text: 'image',
          usage: {
            input_tokens: 1,
            output_tokens: 0,
            total_tokens: 1,
            input_tokens_details: {},
            output_tokens_details: {},
          },
        };

        mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);
        await service.createImageResponse(dto);

        const createCall =
          mockOpenAIClient.responses.create.mock.calls[
            mockOpenAIClient.responses.create.mock.calls.length - 1
          ][0];
        const tools = createCall.tools as Array<Record<string, unknown>>;
        const imageGenTool = tools?.find(
          (t) => t.type === 'image_generation',
        ) as Record<string, unknown>;

        expect(imageGenTool.partial_images).toBe(partial);
      }
    });
  });

  describe('createImageResponseStream', () => {
    it('should create a streaming image response with basic parameters', async () => {
      const dto: CreateImageResponseDto = {
        input: 'A beautiful landscape',
      };

      async function* mockStream() {
        yield {
          type: 'response.created',
          sequence_number: 1,
          response: { id: 'resp_img_stream' },
        };
        yield {
          type: 'response.image_generation_call.in_progress',
          sequence_number: 2,
          call_id: 'img_gen_123',
        };
        yield {
          type: 'response.image_generation_call.partial_image',
          sequence_number: 3,
          call_id: 'img_gen_123',
          image: 'partial_base64_data',
        };
        yield {
          type: 'response.image_generation_call.completed',
          sequence_number: 4,
          call_id: 'img_gen_123',
          result: { image: 'full_base64_data' },
        };
        yield {
          type: 'response.completed',
          sequence_number: 5,
          response: {
            id: 'resp_img_stream',
            status: 'completed',
          },
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockLifecycleHandler.handleResponseCreated = jest
        .fn()
        .mockReturnValue([]);
      mockImageHandler.handleImageGenProgress = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'image_progress', data: '{}', sequence: 2 };
        })(),
      );
      mockImageHandler.handleImageGenPartial = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'image_partial', data: '{}', sequence: 3 };
        })(),
      );
      mockImageHandler.handleImageGenCompleted = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'image_completed', data: '{}', sequence: 4 };
        })(),
      );
      mockLifecycleHandler.handleResponseCompleted = jest
        .fn()
        .mockReturnValue([]);

      const generator = service.createImageResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          input: 'A beautiful landscape',
          stream: true,
          tools: expect.arrayContaining([
            expect.objectContaining({
              type: 'image_generation',
            }),
          ]),
        }),
      );
    });

    it('should include all 9 image parameters in streaming request', async () => {
      const dto: CreateImageResponseDto = {
        input: 'Advanced image streaming',
        image_model: 'gpt-image-1',
        image_quality: 'high',
        image_format: 'png',
        image_size: '1024x1536',
        image_moderation: 'low',
        image_background: 'transparent',
        input_fidelity: 'high',
        output_compression: 95,
        partial_images: 3,
      };

      async function* mockStream() {
        yield {
          type: 'response.completed',
          sequence_number: 1,
          response: { id: 'resp_advanced_img' },
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockLifecycleHandler.handleResponseCompleted = jest
        .fn()
        .mockReturnValue([]);

      const generator = service.createImageResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      const createCall = mockOpenAIClient.responses.create.mock.calls[0][0];
      const tools = createCall.tools as Array<Record<string, unknown>>;
      const imageGenTool = tools?.find(
        (t) => t.type === 'image_generation',
      ) as Record<string, unknown>;

      expect(imageGenTool.model).toBe('gpt-image-1');
      expect(imageGenTool.quality).toBe('high');
      expect(imageGenTool.output_format).toBe('png');
      expect(imageGenTool.size).toBe('1024x1536');
      expect(imageGenTool.moderation).toBe('low');
      expect(imageGenTool.background).toBe('transparent');
      expect(imageGenTool.input_fidelity).toBe('high');
      expect(imageGenTool.output_compression).toBe(95);
      expect(imageGenTool.partial_images).toBe(3);
    });

    it('should handle progressive image rendering with multiple partial images', async () => {
      const dto: CreateImageResponseDto = {
        input: 'Progressive rendering test',
        partial_images: 3,
      };

      async function* mockStream() {
        yield {
          type: 'response.image_generation_call.in_progress',
          sequence_number: 1,
          call_id: 'img_123',
        };
        yield {
          type: 'response.image_generation_call.partial_image',
          sequence_number: 2,
          call_id: 'img_123',
          image: 'partial1',
        };
        yield {
          type: 'response.image_generation_call.partial_image',
          sequence_number: 3,
          call_id: 'img_123',
          image: 'partial2',
        };
        yield {
          type: 'response.image_generation_call.partial_image',
          sequence_number: 4,
          call_id: 'img_123',
          image: 'partial3',
        };
        yield {
          type: 'response.image_generation_call.completed',
          sequence_number: 5,
          call_id: 'img_123',
          result: { image: 'final' },
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockImageHandler.handleImageGenProgress = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'progress', data: '{}', sequence: 1 };
        })(),
      );
      mockImageHandler.handleImageGenPartial = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'partial', data: '{}', sequence: 2 };
        })(),
      );
      mockImageHandler.handleImageGenCompleted = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'completed', data: '{}', sequence: 5 };
        })(),
      );

      const generator = service.createImageResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      expect(mockImageHandler.handleImageGenProgress).toHaveBeenCalledTimes(1);
      expect(mockImageHandler.handleImageGenPartial).toHaveBeenCalledTimes(3);
      expect(mockImageHandler.handleImageGenCompleted).toHaveBeenCalledTimes(1);
    });

    it('should handle image generation errors during streaming', async () => {
      const dto: CreateImageResponseDto = {
        input: 'Error test streaming',
      };

      async function* mockStream() {
        yield {
          type: 'response.image_generation_call.in_progress',
          sequence_number: 1,
          call_id: 'img_error',
        };
        yield {
          type: 'error',
          sequence_number: 2,
          error: {
            message: 'Image generation failed',
            code: 'image_generation_error',
          },
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockImageHandler.handleImageGenProgress = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'progress', data: '{}', sequence: 1 };
        })(),
      );
      mockLifecycleHandler.handleErrorEvent = jest.fn().mockReturnValue([]);

      const generator = service.createImageResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      expect(mockImageHandler.handleImageGenProgress).toHaveBeenCalled();
      expect(mockLifecycleHandler.handleErrorEvent).toHaveBeenCalled();
    });

    it('should test image_generation_call.generating event', async () => {
      const dto: CreateImageResponseDto = {
        input: 'Test generating event',
      };

      async function* mockStream() {
        yield {
          type: 'response.image_generation_call.generating',
          sequence_number: 1,
          call_id: 'img_gen',
          progress: 50,
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockImageHandler.handleImageGenProgress = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'generating', data: '{}', sequence: 1 };
        })(),
      );

      const generator = service.createImageResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      expect(mockImageHandler.handleImageGenProgress).toHaveBeenCalled();
    });

    it('should build request with all optional parameters', async () => {
      const dto: CreateImageResponseDto = {
        input: 'Complete parameter test',
        model: 'gpt-4o',
        instructions: 'Test instructions',
        image_model: 'gpt-image-1',
        image_quality: 'high',
        image_format: 'png',
        image_size: '1024x1536',
        image_moderation: 'low',
        image_background: 'transparent',
        input_fidelity: 'high',
        output_compression: 90,
        partial_images: 5,
        conversation: 'conv_123',
        previous_response_id: 'resp_prev',
        store: true,
        max_output_tokens: 1000,
        tool_choice: 'auto' as const,
        parallel_tool_calls: true,
        prompt_cache_key: 'cache_key_123',
        service_tier: 'default' as const,
        background: false,
        safety_identifier: 'safety_123',
        metadata: { test: 'metadata' },
        truncation: { type: 'auto' as const },
        include: ['file_search_call.results'],
      };

      async function* mockStream() {
        yield {
          type: 'response.completed',
          sequence_number: 1,
          response: { id: 'resp_complete', status: 'completed' },
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockLifecycleHandler.handleResponseCompleted = jest
        .fn()
        .mockReturnValue([]);

      const generator = service.createImageResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      const createCall = mockOpenAIClient.responses.create.mock.calls[0][0];

      // Verify all parameters were included
      expect(createCall).toMatchObject({
        model: 'gpt-4o',
        input: 'Complete parameter test',
        instructions: 'Test instructions',
        stream: true,
        conversation: 'conv_123',
        previous_response_id: 'resp_prev',
        store: true,
        max_output_tokens: 1000,
        tool_choice: 'auto',
        parallel_tool_calls: true,
        prompt_cache_key: 'cache_key_123',
        service_tier: 'default',
        background: false,
        safety_identifier: 'safety_123',
        metadata: { test: 'metadata' },
        truncation: { type: 'auto' },
        include: ['file_search_call.results'],
      });

      // Verify image_generation tool was built correctly
      const tools = createCall.tools as Array<Record<string, unknown>>;
      const imageGenTool = tools?.find(
        (t) => t.type === 'image_generation',
      ) as Record<string, unknown>;

      expect(imageGenTool).toMatchObject({
        type: 'image_generation',
        model: 'gpt-image-1',
        quality: 'high',
        output_format: 'png',
        size: '1024x1536',
        moderation: 'low',
        background: 'transparent',
        input_fidelity: 'high',
        output_compression: 90,
        partial_images: 5,
      });
    });

    it('should handle streaming errors and log them properly', async () => {
      const dto: CreateImageResponseDto = {
        input: 'Error test',
      };

      const error = new Error('Streaming failed');

      async function* mockStream() {
        throw error;
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);

      const generator = service.createImageResponseStream(dto);

      const events: unknown[] = [];
      try {
        for await (const event of generator) {
          events.push(event);
        }
        fail('Should have thrown an error');
      } catch (e) {
        expect(e).toBe(error);
      }

      // Verify error was logged
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'responses',
          endpoint: '/v1/responses (gpt-image-1 stream)',
          error: expect.objectContaining({
            message: 'Streaming failed',
          }),
          metadata: expect.objectContaining({
            latency_ms: expect.any(Number),
          }),
        }),
      );

      // Verify error event was yielded
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        event: 'error',
        data: expect.stringContaining('Streaming failed'),
      });
    });

    it('should handle OpenAI API errors with detailed error properties', async () => {
      const dto: CreateImageResponseDto = {
        input: 'API error test',
      };

      const apiError = Object.assign(new Error('API error occurred'), {
        type: 'invalid_request_error',
        code: 'invalid_parameter',
        status: 400,
      });

      async function* mockStream() {
        throw apiError;
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);

      const generator = service.createImageResponseStream(dto);

      try {
        for await (const event of generator) {
          // Consume events
        }
        fail('Should have thrown an error');
      } catch (e) {
        expect(e).toBe(apiError);
      }

      // Verify error details were logged
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'API error occurred',
            type: 'invalid_request_error',
            code: 'invalid_parameter',
            status: 400,
          }),
        }),
      );
    });

    it('should route text events when model provides text alongside images', async () => {
      const dto: CreateImageResponseDto = {
        input: 'Image with text description',
      };

      async function* mockStream() {
        yield {
          type: 'response.output_text.delta',
          sequence_number: 1,
          delta: 'Generating image',
        };
        yield {
          type: 'response.output_text.done',
          sequence_number: 2,
          text: 'Generating image...',
        };
        yield {
          type: 'response.image_generation_call.completed',
          sequence_number: 3,
          call_id: 'img_123',
          result: { image: 'base64_data' },
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockTextHandler.handleTextDelta = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'text_delta', data: '{}', sequence: 1 };
        })(),
      );
      mockTextHandler.handleTextDone = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'text_done', data: '{}', sequence: 2 };
        })(),
      );
      mockImageHandler.handleImageGenCompleted = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'image_completed', data: '{}', sequence: 3 };
        })(),
      );

      const generator = service.createImageResponseStream(dto);
      const events: unknown[] = [];
      for await (const event of generator) {
        events.push(event);
      }

      expect(mockTextHandler.handleTextDelta).toHaveBeenCalled();
      expect(mockTextHandler.handleTextDone).toHaveBeenCalled();
      expect(mockImageHandler.handleImageGenCompleted).toHaveBeenCalled();
      expect(events).toHaveLength(3);
    });

    it('should log each streaming event to logger service', async () => {
      const dto: CreateImageResponseDto = {
        input: 'Logging test',
      };

      async function* mockStream() {
        yield {
          type: 'response.image_generation_call.in_progress',
          sequence_number: 1,
          call_id: 'img_log',
        };
        yield {
          type: 'response.image_generation_call.completed',
          sequence_number: 2,
          call_id: 'img_log',
          result: { image: 'data' },
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockImageHandler.handleImageGenProgress = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'progress', data: '{}', sequence: 1 };
        })(),
      );
      mockImageHandler.handleImageGenCompleted = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'completed', data: '{}', sequence: 2 };
        })(),
      );

      const generator = service.createImageResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      // Verify logging calls
      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledTimes(2);
      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'responses',
          endpoint: '/v1/responses (gpt-image-1 stream)',
          event_type: 'response.image_generation_call.in_progress',
          sequence: 1,
        }),
      );
      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'response.image_generation_call.completed',
          sequence: 2,
        }),
      );
    });

    it('should handle unknown event types using structural handler', async () => {
      const dto: CreateImageResponseDto = {
        input: 'Unknown event test',
      };

      async function* mockStream() {
        yield {
          type: 'response.unknown_event_type',
          sequence_number: 1,
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockStructuralHandler.handleStructuralEvent = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'structural', data: '{}', sequence: 1 };
        })(),
      );

      const generator = service.createImageResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      expect(mockStructuralHandler.handleStructuralEvent).toHaveBeenCalled();
    });

    it('should handle prompt parameter in image streaming', async () => {
      const dto: CreateImageResponseDto = {
        input: 'Prompt test',
        prompt: {
          type: 'text',
          text: 'System prompt for image generation',
        } as any,
      };

      async function* mockStream() {
        yield {
          type: 'response.completed',
          sequence_number: 1,
          response: { id: 'resp_prompt', status: 'completed' },
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockLifecycleHandler.handleResponseCompleted = jest
        .fn()
        .mockReturnValue([]);

      const generator = service.createImageResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      const createCall = mockOpenAIClient.responses.create.mock.calls[0][0];
      expect(createCall.prompt).toBeDefined();
      expect(createCall.prompt).toMatchObject({
        type: 'text',
        text: 'System prompt for image generation',
      });
    });
  });

  describe('resumeResponseStream', () => {
    it('should resume streaming a stored response by ID', async () => {
      const responseId = 'resp_resume_123';

      async function* mockStream() {
        yield {
          type: 'response.created',
          sequence_number: 1,
          response: { id: responseId },
        };
        yield {
          type: 'response.output_text.delta',
          sequence_number: 2,
          delta: 'Resumed text',
        };
        yield {
          type: 'response.completed',
          sequence_number: 3,
          response: {
            id: responseId,
            status: 'completed',
            output_text: 'Resumed text',
          },
        };
      }

      mockOpenAIClient.responses.retrieve.mockReturnValue(mockStream() as any);
      mockLifecycleHandler.handleResponseCreated = jest
        .fn()
        .mockReturnValue([]);
      mockTextHandler.handleTextDelta = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'text_delta', data: '{}', sequence: 2 };
        })(),
      );
      mockLifecycleHandler.handleResponseCompleted = jest
        .fn()
        .mockReturnValue([]);

      const generator = service.resumeResponseStream(responseId);
      const events: unknown[] = [];
      for await (const event of generator) {
        events.push(event);
      }

      expect(mockOpenAIClient.responses.retrieve).toHaveBeenCalledWith(
        responseId,
        { stream: true },
      );
      expect(mockLifecycleHandler.handleResponseCreated).toHaveBeenCalled();
      expect(mockTextHandler.handleTextDelta).toHaveBeenCalled();
      expect(mockLifecycleHandler.handleResponseCompleted).toHaveBeenCalled();
    });

    it('should handle resume stream errors and log them', async () => {
      const responseId = 'resp_error';
      const error = new Error('Resume failed');

      async function* mockStream() {
        throw error;
      }

      mockOpenAIClient.responses.retrieve.mockReturnValue(mockStream() as any);

      const generator = service.resumeResponseStream(responseId);

      const events: unknown[] = [];
      try {
        for await (const event of generator) {
          events.push(event);
        }
        fail('Should have thrown an error');
      } catch (e) {
        expect(e).toBe(error);
      }

      // Verify error was logged
      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'responses',
          endpoint: `/v1/responses/${responseId}/stream (GET)`,
          event_type: 'stream_error',
          error: expect.objectContaining({
            message: 'Resume failed',
          }),
        }),
      );

      // Verify error event was yielded
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        event: 'error',
        data: expect.stringContaining('Resume failed'),
      });
    });

    it('should log stream resume event', async () => {
      const responseId = 'resp_logging';

      async function* mockStream() {
        yield {
          type: 'response.completed',
          sequence_number: 1,
          response: {
            id: responseId,
            status: 'completed',
            usage: {
              input_tokens: 10,
              output_tokens: 20,
              total_tokens: 30,
            },
          },
        };
      }

      mockOpenAIClient.responses.retrieve.mockReturnValue(mockStream() as any);
      mockLifecycleHandler.handleResponseCompleted = jest
        .fn()
        .mockReturnValue([]);

      const generator = service.resumeResponseStream(responseId);
      for await (const event of generator) {
        // Consume events
      }

      // Verify stream resume was logged at start
      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'responses',
          endpoint: `/v1/responses/${responseId}/stream (GET)`,
          event_type: 'stream_resume',
          request: {
            responseId,
            stream: true,
          },
        }),
      );
    });
  });

  describe('retrieve', () => {
    it('should retrieve a stored response by ID', async () => {
      const responseId = 'resp_retrieve_123';

      const mockResponse: Responses.Response = {
        id: responseId,
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Retrieved response',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: {},
          output_tokens_details: {},
        },
      };

      mockOpenAIClient.responses.retrieve.mockResolvedValue(mockResponse);

      const result = await service.retrieve(responseId);

      expect(result).toEqual(mockResponse);
      expect(mockOpenAIClient.responses.retrieve).toHaveBeenCalledWith(
        responseId,
        { stream: false },
      );
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: `/v1/responses/${responseId} (GET)`,
          request: expect.objectContaining({
            responseId,
          }),
        }),
      );
    });

    it('should handle retrieve errors', async () => {
      const responseId = 'resp_not_found';
      const mockError = new Error('Response not found');

      mockOpenAIClient.responses.retrieve.mockRejectedValue(mockError);

      await expect(service.retrieve(responseId)).rejects.toThrow(
        'Response not found',
      );

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: `/v1/responses/${responseId} (GET)`,
          error: expect.objectContaining({
            message: 'Response not found',
          }),
        }),
      );
    });
  });

  describe('delete', () => {
    it('should delete a stored response by ID', async () => {
      const responseId = 'resp_delete_123';

      mockOpenAIClient.responses.delete.mockResolvedValue(undefined);

      const result = await service.delete(responseId);

      expect(result).toEqual({
        id: responseId,
        deleted: true,
        object: 'response',
      });
      expect(mockOpenAIClient.responses.delete).toHaveBeenCalledWith(
        responseId,
      );
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: `/v1/responses/${responseId} (DELETE)`,
          response: expect.objectContaining({
            deleted: true,
          }),
        }),
      );
    });

    it('should handle delete errors', async () => {
      const responseId = 'resp_delete_error';
      const mockError = new Error('Delete failed');

      mockOpenAIClient.responses.delete.mockRejectedValue(mockError);

      await expect(service.delete(responseId)).rejects.toThrow('Delete failed');

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: `/v1/responses/${responseId} (DELETE)`,
          error: expect.objectContaining({
            message: 'Delete failed',
          }),
        }),
      );
    });
  });

  describe('cancel', () => {
    it('should cancel a background response by ID', async () => {
      const responseId = 'resp_cancel_123';

      const mockResponse: Responses.Response = {
        id: responseId,
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'cancelled',
        output_text: '',
        usage: {
          input_tokens: 10,
          output_tokens: 0,
          total_tokens: 10,
          input_tokens_details: {},
          output_tokens_details: {},
        },
      };

      mockOpenAIClient.responses.cancel.mockResolvedValue(mockResponse);

      const result = await service.cancel(responseId);

      expect(result).toEqual(mockResponse);
      expect(result.status).toBe('cancelled');
      expect(mockOpenAIClient.responses.cancel).toHaveBeenCalledWith(
        responseId,
      );
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: `/v1/responses/${responseId}/cancel (POST)`,
        }),
      );
    });

    it('should handle cancel errors', async () => {
      const responseId = 'resp_cancel_error';
      const mockError = new Error('Not a background response');

      mockOpenAIClient.responses.cancel.mockRejectedValue(mockError);

      await expect(service.cancel(responseId)).rejects.toThrow(
        'Not a background response',
      );

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: `/v1/responses/${responseId}/cancel (POST)`,
          error: expect.objectContaining({
            message: 'Not a background response',
          }),
        }),
      );
    });
  });

  describe('extractUsage (private method)', () => {
    it('should extract basic usage information', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test usage',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_usage',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
          input_tokens_details: {},
          output_tokens_details: {},
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            tokens_used: 300,
          }),
        }),
      );
    });

    it('should handle missing usage gracefully', async () => {
      const dto: CreateTextResponseDto = {
        input: 'No usage',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_no_usage',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            tokens_used: undefined,
          }),
        }),
      );
    });

    it('should extract cached_tokens from input_tokens_details', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test cached tokens',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_cached',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 500,
          output_tokens: 100,
          total_tokens: 600,
          input_tokens_details: {
            cached_tokens: 300,
            text_tokens: 200,
            audio_tokens: 0,
            image_tokens: 0,
          },
          output_tokens_details: {
            text_tokens: 100,
            audio_tokens: 0,
            reasoning_tokens: 0,
          },
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            tokens_used: 600,
            cached_tokens: 300,
          }),
        }),
      );
    });

    it('should extract reasoning_tokens from output_tokens_details (o-series)', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test reasoning tokens',
        model: 'o3',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_reasoning',
        object: 'response',
        created: 1234567890,
        model: 'o3',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 200,
          output_tokens: 400,
          total_tokens: 600,
          input_tokens_details: {
            cached_tokens: 0,
            text_tokens: 200,
            audio_tokens: 0,
            image_tokens: 0,
          },
          output_tokens_details: {
            text_tokens: 300,
            audio_tokens: 0,
            reasoning_tokens: 100,
          },
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            tokens_used: 600,
            reasoning_tokens: 100,
          }),
        }),
      );
    });

    it('should extract both cached and reasoning tokens', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test both special tokens',
        model: 'o3',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_both',
        object: 'response',
        created: 1234567890,
        model: 'o3',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          total_tokens: 1500,
          input_tokens_details: {
            cached_tokens: 600,
            text_tokens: 400,
            audio_tokens: 0,
            image_tokens: 0,
          },
          output_tokens_details: {
            text_tokens: 350,
            audio_tokens: 0,
            reasoning_tokens: 150,
          },
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            tokens_used: 1500,
            cached_tokens: 600,
            reasoning_tokens: 150,
          }),
        }),
      );
    });

    it('should handle missing input_tokens_details', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test missing details',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_no_details',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          total_tokens: 150,
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            tokens_used: 150,
            cached_tokens: undefined,
            reasoning_tokens: undefined,
          }),
        }),
      );
    });
  });

  describe('extractResponseMetadata (private method)', () => {
    it('should extract response status and background fields', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test metadata',
        background: true,
        conversation: 'conv_123',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_metadata',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: {},
          output_tokens_details: {},
        },
        background: true,
        conversation: 'conv_123',
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            response_status: 'completed',
            background: true,
            conversation: 'conv_123',
          }),
        }),
      );
    });

    it('should extract Phase 2.7 optimization parameters', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test optimization params',
        prompt_cache_key: 'cache_key_123',
        service_tier: 'flex',
        safety_identifier: 'user_hash_abc',
        metadata: { request_id: 'req_123', app: 'test' },
      };

      const mockResponse: Responses.Response = {
        id: 'resp_opt',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: {},
          output_tokens_details: {},
        },
        prompt_cache_key: 'cache_key_123',
        service_tier: 'flex',
        safety_identifier: 'user_hash_abc',
        metadata: { request_id: 'req_123', app: 'test' },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      // Phase 2.7 params are in the response object, not logged metadata
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          response: expect.objectContaining({
            prompt_cache_key: 'cache_key_123',
            service_tier: 'flex',
            safety_identifier: 'user_hash_abc',
            metadata: { request_id: 'req_123', app: 'test' },
          }),
        }),
      );
    });

    it('should extract max_output_tokens and previous_response_id', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test conversation params',
        max_output_tokens: 1000,
        previous_response_id: 'resp_prev123',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_conv',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: {},
          output_tokens_details: {},
        },
        max_output_tokens: 1000,
        previous_response_id: 'resp_prev123',
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            max_output_tokens: 1000,
            previous_response_id: 'resp_prev123',
          }),
        }),
      );
    });

    it('should extract truncation parameter', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test truncation',
        truncation: 'auto',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_trunc',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: {},
          output_tokens_details: {},
        },
        truncation: 'auto',
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      // Truncation is in the response object, not logged metadata
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          response: expect.objectContaining({
            truncation: 'auto',
          }),
        }),
      );
    });

    it('should extract error field from incomplete response', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test error extraction',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_err',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'incomplete',
        output_text: '',
        error: {
          code: 'rate_limit_exceeded',
          message: 'Rate limit reached',
        },
        usage: {
          input_tokens: 10,
          output_tokens: 0,
          total_tokens: 10,
          input_tokens_details: {},
          output_tokens_details: {},
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      // Error is logged as response_error in metadata
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            response_status: 'incomplete',
            response_error: {
              code: 'rate_limit_exceeded',
              message: 'Rate limit reached',
            },
          }),
        }),
      );
    });

    it('should extract incomplete_details field', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test incomplete details',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_incomplete',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'incomplete',
        output_text: 'Partial response',
        incomplete_details: {
          reason: 'max_tokens',
        },
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          total_tokens: 15,
          input_tokens_details: {},
          output_tokens_details: {},
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            response_status: 'incomplete',
            incomplete_details: {
              reason: 'max_tokens',
            },
          }),
        }),
      );
    });

    it('should extract text verbosity if present', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test text verbosity',
        text: {
          verbosity: 'concise',
        },
      };

      const mockResponse: Responses.Response = {
        id: 'resp_verbosity',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        text: {
          verbosity: 'concise',
        },
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: {},
          output_tokens_details: {},
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      // Text verbosity is in the response object, not logged metadata
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          response: expect.objectContaining({
            text: {
              verbosity: 'concise',
            },
          }),
        }),
      );
    });

    it('should return empty metadata when no optional fields present', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Minimal response',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_minimal',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: {},
          output_tokens_details: {},
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      const call =
        mockLoggerService.logOpenAIInteraction.mock.calls[
          mockLoggerService.logOpenAIInteraction.mock.calls.length - 1
        ][0];
      const metadata = call.metadata;

      expect(metadata.response_status).toBe('completed');
      expect(metadata.error).toBeUndefined();
      expect(metadata.incomplete_details).toBeUndefined();
      expect(metadata.prompt_cache_key).toBeUndefined();
    });
  });

  describe('estimateCost (private method)', () => {
    it('should estimate cost based on token usage', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Cost estimation test',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_cost',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 1000,
          output_tokens: 2000,
          total_tokens: 3000,
          input_tokens_details: {},
          output_tokens_details: {},
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      // Cost: (1000/1_000_000) * 0.00125 + (2000/1_000_000) * 0.01 = 0.00000125 + 0.00002 = 0.00002125
      const calls = mockLoggerService.logOpenAIInteraction.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.metadata.cost_estimate).toBeCloseTo(0.00002125, 10);
    });

    it('should return 0 cost when no usage', async () => {
      const dto: CreateTextResponseDto = {
        input: 'No cost',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_no_cost',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            cost_estimate: 0,
          }),
        }),
      );
    });

    it('should handle zero tokens correctly', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Zero tokens',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_zero',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: '',
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          input_tokens_details: {},
          output_tokens_details: {},
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            cost_estimate: 0,
          }),
        }),
      );
    });

    it('should calculate cost with only input tokens', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Input only',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_input_only',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'incomplete',
        output_text: '',
        usage: {
          input_tokens: 500,
          output_tokens: 0,
          total_tokens: 500,
          input_tokens_details: {},
          output_tokens_details: {},
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      // Cost: (500/1_000_000) * 0.00125 + (0/1_000_000) * 0.01 = 0.000000625 + 0 = 0.000000625
      const calls = mockLoggerService.logOpenAIInteraction.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.metadata.cost_estimate).toBeCloseTo(0.000000625, 10);
    });

    it('should calculate cost with only output tokens', async () => {
      const dto: CreateTextResponseDto = {
        input: '',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_output_only',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 0,
          output_tokens: 1000,
          total_tokens: 1000,
          input_tokens_details: {},
          output_tokens_details: {},
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      // Cost: (0/1_000_000) * 0.00125 + (1000/1_000_000) * 0.01 = 0 + 0.00001 = 0.00001
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            cost_estimate: 0.00001,
          }),
        }),
      );
    });

    it('should handle very large token counts', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Large request',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_large',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 100000,
          output_tokens: 50000,
          total_tokens: 150000,
          input_tokens_details: {},
          output_tokens_details: {},
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      // Cost: (100000/1_000_000) * 0.00125 + (50000/1_000_000) * 0.01 = 0.000125 + 0.0005 = 0.000625
      const calls = mockLoggerService.logOpenAIInteraction.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.metadata.cost_estimate).toBeCloseTo(0.000625, 10);
    });

    it('should handle fractional token counts correctly', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Fractional',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_fractional',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 250,
          output_tokens: 150,
          total_tokens: 400,
          input_tokens_details: {},
          output_tokens_details: {},
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      // Cost: (250/1_000_000) * 0.00125 + (150/1_000_000) * 0.01 = 0.0000003125 + 0.0000015 = 0.0000018125
      const calls = mockLoggerService.logOpenAIInteraction.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.metadata.cost_estimate).toBeCloseTo(0.0000018125, 10);
    });

    it('should pass file_search tool with all parameters to OpenAI SDK', async () => {
      const fileSearchTool = {
        type: 'file_search' as const,
        vector_store_ids: ['vs_abc123', 'vs_def456'],
        max_num_results: 10,
        ranking_options: {
          ranker: 'auto' as const,
          score_threshold: 0.7,
        },
      };

      const dto: CreateTextResponseDto = {
        input: 'Search my documents',
        tools: [fileSearchTool],
        include: ['file_search_call.results'],
      };

      const mockResponse: Responses.Response = {
        id: 'resp_search',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Results found in documents',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: {},
          output_tokens_details: {},
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      const createCall = mockOpenAIClient.responses.create.mock.calls[0][0];
      expect(createCall.tools).toContainEqual(fileSearchTool);
      expect(createCall.include).toContain('file_search_call.results');
    });

    it('should pass file_search tool with minimal configuration', async () => {
      const fileSearchTool = {
        type: 'file_search' as const,
        vector_store_ids: ['vs_abc123'],
      };

      const dto: CreateTextResponseDto = {
        input: 'Search documents',
        tools: [fileSearchTool],
      };

      const mockResponse: Responses.Response = {
        id: 'resp_search',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Search results',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: {},
          output_tokens_details: {},
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      const createCall = mockOpenAIClient.responses.create.mock.calls[0][0];
      expect(createCall.tools).toContainEqual(fileSearchTool);
    });

    it('should combine file_search with other tools', async () => {
      const functionTool = {
        type: 'function' as const,
        function: {
          name: 'get_weather',
          description: 'Get weather information',
          parameters: {
            type: 'object' as const,
            properties: {
              location: { type: 'string' as const },
            },
            required: ['location'],
          },
        },
      };

      const fileSearchTool = {
        type: 'file_search' as const,
        vector_store_ids: ['vs_abc123'],
        max_num_results: 5,
      };

      const dto: CreateTextResponseDto = {
        input: 'Check weather and search docs',
        tools: [functionTool, fileSearchTool],
      };

      const mockResponse: Responses.Response = {
        id: 'resp_combined',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Combined response',
        usage: {
          input_tokens: 15,
          output_tokens: 25,
          total_tokens: 40,
          input_tokens_details: {},
          output_tokens_details: {},
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      const createCall = mockOpenAIClient.responses.create.mock.calls[0][0];
      expect(createCall.tools).toHaveLength(2);
      expect(createCall.tools).toContainEqual(functionTool);
      expect(createCall.tools).toContainEqual(fileSearchTool);
    });

    it('should handle file_search with multiple vector stores', async () => {
      const fileSearchTool = {
        type: 'file_search' as const,
        vector_store_ids: ['vs_store1', 'vs_store2', 'vs_store3'],
        max_num_results: 15,
        ranking_options: {
          ranker: 'default-2024-11-15' as const,
          score_threshold: 0.85,
        },
      };

      const dto: CreateTextResponseDto = {
        input: 'Search across multiple stores',
        tools: [fileSearchTool],
      };

      const mockResponse: Responses.Response = {
        id: 'resp_multi_store',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Multi-store results',
        usage: {
          input_tokens: 20,
          output_tokens: 30,
          total_tokens: 50,
          input_tokens_details: {},
          output_tokens_details: {},
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      const createCall = mockOpenAIClient.responses.create.mock.calls[0][0];
      expect(createCall.tools[0].vector_store_ids).toEqual([
        'vs_store1',
        'vs_store2',
        'vs_store3',
      ]);
      expect(createCall.tools[0].max_num_results).toBe(15);
      expect(createCall.tools[0].ranking_options.score_threshold).toBe(0.85);
    });

    it('should log file_search tool usage correctly', async () => {
      const fileSearchTool = {
        type: 'file_search' as const,
        vector_store_ids: ['vs_abc123'],
        max_num_results: 10,
      };

      const dto: CreateTextResponseDto = {
        input: 'Search documents',
        tools: [fileSearchTool],
      };

      const mockResponse: Responses.Response = {
        id: 'resp_logged',
        object: 'response',
        created: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Search results',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: {},
          output_tokens_details: {},
        },
      };

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

      await service.createTextResponse(dto);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'responses',
          endpoint: '/v1/responses',
          request: expect.objectContaining({
            tools: expect.arrayContaining([fileSearchTool]),
          }),
          response: mockResponse,
        }),
      );
    });
  });

  describe('createTextResponseStream', () => {
    it('should create a streaming text response with basic parameters', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Hello streaming',
        model: 'gpt-5',
      };

      // Mock async generator for streaming
      async function* mockStream() {
        yield {
          type: 'response.created',
          sequence_number: 1,
          response: { id: 'resp_stream_123' },
        };
        yield {
          type: 'response.output_text.delta',
          sequence_number: 2,
          delta: 'Hello',
        };
        yield {
          type: 'response.completed',
          sequence_number: 3,
          response: {
            id: 'resp_stream_123',
            status: 'completed',
            usage: {
              input_tokens: 10,
              output_tokens: 5,
              total_tokens: 15,
            },
          },
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);

      // Mock handler responses
      mockLifecycleHandler.handleResponseCreated = jest
        .fn()
        .mockReturnValue([]);
      mockTextHandler.handleTextDelta = jest.fn().mockReturnValue([]);
      mockLifecycleHandler.handleResponseCompleted = jest
        .fn()
        .mockReturnValue([]);

      const generator = service.createTextResponseStream(dto);
      const events = [];
      for await (const event of generator) {
        events.push(event);
      }

      expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5',
          input: 'Hello streaming',
          stream: true,
        }),
      );

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'stream_start',
          api: 'responses',
        }),
      );
    });

    it('should handle lifecycle events - response.created', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test lifecycle',
      };

      async function* mockStream() {
        yield {
          type: 'response.created',
          sequence_number: 1,
          response: { id: 'resp_lifecycle' },
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockLifecycleHandler.handleResponseCreated = jest
        .fn()
        .mockReturnValue([{ event: 'created', data: '{}', sequence: 1 }]);

      const generator = service.createTextResponseStream(dto);
      const events = [];
      for await (const event of generator) {
        events.push(event);
      }

      expect(mockLifecycleHandler.handleResponseCreated).toHaveBeenCalled();
    });

    it('should handle text events - text.delta', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test text delta',
      };

      async function* mockStream() {
        yield {
          type: 'response.output_text.delta',
          sequence_number: 1,
          delta: 'Hello ',
        };
        yield {
          type: 'response.output_text.delta',
          sequence_number: 2,
          delta: 'world',
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockTextHandler.handleTextDelta = jest.fn().mockReturnValue([]);

      const generator = service.createTextResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      expect(mockTextHandler.handleTextDelta).toHaveBeenCalledTimes(2);
    });

    it('should handle reasoning events', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test reasoning',
        model: 'o1',
      };

      async function* mockStream() {
        yield {
          type: 'response.reasoning_text.delta',
          sequence_number: 1,
          delta: 'Thinking...',
        };
        yield {
          type: 'response.reasoning_text.done',
          sequence_number: 2,
          text: 'Thinking complete',
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockReasoningHandler.handleReasoningTextDelta = jest
        .fn()
        .mockReturnValue([]);
      mockReasoningHandler.handleReasoningTextDone = jest
        .fn()
        .mockReturnValue([]);

      const generator = service.createTextResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      expect(mockReasoningHandler.handleReasoningTextDelta).toHaveBeenCalled();
      expect(mockReasoningHandler.handleReasoningTextDone).toHaveBeenCalled();
    });

    it('should handle tool calling events', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test tools',
        tools: [{ type: 'function' as const, name: 'test_func' }],
      };

      async function* mockStream() {
        yield {
          type: 'response.function_call_arguments.delta',
          sequence_number: 1,
          call_id: 'call_123',
          delta: '{"query":',
        };
        yield {
          type: 'response.function_call_arguments.done',
          sequence_number: 2,
          call_id: 'call_123',
          arguments: '{"query":"test"}',
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockToolCallingHandler.handleFunctionCallDelta = jest
        .fn()
        .mockReturnValue(
          (function* () {
            yield { event: 'function_delta', data: '{}', sequence: 1 };
          })(),
        );
      mockToolCallingHandler.handleFunctionCallDone = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'function_done', data: '{}', sequence: 2 };
        })(),
      );

      const generator = service.createTextResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      expect(mockToolCallingHandler.handleFunctionCallDelta).toHaveBeenCalled();
      expect(mockToolCallingHandler.handleFunctionCallDone).toHaveBeenCalled();
    });

    it('should handle image generation events', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Generate image',
      };

      async function* mockStream() {
        yield {
          type: 'response.image_generation_call.in_progress',
          sequence_number: 1,
          call_id: 'img_123',
        };
        yield {
          type: 'response.image_generation_call.partial_image',
          sequence_number: 2,
          call_id: 'img_123',
          image: 'base64data...',
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockImageHandler.handleImageGenProgress = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'image_progress', data: '{}', sequence: 1 };
        })(),
      );
      mockImageHandler.handleImageGenPartial = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'image_partial', data: '{}', sequence: 2 };
        })(),
      );

      const generator = service.createTextResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      expect(mockImageHandler.handleImageGenProgress).toHaveBeenCalled();
      expect(mockImageHandler.handleImageGenPartial).toHaveBeenCalled();
    });

    it('should handle audio events', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test audio',
      };

      async function* mockStream() {
        yield {
          type: 'response.audio.delta',
          sequence_number: 1,
          delta: 'audiodata1',
        };
        yield {
          type: 'response.audio.transcript.delta',
          sequence_number: 2,
          delta: 'Hello',
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockAudioHandler.handleAudioDelta = jest.fn().mockReturnValue([]);
      mockAudioHandler.handleAudioTranscriptDelta = jest
        .fn()
        .mockReturnValue([]);

      const generator = service.createTextResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      expect(mockAudioHandler.handleAudioDelta).toHaveBeenCalled();
      expect(mockAudioHandler.handleAudioTranscriptDelta).toHaveBeenCalled();
    });

    it('should handle MCP events', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test MCP',
      };

      async function* mockStream() {
        yield {
          type: 'response.mcp_call.in_progress',
          sequence_number: 1,
          call_id: 'mcp_123',
        };
        yield {
          type: 'response.mcp_call_arguments.delta',
          sequence_number: 2,
          call_id: 'mcp_123',
          delta: '{"arg":',
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockMCPHandler.handleMCPCallProgress = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'mcp_progress', data: '{}', sequence: 1 };
        })(),
      );
      mockMCPHandler.handleMCPCallDelta = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'mcp_args_delta', data: '{}', sequence: 2 };
        })(),
      );

      const generator = service.createTextResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      expect(mockMCPHandler.handleMCPCallProgress).toHaveBeenCalled();
      expect(mockMCPHandler.handleMCPCallDelta).toHaveBeenCalled();
    });

    it('should handle refusal events', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test refusal',
      };

      async function* mockStream() {
        yield {
          type: 'response.refusal.delta',
          sequence_number: 1,
          delta: 'I cannot',
        };
        yield {
          type: 'response.refusal.done',
          sequence_number: 2,
          refusal: 'I cannot assist with that',
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockRefusalHandler.handleRefusalDelta = jest.fn().mockReturnValue([]);
      mockRefusalHandler.handleRefusalDone = jest.fn().mockReturnValue([]);

      const generator = service.createTextResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      expect(mockRefusalHandler.handleRefusalDelta).toHaveBeenCalled();
      expect(mockRefusalHandler.handleRefusalDone).toHaveBeenCalled();
    });

    it('should handle structural events', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test structural',
      };

      async function* mockStream() {
        yield {
          type: 'response.output_item.added',
          sequence_number: 1,
          item: { type: 'text' },
        };
        yield {
          type: 'response.content_part.added',
          sequence_number: 2,
          part: { type: 'text' },
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockStructuralHandler.handleStructuralEvent = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'structural', data: '{}', sequence: 1 };
        })(),
      );

      const generator = service.createTextResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      expect(mockStructuralHandler.handleStructuralEvent).toHaveBeenCalledTimes(
        2,
      );
    });

    it('should include all advanced parameters in streaming request', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Advanced streaming',
        instructions: 'Be helpful',
        temperature: 0.7,
        top_p: 0.9,
        conversation: 'conv_123',
        previous_response_id: 'resp_prev',
        store: true,
        max_output_tokens: 1000,
        prompt_cache_key: 'cache_key',
        service_tier: 'default' as const,
        background: true,
        safety_identifier: 'safe_123',
        metadata: { user: 'test' },
      };

      async function* mockStream() {
        yield {
          type: 'response.completed',
          sequence_number: 1,
          response: { id: 'resp_advanced' },
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockLifecycleHandler.handleResponseCompleted = jest
        .fn()
        .mockReturnValue([]);

      const generator = service.createTextResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          input: 'Advanced streaming',
          instructions: 'Be helpful',
          temperature: 0.7,
          top_p: 0.9,
          conversation: 'conv_123',
          previous_response_id: 'resp_prev',
          store: true,
          max_output_tokens: 1000,
          prompt_cache_key: 'cache_key',
          service_tier: 'default',
          background: true,
          safety_identifier: 'safe_123',
          metadata: { user: 'test' },
          stream: true,
        }),
      );
    });

    it('should handle errors during streaming', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test error',
      };

      async function* mockStream() {
        yield {
          type: 'error',
          sequence_number: 1,
          error: {
            message: 'Stream error',
            code: 'test_error',
          },
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockLifecycleHandler.handleErrorEvent = jest.fn().mockReturnValue([]);

      const generator = service.createTextResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      expect(mockLifecycleHandler.handleErrorEvent).toHaveBeenCalled();
    });

    it('should handle unknown event types', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test unknown',
      };

      async function* mockStream() {
        yield {
          type: 'unknown.event.type',
          sequence_number: 1,
          data: 'test',
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockStructuralHandler.handleUnknownEvent = jest.fn().mockReturnValue([]);

      const generator = service.createTextResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      expect(mockStructuralHandler.handleUnknownEvent).toHaveBeenCalled();
    });

    it('should handle code interpreter events', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test code interpreter',
      };

      async function* mockStream() {
        yield {
          type: 'response.code_interpreter_call.in_progress',
          sequence_number: 1,
          call_id: 'code_123',
        };
        yield {
          type: 'response.code_interpreter_call_code.delta',
          sequence_number: 2,
          call_id: 'code_123',
          delta: 'print(',
        };
        yield {
          type: 'response.code_interpreter_call_code.done',
          sequence_number: 3,
          call_id: 'code_123',
          code: 'print("hello")',
        };
        yield {
          type: 'response.code_interpreter_call.interpreting',
          sequence_number: 4,
          call_id: 'code_123',
        };
        yield {
          type: 'response.code_interpreter_call.completed',
          sequence_number: 5,
          call_id: 'code_123',
          result: { output: 'hello' },
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockToolCallingHandler.handleCodeInterpreterProgress = jest
        .fn()
        .mockReturnValue(
          (function* () {
            yield { event: 'code_progress', data: '{}', sequence: 1 };
          })(),
        );
      mockToolCallingHandler.handleCodeInterpreterCodeDelta = jest
        .fn()
        .mockReturnValue(
          (function* () {
            yield { event: 'code_delta', data: '{}', sequence: 2 };
          })(),
        );
      mockToolCallingHandler.handleCodeInterpreterCodeDone = jest
        .fn()
        .mockReturnValue(
          (function* () {
            yield { event: 'code_done', data: '{}', sequence: 3 };
          })(),
        );
      mockToolCallingHandler.handleCodeInterpreterCompleted = jest
        .fn()
        .mockReturnValue(
          (function* () {
            yield { event: 'code_completed', data: '{}', sequence: 5 };
          })(),
        );

      const generator = service.createTextResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      expect(
        mockToolCallingHandler.handleCodeInterpreterProgress,
      ).toHaveBeenCalledTimes(2); // in_progress + interpreting
      expect(
        mockToolCallingHandler.handleCodeInterpreterCodeDelta,
      ).toHaveBeenCalled();
      expect(
        mockToolCallingHandler.handleCodeInterpreterCodeDone,
      ).toHaveBeenCalled();
      expect(
        mockToolCallingHandler.handleCodeInterpreterCompleted,
      ).toHaveBeenCalled();
    });

    it('should handle file search events', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test file search',
      };

      async function* mockStream() {
        yield {
          type: 'response.file_search_call.in_progress',
          sequence_number: 1,
          call_id: 'file_123',
        };
        yield {
          type: 'response.file_search_call.searching',
          sequence_number: 2,
          call_id: 'file_123',
        };
        yield {
          type: 'response.file_search_call.completed',
          sequence_number: 3,
          call_id: 'file_123',
          results: [{ file_id: 'file_abc', relevance: 0.9 }],
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockToolCallingHandler.handleFileSearchProgress = jest
        .fn()
        .mockReturnValue(
          (function* () {
            yield { event: 'file_progress', data: '{}', sequence: 1 };
          })(),
        );
      mockToolCallingHandler.handleFileSearchCompleted = jest
        .fn()
        .mockReturnValue(
          (function* () {
            yield { event: 'file_completed', data: '{}', sequence: 3 };
          })(),
        );

      const generator = service.createTextResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      expect(
        mockToolCallingHandler.handleFileSearchProgress,
      ).toHaveBeenCalledTimes(2);
      expect(
        mockToolCallingHandler.handleFileSearchCompleted,
      ).toHaveBeenCalled();
    });

    it('should handle web search events', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test web search',
      };

      async function* mockStream() {
        yield {
          type: 'response.web_search_call.in_progress',
          sequence_number: 1,
          call_id: 'web_123',
        };
        yield {
          type: 'response.web_search_call.searching',
          sequence_number: 2,
          call_id: 'web_123',
        };
        yield {
          type: 'response.web_search_call.completed',
          sequence_number: 3,
          call_id: 'web_123',
          results: [{ url: 'https://example.com', title: 'Example' }],
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockToolCallingHandler.handleWebSearchProgress = jest
        .fn()
        .mockReturnValue(
          (function* () {
            yield { event: 'web_progress', data: '{}', sequence: 1 };
          })(),
        );
      mockToolCallingHandler.handleWebSearchCompleted = jest
        .fn()
        .mockReturnValue(
          (function* () {
            yield { event: 'web_completed', data: '{}', sequence: 3 };
          })(),
        );

      const generator = service.createTextResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      expect(
        mockToolCallingHandler.handleWebSearchProgress,
      ).toHaveBeenCalledTimes(2);
      expect(
        mockToolCallingHandler.handleWebSearchCompleted,
      ).toHaveBeenCalled();
    });

    it('should handle custom tool events', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test custom tool',
      };

      async function* mockStream() {
        yield {
          type: 'response.custom_tool_call_input.delta',
          sequence_number: 1,
          call_id: 'custom_123',
          delta: '{"param":',
        };
        yield {
          type: 'response.custom_tool_call_input.done',
          sequence_number: 2,
          call_id: 'custom_123',
          input: '{"param":"value"}',
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockToolCallingHandler.handleCustomToolDelta = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'custom_delta', data: '{}', sequence: 1 };
        })(),
      );
      mockToolCallingHandler.handleCustomToolDone = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'custom_done', data: '{}', sequence: 2 };
        })(),
      );

      const generator = service.createTextResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      expect(mockToolCallingHandler.handleCustomToolDelta).toHaveBeenCalled();
      expect(mockToolCallingHandler.handleCustomToolDone).toHaveBeenCalled();
    });

    it('should handle response.queued event', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test queued',
      };

      async function* mockStream() {
        yield {
          type: 'response.queued',
          sequence_number: 1,
          response: { id: 'resp_queued' },
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockLifecycleHandler.handleResponseQueued = jest.fn().mockReturnValue([]);

      const generator = service.createTextResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      expect(mockLifecycleHandler.handleResponseQueued).toHaveBeenCalled();
    });

    it('should handle text annotation events', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test annotation',
      };

      async function* mockStream() {
        yield {
          type: 'response.output_text.annotation.added',
          sequence_number: 1,
          annotation: { type: 'citation', text: 'Source 1' },
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockTextHandler.handleTextAnnotation = jest.fn().mockReturnValue([]);

      const generator = service.createTextResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      expect(mockTextHandler.handleTextAnnotation).toHaveBeenCalled();
    });

    it('should handle text done event', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test text done',
      };

      async function* mockStream() {
        yield {
          type: 'response.output_text.done',
          sequence_number: 1,
          text: 'Complete text output',
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockTextHandler.handleTextDone = jest.fn().mockReturnValue([]);

      const generator = service.createTextResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      expect(mockTextHandler.handleTextDone).toHaveBeenCalled();
    });

    it('should handle reasoning summary events', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test reasoning summary',
        model: 'o1',
      };

      async function* mockStream() {
        yield {
          type: 'response.reasoning_summary_part.added',
          sequence_number: 1,
          part: { type: 'summary', content: 'Summary part 1' },
        };
        yield {
          type: 'response.reasoning_summary_text.delta',
          sequence_number: 2,
          delta: 'Summary ',
        };
        yield {
          type: 'response.reasoning_summary_text.done',
          sequence_number: 3,
          text: 'Summary complete',
        };
        yield {
          type: 'response.reasoning_summary_part.done',
          sequence_number: 4,
          part: { type: 'summary', content: 'Complete summary' },
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockReasoningHandler.handleReasoningSummaryPart = jest
        .fn()
        .mockReturnValue(
          (function* () {
            yield { event: 'summary_part', data: '{}', sequence: 1 };
          })(),
        );
      mockReasoningHandler.handleReasoningSummaryDelta = jest
        .fn()
        .mockReturnValue([]);
      mockReasoningHandler.handleReasoningSummaryDone = jest
        .fn()
        .mockReturnValue([]);

      const generator = service.createTextResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      expect(
        mockReasoningHandler.handleReasoningSummaryPart,
      ).toHaveBeenCalledTimes(2); // added + done
      expect(
        mockReasoningHandler.handleReasoningSummaryDelta,
      ).toHaveBeenCalled();
      expect(
        mockReasoningHandler.handleReasoningSummaryDone,
      ).toHaveBeenCalled();
    });

    it('should handle audio done event', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test audio done',
      };

      async function* mockStream() {
        yield {
          type: 'response.audio.done',
          sequence_number: 1,
          audio: 'complete_audio_base64',
        };
        yield {
          type: 'response.audio.transcript.done',
          sequence_number: 2,
          transcript: 'Complete transcript',
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockAudioHandler.handleAudioDone = jest.fn().mockReturnValue([]);
      mockAudioHandler.handleAudioTranscriptDone = jest
        .fn()
        .mockReturnValue([]);

      const generator = service.createTextResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      expect(mockAudioHandler.handleAudioDone).toHaveBeenCalled();
      expect(mockAudioHandler.handleAudioTranscriptDone).toHaveBeenCalled();
    });

    it('should handle MCP additional events', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test MCP comprehensive',
      };

      async function* mockStream() {
        yield {
          type: 'response.mcp_call_arguments.done',
          sequence_number: 1,
          call_id: 'mcp_456',
          arguments: '{"complete":"args"}',
        };
        yield {
          type: 'response.mcp_call.completed',
          sequence_number: 2,
          call_id: 'mcp_456',
          result: { status: 'success' },
        };
        yield {
          type: 'response.mcp_call.failed',
          sequence_number: 3,
          call_id: 'mcp_789',
          error: { message: 'MCP failed' },
        };
        yield {
          type: 'response.mcp_list_tools.in_progress',
          sequence_number: 4,
        };
        yield {
          type: 'response.mcp_list_tools.completed',
          sequence_number: 5,
          tools: [{ name: 'tool1' }],
        };
        yield {
          type: 'response.mcp_list_tools.failed',
          sequence_number: 6,
          error: { message: 'List failed' },
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockMCPHandler.handleMCPCallDone = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'mcp_done', data: '{}', sequence: 1 };
        })(),
      );
      mockMCPHandler.handleMCPCallCompleted = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'mcp_completed', data: '{}', sequence: 2 };
        })(),
      );
      mockMCPHandler.handleMCPCallFailed = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'mcp_failed', data: '{}', sequence: 3 };
        })(),
      );
      mockMCPHandler.handleMCPListTools = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'mcp_list', data: '{}', sequence: 4 };
        })(),
      );

      const generator = service.createTextResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      expect(mockMCPHandler.handleMCPCallDone).toHaveBeenCalled();
      expect(mockMCPHandler.handleMCPCallCompleted).toHaveBeenCalled();
      expect(mockMCPHandler.handleMCPCallFailed).toHaveBeenCalled();
      expect(mockMCPHandler.handleMCPListTools).toHaveBeenCalledTimes(3);
    });

    it('should handle output_item and content_part done events', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test structural done',
      };

      async function* mockStream() {
        yield {
          type: 'response.output_item.done',
          sequence_number: 1,
          item: { type: 'text', id: 'item_123' },
        };
      }

      mockOpenAIClient.responses.create.mockReturnValue(mockStream() as any);
      mockStructuralHandler.handleStructuralEvent = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'structural', data: '{}', sequence: 1 };
        })(),
      );

      const generator = service.createTextResponseStream(dto);
      for await (const event of generator) {
        // Consume events
      }

      expect(mockStructuralHandler.handleStructuralEvent).toHaveBeenCalled();
    });
  });

  /**
   * Response Lifecycle Methods Tests
   * Tests for retrieve(), delete(), and cancel() methods
   */
  describe('Response Lifecycle Methods', () => {
    describe('retrieve()', () => {
      it('should retrieve a response by ID successfully', async () => {
        const responseId = 'resp_test123';
        const mockResponse = createMockOpenAIResponse({
          id: responseId,
          status: 'completed',
        });

        mockOpenAIClient.responses.retrieve = jest
          .fn()
          .mockResolvedValue(mockResponse);

        const result = await service.retrieve(responseId);

        expect(result).toEqual(mockResponse);
        expect(mockOpenAIClient.responses.retrieve).toHaveBeenCalledWith(
          responseId,
          { stream: false },
        );
        expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
          expect.objectContaining({
            api: 'responses',
            endpoint: `/v1/responses/${responseId} (GET)`,
            request: {
              responseId,
              stream: false,
            },
            response: mockResponse,
            metadata: expect.objectContaining({
              latency_ms: expect.any(Number),
              tokens_used: 150,
              cached_tokens: 0,
              reasoning_tokens: 0,
              cost_estimate: expect.any(Number),
            }),
          }),
        );
      });

      it('should handle retrieve errors and log them', async () => {
        const responseId = 'resp_invalid';
        const error = new Error('Response not found');

        mockOpenAIClient.responses.retrieve = jest
          .fn()
          .mockRejectedValue(error);

        await expect(service.retrieve(responseId)).rejects.toThrow(
          'Response not found',
        );

        expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
          expect.objectContaining({
            api: 'responses',
            endpoint: `/v1/responses/${responseId} (GET)`,
            request: {
              responseId,
              stream: false,
            },
            error: expect.objectContaining({
              message: 'Response not found',
              original_error: error,
            }),
            metadata: expect.objectContaining({
              latency_ms: expect.any(Number),
            }),
          }),
        );
      });

      it('should handle OpenAI API errors with status codes', async () => {
        const responseId = 'resp_error';
        const apiError = createOpenAIError(
          OpenAI.NotFoundError,
          404,
          'Resource not found',
          'req_123',
        );

        mockOpenAIClient.responses.retrieve = jest
          .fn()
          .mockRejectedValue(apiError);

        await expect(service.retrieve(responseId)).rejects.toThrow(apiError);

        expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              status: 404,
              message: expect.stringContaining('Resource not found'),
            }),
          }),
        );
      });

      it('should extract and log usage information from retrieved response', async () => {
        const responseId = 'resp_cached';
        const mockResponse = createMockOpenAIResponse({
          id: responseId,
          usage: {
            input_tokens: 500,
            output_tokens: 200,
            total_tokens: 700,
            input_tokens_details: {
              cached_tokens: 300,
              text_tokens: 200,
              audio_tokens: 0,
              image_tokens: 0,
            },
            output_tokens_details: {
              text_tokens: 150,
              audio_tokens: 0,
              reasoning_tokens: 50,
            },
          },
        });

        mockOpenAIClient.responses.retrieve = jest
          .fn()
          .mockResolvedValue(mockResponse);

        await service.retrieve(responseId);

        expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({
              tokens_used: 700,
              cached_tokens: 300,
              reasoning_tokens: 50,
            }),
          }),
        );
      });
    });

    describe('delete()', () => {
      it('should delete a response by ID successfully', async () => {
        const responseId = 'resp_todelete';

        mockOpenAIClient.responses.delete = jest
          .fn()
          .mockResolvedValue(undefined);

        const result = await service.delete(responseId);

        expect(result).toEqual({
          id: responseId,
          deleted: true,
          object: 'response',
        });
        expect(mockOpenAIClient.responses.delete).toHaveBeenCalledWith(
          responseId,
        );
        expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
          expect.objectContaining({
            api: 'responses',
            endpoint: `/v1/responses/${responseId} (DELETE)`,
            request: {
              responseId,
            },
            response: {
              id: responseId,
              deleted: true,
              object: 'response',
            },
            metadata: expect.objectContaining({
              latency_ms: expect.any(Number),
            }),
          }),
        );
      });

      it('should handle delete errors and log them', async () => {
        const responseId = 'resp_cannotdelete';
        const error = new Error('Cannot delete response');

        mockOpenAIClient.responses.delete = jest.fn().mockRejectedValue(error);

        await expect(service.delete(responseId)).rejects.toThrow(
          'Cannot delete response',
        );

        expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
          expect.objectContaining({
            api: 'responses',
            endpoint: `/v1/responses/${responseId} (DELETE)`,
            request: {
              responseId,
            },
            error: expect.objectContaining({
              message: 'Cannot delete response',
              original_error: error,
            }),
            metadata: expect.objectContaining({
              latency_ms: expect.any(Number),
            }),
          }),
        );
      });

      it('should handle OpenAI API errors during deletion', async () => {
        const responseId = 'resp_forbidden';
        const apiError = createOpenAIError(
          OpenAI.PermissionDeniedError,
          403,
          'Permission denied',
          'req_456',
        );

        mockOpenAIClient.responses.delete = jest
          .fn()
          .mockRejectedValue(apiError);

        await expect(service.delete(responseId)).rejects.toThrow(apiError);

        expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              status: 403,
              message: expect.stringContaining('Permission denied'),
            }),
          }),
        );
      });

      it('should return correct confirmation object structure', async () => {
        const responseId = 'resp_confirm123';

        mockOpenAIClient.responses.delete = jest
          .fn()
          .mockResolvedValue(undefined);

        const result = await service.delete(responseId);

        expect(result).toHaveProperty('id', responseId);
        expect(result).toHaveProperty('deleted', true);
        expect(result).toHaveProperty('object', 'response');
        expect(Object.keys(result)).toEqual(['id', 'deleted', 'object']);
      });
    });

    describe('cancel()', () => {
      it('should cancel a background response successfully', async () => {
        const responseId = 'resp_background123';
        const mockCanceledResponse = createMockOpenAIResponse({
          id: responseId,
          status: 'cancelled',
        });

        mockOpenAIClient.responses.cancel = jest
          .fn()
          .mockResolvedValue(mockCanceledResponse);

        const result = await service.cancel(responseId);

        expect(result).toEqual(mockCanceledResponse);
        expect(mockOpenAIClient.responses.cancel).toHaveBeenCalledWith(
          responseId,
        );
        expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
          expect.objectContaining({
            api: 'responses',
            endpoint: `/v1/responses/${responseId}/cancel (POST)`,
            request: {
              responseId,
            },
            response: mockCanceledResponse,
            metadata: expect.objectContaining({
              latency_ms: expect.any(Number),
              tokens_used: 150,
              cached_tokens: 0,
              reasoning_tokens: 0,
              cost_estimate: expect.any(Number),
            }),
          }),
        );
      });

      it('should handle cancel errors for non-background responses', async () => {
        const responseId = 'resp_notbackground';
        const error = new Error(
          'Response was not created with background=true',
        );

        mockOpenAIClient.responses.cancel = jest.fn().mockRejectedValue(error);

        await expect(service.cancel(responseId)).rejects.toThrow(
          'Response was not created with background=true',
        );

        expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
          expect.objectContaining({
            api: 'responses',
            endpoint: `/v1/responses/${responseId}/cancel (POST)`,
            request: {
              responseId,
            },
            error: expect.objectContaining({
              message: 'Response was not created with background=true',
              original_error: error,
            }),
            metadata: expect.objectContaining({
              latency_ms: expect.any(Number),
            }),
          }),
        );
      });

      it('should handle OpenAI API errors during cancellation', async () => {
        const responseId = 'resp_alreadycompleted';
        const apiError = createOpenAIError(
          OpenAI.BadRequestError,
          400,
          'Response already completed',
          'req_789',
        );

        mockOpenAIClient.responses.cancel = jest
          .fn()
          .mockRejectedValue(apiError);

        await expect(service.cancel(responseId)).rejects.toThrow(apiError);

        expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              status: 400,
              message: expect.stringContaining('Response already completed'),
            }),
          }),
        );
      });

      it('should extract and log usage information from canceled response', async () => {
        const responseId = 'resp_partialcancel';
        const mockResponse = createMockOpenAIResponse({
          id: responseId,
          status: 'cancelled',
          usage: {
            input_tokens: 100,
            output_tokens: 25,
            total_tokens: 125,
            input_tokens_details: {
              cached_tokens: 50,
              text_tokens: 50,
              audio_tokens: 0,
              image_tokens: 0,
            },
            output_tokens_details: {
              text_tokens: 20,
              audio_tokens: 0,
              reasoning_tokens: 5,
            },
          },
        });

        mockOpenAIClient.responses.cancel = jest
          .fn()
          .mockResolvedValue(mockResponse);

        await service.cancel(responseId);

        expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({
              tokens_used: 125,
              cached_tokens: 50,
              reasoning_tokens: 5,
            }),
          }),
        );
      });

      it('should return response with cancelled status', async () => {
        const responseId = 'resp_statuscheck';
        const mockResponse = createMockOpenAIResponse({
          id: responseId,
          status: 'cancelled',
        });

        mockOpenAIClient.responses.cancel = jest
          .fn()
          .mockResolvedValue(mockResponse);

        const result = await service.cancel(responseId);

        expect(result.status).toBe('cancelled');
        expect(result.id).toBe(responseId);
      });
    });
  });
});
