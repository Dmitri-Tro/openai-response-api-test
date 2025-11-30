import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { Responses } from 'openai/resources/responses';
import { OpenAIResponsesService } from './openai-responses.service';
import { OPENAI_CLIENT } from '../providers/openai-client.provider';
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
import { ComputerUseEventsHandler } from './handlers/computer-use-events.handler';
import {
  createMockConfigService,
  createMockLoggerService,
  createMockOpenAIClient,
  createMockOpenAIResponse,
  createOpenAIError,
} from '../../common/testing/test.factories';

describe('OpenAIResponsesService', () => {
  let service: OpenAIResponsesService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockLoggerService: jest.Mocked<LoggerService>;
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
  let mockComputerUseHandler: jest.Mocked<ComputerUseEventsHandler>;

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
    mockComputerUseHandler = {} as jest.Mocked<ComputerUseEventsHandler>;

    // Mock OpenAI client (singleton provider pattern)
    mockOpenAIClient = createMockOpenAIClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenAIResponsesService,
        {
          provide: OPENAI_CLIENT,
          useValue: mockOpenAIClient,
        },
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
        {
          provide: ComputerUseEventsHandler,
          useValue: mockComputerUseHandler,
        },
      ],
    }).compile();

    service = module.get<OpenAIResponsesService>(OpenAIResponsesService);
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
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Hello! How can I help you today?',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

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
            latency_ms: expect.any(Number) as number,
            tokens_used: 30,
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      );
    });

    it('should include instructions when provided', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test message',
        instructions: 'You are a helpful assistant',
      };

      const mockResponse: Responses.Response = createMockOpenAIResponse({
        id: 'resp_456',
        output_text: 'Response text',
        usage: {
          input_tokens: 5,
          output_tokens: 10,
          total_tokens: 15,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
      });

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

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
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 1,
          output_tokens: 2,
          total_tokens: 3,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

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
        created_at: 1234567890,
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
          output_tokens_details: { reasoning_tokens: 0 },
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      await service.createTextResponse(dto);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            cached_tokens: 80,
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
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
        created_at: 1234567890,
        model: 'o1',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 50,
          output_tokens: 100,
          total_tokens: 150,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: {
            reasoning_tokens: 75,
          },
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      await service.createTextResponse(dto);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            reasoning_tokens: 75,
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
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
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

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
      (mockOpenAIClient.responses.create as jest.Mock).mockRejectedValue(
        mockError,
      );

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
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      );
    });

    it('should use default model when not provided', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test default model',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_default',
        object: 'response',
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

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
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'base64encodedimagedata',
        usage: {
          input_tokens: 5,
          output_tokens: 0,
          total_tokens: 5,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

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
            }) as Record<string, unknown>,
          ]) as unknown[],
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
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'base64image',
        usage: {
          input_tokens: 10,
          output_tokens: 0,
          total_tokens: 10,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      await service.createImageResponse(dto);

      const createCall = (
        (mockOpenAIClient.responses.create as jest.Mock).mock
          .calls as unknown[][]
      )[0][0] as Record<string, unknown>;
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
        name: 'custom_function',
        description: 'Custom function',
        parameters: {
          type: 'object',
          properties: {},
        },
        strict: null,
      };

      const dto: CreateImageResponseDto = {
        input: 'Test with tools',
        tools: [userTool],
      };

      const mockResponse: Responses.Response = {
        id: 'resp_tools',
        object: 'response',
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'base64',
        usage: {
          input_tokens: 5,
          output_tokens: 0,
          total_tokens: 5,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      await service.createImageResponse(dto);

      const createCall = (
        (mockOpenAIClient.responses.create as jest.Mock).mock
          .calls as unknown[][]
      )[0][0] as Record<string, unknown>;
      expect(createCall.tools).toHaveLength(2);
      expect(createCall.tools).toContainEqual(userTool);
    });

    it('should handle image generation errors', async () => {
      const dto: CreateImageResponseDto = {
        input: 'Error test',
      };

      const mockError = new Error('Image generation failed');
      (mockOpenAIClient.responses.create as jest.Mock).mockRejectedValue(
        mockError,
      );

      await expect(service.createImageResponse(dto)).rejects.toThrow(
        'Image generation failed',
      );

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: '/v1/responses (gpt-image-1)',
          error: expect.objectContaining({
            message: 'Image generation failed',
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
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
          created_at: 1234567890,
          model: 'gpt-5',
          status: 'completed',
          output_text: 'image',
          usage: {
            input_tokens: 1,
            output_tokens: 0,
            total_tokens: 1,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens_details: { reasoning_tokens: 0 },
          },
          error: null,
          incomplete_details: null,
          instructions: null,
          metadata: null,
          output: [],
          parallel_tool_calls: false,
          temperature: null,
          tool_choice: 'auto',
          tools: [],
          top_p: null,
        };

        (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
          mockResponse,
        );
        await service.createImageResponse(dto);

        const mockCalls = (mockOpenAIClient.responses.create as jest.Mock).mock
          .calls as unknown[][];
        const createCall = mockCalls[mockCalls.length - 1][0] as Record<
          string,
          unknown
        >;
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
          created_at: 1234567890,
          model: 'gpt-5',
          status: 'completed',
          output_text: 'image',
          usage: {
            input_tokens: 1,
            output_tokens: 0,
            total_tokens: 1,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens_details: { reasoning_tokens: 0 },
          },
          error: null,
          incomplete_details: null,
          instructions: null,
          metadata: null,
          output: [],
          parallel_tool_calls: false,
          temperature: null,
          tool_choice: 'auto',
          tools: [],
          top_p: null,
        };

        (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
          mockResponse,
        );
        await service.createImageResponse(dto);

        const mockCalls = (mockOpenAIClient.responses.create as jest.Mock).mock
          .calls as unknown[][];
        const createCall = mockCalls[mockCalls.length - 1][0] as Record<
          string,
          unknown
        >;
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
          created_at: 1234567890,
          model: 'gpt-5',
          status: 'completed',
          output_text: 'image',
          usage: {
            input_tokens: 1,
            output_tokens: 0,
            total_tokens: 1,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens_details: { reasoning_tokens: 0 },
          },
          error: null,
          incomplete_details: null,
          instructions: null,
          metadata: null,
          output: [],
          parallel_tool_calls: false,
          temperature: null,
          tool_choice: 'auto',
          tools: [],
          top_p: null,
        };

        (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
          mockResponse,
        );
        await service.createImageResponse(dto);

        const mockCalls = (mockOpenAIClient.responses.create as jest.Mock).mock
          .calls as unknown[][];
        const createCall = mockCalls[mockCalls.length - 1][0] as Record<
          string,
          unknown
        >;
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
          created_at: 1234567890,
          model: 'gpt-5',
          status: 'completed',
          output_text: 'image',
          usage: {
            input_tokens: 1,
            output_tokens: 0,
            total_tokens: 1,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens_details: { reasoning_tokens: 0 },
          },
          error: null,
          incomplete_details: null,
          instructions: null,
          metadata: null,
          output: [],
          parallel_tool_calls: false,
          temperature: null,
          tool_choice: 'auto',
          tools: [],
          top_p: null,
        };

        (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
          mockResponse,
        );
        await service.createImageResponse(dto);

        const mockCalls = (mockOpenAIClient.responses.create as jest.Mock).mock
          .calls as unknown[][];
        const createCall = mockCalls[mockCalls.length - 1][0] as Record<
          string,
          unknown
        >;
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

      function* mockStream() {
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

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
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
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
      }

      expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          input: 'A beautiful landscape',
          stream: true,
          tools: expect.arrayContaining([
            expect.objectContaining({
              type: 'image_generation',
            }) as Record<string, unknown>,
          ]) as unknown[],
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

      function* mockStream() {
        yield {
          type: 'response.completed',
          sequence_number: 1,
          response: { id: 'resp_advanced_img' },
        };
      }

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
      mockLifecycleHandler.handleResponseCompleted = jest
        .fn()
        .mockReturnValue([]);

      const generator = service.createImageResponseStream(dto);
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
      }

      const createCall = (
        (mockOpenAIClient.responses.create as jest.Mock).mock
          .calls as unknown[][]
      )[0][0] as Record<string, unknown>;
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

      function* mockStream() {
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

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
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
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
      }

      expect(mockImageHandler.handleImageGenProgress).toHaveBeenCalledTimes(1);
      expect(mockImageHandler.handleImageGenPartial).toHaveBeenCalledTimes(3);
      expect(mockImageHandler.handleImageGenCompleted).toHaveBeenCalledTimes(1);
    });

    it('should handle image generation errors during streaming', async () => {
      const dto: CreateImageResponseDto = {
        input: 'Error test streaming',
      };

      function* mockStream() {
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

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
      mockImageHandler.handleImageGenProgress = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'progress', data: '{}', sequence: 1 };
        })(),
      );
      mockLifecycleHandler.handleErrorEvent = jest.fn().mockReturnValue([]);

      const generator = service.createImageResponseStream(dto);
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
      }

      expect(mockImageHandler.handleImageGenProgress).toHaveBeenCalled();
      expect(mockLifecycleHandler.handleErrorEvent).toHaveBeenCalled();
    });

    it('should test image_generation_call.generating event', async () => {
      const dto: CreateImageResponseDto = {
        input: 'Test generating event',
      };

      function* mockStream() {
        yield {
          type: 'response.image_generation_call.generating',
          sequence_number: 1,
          call_id: 'img_gen',
          progress: 50,
        };
      }

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
      mockImageHandler.handleImageGenProgress = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'generating', data: '{}', sequence: 1 };
        })(),
      );

      const generator = service.createImageResponseStream(dto);
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
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
        truncation: 'auto',
        include: ['file_search_call.results'],
      };

      function* mockStream() {
        yield {
          type: 'response.completed',
          sequence_number: 1,
          response: { id: 'resp_complete', status: 'completed' },
        };
      }

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
      mockLifecycleHandler.handleResponseCompleted = jest
        .fn()
        .mockReturnValue([]);

      const generator = service.createImageResponseStream(dto);
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
      }

      const createCall = (
        (mockOpenAIClient.responses.create as jest.Mock).mock
          .calls as unknown[][]
      )[0][0] as Record<string, unknown>;

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
        truncation: 'auto',
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

      const mockStream = (): AsyncIterable<Record<string, unknown>> => ({
        [Symbol.asyncIterator]() {
          return {
            next() {
              return Promise.reject(error);
            },
          };
        },
      });

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream(),
      );

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
          }) as Record<string, unknown>,
          metadata: expect.objectContaining({
            latency_ms: expect.any(Number) as number,
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      );

      // Verify error event was yielded
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        event: 'error',
        data: expect.stringContaining('Streaming failed') as string,
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

      const mockStream = (): AsyncIterable<Record<string, unknown>> => ({
        [Symbol.asyncIterator]() {
          return {
            next() {
              return Promise.reject(apiError);
            },
          };
        },
      });

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream(),
      );

      const generator = service.createImageResponseStream(dto);

      try {
        // Consume all events from generator
        for await (const _ of generator) {
          void _;
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
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      );
    });

    it('should route text events when model provides text alongside images', async () => {
      const dto: CreateImageResponseDto = {
        input: 'Image with text description',
      };

      function* mockStream() {
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

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
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

      function* mockStream() {
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

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
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
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
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

      function* mockStream() {
        yield {
          type: 'response.unknown_event_type',
          sequence_number: 1,
        };
      }

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
      mockStructuralHandler.handleStructuralEvent = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'structural', data: '{}', sequence: 1 };
        })(),
      );

      const generator = service.createImageResponseStream(dto);
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
      }

      expect(mockStructuralHandler.handleStructuralEvent).toHaveBeenCalled();
    });

    it('should handle prompt parameter in image streaming', async () => {
      const dto: CreateImageResponseDto = {
        input: 'Prompt test',
        prompt: {
          type: 'text',
          text: 'System prompt for image generation',
        } as unknown as typeof dto.prompt,
      };

      function* mockStream() {
        yield {
          type: 'response.completed',
          sequence_number: 1,
          response: { id: 'resp_prompt', status: 'completed' },
        };
      }

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
      mockLifecycleHandler.handleResponseCompleted = jest
        .fn()
        .mockReturnValue([]);

      const generator = service.createImageResponseStream(dto);
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
      }

      const createCall = (
        (mockOpenAIClient.responses.create as jest.Mock).mock
          .calls as unknown[][]
      )[0][0] as Record<string, unknown>;
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

      function* mockStream() {
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

      (mockOpenAIClient.responses.retrieve as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
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

      const mockStream = (): AsyncIterable<Record<string, unknown>> => ({
        [Symbol.asyncIterator]() {
          return {
            next() {
              return Promise.reject(error);
            },
          };
        },
      });

      (mockOpenAIClient.responses.retrieve as jest.Mock).mockReturnValue(
        mockStream(),
      );

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
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      );

      // Verify error event was yielded
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        event: 'error',
        data: expect.stringContaining('Resume failed') as string,
      });
    });

    it('should log stream resume event', async () => {
      const responseId = 'resp_logging';

      function* mockStream() {
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

      (mockOpenAIClient.responses.retrieve as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
      mockLifecycleHandler.handleResponseCompleted = jest
        .fn()
        .mockReturnValue([]);

      const generator = service.resumeResponseStream(responseId);
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
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
          } as Record<string, unknown>,
        }) as Record<string, unknown>,
      );
    });
  });

  describe('retrieve', () => {
    it('should retrieve a stored response by ID', async () => {
      const responseId = 'resp_retrieve_123';

      const mockResponse: Responses.Response = {
        id: responseId,
        object: 'response',
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Retrieved response',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.retrieve as jest.Mock).mockResolvedValue(
        mockResponse,
      );

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
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      );
    });

    it('should handle retrieve errors', async () => {
      const responseId = 'resp_not_found';
      const mockError = new Error('Response not found');

      (mockOpenAIClient.responses.retrieve as jest.Mock).mockRejectedValue(
        mockError,
      );

      await expect(service.retrieve(responseId)).rejects.toThrow(
        'Response not found',
      );

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: `/v1/responses/${responseId} (GET)`,
          error: expect.objectContaining({
            message: 'Response not found',
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      );
    });
  });

  describe('delete', () => {
    it('should delete a stored response by ID', async () => {
      const responseId = 'resp_delete_123';

      (mockOpenAIClient.responses.delete as jest.Mock).mockResolvedValue(
        undefined,
      );

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
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      );
    });

    it('should handle delete errors', async () => {
      const responseId = 'resp_delete_error';
      const mockError = new Error('Delete failed');

      (mockOpenAIClient.responses.delete as jest.Mock).mockRejectedValue(
        mockError,
      );

      await expect(service.delete(responseId)).rejects.toThrow('Delete failed');

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: `/v1/responses/${responseId} (DELETE)`,
          error: expect.objectContaining({
            message: 'Delete failed',
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      );
    });
  });

  describe('cancel', () => {
    it('should cancel a background response by ID', async () => {
      const responseId = 'resp_cancel_123';

      const mockResponse: Responses.Response = {
        id: responseId,
        object: 'response',
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'cancelled',
        output_text: '',
        usage: {
          input_tokens: 10,
          output_tokens: 0,
          total_tokens: 10,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.cancel as jest.Mock).mockResolvedValue(
        mockResponse,
      );

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

      (mockOpenAIClient.responses.cancel as jest.Mock).mockRejectedValue(
        mockError,
      );

      await expect(service.cancel(responseId)).rejects.toThrow(
        'Not a background response',
      );

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: `/v1/responses/${responseId}/cancel (POST)`,
          error: expect.objectContaining({
            message: 'Not a background response',
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
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
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      await service.createTextResponse(dto);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            tokens_used: 300,
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      );
    });

    it('should handle missing usage gracefully', async () => {
      const dto: CreateTextResponseDto = {
        input: 'No usage',
      };

      const mockResponse: Responses.Response = createMockOpenAIResponse({
        id: 'resp_no_usage',
        output_text: 'Response',
        usage: undefined as unknown as Responses.Response['usage'],
      });

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      await service.createTextResponse(dto);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            tokens_used: undefined,
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      );
    });

    it('should extract cached_tokens from input_tokens_details', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test cached tokens',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_cached',
        object: 'response',
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 500,
          output_tokens: 100,
          total_tokens: 600,
          input_tokens_details: {
            cached_tokens: 300,
          },
          output_tokens_details: {
            reasoning_tokens: 0,
          },
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      await service.createTextResponse(dto);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            tokens_used: 600,
            cached_tokens: 300,
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
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
        created_at: 1234567890,
        model: 'o3',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 200,
          output_tokens: 400,
          total_tokens: 600,
          input_tokens_details: {
            cached_tokens: 0,
          },
          output_tokens_details: {
            reasoning_tokens: 100,
          },
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      await service.createTextResponse(dto);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            tokens_used: 600,
            reasoning_tokens: 100,
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
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
        created_at: 1234567890,
        model: 'o3',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          total_tokens: 1500,
          input_tokens_details: {
            cached_tokens: 600,
          },
          output_tokens_details: {
            reasoning_tokens: 150,
          },
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      await service.createTextResponse(dto);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            tokens_used: 1500,
            cached_tokens: 600,
            reasoning_tokens: 150,
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      );
    });

    it('should handle missing input_tokens_details', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test missing details',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_no_details',
        object: 'response',
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          total_tokens: 150,
          input_tokens_details:
            {} as Responses.ResponseUsage['input_tokens_details'],
          output_tokens_details:
            {} as Responses.ResponseUsage['output_tokens_details'],
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      await service.createTextResponse(dto);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            tokens_used: 150,
            cached_tokens: undefined,
            reasoning_tokens: undefined,
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      );
    });
  });

  describe('extractResponseMetadata (private method)', () => {
    it('should extract response status and background fields', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test metadata',
        background: true,
      };

      const mockResponse: Responses.Response = {
        id: 'resp_metadata',
        object: 'response',
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        background: true,
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      await service.createTextResponse(dto);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            response_status: 'completed',
            background: true,
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
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
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        prompt_cache_key: 'cache_key_123',
        service_tier: 'flex',
        safety_identifier: 'user_hash_abc',
        metadata: { request_id: 'req_123', app: 'test' },
        error: null,
        incomplete_details: null,
        instructions: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      await service.createTextResponse(dto);

      // Phase 2.7 params are in the response object, not logged metadata
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          response: expect.objectContaining({
            prompt_cache_key: 'cache_key_123',
            service_tier: 'flex',
            safety_identifier: 'user_hash_abc',
            metadata: { request_id: 'req_123', app: 'test' },
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      );
    });

    it('should extract max_output_tokens and previous_response_id', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test conversation params',
        max_output_tokens: 1000,
        previous_response_id: 'resp_prev123',
      };

      const mockResponse: Responses.Response = createMockOpenAIResponse({
        id: 'resp_conv',
        output_text: 'Response',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        max_output_tokens: 1000,
        previous_response_id: 'resp_prev123',
      });

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      await service.createTextResponse(dto);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            max_output_tokens: 1000,
            previous_response_id: 'resp_prev123',
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
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
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        truncation: 'auto',
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      await service.createTextResponse(dto);

      // Truncation is in the response object, not logged metadata
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          response: expect.objectContaining({
            truncation: 'auto',
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      );
    });

    it('should extract error field from incomplete response', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test error extraction',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_err',
        object: 'response',
        created_at: 1234567890,
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
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

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
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      );
    });

    it('should extract incomplete_details field', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test incomplete details',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_incomplete',
        object: 'response',
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'incomplete',
        output_text: 'Partial response',
        incomplete_details: {
          reason: 'max_output_tokens',
        },
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          total_tokens: 15,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        error: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      await service.createTextResponse(dto);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            response_status: 'incomplete',
            incomplete_details: {
              reason: 'max_output_tokens',
            },
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      );
    });

    it('should extract text verbosity if present', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test text verbosity',
        text: {
          verbosity: 'low',
        },
      };

      const mockResponse: Responses.Response = {
        id: 'resp_verbosity',
        object: 'response',
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        text: {
          verbosity: 'low',
        },
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      await service.createTextResponse(dto);

      // Text verbosity is in the response object, not logged metadata
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          response: expect.objectContaining({
            text: {
              verbosity: 'low',
            },
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      );
    });

    it('should return empty metadata when no optional fields present', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Minimal response',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_minimal',
        object: 'response',
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      await service.createTextResponse(dto);

      const call =
        mockLoggerService.logOpenAIInteraction.mock.calls[
          mockLoggerService.logOpenAIInteraction.mock.calls.length - 1
        ][0];
      const metadata = call.metadata;

      expect(metadata.response_status).toBe('completed');
      expect(metadata.response_error).toBeUndefined();
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
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 1000,
          output_tokens: 2000,
          total_tokens: 3000,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

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
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      await service.createTextResponse(dto);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            cost_estimate: 0,
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      );
    });

    it('should handle zero tokens correctly', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Zero tokens',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_zero',
        object: 'response',
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: '',
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      await service.createTextResponse(dto);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            cost_estimate: 0,
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      );
    });

    it('should calculate cost with only input tokens', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Input only',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_input_only',
        object: 'response',
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'incomplete',
        output_text: '',
        usage: {
          input_tokens: 500,
          output_tokens: 0,
          total_tokens: 500,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

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
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 0,
          output_tokens: 1000,
          total_tokens: 1000,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      await service.createTextResponse(dto);

      // Cost: (0/1_000_000) * 0.00125 + (1000/1_000_000) * 0.01 = 0 + 0.00001 = 0.00001
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            cost_estimate: 0.00001,
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      );
    });

    it('should handle very large token counts', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Large request',
      };

      const mockResponse: Responses.Response = {
        id: 'resp_large',
        object: 'response',
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 100000,
          output_tokens: 50000,
          total_tokens: 150000,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

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
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Response',
        usage: {
          input_tokens: 250,
          output_tokens: 150,
          total_tokens: 400,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

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
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Results found in documents',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      await service.createTextResponse(dto);

      const createCall = (
        (mockOpenAIClient.responses.create as jest.Mock).mock
          .calls as unknown[][]
      )[0][0] as Record<string, unknown>;
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
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Search results',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      await service.createTextResponse(dto);

      const createCall = (
        (mockOpenAIClient.responses.create as jest.Mock).mock
          .calls as unknown[][]
      )[0][0] as Record<string, unknown>;
      expect(createCall.tools).toContainEqual(fileSearchTool);
    });

    it('should combine file_search with other tools', async () => {
      const functionTool = {
        type: 'function' as const,
        name: 'get_weather',
        description: 'Get weather information',
        parameters: {
          type: 'object' as const,
          properties: {
            location: { type: 'string' as const },
          },
          required: ['location'],
        },
        strict: null,
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
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Combined response',
        usage: {
          input_tokens: 15,
          output_tokens: 25,
          total_tokens: 40,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      await service.createTextResponse(dto);

      const createCall = (
        (mockOpenAIClient.responses.create as jest.Mock).mock
          .calls as unknown[][]
      )[0][0] as Record<string, unknown>;
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
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Multi-store results',
        usage: {
          input_tokens: 20,
          output_tokens: 30,
          total_tokens: 50,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      await service.createTextResponse(dto);

      const createCall = (
        (mockOpenAIClient.responses.create as jest.Mock).mock
          .calls as unknown[][]
      )[0][0] as Record<string, unknown>;
      const tools = createCall.tools as Array<Record<string, unknown>>;
      expect(tools[0].vector_store_ids).toEqual([
        'vs_store1',
        'vs_store2',
        'vs_store3',
      ]);
      expect(tools[0].max_num_results).toBe(15);
      const rankingOptions = tools[0].ranking_options as Record<
        string,
        unknown
      >;
      expect(rankingOptions.score_threshold).toBe(0.85);
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
        created_at: 1234567890,
        model: 'gpt-5',
        status: 'completed',
        output_text: 'Search results',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: 'auto',
        tools: [],
        top_p: null,
      };

      (mockOpenAIClient.responses.create as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      await service.createTextResponse(dto);

      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'responses',
          endpoint: '/v1/responses',
          request: expect.objectContaining({
            tools: expect.arrayContaining([fileSearchTool]) as unknown[],
          }) as Record<string, unknown>,
          response: mockResponse,
        }) as Record<string, unknown>,
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
      function* mockStream() {
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

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );

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

    it('should include stream_options in the request', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test stream options',
        stream_options: { include_obfuscation: true },
      };

      function* mockStream() {
        yield {
          type: 'response.created',
          sequence_number: 1,
          response: { id: 'resp_stream_opts' },
        };
      }

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
      mockLifecycleHandler.handleResponseCreated = jest
        .fn()
        .mockReturnValue([]);

      const generator = service.createTextResponseStream(dto);
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
      }

      expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          stream: true,
          stream_options: { include_obfuscation: true },
        }),
      );
    });

    it('should handle lifecycle events - response.created', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test lifecycle',
      };

      function* mockStream() {
        yield {
          type: 'response.created',
          sequence_number: 1,
          response: { id: 'resp_lifecycle' },
        };
      }

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
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

      function* mockStream() {
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

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
      mockTextHandler.handleTextDelta = jest.fn().mockReturnValue([]);

      const generator = service.createTextResponseStream(dto);
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
      }

      expect(mockTextHandler.handleTextDelta).toHaveBeenCalledTimes(2);
    });

    it('should handle reasoning events', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test reasoning',
        model: 'o1',
      };

      function* mockStream() {
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

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
      mockReasoningHandler.handleReasoningTextDelta = jest
        .fn()
        .mockReturnValue([]);
      mockReasoningHandler.handleReasoningTextDone = jest
        .fn()
        .mockReturnValue([]);

      const generator = service.createTextResponseStream(dto);
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
      }

      expect(mockReasoningHandler.handleReasoningTextDelta).toHaveBeenCalled();
      expect(mockReasoningHandler.handleReasoningTextDone).toHaveBeenCalled();
    });

    it('should handle tool calling events', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test tools',
        tools: [
          {
            type: 'function' as const,
            name: 'test_func',
            description: 'Test function',
            parameters: { type: 'object', properties: {} },
            strict: null,
          },
        ],
      };

      function* mockStream() {
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

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
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
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
      }

      expect(mockToolCallingHandler.handleFunctionCallDelta).toHaveBeenCalled();
      expect(mockToolCallingHandler.handleFunctionCallDone).toHaveBeenCalled();
    });

    it('should handle image generation events', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Generate image',
      };

      function* mockStream() {
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

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
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
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
      }

      expect(mockImageHandler.handleImageGenProgress).toHaveBeenCalled();
      expect(mockImageHandler.handleImageGenPartial).toHaveBeenCalled();
    });

    it('should handle audio events', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test audio',
      };

      function* mockStream() {
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

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
      mockAudioHandler.handleAudioDelta = jest.fn().mockReturnValue([]);
      mockAudioHandler.handleAudioTranscriptDelta = jest
        .fn()
        .mockReturnValue([]);

      const generator = service.createTextResponseStream(dto);
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
      }

      expect(mockAudioHandler.handleAudioDelta).toHaveBeenCalled();
      expect(mockAudioHandler.handleAudioTranscriptDelta).toHaveBeenCalled();
    });

    it('should handle MCP events', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test MCP',
      };

      function* mockStream() {
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

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
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
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
      }

      expect(mockMCPHandler.handleMCPCallProgress).toHaveBeenCalled();
      expect(mockMCPHandler.handleMCPCallDelta).toHaveBeenCalled();
    });

    it('should handle refusal events', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test refusal',
      };

      function* mockStream() {
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

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
      mockRefusalHandler.handleRefusalDelta = jest.fn().mockReturnValue([]);
      mockRefusalHandler.handleRefusalDone = jest.fn().mockReturnValue([]);

      const generator = service.createTextResponseStream(dto);
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
      }

      expect(mockRefusalHandler.handleRefusalDelta).toHaveBeenCalled();
      expect(mockRefusalHandler.handleRefusalDone).toHaveBeenCalled();
    });

    it('should handle structural events', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test structural',
      };

      function* mockStream() {
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

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
      mockStructuralHandler.handleStructuralEvent = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'structural', data: '{}', sequence: 1 };
        })(),
      );

      const generator = service.createTextResponseStream(dto);
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
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

      function* mockStream() {
        yield {
          type: 'response.completed',
          sequence_number: 1,
          response: { id: 'resp_advanced' },
        };
      }

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
      mockLifecycleHandler.handleResponseCompleted = jest
        .fn()
        .mockReturnValue([]);

      const generator = service.createTextResponseStream(dto);
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
      }

      expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          input: 'Advanced streaming',
          instructions: 'Be helpful',
          temperature: 0.7,
          top_p: 0.9,
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

      function* mockStream() {
        yield {
          type: 'error',
          sequence_number: 1,
          error: {
            message: 'Stream error',
            code: 'test_error',
          },
        };
      }

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
      mockLifecycleHandler.handleErrorEvent = jest.fn().mockReturnValue([]);

      const generator = service.createTextResponseStream(dto);
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
      }

      expect(mockLifecycleHandler.handleErrorEvent).toHaveBeenCalled();
    });

    it('should handle unknown event types', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test unknown',
      };

      function* mockStream() {
        yield {
          type: 'unknown.event.type',
          sequence_number: 1,
          data: 'test',
        };
      }

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
      mockStructuralHandler.handleUnknownEvent = jest.fn().mockReturnValue([]);

      const generator = service.createTextResponseStream(dto);
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
      }

      expect(mockStructuralHandler.handleUnknownEvent).toHaveBeenCalled();
    });

    it('should handle code interpreter events', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test code interpreter',
      };

      function* mockStream() {
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

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
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
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
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

      function* mockStream() {
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

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
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
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
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

      function* mockStream() {
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

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
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
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
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

      function* mockStream() {
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

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
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
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
      }

      expect(mockToolCallingHandler.handleCustomToolDelta).toHaveBeenCalled();
      expect(mockToolCallingHandler.handleCustomToolDone).toHaveBeenCalled();
    });

    it('should handle response.queued event', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test queued',
      };

      function* mockStream() {
        yield {
          type: 'response.queued',
          sequence_number: 1,
          response: { id: 'resp_queued' },
        };
      }

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
      mockLifecycleHandler.handleResponseQueued = jest.fn().mockReturnValue([]);

      const generator = service.createTextResponseStream(dto);
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
      }

      expect(mockLifecycleHandler.handleResponseQueued).toHaveBeenCalled();
    });

    it('should handle text annotation events', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test annotation',
      };

      function* mockStream() {
        yield {
          type: 'response.output_text.annotation.added',
          sequence_number: 1,
          annotation: { type: 'citation', text: 'Source 1' },
        };
      }

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
      mockTextHandler.handleTextAnnotation = jest.fn().mockReturnValue([]);

      const generator = service.createTextResponseStream(dto);
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
      }

      expect(mockTextHandler.handleTextAnnotation).toHaveBeenCalled();
    });

    it('should handle text done event', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test text done',
      };

      function* mockStream() {
        yield {
          type: 'response.output_text.done',
          sequence_number: 1,
          text: 'Complete text output',
        };
      }

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
      mockTextHandler.handleTextDone = jest.fn().mockReturnValue([]);

      const generator = service.createTextResponseStream(dto);
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
      }

      expect(mockTextHandler.handleTextDone).toHaveBeenCalled();
    });

    it('should handle reasoning summary events', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test reasoning summary',
        model: 'o1',
      };

      function* mockStream() {
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

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
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
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
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

      function* mockStream() {
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

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
      mockAudioHandler.handleAudioDone = jest.fn().mockReturnValue([]);
      mockAudioHandler.handleAudioTranscriptDone = jest
        .fn()
        .mockReturnValue([]);

      const generator = service.createTextResponseStream(dto);
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
      }

      expect(mockAudioHandler.handleAudioDone).toHaveBeenCalled();
      expect(mockAudioHandler.handleAudioTranscriptDone).toHaveBeenCalled();
    });

    it('should handle MCP additional events', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Test MCP comprehensive',
      };

      function* mockStream() {
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

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
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
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
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

      function* mockStream() {
        yield {
          type: 'response.output_item.done',
          sequence_number: 1,
          item: { type: 'text', id: 'item_123' },
        };
      }

      (mockOpenAIClient.responses.create as jest.Mock).mockReturnValue(
        mockStream() as unknown as AsyncIterable<Record<string, unknown>>,
      );
      mockStructuralHandler.handleStructuralEvent = jest.fn().mockReturnValue(
        (function* () {
          yield { event: 'structural', data: '{}', sequence: 1 };
        })(),
      );

      const generator = service.createTextResponseStream(dto);
      // Consume all events from generator
      for await (const _ of generator) {
        void _;
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
            } as Record<string, unknown>,
            response: mockResponse,
            metadata: expect.objectContaining({
              latency_ms: expect.any(Number) as number,
              tokens_used: 150,
              cached_tokens: 0,
              reasoning_tokens: 0,
              cost_estimate: expect.any(Number) as number,
            }) as Record<string, unknown>,
          }) as Record<string, unknown>,
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
            } as Record<string, unknown>,
            error: expect.objectContaining({
              message: 'Response not found',
              original_error: error,
            }) as Record<string, unknown>,
            metadata: expect.objectContaining({
              latency_ms: expect.any(Number) as number,
            }) as Record<string, unknown>,
          }) as Record<string, unknown>,
        );
      });

      it('should handle OpenAI API errors with status codes', async () => {
        const responseId = 'resp_error';
        const apiError = createOpenAIError(
          OpenAI.NotFoundError as new (...args: unknown[]) => unknown,
          404,
          'Resource not found',
          'req_123',
        );

        mockOpenAIClient.responses.retrieve = jest
          .fn()
          .mockRejectedValue(apiError);

        await expect(service.retrieve(responseId)).rejects.toThrow(
          apiError as Error,
        );

        expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              status: 404,
              message: expect.stringContaining('Resource not found') as string,
            }) as Record<string, unknown>,
          }) as Record<string, unknown>,
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
            },
            output_tokens_details: {
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
            }) as Record<string, unknown>,
          }) as Record<string, unknown>,
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
              latency_ms: expect.any(Number) as number,
            }) as Record<string, unknown>,
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
            } as Record<string, unknown>,
            error: expect.objectContaining({
              message: 'Cannot delete response',
              original_error: error,
            }) as Record<string, unknown>,
            metadata: expect.objectContaining({
              latency_ms: expect.any(Number) as number,
            }) as Record<string, unknown>,
          }) as Record<string, unknown>,
        );
      });

      it('should handle OpenAI API errors during deletion', async () => {
        const responseId = 'resp_forbidden';
        const apiError = createOpenAIError(
          OpenAI.PermissionDeniedError as new (...args: unknown[]) => unknown,
          403,
          'Permission denied',
          'req_456',
        );

        mockOpenAIClient.responses.delete = jest
          .fn()
          .mockRejectedValue(apiError);

        await expect(service.delete(responseId)).rejects.toThrow(
          apiError as Error,
        );

        expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              status: 403,
              message: expect.stringContaining('Permission denied') as string,
            }) as Record<string, unknown>,
          }) as Record<string, unknown>,
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
            } as Record<string, unknown>,
            response: mockCanceledResponse,
            metadata: expect.objectContaining({
              latency_ms: expect.any(Number) as number,
              tokens_used: 150,
              cached_tokens: 0,
              reasoning_tokens: 0,
              cost_estimate: expect.any(Number) as number,
            }) as Record<string, unknown>,
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
            } as Record<string, unknown>,
            error: expect.objectContaining({
              message: 'Response was not created with background=true',
              original_error: error,
            }) as Record<string, unknown>,
            metadata: expect.objectContaining({
              latency_ms: expect.any(Number) as number,
            }) as Record<string, unknown>,
          }) as Record<string, unknown>,
        );
      });

      it('should handle OpenAI API errors during cancellation', async () => {
        const responseId = 'resp_alreadycompleted';
        const apiError = createOpenAIError(
          OpenAI.BadRequestError as new (...args: unknown[]) => unknown,
          400,
          'Response already completed',
          'req_789',
        );

        mockOpenAIClient.responses.cancel = jest
          .fn()
          .mockRejectedValue(apiError);

        await expect(service.cancel(responseId)).rejects.toThrow(
          apiError as Error,
        );

        expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              status: 400,
              message: expect.stringContaining(
                'Response already completed',
              ) as string,
            }) as Record<string, unknown>,
          }) as Record<string, unknown>,
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
            },
            output_tokens_details: {
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
            }) as Record<string, unknown>,
          }) as Record<string, unknown>,
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

  describe('Code Interpreter Helper Methods (Phase 7.1)', () => {
    describe('parseCodeInterpreterOutputs', () => {
      it('should parse logs output correctly', () => {
        const outputs = [
          {
            type: 'logs',
            logs: 'Processing data...\nCalculating...\nDone!',
          },
        ];

        const result = service.parseCodeInterpreterOutputs(outputs);

        expect(result.logs).toHaveLength(1);
        expect(result.logs[0].logs).toBe(
          'Processing data...\nCalculating...\nDone!',
        );
        expect(result.images).toHaveLength(0);
        expect(result.files).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
      });

      it('should parse image output correctly', () => {
        const outputs = [
          {
            type: 'image',
            image: 'data:image/png;base64,iVBORw0KGgoAAAANS',
            filename: 'plot.png',
          },
        ];

        const result = service.parseCodeInterpreterOutputs(outputs);

        expect(result.images).toHaveLength(1);
        expect(result.images[0].image).toBe(
          'data:image/png;base64,iVBORw0KGgoAAAANS',
        );
        expect(result.images[0].filename).toBe('plot.png');
        expect(result.logs).toHaveLength(0);
        expect(result.files).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
      });

      it('should parse file output correctly', () => {
        const outputs = [
          {
            type: 'file',
            file_id: 'file-abc123',
            filename: 'results.csv',
            size: 1024,
            mime_type: 'text/csv',
          },
        ];

        const result = service.parseCodeInterpreterOutputs(outputs);

        expect(result.files).toHaveLength(1);
        expect(result.files[0].file_id).toBe('file-abc123');
        expect(result.files[0].filename).toBe('results.csv');
        expect(result.files[0].size).toBe(1024);
        expect(result.files[0].mime_type).toBe('text/csv');
        expect(result.logs).toHaveLength(0);
        expect(result.images).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
      });

      it('should parse error output correctly', () => {
        const outputs = [
          {
            type: 'error',
            error_type: 'ZeroDivisionError',
            message: 'division by zero',
            line: 5,
            traceback: 'Traceback (most recent call last):\n  File ...',
          },
        ];

        const result = service.parseCodeInterpreterOutputs(outputs);

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].error_type).toBe('ZeroDivisionError');
        expect(result.errors[0].message).toBe('division by zero');
        expect(result.errors[0].line).toBe(5);
        expect(result.errors[0].traceback).toContain('Traceback');
        expect(result.logs).toHaveLength(0);
        expect(result.images).toHaveLength(0);
        expect(result.files).toHaveLength(0);
      });

      it('should parse multiple outputs of different types', () => {
        const outputs = [
          { type: 'logs', logs: 'Starting calculation' },
          {
            type: 'image',
            image: 'data:image/png;base64,abc123',
            filename: 'chart.png',
          },
          {
            type: 'file',
            file_id: 'file-xyz789',
            filename: 'output.csv',
          },
          { type: 'logs', logs: 'Finished' },
        ];

        const result = service.parseCodeInterpreterOutputs(outputs);

        expect(result.logs).toHaveLength(2);
        expect(result.images).toHaveLength(1);
        expect(result.files).toHaveLength(1);
        expect(result.errors).toHaveLength(0);
      });

      it('should handle empty outputs array', () => {
        const result = service.parseCodeInterpreterOutputs([]);

        expect(result.logs).toHaveLength(0);
        expect(result.images).toHaveLength(0);
        expect(result.files).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
      });

      it('should handle non-array input gracefully', () => {
        const result = service.parseCodeInterpreterOutputs(null as never);

        expect(result.logs).toHaveLength(0);
        expect(result.images).toHaveLength(0);
        expect(result.files).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
      });

      it('should skip outputs without type field', () => {
        const outputs = [
          { logs: 'No type field' },
          { type: 'logs', logs: 'Valid output' },
        ];

        const result = service.parseCodeInterpreterOutputs(
          outputs as unknown[],
        );

        expect(result.logs).toHaveLength(1);
        expect(result.logs[0].logs).toBe('Valid output');
      });

      it('should skip outputs with unknown type', () => {
        const outputs = [
          { type: 'unknown_type', data: 'something' },
          { type: 'logs', logs: 'Valid output' },
        ];

        const result = service.parseCodeInterpreterOutputs(
          outputs as unknown[],
        );

        expect(result.logs).toHaveLength(1);
      });

      it('should handle outputs with missing optional fields', () => {
        const outputs = [
          {
            type: 'image',
            image: 'file-abc123',
            // filename is missing
          },
          {
            type: 'file',
            file_id: 'file-xyz789',
            filename: 'data.csv',
            // size and mime_type are missing
          },
        ];

        const result = service.parseCodeInterpreterOutputs(outputs);

        expect(result.images).toHaveLength(1);
        expect(result.images[0].filename).toBeUndefined();
        expect(result.files).toHaveLength(1);
        expect(result.files[0].size).toBeUndefined();
        expect(result.files[0].mime_type).toBeUndefined();
      });
    });

    describe('extractImageData', () => {
      it('should extract data URL format correctly', () => {
        const imageOutput = {
          image: 'data:image/png;base64,iVBORw0KGgoAAAANS',
          filename: 'chart.png',
        };

        const result = service.extractImageData(imageOutput);

        expect(result.format).toBe('data_url');
        expect(result.data).toBe('data:image/png;base64,iVBORw0KGgoAAAANS');
        expect(result.mimeType).toBe('image/png');
        expect(result.filename).toBe('chart.png');
      });

      it('should extract JPEG data URL format correctly', () => {
        const imageOutput = {
          image: 'data:image/jpeg;base64,/9j/4AAQSkZJRg',
        };

        const result = service.extractImageData(imageOutput);

        expect(result.format).toBe('data_url');
        expect(result.mimeType).toBe('image/jpeg');
      });

      it('should extract file ID format correctly', () => {
        const imageOutput = {
          image: 'file-abc123xyz789',
          filename: 'plot.png',
        };

        const result = service.extractImageData(imageOutput);

        expect(result.format).toBe('file_id');
        expect(result.data).toBe('file-abc123xyz789');
        expect(result.file_id).toBe('file-abc123xyz789');
        expect(result.filename).toBe('plot.png');
      });

      it('should use file_id field if present', () => {
        const imageOutput = {
          image: 'some_value',
          file_id: 'file-xyz789',
          filename: 'image.jpg',
        };

        const result = service.extractImageData(imageOutput);

        expect(result.format).toBe('file_id');
        expect(result.file_id).toBe('file-xyz789');
      });

      it('should extract raw base64 format correctly', () => {
        const imageOutput = {
          image: 'iVBORw0KGgoAAAANSUhEUgAA',
        };

        const result = service.extractImageData(imageOutput);

        expect(result.format).toBe('base64');
        expect(result.data).toBe(
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA',
        );
        expect(result.mimeType).toBe('image/png');
      });

      it('should handle missing optional fields', () => {
        const imageOutput = {
          image: 'data:image/png;base64,abc123',
        };

        const result = service.extractImageData(imageOutput);

        expect(result.filename).toBeUndefined();
        expect(result.file_id).toBeUndefined();
      });

      it('should preserve all fields in result', () => {
        const imageOutput = {
          image: 'file-abc123',
          filename: 'test.png',
          file_id: 'file-abc123',
        };

        const result = service.extractImageData(imageOutput);

        expect(result).toHaveProperty('format');
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('filename');
        expect(result).toHaveProperty('file_id');
      });
    });

    describe('extractFileDownloadUrls', () => {
      it('should generate download URLs for single file', () => {
        const fileOutputs = [
          {
            file_id: 'file-abc123',
            filename: 'results.csv',
            size: 2048,
            mime_type: 'text/csv',
          },
        ];

        const result = service.extractFileDownloadUrls(fileOutputs);

        expect(result).toHaveLength(1);
        expect(result[0].file_id).toBe('file-abc123');
        expect(result[0].filename).toBe('results.csv');
        expect(result[0].download_url).toBe(
          'https://api.openai.com/v1/files/file-abc123/content',
        );
        expect(result[0].size).toBe(2048);
        expect(result[0].mime_type).toBe('text/csv');
      });

      it('should generate download URLs for multiple files', () => {
        const fileOutputs = [
          { file_id: 'file-abc123', filename: 'data1.csv' },
          { file_id: 'file-xyz789', filename: 'data2.json' },
          { file_id: 'file-def456', filename: 'report.pdf' },
        ];

        const result = service.extractFileDownloadUrls(fileOutputs);

        expect(result).toHaveLength(3);
        expect(result[0].download_url).toBe(
          'https://api.openai.com/v1/files/file-abc123/content',
        );
        expect(result[1].download_url).toBe(
          'https://api.openai.com/v1/files/file-xyz789/content',
        );
        expect(result[2].download_url).toBe(
          'https://api.openai.com/v1/files/file-def456/content',
        );
      });

      it('should handle empty array', () => {
        const result = service.extractFileDownloadUrls([]);

        expect(result).toHaveLength(0);
      });

      it('should use custom base URL if provided', () => {
        const fileOutputs = [{ file_id: 'file-abc123', filename: 'test.csv' }];

        const result = service.extractFileDownloadUrls(
          fileOutputs,
          'https://custom-api.example.com',
        );

        expect(result[0].download_url).toBe(
          'https://custom-api.example.com/files/file-abc123/content',
        );
      });

      it('should preserve optional fields (size, mime_type)', () => {
        const fileOutputs = [
          {
            file_id: 'file-abc123',
            filename: 'data.csv',
            size: 4096,
            mime_type: 'text/csv',
          },
        ];

        const result = service.extractFileDownloadUrls(fileOutputs);

        expect(result[0].size).toBe(4096);
        expect(result[0].mime_type).toBe('text/csv');
      });

      it('should handle files without optional fields', () => {
        const fileOutputs = [
          { file_id: 'file-abc123', filename: 'minimal.txt' },
        ];

        const result = service.extractFileDownloadUrls(fileOutputs);

        expect(result[0].file_id).toBe('file-abc123');
        expect(result[0].filename).toBe('minimal.txt');
        expect(result[0].download_url).toBeDefined();
        expect(result[0].size).toBeUndefined();
        expect(result[0].mime_type).toBeUndefined();
      });
    });

    describe('uploadFilesForCodeInterpreter', () => {
      it('should upload single file successfully', async () => {
        const mockFile: Express.Multer.File = {
          buffer: Buffer.from('test file content'),
          originalname: 'test.csv',
          mimetype: 'text/csv',
          fieldname: 'files',
          encoding: '7bit',
          size: 17,
          stream: null as never,
          destination: '',
          filename: '',
          path: '',
        };

        const mockUploadedFile = {
          id: 'file-abc123',
          object: 'file' as const,
          bytes: 17,
          created_at: Date.now(),
          filename: 'test.csv',
          purpose: 'user_data' as const,
        };

        mockOpenAIClient.files.create = jest
          .fn()
          .mockResolvedValue(mockUploadedFile);

        const result = await service['uploadFilesForCodeInterpreter']([
          mockFile,
        ]);

        expect(result).toHaveLength(1);
        expect(result[0]).toBe('file-abc123');
        expect(mockOpenAIClient.files.create).toHaveBeenCalledWith({
          file: expect.any(File) as File,
          purpose: 'user_data',
        });
        expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalled();
      });

      it('should upload multiple files successfully', async () => {
        const mockFiles: Express.Multer.File[] = [
          {
            buffer: Buffer.from('file1 content'),
            originalname: 'file1.csv',
            mimetype: 'text/csv',
            fieldname: 'files',
            encoding: '7bit',
            size: 13,
            stream: null as never,
            destination: '',
            filename: '',
            path: '',
          },
          {
            buffer: Buffer.from('file2 content'),
            originalname: 'file2.json',
            mimetype: 'application/json',
            fieldname: 'files',
            encoding: '7bit',
            size: 13,
            stream: null as never,
            destination: '',
            filename: '',
            path: '',
          },
        ];

        mockOpenAIClient.files.create = jest
          .fn()
          .mockResolvedValueOnce({
            id: 'file-abc123',
            object: 'file' as const,
            bytes: 13,
            created_at: Date.now(),
            filename: 'file1.csv',
            purpose: 'user_data' as const,
          })
          .mockResolvedValueOnce({
            id: 'file-xyz789',
            object: 'file' as const,
            bytes: 13,
            created_at: Date.now(),
            filename: 'file2.json',
            purpose: 'user_data' as const,
          });

        const result =
          await service['uploadFilesForCodeInterpreter'](mockFiles);

        expect(result).toHaveLength(2);
        expect(result[0]).toBe('file-abc123');
        expect(result[1]).toBe('file-xyz789');
        expect(mockOpenAIClient.files.create).toHaveBeenCalledTimes(2);
      });

      it('should handle empty files array', async () => {
        const result = await service['uploadFilesForCodeInterpreter']([]);

        expect(result).toHaveLength(0);
        expect(mockOpenAIClient.files.create).not.toHaveBeenCalled();
      });

      it('should log upload errors and rethrow', async () => {
        const mockFile: Express.Multer.File = {
          buffer: Buffer.from('test'),
          originalname: 'test.csv',
          mimetype: 'text/csv',
          fieldname: 'files',
          encoding: '7bit',
          size: 4,
          stream: null as never,
          destination: '',
          filename: '',
          path: '',
        };

        const uploadError = new Error('Upload failed');
        mockOpenAIClient.files.create = jest
          .fn()
          .mockRejectedValue(uploadError);

        await expect(
          service['uploadFilesForCodeInterpreter']([mockFile]),
        ).rejects.toThrow('Upload failed');
      });

      it('should convert Buffer to Uint8Array before creating File', async () => {
        const mockFile: Express.Multer.File = {
          buffer: Buffer.from('test content'),
          originalname: 'test.txt',
          mimetype: 'text/plain',
          fieldname: 'files',
          encoding: '7bit',
          size: 12,
          stream: null as never,
          destination: '',
          filename: '',
          path: '',
        };

        mockOpenAIClient.files.create = jest.fn().mockResolvedValue({
          id: 'file-test',
          object: 'file' as const,
          bytes: 12,
          created_at: Date.now(),
          filename: 'test.txt',
          purpose: 'user_data' as const,
        });

        await service['uploadFilesForCodeInterpreter']([mockFile]);

        expect(mockOpenAIClient.files.create).toHaveBeenCalledWith({
          file: expect.any(File) as File,
          purpose: 'user_data',
        });
      });
    });

    describe('createCodeInterpreterResponse', () => {
      it('should create response without file uploads', async () => {
        const dto = {
          input: 'Calculate factorial of 10',
          model: 'gpt-5',
          tools: [
            {
              type: 'code_interpreter' as const,
              container: { type: 'auto' as const },
            },
          ],
        } as unknown as CreateTextResponseDto & {
          memory_limit?: string;
          container_id?: string;
        };

        const mockResponse = createMockOpenAIResponse({
          output_text: 'The factorial of 10 is 3,628,800',
          status: 'completed',
        });

        mockOpenAIClient.responses.create = jest
          .fn()
          .mockResolvedValue(mockResponse);

        const result = await service.createCodeInterpreterResponse(dto);

        expect(result).toBe(mockResponse);
        expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith(
          expect.objectContaining({
            model: 'gpt-5',
            input: 'Calculate factorial of 10',
            stream: false,
            include: ['code_interpreter_call.outputs'],
          }),
        );
      });

      it('should upload files and include file_ids in container config', async () => {
        const dto = {
          input: 'Analyze data.csv',
          tools: [
            {
              type: 'code_interpreter' as const,
              container: { type: 'auto' as const },
            },
          ],
        } as unknown as CreateTextResponseDto & {
          memory_limit?: string;
          container_id?: string;
        };

        const mockFiles: Express.Multer.File[] = [
          {
            buffer: Buffer.from('csv data'),
            originalname: 'data.csv',
            mimetype: 'text/csv',
            fieldname: 'files',
            encoding: '7bit',
            size: 8,
            stream: null as never,
            destination: '',
            filename: '',
            path: '',
          },
        ];

        mockOpenAIClient.files.create = jest.fn().mockResolvedValue({
          id: 'file-abc123',
          object: 'file' as const,
          bytes: 8,
          created_at: Date.now(),
          filename: 'data.csv',
          purpose: 'user_data' as const,
        });

        const mockResponse = createMockOpenAIResponse({
          output_text: 'Data analyzed',
          status: 'completed',
        });

        mockOpenAIClient.responses.create = jest
          .fn()
          .mockResolvedValue(mockResponse);

        const result = await service.createCodeInterpreterResponse(
          dto,
          mockFiles,
        );

        expect(result).toBe(mockResponse);
        expect(mockOpenAIClient.files.create).toHaveBeenCalled();
        expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith(
          expect.objectContaining({
            tools: [
              {
                type: 'code_interpreter',
                container: { type: 'auto', file_ids: ['file-abc123'] },
              },
            ],
          }),
        );
      });

      it('should use container_id if provided', async () => {
        const dto = {
          input: 'Continue analysis',
          tools: [
            {
              type: 'code_interpreter' as const,
              container: { type: 'auto' as const },
            },
          ],
          container_id: 'container_reuse123',
        } as unknown as CreateTextResponseDto & {
          memory_limit?: string;
          container_id?: string;
        };

        const mockResponse = createMockOpenAIResponse({
          output_text: 'Analysis continued',
          status: 'completed',
        });

        mockOpenAIClient.responses.create = jest
          .fn()
          .mockResolvedValue(mockResponse);

        const result = await service.createCodeInterpreterResponse(dto);

        expect(result).toBe(mockResponse);
        expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith(
          expect.objectContaining({
            tools: [
              {
                type: 'code_interpreter',
                container: 'container_reuse123',
              },
            ],
          }),
        );
      });

      it('should preserve non-code_interpreter tools unchanged', async () => {
        const dto = {
          input: 'Search and calculate',
          tools: [
            { type: 'web_search' as const },
            {
              type: 'code_interpreter' as const,
              container: { type: 'auto' as const },
            },
          ],
        } as unknown as CreateTextResponseDto & {
          memory_limit?: string;
          container_id?: string;
        };

        const mockResponse = createMockOpenAIResponse({
          output_text: 'Results',
          status: 'completed',
        });

        mockOpenAIClient.responses.create = jest
          .fn()
          .mockResolvedValue(mockResponse);

        const result = await service.createCodeInterpreterResponse(dto);

        expect(result).toBe(mockResponse);
        expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith(
          expect.objectContaining({
            tools: expect.arrayContaining([
              expect.objectContaining({ type: 'web_search' }),
              expect.objectContaining({ type: 'code_interpreter' }),
            ]) as unknown[],
          }),
        );
      });

      it('should log interaction with proper metadata', async () => {
        const dto = {
          input: 'Test',
          tools: [
            {
              type: 'code_interpreter' as const,
              container: { type: 'auto' as const },
            },
          ],
        } as unknown as CreateTextResponseDto & {
          memory_limit?: string;
          container_id?: string;
        };

        const mockResponse = createMockOpenAIResponse({
          output_text: 'Result',
          status: 'completed',
          usage: {
            input_tokens: 50,
            output_tokens: 100,
            total_tokens: 150,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens_details: { reasoning_tokens: 0 },
          },
        });

        mockOpenAIClient.responses.create = jest
          .fn()
          .mockResolvedValue(mockResponse);

        await service.createCodeInterpreterResponse(dto);

        expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
          expect.objectContaining({
            api: 'responses',
            endpoint: '/v1/responses',
            metadata: expect.objectContaining({
              tokens_used: 150,
            }) as Record<string, unknown>,
          }) as Record<string, unknown>,
        );
      });

      it('should handle errors during API call', async () => {
        const dto = {
          input: 'Test',
          tools: [
            {
              type: 'code_interpreter' as const,
              container: { type: 'auto' as const },
            },
          ],
        } as unknown as CreateTextResponseDto & {
          memory_limit?: string;
          container_id?: string;
        };

        const apiError = new Error('Invalid request');

        mockOpenAIClient.responses.create = jest
          .fn()
          .mockRejectedValue(apiError);

        await expect(
          service.createCodeInterpreterResponse(dto),
        ).rejects.toThrow();

        expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
          expect.objectContaining({
            response: expect.objectContaining({
              error: 'Invalid request',
            }) as Record<string, unknown>,
            metadata: expect.objectContaining({
              error: true,
            }) as Record<string, unknown>,
          }) as Record<string, unknown>,
        );
      });

      it('should use default model if not provided', async () => {
        const dto = {
          input: 'Test',
          tools: [
            {
              type: 'code_interpreter' as const,
              container: { type: 'auto' as const },
            },
          ],
        } as unknown as CreateTextResponseDto & {
          memory_limit?: string;
          container_id?: string;
        };

        const mockResponse = createMockOpenAIResponse({});
        mockOpenAIClient.responses.create = jest
          .fn()
          .mockResolvedValue(mockResponse);

        await service.createCodeInterpreterResponse(dto);

        expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith(
          expect.objectContaining({
            model: 'gpt-5', // default model from config
          }),
        );
      });
    });
  });
});
