import { Test, TestingModule } from '@nestjs/testing';
import { StructuralEventsHandler } from './structural-events.handler';
import { LoggerService } from '../../../common/services/logger.service';
import type {
  StreamState,
  SSEEvent,
} from '../../interfaces/streaming-events.interface';
import {
  createMockLoggerService,
  createMockStreamState,
} from '../../../common/testing/test.factories';

describe('StructuralEventsHandler', () => {
  let handler: StructuralEventsHandler;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockState: StreamState;

  beforeEach(async () => {
    // Mock LoggerService using factory
    mockLoggerService = createMockLoggerService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StructuralEventsHandler,
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    handler = module.get<StructuralEventsHandler>(StructuralEventsHandler);

    // Initialize mock state using factory
    mockState = createMockStreamState();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleStructuralEvent', () => {
    it('should yield output_item.added event', () => {
      const event = {
        type: 'response.output_item.added',
        item: { id: 'item_123', type: 'message', content: [] },
      };
      const sequence = 1;

      const generator = handler.handleStructuralEvent(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('output_item.added');

      const data = JSON.parse(results[0].data);
      expect(data.item).toEqual({
        id: 'item_123',
        type: 'message',
        content: [],
      });
    });

    it('should yield output_item.done event', () => {
      const event = {
        type: 'response.output_item.done',
        item: { id: 'item_456', type: 'message' },
      };
      const sequence = 5;

      const generator = handler.handleStructuralEvent(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('output_item.done');
    });

    it('should yield content_part.added event', () => {
      const event = {
        type: 'response.content_part.added',
        part: { id: 'part_123', type: 'text' },
      };
      const sequence = 2;

      const generator = handler.handleStructuralEvent(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('content_part.added');

      const data = JSON.parse(results[0].data);
      expect(data.part).toEqual({ id: 'part_123', type: 'text' });
    });

    it('should yield content_part.done event', () => {
      const event = {
        type: 'response.content_part.done',
        part: { id: 'part_789' },
      };
      const sequence = 8;

      const generator = handler.handleStructuralEvent(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('content_part.done');
    });

    it('should strip "response." prefix from event type', () => {
      const event = {
        type: 'response.output_item.added',
        item: { id: 'item_test' },
      };
      const sequence = 1;

      const generator = handler.handleStructuralEvent(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results[0].event).toBe('output_item.added');
      expect(results[0].event).not.toContain('response.');
    });

    it('should log structural event', () => {
      const event = {
        type: 'response.output_item.added',
        item: { id: 'item_log' },
      };
      const sequence = 3;

      Array.from(handler.handleStructuralEvent(event, mockState, sequence));

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'response.output_item.added',
        sequence: 3,
        response: { item: { id: 'item_log' }, part: undefined },
      });
    });

    it('should handle event with both item and part', () => {
      const event = {
        type: 'response.content_part.added',
        item: { id: 'item_abc' },
        part: { id: 'part_abc' },
      };
      const sequence = 5;

      const generator = handler.handleStructuralEvent(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      const data = JSON.parse(results[0].data);
      expect(data.item).toEqual({ id: 'item_abc' });
      expect(data.part).toEqual({ id: 'part_abc' });
    });
  });

  describe('handleUnknownEvent', () => {
    it('should yield unknown_event for unrecognized event types', () => {
      const event = {
        type: 'response.future_feature.new_event',
        some_data: 'test',
      };
      const sequence = 1;

      const generator = handler.handleUnknownEvent(event, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        event: 'unknown_event',
        data: JSON.stringify({
          type: 'response.future_feature.new_event',
          sequence: 1,
        }),
        sequence: 1,
      });
    });

    it('should log unknown event with full event data', () => {
      const event = {
        type: 'response.experimental.beta',
        data: { test: true },
      };
      const sequence = 10;

      Array.from(handler.handleUnknownEvent(event, mockState, sequence));

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'unknown_event',
        sequence: 10,
        response: {
          unknown_type: 'response.experimental.beta',
          event: { type: 'response.experimental.beta', data: { test: true } },
        },
      });
    });

    it('should handle unknown event without type', () => {
      const event = { unexpected_field: 'value' };
      const sequence = 5;

      const generator = handler.handleUnknownEvent(event, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      const data = JSON.parse(results[0].data);
      expect(data.type).toBeUndefined();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete structural event sequence', () => {
      let sequence = 0;

      // Output item added
      Array.from(
        handler.handleStructuralEvent(
          {
            type: 'response.output_item.added',
            item: { id: 'item_1', type: 'message', content: [] },
          },
          mockState,
          ++sequence,
        ),
      );

      // Content parts added
      Array.from(
        handler.handleStructuralEvent(
          {
            type: 'response.content_part.added',
            part: { id: 'part_1', type: 'text' },
          },
          mockState,
          ++sequence,
        ),
      );

      Array.from(
        handler.handleStructuralEvent(
          {
            type: 'response.content_part.added',
            part: { id: 'part_2', type: 'tool_use' },
          },
          mockState,
          ++sequence,
        ),
      );

      // Content parts done
      Array.from(
        handler.handleStructuralEvent(
          { type: 'response.content_part.done', part: { id: 'part_1' } },
          mockState,
          ++sequence,
        ),
      );

      Array.from(
        handler.handleStructuralEvent(
          { type: 'response.content_part.done', part: { id: 'part_2' } },
          mockState,
          ++sequence,
        ),
      );

      // Output item done
      Array.from(
        handler.handleStructuralEvent(
          { type: 'response.output_item.done', item: { id: 'item_1' } },
          mockState,
          ++sequence,
        ),
      );

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledTimes(6);
    });

    it('should handle future-proofing with unknown events', () => {
      let sequence = 0;

      // Known event
      Array.from(
        handler.handleStructuralEvent(
          { type: 'response.output_item.added', item: {} },
          mockState,
          ++sequence,
        ),
      );

      // Unknown future event
      Array.from(
        handler.handleUnknownEvent(
          { type: 'response.future_api.v2_feature' },
          mockState,
          ++sequence,
        ),
      );

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledTimes(2);
      expect(mockLoggerService.logStreamingEvent).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ event_type: 'unknown_event' }),
      );
    });
  });

  describe('Error Handling & Edge Cases', () => {
    describe('handleStructuralEvent - Malformed Events', () => {
      it('should handle null event', () => {
        const event = null;
        const sequence = 1;

        const generator = handler.handleStructuralEvent(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
      });

      it('should handle undefined event', () => {
        const event = undefined;
        const sequence = 1;

        const generator = handler.handleStructuralEvent(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
      });

      it('should handle event with wrong type', () => {
        const event = 'invalid' as unknown;
        const sequence = 1;

        const generator = handler.handleStructuralEvent(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
      });
    });

    describe('handleUnknownEvent - Malformed Events', () => {
      it('should handle null event', () => {
        const event = null;
        const sequence = 1;

        const generator = handler.handleUnknownEvent(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(results[0].event).toBe('unknown_event');
      });

      it('should handle undefined event', () => {
        const event = undefined;
        const sequence = 1;

        const generator = handler.handleUnknownEvent(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
      });
    });

    describe('Invalid Sequence Numbers', () => {
      it('should handle negative sequence number', () => {
        const event = { type: 'response.output_item.added', item: {} };
        const sequence = -1;

        const generator = handler.handleStructuralEvent(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(results[0].sequence).toBe(-1);
      });

      it('should handle very large sequence number', () => {
        const event = { type: 'response.output_item.added', item: {} };
        const sequence = Number.MAX_SAFE_INTEGER;

        const generator = handler.handleStructuralEvent(
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
