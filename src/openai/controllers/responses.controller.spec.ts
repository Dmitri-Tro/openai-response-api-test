import { Test, TestingModule } from '@nestjs/testing';
import { ResponsesController } from './responses.controller';
import { OpenAIResponsesService } from '../services/openai-responses.service';
import { LoggerService } from '../../common/services/logger.service';
import { PricingService } from '../../common/services/pricing.service';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { RetryInterceptor } from '../../common/interceptors/retry.interceptor';
import { CreateTextResponseDto } from '../dto/create-text-response.dto';
import { CreateImageResponseDto } from '../dto/create-image-response.dto';
import type { Response } from 'express';
import type { Responses } from 'openai/resources/responses';

describe('ResponsesController', () => {
  let controller: ResponsesController;
  let mockResponsesService: jest.Mocked<OpenAIResponsesService>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockPricingService: jest.Mocked<PricingService>;

  // Spy variables for proper type checking
  let createTextResponseSpy: jest.Mock;
  let createTextResponseStreamSpy: jest.Mock;
  let createImageResponseSpy: jest.Mock;
  let createImageResponseStreamSpy: jest.Mock;
  let retrieveSpy: jest.Mock;
  let deleteSpy: jest.Mock;
  let cancelSpy: jest.Mock;
  let resumeResponseStreamSpy: jest.Mock;

  beforeEach(async () => {
    // Create spy functions
    createTextResponseSpy = jest.fn();
    createTextResponseStreamSpy = jest.fn();
    createImageResponseSpy = jest.fn();
    createImageResponseStreamSpy = jest.fn();
    retrieveSpy = jest.fn();
    deleteSpy = jest.fn();
    cancelSpy = jest.fn();
    resumeResponseStreamSpy = jest.fn();

    mockResponsesService = {
      createTextResponse: createTextResponseSpy,
      createTextResponseStream: createTextResponseStreamSpy,
      createImageResponse: createImageResponseSpy,
      createImageResponseStream: createImageResponseStreamSpy,
      retrieve: retrieveSpy,
      delete: deleteSpy,
      cancel: cancelSpy,
      resumeResponseStream: resumeResponseStreamSpy,
    } as unknown as jest.Mocked<OpenAIResponsesService>;

    mockLoggerService = {
      logOpenAIInteraction: jest.fn(),
      logStreamingEvent: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;

    mockPricingService = {
      calculateCost: jest.fn().mockReturnValue(0.00001),
      estimateCost: jest.fn().mockReturnValue(0.00001),
      getModelPricing: jest.fn(),
      getSupportedModels: jest.fn(),
      isModelSupported: jest.fn(),
    } as unknown as jest.Mocked<PricingService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ResponsesController],
      providers: [
        {
          provide: OpenAIResponsesService,
          useValue: mockResponsesService,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
        {
          provide: PricingService,
          useValue: mockPricingService,
        },
        LoggingInterceptor,
        RetryInterceptor,
      ],
    }).compile();

    controller = module.get<ResponsesController>(ResponsesController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTextResponse', () => {
    it('should create text response successfully', async () => {
      const dto: CreateTextResponseDto = {
        model: 'gpt-5',
        input: 'Hello, world!',
      };

      const mockResponse = {
        id: 'resp_123',
        output_text: 'Hello! How can I help you today?',
        usage: {
          input_tokens: 10,
          output_tokens: 15,
          total_tokens: 25,
        },
      };

      mockResponsesService.createTextResponse.mockResolvedValue(
        mockResponse as unknown as Responses.Response,
      );

      const result = await controller.createTextResponse(dto);

      expect(result).toEqual(mockResponse);
      expect(createTextResponseSpy).toHaveBeenCalledWith(dto);
      expect(createTextResponseSpy).toHaveBeenCalledTimes(1);
    });

    it('should pass all DTO parameters to service', async () => {
      const dto: CreateTextResponseDto = {
        model: 'gpt-5',
        input: 'Test input',
        instructions: 'Be concise',
        temperature: 0.7,
        max_output_tokens: 100,
        store: true,
      };

      mockResponsesService.createTextResponse.mockResolvedValue(
        {} as unknown as Responses.Response,
      );

      await controller.createTextResponse(dto);

      expect(createTextResponseSpy).toHaveBeenCalledWith(dto);
    });

    it('should propagate service errors', async () => {
      const dto: CreateTextResponseDto = {
        model: 'gpt-5',
        input: 'Hello',
      };

      const error = new Error('OpenAI API error');
      mockResponsesService.createTextResponse.mockRejectedValue(error);

      await expect(controller.createTextResponse(dto)).rejects.toThrow(
        'OpenAI API error',
      );
    });

    describe('Advanced Text Configuration', () => {
      it('should pass text format configuration', async () => {
        const dto: CreateTextResponseDto = {
          model: 'gpt-5',
          input: 'Generate JSON',
          text: {
            format: { type: 'json_object' },
            verbosity: 'high',
          },
        };

        mockResponsesService.createTextResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createTextResponse(dto);

        expect(createTextResponseSpy).toHaveBeenCalledWith(dto);
      });

      it('should pass top_p sampling parameter', async () => {
        const dto: CreateTextResponseDto = {
          model: 'gpt-5',
          input: 'Test',
          top_p: 0.9,
        };

        mockResponsesService.createTextResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createTextResponse(dto);

        expect(createTextResponseSpy).toHaveBeenCalledWith(dto);
      });

      it('should pass max_output_tokens parameter', async () => {
        const dto: CreateTextResponseDto = {
          model: 'gpt-5',
          input: 'Test',
          max_output_tokens: 500,
        };

        mockResponsesService.createTextResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createTextResponse(dto);

        expect(createTextResponseSpy).toHaveBeenCalledWith(dto);
      });
    });

    describe('Tools and Tool Configuration', () => {
      it('should pass tools parameter', async () => {
        const dto: CreateTextResponseDto = {
          model: 'gpt-5',
          input: 'Call a function',
          tools: [
            {
              type: 'function',
              function: {
                name: 'get_weather',
                description: 'Get current weather',
                parameters: {
                  type: 'object',
                  properties: {
                    location: { type: 'string' },
                  },
                  required: ['location'],
                },
              },
            },
          ] as unknown as Responses.ResponseCreateParamsNonStreaming['tools'],
        };

        mockResponsesService.createTextResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createTextResponse(dto);

        expect(createTextResponseSpy).toHaveBeenCalledWith(dto);
        expect(
          mockResponsesService.createTextResponse.mock.calls[0][0].tools,
        ).toHaveLength(1);
      });

      it('should pass tool_choice parameter', async () => {
        const dto: CreateTextResponseDto = {
          model: 'gpt-5',
          input: 'Test',
          tool_choice: 'required',
        };

        mockResponsesService.createTextResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createTextResponse(dto);

        expect(createTextResponseSpy).toHaveBeenCalledWith(dto);
      });

      it('should pass parallel_tool_calls parameter', async () => {
        const dto: CreateTextResponseDto = {
          model: 'gpt-5',
          input: 'Test',
          parallel_tool_calls: false,
        };

        mockResponsesService.createTextResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createTextResponse(dto);

        expect(createTextResponseSpy).toHaveBeenCalledWith(dto);
      });

      describe('Code Interpreter Tool', () => {
        it('should accept basic code_interpreter tool', async () => {
          const dto: CreateTextResponseDto = {
            model: 'gpt-5',
            input: 'Calculate factorial of 10',
            tools: [
              {
                type: 'code_interpreter',
              },
            ] as unknown as Responses.ResponseCreateParamsNonStreaming['tools'],
          };

          mockResponsesService.createTextResponse.mockResolvedValue(
            {} as unknown as Responses.Response,
          );

          await controller.createTextResponse(dto);

          expect(createTextResponseSpy).toHaveBeenCalledWith(dto);
          const calledTools =
            mockResponsesService.createTextResponse.mock.calls[0][0].tools;
          expect(calledTools).toHaveLength(1);
          expect(calledTools?.[0].type).toBe('code_interpreter');
        });

        it('should accept code_interpreter with auto container', async () => {
          const dto: CreateTextResponseDto = {
            model: 'gpt-5',
            input: 'Analyze data',
            tools: [
              {
                type: 'code_interpreter',
                container: {
                  type: 'auto',
                },
              },
            ] as unknown as Responses.ResponseCreateParamsNonStreaming['tools'],
          };

          mockResponsesService.createTextResponse.mockResolvedValue(
            {} as unknown as Responses.Response,
          );

          await controller.createTextResponse(dto);

          expect(createTextResponseSpy).toHaveBeenCalledWith(dto);
          const calledTools =
            mockResponsesService.createTextResponse.mock.calls[0][0].tools;
          expect(
            (calledTools?.[0] as { container?: unknown })?.container,
          ).toEqual({ type: 'auto' });
        });

        it('should accept code_interpreter with auto container and file_ids', async () => {
          const dto: CreateTextResponseDto = {
            model: 'gpt-5',
            input: 'Process uploaded files',
            tools: [
              {
                type: 'code_interpreter',
                container: {
                  type: 'auto',
                  file_ids: ['file-abc123xyz789012345678901'],
                },
              },
            ] as unknown as Responses.ResponseCreateParamsNonStreaming['tools'],
          };

          mockResponsesService.createTextResponse.mockResolvedValue(
            {} as unknown as Responses.Response,
          );

          await controller.createTextResponse(dto);

          expect(createTextResponseSpy).toHaveBeenCalledWith(dto);
          const calledTools =
            mockResponsesService.createTextResponse.mock.calls[0][0].tools;
          expect(
            (calledTools?.[0] as { container?: { file_ids?: string[] } })
              ?.container?.file_ids,
          ).toHaveLength(1);
        });

        it('should accept code_interpreter with string container ID', async () => {
          const dto: CreateTextResponseDto = {
            model: 'gpt-5',
            input: 'Reuse existing container',
            tools: [
              {
                type: 'code_interpreter',
                container: 'container_abc123xyz789',
              },
            ],
          };

          mockResponsesService.createTextResponse.mockResolvedValue(
            {} as unknown as Responses.Response,
          );

          await controller.createTextResponse(dto);

          expect(createTextResponseSpy).toHaveBeenCalledWith(dto);
          const calledTools =
            mockResponsesService.createTextResponse.mock.calls[0][0].tools;
          expect((calledTools?.[0] as { container?: unknown })?.container).toBe(
            'container_abc123xyz789',
          );
        });

        it('should accept multiple code_interpreter tools', async () => {
          const dto: CreateTextResponseDto = {
            model: 'gpt-5',
            input: 'Run multiple analyses',
            tools: [
              {
                type: 'code_interpreter',
                container: {
                  type: 'auto',
                  file_ids: ['file-abc123xyz789012345678901'],
                },
              },
              {
                type: 'code_interpreter',
                container: 'container_def456uvw012',
              },
            ],
          };

          mockResponsesService.createTextResponse.mockResolvedValue(
            {} as unknown as Responses.Response,
          );

          await controller.createTextResponse(dto);

          expect(createTextResponseSpy).toHaveBeenCalledWith(dto);
          const calledTools =
            mockResponsesService.createTextResponse.mock.calls[0][0].tools;
          expect(calledTools).toHaveLength(2);
          expect(calledTools?.[0].type).toBe('code_interpreter');
          expect(calledTools?.[1].type).toBe('code_interpreter');
        });

        it('should accept code_interpreter combined with function tool', async () => {
          const dto: CreateTextResponseDto = {
            model: 'gpt-5',
            input: 'Calculate and fetch weather',
            tools: [
              {
                type: 'function',

                name: 'get_weather',

                description: 'Get weather',

                parameters: {
                  type: 'object',
                  properties: {},

                  strict: null,
                },
              },
              {
                type: 'code_interpreter',
                container: {
                  type: 'auto',
                },
              },
            ] as unknown as Responses.ResponseCreateParamsNonStreaming['tools'],
          };

          mockResponsesService.createTextResponse.mockResolvedValue(
            {} as unknown as Responses.Response,
          );

          await controller.createTextResponse(dto);

          expect(createTextResponseSpy).toHaveBeenCalledWith(dto);
          const calledTools =
            mockResponsesService.createTextResponse.mock.calls[0][0].tools;
          expect(calledTools).toHaveLength(2);
          expect(calledTools?.[0].type).toBe('function');
          expect(calledTools?.[1].type).toBe('code_interpreter');
        });

        it('should accept code_interpreter with include parameter', async () => {
          const dto: CreateTextResponseDto = {
            model: 'gpt-5',
            input: 'Calculate with detailed outputs',
            tools: [
              {
                type: 'code_interpreter',
                container: {
                  type: 'auto',
                },
              },
            ],
            include: ['code_interpreter_call.outputs'],
          };

          mockResponsesService.createTextResponse.mockResolvedValue(
            {} as unknown as Responses.Response,
          );

          await controller.createTextResponse(dto);

          expect(createTextResponseSpy).toHaveBeenCalledWith(dto);
          expect(
            mockResponsesService.createTextResponse.mock.calls[0][0].include,
          ).toContain('code_interpreter_call.outputs');
        });
      });
    });

    describe('Conversation Parameters', () => {
      it('should pass conversation parameter', async () => {
        const dto: CreateTextResponseDto = {
          model: 'gpt-5',
          input: 'Continue conversation',
          conversation: 'conv_abc123',
        };

        mockResponsesService.createTextResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createTextResponse(dto);

        expect(createTextResponseSpy).toHaveBeenCalledWith(dto);
      });

      it('should pass previous_response_id parameter', async () => {
        const dto: CreateTextResponseDto = {
          model: 'gpt-5',
          input: 'Follow up question',
          previous_response_id: 'resp_prev123',
        };

        mockResponsesService.createTextResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createTextResponse(dto);

        expect(createTextResponseSpy).toHaveBeenCalledWith(dto);
      });
    });

    describe('Performance & Caching Parameters', () => {
      it('should pass prompt_cache_key parameter', async () => {
        const dto: CreateTextResponseDto = {
          model: 'gpt-5',
          input: 'Test',
          prompt_cache_key: 'user-123-hashed',
        };

        mockResponsesService.createTextResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createTextResponse(dto);

        expect(createTextResponseSpy).toHaveBeenCalledWith(dto);
      });

      it('should pass service_tier parameter', async () => {
        const dto: CreateTextResponseDto = {
          model: 'gpt-5',
          input: 'Test',
          service_tier: 'flex',
        };

        mockResponsesService.createTextResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createTextResponse(dto);

        expect(createTextResponseSpy).toHaveBeenCalledWith(dto);
      });

      it('should pass truncation parameter', async () => {
        const dto: CreateTextResponseDto = {
          model: 'gpt-5',
          input: 'Test',
          truncation: 'auto',
        };

        mockResponsesService.createTextResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createTextResponse(dto);

        expect(createTextResponseSpy).toHaveBeenCalledWith(dto);
      });

      it('should pass background parameter', async () => {
        const dto: CreateTextResponseDto = {
          model: 'gpt-5',
          input: 'Long running task',
          background: true,
        };

        mockResponsesService.createTextResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createTextResponse(dto);

        expect(createTextResponseSpy).toHaveBeenCalledWith(dto);
      });
    });

    describe('Safety & Metadata Parameters', () => {
      it('should pass safety_identifier parameter', async () => {
        const dto: CreateTextResponseDto = {
          model: 'gpt-5',
          input: 'Test',
          safety_identifier: 'hashed-user-id-abc123',
        };

        mockResponsesService.createTextResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createTextResponse(dto);

        expect(createTextResponseSpy).toHaveBeenCalledWith(dto);
      });

      it('should pass metadata parameter', async () => {
        const dto: CreateTextResponseDto = {
          model: 'gpt-5',
          input: 'Test',
          metadata: { request_id: '123', user_tier: 'premium' },
        };

        mockResponsesService.createTextResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createTextResponse(dto);

        expect(createTextResponseSpy).toHaveBeenCalledWith(dto);
      });
    });

    describe('Advanced Features', () => {
      it('should pass prompt template parameter', async () => {
        const dto: CreateTextResponseDto = {
          model: 'gpt-5',
          input: 'Test',
          prompt: {
            id: 'pmpt_abc123',
            version: '2',
            variables: { customer_name: 'Jane Doe' },
          },
        };

        mockResponsesService.createTextResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createTextResponse(dto);

        expect(createTextResponseSpy).toHaveBeenCalledWith(dto);
      });

      it('should pass include parameter for additional output data', async () => {
        const dto: CreateTextResponseDto = {
          model: 'gpt-5',
          input: 'Test',
          include: [
            'code_interpreter_call.outputs',
            'message.output_text.logprobs',
          ],
        };

        mockResponsesService.createTextResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createTextResponse(dto);

        expect(createTextResponseSpy).toHaveBeenCalledWith(dto);
      });

      it('should pass reasoning parameter for o-series models', async () => {
        const dto: CreateTextResponseDto = {
          model: 'o1',
          input: 'Solve this complex problem',
          reasoning: {
            effort: 'medium',
            summary: 'concise',
          },
        };

        mockResponsesService.createTextResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createTextResponse(dto);

        expect(createTextResponseSpy).toHaveBeenCalledWith(dto);
      });

      it('should pass stream_options parameter', async () => {
        const dto: CreateTextResponseDto = {
          model: 'gpt-5',
          input: 'Test',
          stream: true,
          stream_options: { include_obfuscation: false },
        };

        mockResponsesService.createTextResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createTextResponse(dto);

        expect(createTextResponseSpy).toHaveBeenCalledWith(dto);
      });
    });

    describe('Combined Parameters', () => {
      it('should pass all parameters together', async () => {
        const dto: CreateTextResponseDto = {
          model: 'gpt-5',
          input: 'Complex request',
          instructions: 'Be detailed',
          temperature: 0.8,
          top_p: 0.95,
          max_output_tokens: 2000,
          store: true,
          tools: [
            {
              type: 'function',

              name: 'test_tool',

              description: 'Test',

              parameters: { type: 'object', properties: {} },

              strict: null,
            },
          ],
          tool_choice: 'auto',
          parallel_tool_calls: true,
          prompt_cache_key: 'cache-key-123',
          service_tier: 'priority',
          safety_identifier: 'user-hash-123',
          metadata: { session_id: 'sess_123' },
        };

        mockResponsesService.createTextResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createTextResponse(dto);

        expect(createTextResponseSpy).toHaveBeenCalledWith(dto);
        const calledDto =
          mockResponsesService.createTextResponse.mock.calls[0][0];
        expect(calledDto).toHaveProperty('tools');
        expect(calledDto).toHaveProperty('prompt_cache_key', 'cache-key-123');
        expect(calledDto).toHaveProperty('service_tier', 'priority');
        expect(calledDto).toHaveProperty('metadata');
      });
    });
  });

  describe('createTextResponseStream', () => {
    let mockRes: jest.Mocked<Response>;
    let setHeaderSpy: jest.Mock;
    let writeSpy: jest.Mock;
    let endSpy: jest.Mock;

    beforeEach(() => {
      setHeaderSpy = jest.fn();
      writeSpy = jest.fn();
      endSpy = jest.fn();
      mockRes = {
        setHeader: setHeaderSpy,
        write: writeSpy,
        end: endSpy,
      } as unknown as jest.Mocked<Response>;
    });

    it('should set SSE headers correctly', async () => {
      const dto: CreateTextResponseDto = {
        model: 'gpt-5',
        input: 'Hello',
      };

      const mockGenerator = async function* () {
        yield await Promise.resolve({
          event: 'text_delta',
          data: '{"delta":"Hello"}',
          sequence: 1,
        });
      };

      mockResponsesService.createTextResponseStream.mockReturnValue(
        mockGenerator(),
      );

      await controller.createTextResponseStream(dto, mockRes);

      expect(setHeaderSpy).toHaveBeenCalledWith(
        'Content-Type',
        'text/event-stream',
      );
      expect(setHeaderSpy).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(setHeaderSpy).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(setHeaderSpy).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
    });

    it('should stream events in SSE format', async () => {
      const dto: CreateTextResponseDto = {
        model: 'gpt-5',
        input: 'Test',
      };

      const mockGenerator = async function* () {
        yield await Promise.resolve({
          event: 'text_delta',
          data: '{"delta":"Hello"}',
          sequence: 1,
        });
        yield await Promise.resolve({
          event: 'text_delta',
          data: '{"delta":" world"}',
          sequence: 2,
        });
        yield await Promise.resolve({
          event: 'done',
          data: '{"response":{"id":"resp_123"}}',
          sequence: 3,
        });
      };

      mockResponsesService.createTextResponseStream.mockReturnValue(
        mockGenerator(),
      );

      await controller.createTextResponseStream(dto, mockRes);

      expect(writeSpy).toHaveBeenCalledTimes(3);
      expect(writeSpy).toHaveBeenNthCalledWith(
        1,
        'event: text_delta\ndata: {"delta":"Hello"}\n\n',
      );
      expect(writeSpy).toHaveBeenNthCalledWith(
        2,
        'event: text_delta\ndata: {"delta":" world"}\n\n',
      );
      expect(writeSpy).toHaveBeenNthCalledWith(
        3,
        'event: done\ndata: {"response":{"id":"resp_123"}}\n\n',
      );
      expect(endSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle streaming errors gracefully', async () => {
      const dto: CreateTextResponseDto = {
        model: 'gpt-5',
        input: 'Test',
      };

      const mockGenerator = async function* () {
        yield await Promise.resolve({
          event: 'text_delta',
          data: '{"delta":"Hello"}',
          sequence: 1,
        });
        throw new Error('Stream error occurred');
      };

      mockResponsesService.createTextResponseStream.mockReturnValue(
        mockGenerator(),
      );

      await controller.createTextResponseStream(dto, mockRes);

      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('event: error'),
      );
      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('Stream error occurred'),
      );
      expect(endSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle unknown errors in streaming', async () => {
      const dto: CreateTextResponseDto = {
        model: 'gpt-5',
        input: 'Test',
      };

      const mockGenerator = async function* () {
        yield await Promise.resolve({
          event: 'error',
          data: '{}',
          sequence: 1,
        });
        throw new Error('Non-Error object');
      };

      mockResponsesService.createTextResponseStream.mockReturnValue(
        mockGenerator(),
      );

      await controller.createTextResponseStream(dto, mockRes);

      expect(writeSpy).toHaveBeenCalledWith('event: error\ndata: {}\n\n');
      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('Non-Error object'),
      );
      expect(endSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('createImageResponse', () => {
    it('should create image response successfully', async () => {
      const dto: CreateImageResponseDto = {
        model: 'gpt-image-1',
        input: 'A beautiful sunset over mountains',
      };

      const mockResponse = {
        id: 'resp_img_123',
        output_text: 'data:image/png;base64,iVBORw0KGgoAAAANSU...',
        usage: {
          input_tokens: 20,
          output_tokens: 0,
          total_tokens: 20,
        },
      };

      mockResponsesService.createImageResponse.mockResolvedValue(
        mockResponse as unknown as Responses.Response,
      );

      const result = await controller.createImageResponse(dto);

      expect(result).toEqual(mockResponse);
      expect(createImageResponseSpy).toHaveBeenCalledWith(dto);
      expect(createImageResponseSpy).toHaveBeenCalledTimes(1);
    });

    it('should pass image generation parameters to service', async () => {
      const dto: CreateImageResponseDto = {
        model: 'gpt-image-1',
        input: 'A cat wearing a hat',
        image_size: '1024x1024',
        image_quality: 'high',
      };

      mockResponsesService.createImageResponse.mockResolvedValue(
        {} as unknown as Responses.Response,
      );

      await controller.createImageResponse(dto);

      expect(createImageResponseSpy).toHaveBeenCalledWith(dto);
    });

    it('should propagate image generation errors', async () => {
      const dto: CreateImageResponseDto = {
        model: 'gpt-image-1',
        input: 'Invalid prompt',
      };

      const error = new Error('Content policy violation');
      mockResponsesService.createImageResponse.mockRejectedValue(error);

      await expect(controller.createImageResponse(dto)).rejects.toThrow(
        'Content policy violation',
      );
    });

    describe('Image-Specific Parameters', () => {
      it('should pass image_model parameter', async () => {
        const dto: CreateImageResponseDto = {
          model: 'gpt-image-1',
          input: 'A cat',
          image_model: 'gpt-image-1-mini',
        };

        mockResponsesService.createImageResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createImageResponse(dto);

        expect(createImageResponseSpy).toHaveBeenCalledWith(dto);
      });

      it('should pass image_quality parameter', async () => {
        const dto: CreateImageResponseDto = {
          model: 'gpt-image-1',
          input: 'A landscape',
          image_quality: 'high',
        };

        mockResponsesService.createImageResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createImageResponse(dto);

        expect(createImageResponseSpy).toHaveBeenCalledWith(dto);
      });

      it('should pass image_format parameter', async () => {
        const dto: CreateImageResponseDto = {
          model: 'gpt-image-1',
          input: 'A photo',
          image_format: 'webp',
        };

        mockResponsesService.createImageResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createImageResponse(dto);

        expect(createImageResponseSpy).toHaveBeenCalledWith(dto);
      });

      it('should pass image_size parameter', async () => {
        const dto: CreateImageResponseDto = {
          model: 'gpt-image-1',
          input: 'A portrait',
          image_size: '1024x1536',
        };

        mockResponsesService.createImageResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createImageResponse(dto);

        expect(createImageResponseSpy).toHaveBeenCalledWith(dto);
      });

      it('should pass image_moderation parameter', async () => {
        const dto: CreateImageResponseDto = {
          model: 'gpt-image-1',
          input: 'Creative art',
          image_moderation: 'low',
        };

        mockResponsesService.createImageResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createImageResponse(dto);

        expect(createImageResponseSpy).toHaveBeenCalledWith(dto);
      });

      it('should pass image_background parameter', async () => {
        const dto: CreateImageResponseDto = {
          model: 'gpt-image-1',
          input: 'A logo',
          image_background: 'transparent',
          image_format: 'png',
        };

        mockResponsesService.createImageResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createImageResponse(dto);

        expect(createImageResponseSpy).toHaveBeenCalledWith(dto);
      });

      it('should pass input_fidelity parameter', async () => {
        const dto: CreateImageResponseDto = {
          model: 'gpt-image-1',
          input: 'Specific scene',
          input_fidelity: 'high',
        };

        mockResponsesService.createImageResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createImageResponse(dto);

        expect(createImageResponseSpy).toHaveBeenCalledWith(dto);
      });

      it('should pass output_compression parameter', async () => {
        const dto: CreateImageResponseDto = {
          model: 'gpt-image-1',
          input: 'Compress this',
          output_compression: 80,
        };

        mockResponsesService.createImageResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createImageResponse(dto);

        expect(createImageResponseSpy).toHaveBeenCalledWith(dto);
      });

      it('should pass partial_images parameter', async () => {
        const dto: CreateImageResponseDto = {
          model: 'gpt-image-1',
          input: 'Progressive rendering',
          partial_images: 3,
        };

        mockResponsesService.createImageResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createImageResponse(dto);

        expect(createImageResponseSpy).toHaveBeenCalledWith(dto);
      });
    });

    describe('Image Optimization Parameters', () => {
      it('should pass conversation parameter for multi-turn', async () => {
        const dto: CreateImageResponseDto = {
          model: 'gpt-image-1',
          input: 'Modify the previous image',
          conversation: 'conv_img_123',
        };

        mockResponsesService.createImageResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createImageResponse(dto);

        expect(createImageResponseSpy).toHaveBeenCalledWith(dto);
      });

      it('should pass service_tier parameter', async () => {
        const dto: CreateImageResponseDto = {
          model: 'gpt-image-1',
          input: 'Test image',
          service_tier: 'flex',
        };

        mockResponsesService.createImageResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createImageResponse(dto);

        expect(createImageResponseSpy).toHaveBeenCalledWith(dto);
      });

      it('should pass background execution parameter', async () => {
        const dto: CreateImageResponseDto = {
          model: 'gpt-image-1',
          input: 'Complex image generation',
          background: true,
        };

        mockResponsesService.createImageResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createImageResponse(dto);

        expect(createImageResponseSpy).toHaveBeenCalledWith(dto);
      });

      it('should pass metadata parameter', async () => {
        const dto: CreateImageResponseDto = {
          model: 'gpt-image-1',
          input: 'Test',
          metadata: { project_id: 'proj_123', batch: 'batch_1' },
        };

        mockResponsesService.createImageResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createImageResponse(dto);

        expect(createImageResponseSpy).toHaveBeenCalledWith(dto);
      });
    });

    describe('Combined Image Parameters', () => {
      it('should pass all image parameters together', async () => {
        const dto: CreateImageResponseDto = {
          model: 'gpt-image-1',
          input: 'A complex scene',
          instructions: 'High quality, photorealistic',
          image_model: 'gpt-image-1',
          image_quality: 'high',
          image_format: 'webp',
          image_size: '1536x1024',
          image_background: 'opaque',
          input_fidelity: 'high',
          output_compression: 95,
          partial_images: 2,
          store: true,
          service_tier: 'priority',
          metadata: { user_id: 'user_123' },
        };

        mockResponsesService.createImageResponse.mockResolvedValue(
          {} as unknown as Responses.Response,
        );

        await controller.createImageResponse(dto);

        expect(createImageResponseSpy).toHaveBeenCalledWith(dto);
        const calledDto =
          mockResponsesService.createImageResponse.mock.calls[0][0];
        expect(calledDto).toHaveProperty('image_quality', 'high');
        expect(calledDto).toHaveProperty('image_format', 'webp');
        expect(calledDto).toHaveProperty('partial_images', 2);
        expect(calledDto).toHaveProperty('metadata');
      });
    });
  });

  describe('createImageResponseStream', () => {
    let mockRes: jest.Mocked<Response>;
    let setHeaderSpy: jest.Mock;
    let writeSpy: jest.Mock;
    let endSpy: jest.Mock;

    beforeEach(() => {
      setHeaderSpy = jest.fn();
      writeSpy = jest.fn();
      endSpy = jest.fn();
      mockRes = {
        setHeader: setHeaderSpy,
        write: writeSpy,
        end: endSpy,
      } as unknown as jest.Mocked<Response>;
    });

    it('should set SSE headers for image streaming', async () => {
      const dto: CreateImageResponseDto = {
        model: 'gpt-image-1',
        input: 'A sunset',
      };

      const mockGenerator = async function* () {
        yield await Promise.resolve({
          event: 'image_generation_call.in_progress',
          data: '{"call_id":"img_123"}',
          sequence: 1,
        });
      };

      mockResponsesService.createImageResponseStream.mockReturnValue(
        mockGenerator(),
      );

      await controller.createImageResponseStream(dto, mockRes);

      expect(setHeaderSpy).toHaveBeenCalledWith(
        'Content-Type',
        'text/event-stream',
      );
      expect(setHeaderSpy).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(setHeaderSpy).toHaveBeenCalledWith('Connection', 'keep-alive');
    });

    it('should stream image generation events', async () => {
      const dto: CreateImageResponseDto = {
        model: 'gpt-image-1',
        input: 'A cat',
      };

      const mockGenerator = async function* () {
        yield await Promise.resolve({
          event: 'image_generation_call.in_progress',
          data: '{"call_id":"img_123"}',
          sequence: 1,
        });
        yield await Promise.resolve({
          event: 'image_generation_call.partial_image',
          data: '{"call_id":"img_123","image_data":"data:image/png;base64,partial"}',
          sequence: 2,
        });
        yield await Promise.resolve({
          event: 'image_generation_call.completed',
          data: '{"call_id":"img_123"}',
          sequence: 3,
        });
      };

      mockResponsesService.createImageResponseStream.mockReturnValue(
        mockGenerator(),
      );

      await controller.createImageResponseStream(dto, mockRes);

      expect(writeSpy).toHaveBeenCalledTimes(3);
      expect(writeSpy).toHaveBeenNthCalledWith(
        1,
        'event: image_generation_call.in_progress\ndata: {"call_id":"img_123"}\n\n',
      );
      expect(endSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle image streaming errors', async () => {
      const dto: CreateImageResponseDto = {
        model: 'gpt-image-1',
        input: 'Test',
      };

      const mockGenerator = async function* () {
        yield await Promise.resolve({
          event: 'error',
          data: '{}',
          sequence: 1,
        });
        throw new Error('Image generation failed');
      };

      mockResponsesService.createImageResponseStream.mockReturnValue(
        mockGenerator(),
      );

      await controller.createImageResponseStream(dto, mockRes);

      expect(writeSpy).toHaveBeenCalledWith(
        'event: error\ndata: {"error":"Image generation failed"}\n\n',
      );
      expect(endSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('retrieveResponse', () => {
    it('should retrieve response by ID successfully', async () => {
      const responseId = 'resp_abc123';
      const mockResponse = {
        id: responseId,
        object: 'response',
        output_text: 'Retrieved text',
        status: 'completed',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
        },
      };

      mockResponsesService.retrieve.mockResolvedValue(
        mockResponse as unknown as Responses.Response,
      );

      const result = await controller.retrieveResponse(responseId);

      expect(result).toEqual(mockResponse);
      expect(retrieveSpy).toHaveBeenCalledWith(responseId);
      expect(retrieveSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle response not found error', async () => {
      const responseId = 'resp_nonexistent';
      const error = new Error('Response not found');

      mockResponsesService.retrieve.mockRejectedValue(error);

      await expect(controller.retrieveResponse(responseId)).rejects.toThrow(
        'Response not found',
      );
    });
  });

  describe('deleteResponse', () => {
    it('should delete response by ID successfully', async () => {
      const responseId = 'resp_abc123';
      const mockResponse = {
        id: responseId,
        deleted: true,
        object: 'response',
      };

      mockResponsesService.delete.mockResolvedValue(
        mockResponse as { id: string; deleted: boolean; object: string },
      );

      const result = await controller.deleteResponse(responseId);

      expect(result).toEqual(mockResponse);
      expect(deleteSpy).toHaveBeenCalledWith(responseId);
      expect(deleteSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle delete error for non-existent response', async () => {
      const responseId = 'resp_nonexistent';
      const error = new Error('Response not found');

      mockResponsesService.delete.mockRejectedValue(error);

      await expect(controller.deleteResponse(responseId)).rejects.toThrow(
        'Response not found',
      );
    });

    it('should handle permission error', async () => {
      const responseId = 'resp_other_user';
      const error = new Error('Permission denied');

      mockResponsesService.delete.mockRejectedValue(error);

      await expect(controller.deleteResponse(responseId)).rejects.toThrow(
        'Permission denied',
      );
    });
  });

  describe('cancelResponse', () => {
    it('should cancel background response successfully', async () => {
      const responseId = 'resp_background_123';
      const mockResponse = {
        id: responseId,
        object: 'response',
        status: 'cancelled',
        output_text: 'Partial output before cancel',
      };

      mockResponsesService.cancel.mockResolvedValue(
        mockResponse as unknown as Responses.Response,
      );

      const result = await controller.cancelResponse(responseId);

      expect(result).toEqual(mockResponse);
      expect(cancelSpy).toHaveBeenCalledWith(responseId);
      expect(cancelSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle cancel error for non-background response', async () => {
      const responseId = 'resp_regular_123';
      const error = new Error('Not a background response');

      mockResponsesService.cancel.mockRejectedValue(error);

      await expect(controller.cancelResponse(responseId)).rejects.toThrow(
        'Not a background response',
      );
    });

    it('should handle cancel error for already completed response', async () => {
      const responseId = 'resp_completed_123';
      const error = new Error('Response already completed');

      mockResponsesService.cancel.mockRejectedValue(error);

      await expect(controller.cancelResponse(responseId)).rejects.toThrow(
        'Response already completed',
      );
    });

    it('should handle response not found', async () => {
      const responseId = 'resp_nonexistent';
      const error = new Error('Response not found');

      mockResponsesService.cancel.mockRejectedValue(error);

      await expect(controller.cancelResponse(responseId)).rejects.toThrow(
        'Response not found',
      );
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete text response lifecycle', async () => {
      // Create
      const createDto: CreateTextResponseDto = {
        model: 'gpt-5',
        input: 'Hello',
        store: true,
      };

      const createResponse = {
        id: 'resp_lifecycle_123',
        output_text: 'Hello! How can I help?',
      };

      mockResponsesService.createTextResponse.mockResolvedValue(
        createResponse as unknown as Responses.Response,
      );

      const created = await controller.createTextResponse(createDto);
      expect(created.id).toBe('resp_lifecycle_123');

      // Retrieve
      mockResponsesService.retrieve.mockResolvedValue(
        createResponse as unknown as Responses.Response,
      );
      const retrieved = await controller.retrieveResponse('resp_lifecycle_123');
      expect(retrieved).toEqual(createResponse);

      // Delete
      mockResponsesService.delete.mockResolvedValue({
        id: 'resp_lifecycle_123',
        deleted: true,
        object: 'response',
      } as { id: string; deleted: boolean; object: string });
      const deleted = await controller.deleteResponse('resp_lifecycle_123');
      expect(deleted.deleted).toBe(true);
    });

    it('should handle text streaming with multiple events', async () => {
      const dto: CreateTextResponseDto = {
        model: 'gpt-5',
        input: 'Count to 3',
      };

      const mockGenerator = async function* () {
        yield await Promise.resolve({
          event: 'response_created',
          data: '{"id":"resp_123"}',
          sequence: 1,
        });
        yield await Promise.resolve({
          event: 'text_delta',
          data: '{"delta":"1"}',
          sequence: 2,
        });
        yield await Promise.resolve({
          event: 'text_delta',
          data: '{"delta":", 2"}',
          sequence: 3,
        });
        yield await Promise.resolve({
          event: 'text_delta',
          data: '{"delta":", 3"}',
          sequence: 4,
        });
        yield await Promise.resolve({
          event: 'text_done',
          data: '{"text":"1, 2, 3"}',
          sequence: 5,
        });
        yield await Promise.resolve({
          event: 'response_completed',
          data: '{"status":"completed"}',
          sequence: 6,
        });
      };

      mockResponsesService.createTextResponseStream.mockReturnValue(
        mockGenerator(),
      );

      const setHeaderSpy = jest.fn();
      const writeSpy = jest.fn();
      const endSpy = jest.fn();

      const mockRes = {
        setHeader: setHeaderSpy,
        write: writeSpy,
        end: endSpy,
      } as unknown as jest.Mocked<Response>;

      await controller.createTextResponseStream(dto, mockRes);

      expect(writeSpy).toHaveBeenCalledTimes(6);
      expect(endSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle image streaming with progressive rendering', async () => {
      const dto: CreateImageResponseDto = {
        model: 'gpt-image-1',
        input: 'A mountain landscape',
      };

      const mockGenerator = async function* () {
        yield await Promise.resolve({
          event: 'response_created',
          data: '{"id":"resp_img_123"}',
          sequence: 1,
        });
        yield await Promise.resolve({
          event: 'image_generation_call.in_progress',
          data: '{"call_id":"img_call_123"}',
          sequence: 2,
        });
        yield await Promise.resolve({
          event: 'image_generation_call.partial_image',
          data: '{"image_data":"data:image/png;base64,partial1"}',
          sequence: 3,
        });
        yield await Promise.resolve({
          event: 'image_generation_call.partial_image',
          data: '{"image_data":"data:image/png;base64,partial2"}',
          sequence: 4,
        });
        yield await Promise.resolve({
          event: 'image_generation_call.completed',
          data: '{"call_id":"img_call_123"}',
          sequence: 5,
        });
        yield await Promise.resolve({
          event: 'response_completed',
          data: '{"status":"completed"}',
          sequence: 6,
        });
      };

      mockResponsesService.createImageResponseStream.mockReturnValue(
        mockGenerator(),
      );

      const setHeaderSpy = jest.fn();
      const writeSpy = jest.fn();
      const endSpy = jest.fn();

      const mockRes = {
        setHeader: setHeaderSpy,
        write: writeSpy,
        end: endSpy,
      } as unknown as jest.Mocked<Response>;

      await controller.createImageResponseStream(dto, mockRes);

      expect(writeSpy).toHaveBeenCalledTimes(6);
      expect(endSpy).toHaveBeenCalledTimes(1);
    });
  });

  // Resumable Streaming Tests
  describe('resumeResponseStream (GET /:id/stream)', () => {
    let setHeaderSpy: jest.Mock;
    let writeSpy: jest.Mock;
    let endSpy: jest.Mock;

    it('should resume streaming for a stored response', async () => {
      const responseId = 'resp_abc123';

      const mockGenerator = async function* () {
        yield await Promise.resolve({
          event: 'text_delta',
          data: '{"delta":"resumed text"}',
          sequence: 10,
        });
        yield await Promise.resolve({
          event: 'text_done',
          data: '{"text":"resumed text"}',
          sequence: 11,
        });
        yield await Promise.resolve({
          event: 'response_completed',
          data: '{"status":"completed"}',
          sequence: 12,
        });
      };

      resumeResponseStreamSpy.mockReturnValue(mockGenerator());

      setHeaderSpy = jest.fn();
      writeSpy = jest.fn();
      endSpy = jest.fn();

      const mockRes = {
        setHeader: setHeaderSpy,
        write: writeSpy,
        end: endSpy,
      } as unknown as jest.Mocked<Response>;

      await controller.resumeResponseStream(responseId, mockRes);

      expect(resumeResponseStreamSpy).toHaveBeenCalledWith(responseId);
      expect(setHeaderSpy).toHaveBeenCalledWith(
        'Content-Type',
        'text/event-stream',
      );
      expect(writeSpy).toHaveBeenCalledTimes(3);
      expect(endSpy).toHaveBeenCalledTimes(1);
    });

    it('should set correct SSE headers for resumed streaming', async () => {
      const responseId = 'resp_xyz789';

      const mockGenerator = async function* () {
        yield await Promise.resolve({
          event: 'text_delta',
          data: '{"delta":"test"}',
          sequence: 1,
        });
      };

      resumeResponseStreamSpy.mockReturnValue(mockGenerator());

      setHeaderSpy = jest.fn();
      writeSpy = jest.fn();
      endSpy = jest.fn();

      const mockRes = {
        setHeader: setHeaderSpy,
        write: writeSpy,
        end: endSpy,
      } as unknown as jest.Mocked<Response>;

      await controller.resumeResponseStream(responseId, mockRes);

      expect(setHeaderSpy).toHaveBeenCalledWith(
        'Content-Type',
        'text/event-stream',
      );
      expect(setHeaderSpy).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(setHeaderSpy).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(setHeaderSpy).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
    });

    it('should handle errors during resumed streaming', async () => {
      const responseId = 'resp_error';

      const mockGenerator = async function* () {
        yield await Promise.resolve({
          event: 'text_delta',
          data: '{"delta":"start"}',
          sequence: 1,
        });
        throw new Error('Connection interrupted');
      };

      resumeResponseStreamSpy.mockReturnValue(mockGenerator());

      setHeaderSpy = jest.fn();
      writeSpy = jest.fn();
      endSpy = jest.fn();

      const mockRes = {
        setHeader: setHeaderSpy,
        write: writeSpy,
        end: endSpy,
      } as unknown as jest.Mocked<Response>;

      await controller.resumeResponseStream(responseId, mockRes);

      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('event: error'),
      );
      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('Connection interrupted'),
      );
      expect(endSpy).toHaveBeenCalledTimes(1);
    });

    it('should format SSE messages correctly for resumed stream', async () => {
      const responseId = 'resp_format_test';

      const mockGenerator = async function* () {
        yield await Promise.resolve({
          event: 'text_delta',
          data: '{"delta":"Hello"}',
          sequence: 5,
        });
      };

      resumeResponseStreamSpy.mockReturnValue(mockGenerator());

      setHeaderSpy = jest.fn();
      writeSpy = jest.fn();
      endSpy = jest.fn();

      const mockRes = {
        setHeader: setHeaderSpy,
        write: writeSpy,
        end: endSpy,
      } as unknown as jest.Mocked<Response>;

      await controller.resumeResponseStream(responseId, mockRes);

      expect(writeSpy).toHaveBeenCalledWith(
        'event: text_delta\ndata: {"delta":"Hello"}\n\n',
      );
    });

    it('should handle multiple events in resumed stream', async () => {
      const responseId = 'resp_multi_event';

      const mockGenerator = async function* () {
        yield await Promise.resolve({
          event: 'text_delta',
          data: '{"delta":"Part 1"}',
          sequence: 15,
        });
        yield await Promise.resolve({
          event: 'text_delta',
          data: '{"delta":" Part 2"}',
          sequence: 16,
        });
        yield await Promise.resolve({
          event: 'text_delta',
          data: '{"delta":" Part 3"}',
          sequence: 17,
        });
        yield await Promise.resolve({
          event: 'text_done',
          data: '{"text":"Part 1 Part 2 Part 3"}',
          sequence: 18,
        });
        yield await Promise.resolve({
          event: 'response_completed',
          data: '{"status":"completed"}',
          sequence: 19,
        });
      };

      resumeResponseStreamSpy.mockReturnValue(mockGenerator());

      setHeaderSpy = jest.fn();
      writeSpy = jest.fn();
      endSpy = jest.fn();

      const mockRes = {
        setHeader: setHeaderSpy,
        write: writeSpy,
        end: endSpy,
      } as unknown as jest.Mocked<Response>;

      await controller.resumeResponseStream(responseId, mockRes);

      expect(writeSpy).toHaveBeenCalledTimes(5);
      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('text_delta'),
      );
      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('text_done'),
      );
      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('response_completed'),
      );
      expect(endSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle empty stream gracefully', async () => {
      const responseId = 'resp_empty';

      const mockGenerator = async function* () {
        // Empty generator
      };

      resumeResponseStreamSpy.mockReturnValue(mockGenerator());

      setHeaderSpy = jest.fn();
      writeSpy = jest.fn();
      endSpy = jest.fn();

      const mockRes = {
        setHeader: setHeaderSpy,
        write: writeSpy,
        end: endSpy,
      } as unknown as jest.Mocked<Response>;

      await controller.resumeResponseStream(responseId, mockRes);

      expect(setHeaderSpy).toHaveBeenCalled();
      expect(endSpy).toHaveBeenCalledTimes(1);
    });
  });
});
