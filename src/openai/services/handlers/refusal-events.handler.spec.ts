import { Test, TestingModule } from '@nestjs/testing';
import { RefusalEventsHandler } from './refusal-events.handler';
import { LoggerService } from '../../../common/services/logger.service';
import type {
  StreamState,
  SSEEvent,
} from '../../interfaces/streaming-events.interface';
import {
  createMockLoggerService,
  createMockStreamState,
} from '../../../common/testing/test.factories';

// Test data interfaces
interface RefusalDoneData {
  refusal: string;
  sequence: number;
}

describe('RefusalEventsHandler', () => {
  let handler: RefusalEventsHandler;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockState: StreamState;

  beforeEach(async () => {
    // Mock LoggerService using factory
    mockLoggerService = createMockLoggerService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefusalEventsHandler,
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    handler = module.get<RefusalEventsHandler>(RefusalEventsHandler);

    // Initialize mock state using factory
    mockState = createMockStreamState();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleRefusalDelta', () => {
    it('should yield refusal_delta event and accumulate refusal in state', () => {
      const event = { delta: 'I cannot ' };
      const sequence = 1;

      const generator = handler.handleRefusalDelta(event, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        event: 'refusal_delta',
        data: JSON.stringify({ delta: 'I cannot ', sequence: 1 }),
        sequence: 1,
      });

      expect(mockState.refusal).toBe('I cannot ');
    });

    it('should accumulate multiple refusal deltas', () => {
      const deltas = ['I ', 'cannot ', 'assist ', 'with ', 'that.'];

      deltas.forEach((delta, index) => {
        const event = { delta };
        Array.from(handler.handleRefusalDelta(event, mockState, index + 1));
      });

      expect(mockState.refusal).toBe('I cannot assist with that.');
    });

    it('should log refusal_delta event', () => {
      const event = { delta: 'refusal message' };
      const sequence = 5;

      Array.from(handler.handleRefusalDelta(event, mockState, sequence));

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String) as string,
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'refusal_delta',
        sequence: 5,
        delta: 'refusal message',
      });
    });

    it('should handle empty delta', () => {
      const event = { delta: '' };
      const sequence = 1;

      Array.from(handler.handleRefusalDelta(event, mockState, sequence));

      expect(mockState.refusal).toBe('');
    });

    it('should handle event without delta property', () => {
      const event = {};
      const sequence = 1;
      mockState.refusal = 'existing';

      Array.from(handler.handleRefusalDelta(event, mockState, sequence));

      expect(mockState.refusal).toBe('existing');
    });
  });

  describe('handleRefusalDone', () => {
    it('should yield refusal_done event with complete refusal message', () => {
      mockState.refusal = 'I cannot assist with this request.';
      const sequence = 10;

      const generator = handler.handleRefusalDone({}, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        event: 'refusal_done',
        data: JSON.stringify({
          refusal: 'I cannot assist with this request.',
          sequence: 10,
        }),
        sequence: 10,
      });
    });

    it('should log refusal_done event', () => {
      mockState.refusal = 'Refusal complete';
      const sequence = 15;

      Array.from(handler.handleRefusalDone({}, mockState, sequence));

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String) as string,
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'refusal_done',
        sequence: 15,
        response: { refusal: 'Refusal complete' },
      });
    });

    it('should handle empty refusal', () => {
      mockState.refusal = '';
      const sequence = 1;

      const generator = handler.handleRefusalDone({}, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      const data = JSON.parse(results[0].data) as RefusalDoneData;
      expect(data.refusal).toBe('');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete refusal streaming flow', () => {
      let sequence = 0;

      // Stream refusal message
      const refusalChunks = [
        'I ',
        'apologize, ',
        'but ',
        'I ',
        'cannot ',
        'provide ',
        'that ',
        'information.',
      ];
      refusalChunks.forEach((chunk) => {
        Array.from(
          handler.handleRefusalDelta({ delta: chunk }, mockState, ++sequence),
        );
      });

      // Complete refusal
      Array.from(handler.handleRefusalDone({}, mockState, ++sequence));

      expect(mockState.refusal).toBe(
        'I apologize, but I cannot provide that information.',
      );
      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledTimes(9);
    });

    it('should handle policy violation refusal', () => {
      let sequence = 0;

      const policyRefusal =
        'This request violates our content policy. I cannot assist with creating harmful content.';
      Array.from(
        handler.handleRefusalDelta(
          { delta: policyRefusal },
          mockState,
          ++sequence,
        ),
      );
      Array.from(handler.handleRefusalDone({}, mockState, ++sequence));

      expect(mockState.refusal).toBe(policyRefusal);
      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling & Edge Cases', () => {
    describe('handleRefusalDelta - Malformed Events', () => {
      it('should handle null event', () => {
        const event = null;
        const sequence = 1;

        const generator = handler.handleRefusalDelta(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(results[0].event).toBe('refusal_delta');
        expect(mockState.refusal).toBe('');
      });

      it('should handle undefined event', () => {
        const event = undefined;
        const sequence = 1;

        const generator = handler.handleRefusalDelta(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(mockState.refusal).toBe('');
      });

      it('should handle event with wrong type', () => {
        const event = 12345 as unknown;
        const sequence = 1;

        const generator = handler.handleRefusalDelta(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(mockState.refusal).toBe('');
      });
    });

    describe('Special Characters & Unicode', () => {
      it('should handle unicode in refusal message', () => {
        const event = { delta: '你好 🌍 مرحبا' };
        const sequence = 1;

        const generator = handler.handleRefusalDelta(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(mockState.refusal).toBe('你好 🌍 مرحبا');
      });

      it('should handle emojis in refusal', () => {
        const event = { delta: '❌ 🚫 ⛔' };
        const sequence = 1;

        const generator = handler.handleRefusalDelta(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(mockState.refusal).toBe('❌ 🚫 ⛔');
      });
    });

    describe('Invalid Sequence Numbers', () => {
      it('should handle negative sequence number', () => {
        const event = { delta: 'test' };
        const sequence = -1;

        const generator = handler.handleRefusalDelta(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(results[0].sequence).toBe(-1);
      });

      it('should handle very large sequence number', () => {
        const event = { delta: 'test' };
        const sequence = Number.MAX_SAFE_INTEGER;

        const generator = handler.handleRefusalDelta(
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
