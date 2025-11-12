import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import type OpenAI from 'openai';
import configuration from '../../../src/config/configuration';
import { OpenAIResponsesService } from '../../../src/openai/services/openai-responses.service';
import { ResponsesController } from '../../../src/openai/controllers/responses.controller';
import { LoggerService } from '../../../src/common/services/logger.service';
import { OpenAIExceptionFilter } from '../../../src/common/filters/openai-exception.filter';
import { CreateTextResponseDto } from '../../../src/openai/dto/create-text-response.dto';
import { CreateImageResponseDto } from '../../../src/openai/dto/create-image-response.dto';
import {
  createMockLoggerService,
  createMockOpenAIResponse,
} from '../../../src/common/testing/test.factories';

// Import all event handlers
import { LifecycleEventsHandler } from '../../../src/openai/services/handlers/lifecycle-events.handler';
import { TextEventsHandler } from '../../../src/openai/services/handlers/text-events.handler';
import { ReasoningEventsHandler } from '../../../src/openai/services/handlers/reasoning-events.handler';
import { ToolCallingEventsHandler } from '../../../src/openai/services/handlers/tool-calling-events.handler';
import { ImageEventsHandler } from '../../../src/openai/services/handlers/image-events.handler';
import { AudioEventsHandler } from '../../../src/openai/services/handlers/audio-events.handler';
import { MCPEventsHandler } from '../../../src/openai/services/handlers/mcp-events.handler';
import { RefusalEventsHandler } from '../../../src/openai/services/handlers/refusal-events.handler';
import { StructuralEventsHandler } from '../../../src/openai/services/handlers/structural-events.handler';

describe('Data Size Edge Cases Integration', () => {
  let module: TestingModule;
  let service: OpenAIResponsesService;
  let controller: ResponsesController;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockClient: jest.Mocked<OpenAI>;

  beforeAll(async () => {
    // Set up test environment variables
    process.env.OPENAI_API_KEY = 'sk-test-data-size-key';
    process.env.OPENAI_DEFAULT_MODEL = 'gpt-5';
    process.env.OPENAI_TIMEOUT = '60000';
    process.env.OPENAI_MAX_RETRIES = '3';

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
    delete process.env.OPENAI_DEFAULT_MODEL;
    delete process.env.OPENAI_TIMEOUT;
    delete process.env.OPENAI_MAX_RETRIES;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Very Long Inputs', () => {
    it('should handle very long text input (10k+ tokens)', async () => {
      // Generate ~10k token input (~40k characters)
      const longInput =
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(700);

      const dto: CreateTextResponseDto = {
        input: longInput,
        model: 'gpt-5',
      };

      const mockResponse = createMockOpenAIResponse({
        output_text: 'Response to very long input',
        usage: {
          input_tokens: 10240,
          output_tokens: 50,
          total_tokens: 10290,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      const result = await controller.createTextResponse(dto);

      expect(result).toBeDefined();
      expect(result.output_text).toBe('Response to very long input');
      expect(result.usage.input_tokens).toBeGreaterThan(10000);
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalled();
    });

    it('should handle maximum context length input (128k tokens)', async () => {
      // Generate input approaching 128k token limit (~512k characters)
      const veryLongInput = 'A'.repeat(500000);

      const dto: CreateTextResponseDto = {
        input: veryLongInput,
        model: 'gpt-5',
      };

      const mockResponse = createMockOpenAIResponse({
        output_text: 'Response to maximum context',
        usage: {
          input_tokens: 127500,
          output_tokens: 100,
          total_tokens: 127600,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      const result = await service.createTextResponse(dto);

      expect(result.usage.input_tokens).toBeGreaterThan(100000);
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            tokens_used: 127600,
          }),
        }),
      );
    });

    it('should handle input with very long single line (no newlines)', async () => {
      const longSingleLine = 'x'.repeat(100000);

      const dto: CreateTextResponseDto = {
        input: longSingleLine,
      };

      const mockResponse = createMockOpenAIResponse({
        output_text: 'Processed long single line',
        usage: {
          input_tokens: 25000,
          output_tokens: 50,
          total_tokens: 25050,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      const result = await controller.createTextResponse(dto);

      expect(result.output_text).toBe('Processed long single line');
      expect(result.usage.input_tokens).toBe(25000);
    });

    it('should handle input with many repeated patterns', async () => {
      const repeatedPattern = 'Pattern123\n'.repeat(10000);

      const dto: CreateTextResponseDto = {
        input: repeatedPattern,
      };

      const mockResponse = createMockOpenAIResponse({
        output_text: 'Analyzed repeated patterns',
        usage: {
          input_tokens: 20000,
          output_tokens: 50,
          total_tokens: 20050,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      const result = await service.createTextResponse(dto);

      expect(result.output_text).toBe('Analyzed repeated patterns');
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalled();
    });
  });

  describe('Very Long Outputs', () => {
    it('should handle very long output (100k+ characters)', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Write a comprehensive guide',
        max_output_tokens: 16384,
      };

      // Generate ~105k character output (to ensure > 100k)
      const longOutput = 'Chapter 1: Introduction.\n'.repeat(4200);

      const mockResponse = createMockOpenAIResponse({
        output_text: longOutput,
        usage: {
          input_tokens: 100,
          output_tokens: 16000,
          total_tokens: 16100,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      const result = await controller.createTextResponse(dto);

      expect(result.output_text.length).toBeGreaterThan(100000);
      expect(result.usage.output_tokens).toBe(16000);
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          response: expect.objectContaining({
            output_text: longOutput,
          }),
        }),
      );
    });

    it('should handle output with many lines (10k+ lines)', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Generate a list',
        max_output_tokens: 16384,
      };

      const manyLines = Array(15000)
        .fill(0)
        .map((_, i) => `Line ${i + 1}`)
        .join('\n');

      const mockResponse = createMockOpenAIResponse({
        output_text: manyLines,
        usage: {
          input_tokens: 50,
          output_tokens: 15000,
          total_tokens: 15050,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      const result = await service.createTextResponse(dto);

      const lineCount = result.output_text.split('\n').length;
      expect(lineCount).toBeGreaterThan(10000);
      expect(result.usage.output_tokens).toBe(15000);
    });

    it('should handle output with complex nested structure', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Generate JSON structure',
      };

      // Deep nested JSON structure
      let nestedJson = '{"level0": ';
      for (let i = 1; i <= 50; i++) {
        nestedJson += `{"level${i}": `;
      }
      nestedJson += '"deep value"';
      for (let i = 0; i <= 50; i++) {
        nestedJson += '}';
      }

      const mockResponse = createMockOpenAIResponse({
        output_text: nestedJson,
        usage: {
          input_tokens: 50,
          output_tokens: 500,
          total_tokens: 550,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      const result = await controller.createTextResponse(dto);

      expect(result.output_text).toContain('level50');
      expect(result.output_text).toContain('deep value');
    });
  });

  describe('Large Metadata Objects', () => {
    it('should handle metadata with maximum key-value pairs (16 pairs)', async () => {
      const maxMetadata: Record<string, string> = {};
      for (let i = 1; i <= 16; i++) {
        maxMetadata[`key${i}`] = `value${i}`;
      }

      const dto: CreateTextResponseDto = {
        input: 'Test with max metadata',
        metadata: maxMetadata,
      };

      const mockResponse = createMockOpenAIResponse({
        output_text: 'Response with max metadata',
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          total_tokens: 150,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      const result = await controller.createTextResponse(dto);

      expect(result.output_text).toBe('Response with max metadata');
      expect(mockClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: maxMetadata,
        }),
      );
    });

    it('should handle metadata with very long values (512 chars each)', async () => {
      const longValueMetadata: Record<string, string> = {
        description: 'x'.repeat(512),
        context: 'y'.repeat(512),
        notes: 'z'.repeat(512),
      };

      const dto: CreateTextResponseDto = {
        input: 'Test with long metadata values',
        metadata: longValueMetadata,
      };

      const mockResponse = createMockOpenAIResponse({
        output_text: 'Response with long metadata',
        usage: {
          input_tokens: 150,
          output_tokens: 50,
          total_tokens: 200,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      const result = await service.createTextResponse(dto);

      expect(result.output_text).toBe('Response with long metadata');
      expect(mockClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: longValueMetadata,
        }),
      );
    });

    it('should handle metadata with special characters and unicode', async () => {
      const specialMetadata: Record<string, string> = {
        emoji: '😀🎉🚀',
        unicode: '你好世界',
        symbols: '!@#$%^&*(){}[]|\\:;"\'<>?,./`~',
        mixed: 'Test with 中文 and émojis 🌍',
      };

      const dto: CreateTextResponseDto = {
        input: 'Test with special metadata',
        metadata: specialMetadata,
      };

      const mockResponse = createMockOpenAIResponse({
        output_text: 'Response with special metadata',
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          total_tokens: 150,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      const result = await controller.createTextResponse(dto);

      expect(result.output_text).toBe('Response with special metadata');
    });
  });

  describe('Binary Data and Base64 Images', () => {
    it('should handle large base64 image data (10MB+)', async () => {
      const dto: CreateImageResponseDto = {
        input: 'Generate a high resolution image',
        image_quality: 'high',
        image_format: 'png',
      };

      // Simulate 10MB base64 image (~13.3MB in base64)
      const largeBase64Image =
        'iVBORw0KGgoAAAANSUhEUgAA' + 'A'.repeat(13000000);

      const mockResponse = createMockOpenAIResponse({
        output_text: largeBase64Image,
        usage: {
          input_tokens: 100,
          output_tokens: 0,
          total_tokens: 100,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      const result = await service.createImageResponse(dto);

      expect(result.output_text.length).toBeGreaterThan(10000000);
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalled();
    });

    it('should handle multiple large base64 images in single response', async () => {
      const dto: CreateImageResponseDto = {
        input: 'Generate multiple images',
        image_quality: 'standard',
      };

      // Multiple 5MB images
      const image1 = 'data:image/png;base64,' + 'A'.repeat(5000000);
      const image2 = 'data:image/png;base64,' + 'B'.repeat(5000000);
      const multipleImages = `${image1}\n---\n${image2}`;

      const mockResponse = createMockOpenAIResponse({
        output_text: multipleImages,
        usage: {
          input_tokens: 100,
          output_tokens: 0,
          total_tokens: 100,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      const result = await controller.createImageResponse(dto);

      expect(result.output_text.length).toBeGreaterThan(10000000);
      expect(result.output_text).toContain('data:image/png;base64,');
    });

    it('should handle base64 image with complex metadata', async () => {
      const largeMetadata: Record<string, string> = {
        prompt: 'x'.repeat(500),
        style: 'photorealistic',
        resolution: '4096x4096',
        quality: 'ultra-high',
        format: 'png',
        compression: 'none',
      };

      const dto: CreateImageResponseDto = {
        input: 'Generate image with metadata',
        metadata: largeMetadata,
      };

      const largeBase64 = 'iVBORw0KGgoAAAANSUhEUgAA' + 'C'.repeat(8000000);

      const mockResponse = createMockOpenAIResponse({
        output_text: largeBase64,
        usage: {
          input_tokens: 150,
          output_tokens: 0,
          total_tokens: 150,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      const result = await service.createImageResponse(dto);

      expect(result.output_text.length).toBeGreaterThan(8000000);
      expect(mockClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: largeMetadata,
        }),
      );
    });
  });

  describe('Combined Large Data Scenarios', () => {
    it('should handle long input with long output and metadata', async () => {
      const longInput = 'Context: ' + 'x'.repeat(50000);
      const metadata: Record<string, string> = {};
      for (let i = 1; i <= 10; i++) {
        metadata[`field${i}`] = 'value'.repeat(50);
      }

      const dto: CreateTextResponseDto = {
        input: longInput,
        max_output_tokens: 8192,
        metadata: metadata,
      };

      const longOutput = 'Response: ' + 'y'.repeat(50000);

      const mockResponse = createMockOpenAIResponse({
        output_text: longOutput,
        usage: {
          input_tokens: 12500,
          output_tokens: 8000,
          total_tokens: 20500,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      const result = await controller.createTextResponse(dto);

      expect(result.output_text.length).toBeGreaterThan(50000);
      expect(result.usage.total_tokens).toBeGreaterThan(20000);
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            tokens_used: 20500,
          }),
        }),
      );
    });

    it('should handle reasoning model with long reasoning content', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Solve complex problem',
        model: 'o3',
      };

      const longReasoningOutput = 'Reasoning: ' + 'z'.repeat(100000);

      const mockResponse = createMockOpenAIResponse({
        output_text: longReasoningOutput,
        usage: {
          input_tokens: 100,
          output_tokens: 5000,
          reasoning_tokens: 20000,
          total_tokens: 25100,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      const result = await service.createTextResponse(dto);

      expect(result.output_text.length).toBeGreaterThan(100000);
      expect(result.usage.reasoning_tokens).toBe(20000);
      expect(result.usage.total_tokens).toBe(25100);
    });

    it('should handle cached input with very long prompt', async () => {
      const longCachedInput = 'System context: ' + 'a'.repeat(100000);

      const dto: CreateTextResponseDto = {
        input: longCachedInput,
        prompt_cache_key: 'cache-large-prompt',
      };

      const mockResponse = createMockOpenAIResponse({
        output_text: 'Response using cached prompt',
        usage: {
          input_tokens: 25000,
          output_tokens: 100,
          cached_tokens: 24000,
          total_tokens: 25100,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      const result = await controller.createTextResponse(dto);

      expect(result.usage.cached_tokens).toBe(24000);
      expect(result.usage.input_tokens).toBe(25000);
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalled();
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle response with very large usage statistics', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Large scale processing',
      };

      const mockResponse = createMockOpenAIResponse({
        output_text: 'Processed',
        usage: {
          input_tokens: 128000,
          output_tokens: 16000,
          reasoning_tokens: 50000,
          cached_tokens: 100000,
          total_tokens: 194000,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      const result = await service.createTextResponse(dto);

      expect(result.usage.total_tokens).toBeGreaterThan(150000);
      expect(result.usage.reasoning_tokens).toBe(50000);
      expect(result.usage.cached_tokens).toBe(100000);
    });

    it('should log large responses without truncation', async () => {
      const dto: CreateTextResponseDto = {
        input: 'Generate comprehensive report',
      };

      const largeReport = 'Report:\n' + 'Content line.\n'.repeat(50000);

      const mockResponse = createMockOpenAIResponse({
        output_text: largeReport,
        usage: {
          input_tokens: 100,
          output_tokens: 12000,
          total_tokens: 12100,
        },
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(mockResponse);

      const result = await controller.createTextResponse(dto);

      expect(result.output_text).toBe(largeReport);
      expect(mockLoggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          response: expect.objectContaining({
            output_text: largeReport,
          }),
        }),
      );
    });
  });
});
