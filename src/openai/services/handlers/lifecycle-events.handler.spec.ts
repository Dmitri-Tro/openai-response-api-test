import { Test, TestingModule } from '@nestjs/testing';
import type { Responses } from 'openai/resources/responses';
import { LifecycleEventsHandler } from './lifecycle-events.handler';
import { LoggerService } from '../../../common/services/logger.service';
import type {
  StreamState,
  SSEEvent,
} from '../../interfaces/streaming-events.interface';
import {
  createMockLoggerService,
  createMockStreamState,
} from '../../../common/testing/test.factories';

describe('LifecycleEventsHandler', () => {
  let handler: LifecycleEventsHandler;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockState: StreamState;

  beforeEach(async () => {
    // Mock LoggerService using factory
    mockLoggerService = createMockLoggerService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LifecycleEventsHandler,
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    handler = module.get<LifecycleEventsHandler>(LifecycleEventsHandler);

    // Initialize mock state using factory
    mockState = createMockStreamState();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleResponseCreated', () => {
    it('should yield response_created event and update state', () => {
      const event = {
        response: {
          id: 'resp_123',
          model: 'gpt-5',
        },
      };
      const sequence = 1;

      const generator = handler.handleResponseCreated(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        event: 'response_created',
        data: JSON.stringify({
          response_id: 'resp_123',
          model: 'gpt-5',
          sequence: 1,
        }),
        sequence: 1,
      });

      // Verify state was updated
      expect(mockState.responseId).toBe('resp_123');
      expect(mockState.model).toBe('gpt-5');
    });

    it('should log streaming event with correct parameters', () => {
      const event = {
        response: {
          id: 'resp_123',
          model: 'gpt-5',
        },
      };
      const sequence = 1;

      const generator = handler.handleResponseCreated(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'response_created',
        sequence: 1,
        response: {
          id: 'resp_123',
          model: 'gpt-5',
        },
      });
    });

    it('should handle event without response data', () => {
      const event = {};
      const sequence = 1;

      const generator = handler.handleResponseCreated(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('response_created');
      expect(results[0].sequence).toBe(1);
      // undefined values are omitted from JSON.stringify
      expect(results[0].data).toContain('"sequence":1');
      expect(mockState.responseId).toBeUndefined();
    });
  });

  describe('handleResponseCompleted', () => {
    it('should yield response_completed event with usage stats', () => {
      const mockResponse: Responses.Response = {
        id: 'resp_123',
        object: 'response',
        created: Date.now(),
        model: 'gpt-5',
        status: 'completed',
        output: [],
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          total_tokens: 150,
        },
      };

      const event = { response: mockResponse };
      const sequence = 10;
      mockState.responseId = 'resp_123';
      mockState.fullText = 'Test response';
      mockState.startTime = Date.now() - 1000; // 1 second ago

      const mockExtractUsage = jest.fn().mockReturnValue({
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
        cached_tokens: 20,
        reasoning_tokens: 10,
      });

      const mockExtractResponseMetadata = jest.fn().mockReturnValue({
        status: 'completed',
        conversation: null,
        background: false,
      });

      const mockEstimateCost = jest.fn().mockReturnValue(0.0045);

      const generator = handler.handleResponseCompleted(
        event,
        mockState,
        sequence,
        mockExtractUsage,
        mockExtractResponseMetadata,
        mockEstimateCost,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('response_completed');

      const data = JSON.parse(results[0].data);
      expect(data).toMatchObject({
        response_id: 'resp_123',
        output_text: 'Test response',
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
          cached_tokens: 20,
          reasoning_tokens: 10,
        },
        status: 'completed',
        sequence: 10,
      });
      expect(data.latency_ms).toBeGreaterThan(0);

      // Verify state was updated
      expect(mockState.finalResponse).toBe(mockResponse);
    });

    it('should call helper functions with correct arguments', () => {
      const mockResponse: Responses.Response = {
        id: 'resp_123',
        object: 'response',
        created: Date.now(),
        model: 'gpt-5',
        status: 'completed',
        output: [],
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          total_tokens: 150,
        },
      };

      const event = { response: mockResponse };
      const sequence = 10;

      const mockExtractUsage = jest.fn().mockReturnValue({
        total_tokens: 150,
      });
      const mockExtractResponseMetadata = jest.fn().mockReturnValue({
        status: 'completed',
      });
      const mockEstimateCost = jest.fn().mockReturnValue(0.0045);

      const generator = handler.handleResponseCompleted(
        event,
        mockState,
        sequence,
        mockExtractUsage,
        mockExtractResponseMetadata,
        mockEstimateCost,
      );
      Array.from(generator);

      expect(mockExtractUsage).toHaveBeenCalledWith(mockResponse);
      expect(mockExtractResponseMetadata).toHaveBeenCalledWith(mockResponse);
      expect(mockEstimateCost).toHaveBeenCalledWith(
        {
          total_tokens: 150,
        },
        'gpt-5',
      );
    });

    it('should log completed event with metadata', () => {
      const mockResponse: Responses.Response = {
        id: 'resp_123',
        object: 'response',
        created: Date.now(),
        model: 'gpt-5',
        status: 'completed',
        output: [],
      };

      const event = { response: mockResponse };
      const sequence = 10;
      mockState.startTime = Date.now() - 500;

      const mockExtractUsage = jest.fn().mockReturnValue({ total_tokens: 100 });
      const mockExtractResponseMetadata = jest.fn().mockReturnValue({
        status: 'completed',
      });
      const mockEstimateCost = jest.fn().mockReturnValue(0.003);

      const generator = handler.handleResponseCompleted(
        event,
        mockState,
        sequence,
        mockExtractUsage,
        mockExtractResponseMetadata,
        mockEstimateCost,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'response_completed',
        sequence: 10,
        response: mockResponse,
        metadata: {
          latency_ms: expect.any(Number),
          tokens_used: 100,
          cost_estimate: 0.003,
        },
      });
    });

    it('should handle event without response data', () => {
      const event = {};
      const sequence = 10;

      const mockExtractUsage = jest.fn();
      const mockExtractResponseMetadata = jest.fn();
      const mockEstimateCost = jest.fn();

      const generator = handler.handleResponseCompleted(
        event,
        mockState,
        sequence,
        mockExtractUsage,
        mockExtractResponseMetadata,
        mockEstimateCost,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(0);
      expect(mockExtractUsage).not.toHaveBeenCalled();
      expect(mockExtractResponseMetadata).not.toHaveBeenCalled();
    });
  });

  describe('handleResponseFailed', () => {
    it('should yield response_failed event with error details', () => {
      const event = {
        error: {
          message: 'API rate limit exceeded',
          code: 'rate_limit_exceeded',
        },
        response: { id: 'resp_123' },
      };
      const sequence = 5;
      mockState.responseId = 'resp_123';

      const generator = handler.handleResponseFailed(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        event: 'response_failed',
        data: JSON.stringify({
          response_id: 'resp_123',
          error: {
            message: 'API rate limit exceeded',
            code: 'rate_limit_exceeded',
          },
          sequence: 5,
        }),
        sequence: 5,
      });
    });

    it('should log failed event with error details', () => {
      const event = {
        error: { message: 'Test error' },
        response: { id: 'resp_123' },
      };
      const sequence = 5;

      const generator = handler.handleResponseFailed(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'response_failed',
        sequence: 5,
        error: { message: 'Test error' },
        response: { id: 'resp_123' },
      });
    });
  });

  describe('handleErrorEvent', () => {
    it('should yield error event', () => {
      const event = {
        error: {
          type: 'server_error',
          message: 'Internal server error',
        },
      };
      const sequence = 3;

      const generator = handler.handleErrorEvent(event, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        event: 'error',
        data: JSON.stringify({
          error: {
            type: 'server_error',
            message: 'Internal server error',
          },
          sequence: 3,
        }),
        sequence: 3,
      });
    });

    it('should log error event', () => {
      const event = {
        error: { message: 'Connection timeout' },
      };
      const sequence = 3;

      const generator = handler.handleErrorEvent(event, mockState, sequence);
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'error',
        sequence: 3,
        error: { message: 'Connection timeout' },
      });
    });
  });

  describe('handleResponseInProgress', () => {
    it('should yield response_in_progress event', () => {
      const event = {};
      const sequence = 2;
      mockState.responseId = 'resp_456';

      const generator = handler.handleResponseInProgress(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        event: 'response_in_progress',
        data: JSON.stringify({ response_id: 'resp_456', sequence: 2 }),
        sequence: 2,
      });
    });

    it('should log in_progress event', () => {
      const event = {};
      const sequence = 2;

      const generator = handler.handleResponseInProgress(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'response_in_progress',
        sequence: 2,
      });
    });
  });

  describe('handleResponseIncomplete', () => {
    it('should yield response_incomplete event with details', () => {
      const event = {
        incomplete_details: {
          reason: 'max_tokens',
          max_tokens: 1000,
        },
      };
      const sequence = 8;
      mockState.responseId = 'resp_789';

      const generator = handler.handleResponseIncomplete(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        event: 'response_incomplete',
        data: JSON.stringify({
          response_id: 'resp_789',
          incomplete_details: {
            reason: 'max_tokens',
            max_tokens: 1000,
          },
          sequence: 8,
        }),
        sequence: 8,
      });
    });

    it('should log incomplete event with details', () => {
      const event = {
        incomplete_details: { reason: 'content_filter' },
      };
      const sequence = 8;

      const generator = handler.handleResponseIncomplete(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'response_incomplete',
        sequence: 8,
        response: { incomplete_details: { reason: 'content_filter' } },
      });
    });
  });

  describe('handleResponseQueued', () => {
    it('should yield response_queued event', () => {
      const event = {};
      const sequence = 0;
      mockState.responseId = 'resp_abc';

      const generator = handler.handleResponseQueued(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        event: 'response_queued',
        data: JSON.stringify({ response_id: 'resp_abc', sequence: 0 }),
        sequence: 0,
      });
    });

    it('should log queued event', () => {
      const event = {};
      const sequence = 0;

      const generator = handler.handleResponseQueued(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'response_queued',
        sequence: 0,
      });
    });
  });

  describe('edge cases', () => {
    it('should handle multiple events in sequence', () => {
      mockState.responseId = 'resp_multi';

      // Simulate event sequence
      const createdEvent = { response: { id: 'resp_multi', model: 'gpt-5' } };
      const inProgressEvent = {};
      const completedEvent = {
        response: {
          id: 'resp_multi',
          object: 'response' as const,
          created: Date.now(),
          model: 'gpt-5',
          status: 'completed' as const,
          output: [],
        },
      };

      const mockExtractUsage = jest.fn().mockReturnValue({ total_tokens: 100 });
      const mockExtractResponseMetadata = jest.fn().mockReturnValue({
        status: 'completed',
      });
      const mockEstimateCost = jest.fn().mockReturnValue(0.003);

      // Process events
      Array.from(handler.handleResponseCreated(createdEvent, mockState, 1));
      Array.from(
        handler.handleResponseInProgress(inProgressEvent, mockState, 2),
      );
      Array.from(
        handler.handleResponseCompleted(
          completedEvent,
          mockState,
          3,
          mockExtractUsage,
          mockExtractResponseMetadata,
          mockEstimateCost,
        ),
      );

      // Verify logging was called for each event
      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledTimes(3);
      expect(mockState.responseId).toBe('resp_multi');
      expect(mockState.finalResponse).toBeDefined();
    });

    it('should handle events with minimal data', () => {
      const minimalEvent = {};
      const sequence = 99;

      // Test all handlers with minimal event data
      const handlers = [
        handler.handleResponseCreated(minimalEvent, mockState, sequence),
        handler.handleResponseFailed(minimalEvent, mockState, sequence),
        handler.handleErrorEvent(minimalEvent, mockState, sequence),
        handler.handleResponseInProgress(minimalEvent, mockState, sequence),
        handler.handleResponseIncomplete(minimalEvent, mockState, sequence),
        handler.handleResponseQueued(minimalEvent, mockState, sequence),
      ];

      handlers.forEach((gen) => {
        const results = Array.from(gen);
        expect(results.length).toBeGreaterThanOrEqual(0);
        results.forEach((result) => {
          expect(result).toHaveProperty('event');
          expect(result).toHaveProperty('data');
          expect(result).toHaveProperty('sequence');
          expect(result.sequence).toBe(sequence);
        });
      });
    });
  });

  describe('Error Handling & Edge Cases', () => {
    describe('handleResponseCreated - Malformed Events', () => {
      it('should handle null event', () => {
        const event = null;
        const sequence = 1;

        const generator = handler.handleResponseCreated(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(results[0].event).toBe('response_created');
        // State should remain undefined when event is null
        expect(mockState.responseId).toBeUndefined();
      });

      it('should handle undefined event', () => {
        const event = undefined;
        const sequence = 1;

        const generator = handler.handleResponseCreated(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(mockState.responseId).toBeUndefined();
      });

      it('should handle event with wrong type (string)', () => {
        const event = 'invalid' as unknown;
        const sequence = 1;

        const generator = handler.handleResponseCreated(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(results[0].event).toBe('response_created');
      });

      it('should handle event with missing response property', () => {
        const event = { notResponse: 'data' };
        const sequence = 1;

        const generator = handler.handleResponseCreated(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(mockState.responseId).toBeUndefined();
      });

      it('should handle response with missing id', () => {
        const event = { response: { model: 'gpt-5' } };
        const sequence = 1;

        const generator = handler.handleResponseCreated(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        // Should not update state when id is missing
        expect(mockState.responseId).toBeUndefined();
        expect(mockState.model).toBeUndefined();
      });
    });

    describe('handleResponseFailed - Malformed Events', () => {
      it('should handle null event', () => {
        const event = null;
        const sequence = 1;

        const generator = handler.handleResponseFailed(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(results[0].event).toBe('response_failed');
      });

      it('should handle undefined event', () => {
        const event = undefined;
        const sequence = 1;

        const generator = handler.handleResponseFailed(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
      });

      it('should handle event with missing error property', () => {
        const event = { notError: 'data' };
        const sequence = 1;

        const generator = handler.handleResponseFailed(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        const data = JSON.parse(results[0].data);
        expect(data.error).toBeUndefined();
      });
    });

    describe('handleErrorEvent - Malformed Events', () => {
      it('should handle null event', () => {
        const event = null;
        const sequence = 1;

        const generator = handler.handleErrorEvent(event, mockState, sequence);
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(results[0].event).toBe('error');
      });

      it('should handle undefined event', () => {
        const event = undefined;
        const sequence = 1;

        const generator = handler.handleErrorEvent(event, mockState, sequence);
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
      });

      it('should handle event with wrong type', () => {
        const event = 'error string' as unknown;
        const sequence = 1;

        const generator = handler.handleErrorEvent(event, mockState, sequence);
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(results[0].event).toBe('error');
      });
    });

    describe('Special Characters in Event Data', () => {
      it('should handle unicode in response ID', () => {
        const event = {
          response: {
            id: 'resp_你好_🌍',
            model: 'gpt-5',
          },
        };
        const sequence = 1;

        const generator = handler.handleResponseCreated(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(mockState.responseId).toBe('resp_你好_🌍');
      });

      it('should handle very long response ID (1000+ chars)', () => {
        const longId = 'resp_' + 'x'.repeat(1000);
        const event = {
          response: {
            id: longId,
            model: 'gpt-5',
          },
        };
        const sequence = 1;

        const generator = handler.handleResponseCreated(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(mockState.responseId).toBe(longId);
        expect(mockState.responseId?.length).toBe(1005); // 'resp_' (5) + 'x' * 1000
      });
    });

    describe('Invalid Sequence Numbers', () => {
      it('should handle negative sequence number', () => {
        const event = { response: { id: 'resp_123', model: 'gpt-5' } };
        const sequence = -99;

        const generator = handler.handleResponseCreated(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(results[0].sequence).toBe(-99);
      });

      it('should handle very large sequence number', () => {
        const event = { response: { id: 'resp_123', model: 'gpt-5' } };
        const sequence = Number.MAX_SAFE_INTEGER;

        const generator = handler.handleResponseCreated(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(results[0].sequence).toBe(Number.MAX_SAFE_INTEGER);
      });
    });
  });
});
