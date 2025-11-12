import { Test, TestingModule } from '@nestjs/testing';
import { ReasoningEventsHandler } from './reasoning-events.handler';
import { LoggerService } from '../../../common/services/logger.service';
import type {
  StreamState,
  SSEEvent,
} from '../../interfaces/streaming-events.interface';
import {
  createMockLoggerService,
  createMockStreamState,
} from '../../../common/testing/test.factories';

describe('ReasoningEventsHandler', () => {
  let handler: ReasoningEventsHandler;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockState: StreamState;

  beforeEach(async () => {
    // Mock LoggerService using factory
    mockLoggerService = createMockLoggerService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReasoningEventsHandler,
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    handler = module.get<ReasoningEventsHandler>(ReasoningEventsHandler);

    // Initialize mock state using factory
    mockState = createMockStreamState();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleReasoningTextDelta', () => {
    it('should yield reasoning_delta event and accumulate reasoning in state', () => {
      const event = { delta: 'Analyzing the problem...' };
      const sequence = 1;

      const generator = handler.handleReasoningTextDelta(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        event: 'reasoning_delta',
        data: JSON.stringify({
          delta: 'Analyzing the problem...',
          sequence: 1,
        }),
        sequence: 1,
      });

      // Verify state accumulation
      expect(mockState.reasoning).toBe('Analyzing the problem...');
    });

    it('should accumulate multiple reasoning deltas', () => {
      const deltas = [
        'Step 1: ',
        'Identify the issue. ',
        'Step 2: ',
        'Propose solution.',
      ];
      const sequence = 1;

      deltas.forEach((delta, index) => {
        const event = { delta };
        const generator = handler.handleReasoningTextDelta(
          event,
          mockState,
          sequence + index,
        );
        Array.from(generator);
      });

      expect(mockState.reasoning).toBe(
        'Step 1: Identify the issue. Step 2: Propose solution.',
      );
    });

    it('should log reasoning_delta event', () => {
      const event = { delta: 'Reasoning step' };
      const sequence = 5;

      const generator = handler.handleReasoningTextDelta(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'reasoning_delta',
        sequence: 5,
        delta: 'Reasoning step',
      });
    });

    it('should handle empty delta', () => {
      const event = { delta: '' };
      const sequence = 1;

      const generator = handler.handleReasoningTextDelta(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].data).toContain('"delta":""');
      expect(mockState.reasoning).toBe('');
    });

    it('should handle event without delta property', () => {
      const event = {};
      const sequence = 1;
      mockState.reasoning = 'existing reasoning';

      const generator = handler.handleReasoningTextDelta(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].data).toContain('"delta":""');
      expect(mockState.reasoning).toBe('existing reasoning'); // No change
    });
  });

  describe('handleReasoningTextDone', () => {
    it('should yield reasoning_done event with accumulated reasoning', () => {
      mockState.reasoning = 'Complete reasoning chain of thought';
      const sequence = 10;

      const generator = handler.handleReasoningTextDone(
        {},
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        event: 'reasoning_done',
        data: JSON.stringify({
          reasoning_text: 'Complete reasoning chain of thought',
          sequence: 10,
        }),
        sequence: 10,
      });
    });

    it('should log reasoning_done event', () => {
      mockState.reasoning = 'Full reasoning text';
      const sequence = 15;

      const generator = handler.handleReasoningTextDone(
        {},
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'reasoning_done',
        sequence: 15,
        response: { reasoning_text: 'Full reasoning text' },
      });
    });

    it('should handle empty reasoning', () => {
      mockState.reasoning = '';
      const sequence = 1;

      const generator = handler.handleReasoningTextDone(
        {},
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      const data = JSON.parse(results[0].data);
      expect(data.reasoning_text).toBe('');
    });
  });

  describe('handleReasoningSummaryDelta', () => {
    it('should yield reasoning_summary_delta event and accumulate summary in state', () => {
      const event = { delta: 'Summary: ' };
      const sequence = 1;

      const generator = handler.handleReasoningSummaryDelta(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        event: 'reasoning_summary_delta',
        data: JSON.stringify({ delta: 'Summary: ', sequence: 1 }),
        sequence: 1,
      });

      // Verify state accumulation
      expect(mockState.reasoningSummary).toBe('Summary: ');
    });

    it('should accumulate multiple summary deltas', () => {
      const deltas = [
        'The model ',
        'analyzed the input ',
        'and determined ',
        'the best approach.',
      ];
      const sequence = 1;

      deltas.forEach((delta, index) => {
        const event = { delta };
        const generator = handler.handleReasoningSummaryDelta(
          event,
          mockState,
          sequence + index,
        );
        Array.from(generator);
      });

      expect(mockState.reasoningSummary).toBe(
        'The model analyzed the input and determined the best approach.',
      );
    });

    it('should log reasoning_summary_delta event', () => {
      const event = { delta: 'Summary chunk' };
      const sequence = 7;

      const generator = handler.handleReasoningSummaryDelta(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'reasoning_summary_delta',
        sequence: 7,
        delta: 'Summary chunk',
      });
    });

    it('should handle empty delta', () => {
      const event = { delta: '' };
      const sequence = 1;

      const generator = handler.handleReasoningSummaryDelta(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].data).toContain('"delta":""');
      expect(mockState.reasoningSummary).toBe('');
    });

    it('should handle event without delta property', () => {
      const event = {};
      const sequence = 1;
      mockState.reasoningSummary = 'existing summary';

      const generator = handler.handleReasoningSummaryDelta(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(mockState.reasoningSummary).toBe('existing summary'); // No change
    });
  });

  describe('handleReasoningSummaryDone', () => {
    it('should yield reasoning_summary_done event with accumulated summary', () => {
      mockState.reasoningSummary = 'Complete reasoning summary';
      const sequence = 12;

      const generator = handler.handleReasoningSummaryDone(
        {},
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        event: 'reasoning_summary_done',
        data: JSON.stringify({
          reasoning_summary: 'Complete reasoning summary',
          sequence: 12,
        }),
        sequence: 12,
      });
    });

    it('should log reasoning_summary_done event', () => {
      mockState.reasoningSummary = 'Final summary';
      const sequence = 20;

      const generator = handler.handleReasoningSummaryDone(
        {},
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'reasoning_summary_done',
        sequence: 20,
        response: { reasoning_summary: 'Final summary' },
      });
    });

    it('should handle empty summary', () => {
      mockState.reasoningSummary = '';
      const sequence = 1;

      const generator = handler.handleReasoningSummaryDone(
        {},
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      const data = JSON.parse(results[0].data);
      expect(data.reasoning_summary).toBe('');
    });
  });

  describe('handleReasoningSummaryPart', () => {
    it('should yield reasoning_summary_part.added event', () => {
      const event = {
        type: 'response.reasoning_summary_part.added',
        part: {
          id: 'part_123',
          type: 'text',
          text: 'Reasoning part content',
        },
      };
      const sequence = 5;

      const generator = handler.handleReasoningSummaryPart(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        event: 'reasoning_summary_part.added',
        data: JSON.stringify({
          part: {
            id: 'part_123',
            type: 'text',
            text: 'Reasoning part content',
          },
          sequence: 5,
        }),
        sequence: 5,
      });
    });

    it('should yield reasoning_summary_part.done event', () => {
      const event = {
        type: 'response.reasoning_summary_part.done',
        part: {
          id: 'part_456',
          type: 'text',
        },
      };
      const sequence = 8;

      const generator = handler.handleReasoningSummaryPart(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('reasoning_summary_part.done');
      expect(results[0].sequence).toBe(8);
    });

    it('should log reasoning_summary_part event with original type', () => {
      const event = {
        type: 'response.reasoning_summary_part.added',
        part: { id: 'part_789' },
      };
      const sequence = 6;

      const generator = handler.handleReasoningSummaryPart(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'response.reasoning_summary_part.added',
        sequence: 6,
        response: { part: { id: 'part_789' } },
      });
    });

    it('should strip "response." prefix from event type', () => {
      const event = {
        type: 'response.reasoning_summary_part.added',
        part: { content: 'test' },
      };
      const sequence = 1;

      const generator = handler.handleReasoningSummaryPart(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results[0].event).toBe('reasoning_summary_part.added');
      expect(results[0].event).not.toContain('response.');
    });

    it('should handle event without part property', () => {
      const event = {
        type: 'response.reasoning_summary_part.done',
      };
      const sequence = 1;

      const generator = handler.handleReasoningSummaryPart(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      const data = JSON.parse(results[0].data);
      expect(data.part).toBeUndefined();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete o-series reasoning flow', () => {
      let sequence = 0;

      // Stream reasoning deltas
      const reasoningChunks = ['Step 1: ', 'Analyze. ', 'Step 2: ', 'Decide.'];
      reasoningChunks.forEach((chunk) => {
        const event = { delta: chunk };
        Array.from(
          handler.handleReasoningTextDelta(event, mockState, ++sequence),
        );
      });

      expect(mockState.reasoning).toBe('Step 1: Analyze. Step 2: Decide.');

      // Complete reasoning
      Array.from(handler.handleReasoningTextDone({}, mockState, ++sequence));

      // Stream summary deltas
      const summaryChunks = ['Model analyzed ', 'and decided.'];
      summaryChunks.forEach((chunk) => {
        const event = { delta: chunk };
        Array.from(
          handler.handleReasoningSummaryDelta(event, mockState, ++sequence),
        );
      });

      expect(mockState.reasoningSummary).toBe('Model analyzed and decided.');

      // Add summary part
      const partEvent = {
        type: 'response.reasoning_summary_part.added',
        part: { id: 'part_1', type: 'text' },
      };
      Array.from(
        handler.handleReasoningSummaryPart(partEvent, mockState, ++sequence),
      );

      // Complete summary
      Array.from(handler.handleReasoningSummaryDone({}, mockState, ++sequence));

      // Verify all events were logged
      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledTimes(9);
    });

    it('should handle reasoning without summary', () => {
      let sequence = 0;

      // Only reasoning, no summary
      const event = { delta: 'Quick reasoning' };
      Array.from(
        handler.handleReasoningTextDelta(event, mockState, ++sequence),
      );
      Array.from(handler.handleReasoningTextDone({}, mockState, ++sequence));

      expect(mockState.reasoning).toBe('Quick reasoning');
      expect(mockState.reasoningSummary).toBe('');
      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledTimes(2);
    });

    it('should handle summary without detailed reasoning', () => {
      let sequence = 0;

      // Only summary, no detailed reasoning
      const event = { delta: 'Summary only' };
      Array.from(
        handler.handleReasoningSummaryDelta(event, mockState, ++sequence),
      );
      Array.from(handler.handleReasoningSummaryDone({}, mockState, ++sequence));

      expect(mockState.reasoning).toBe('');
      expect(mockState.reasoningSummary).toBe('Summary only');
      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledTimes(2);
    });

    it('should maintain separate reasoning and summary state', () => {
      let sequence = 0;

      // Add reasoning
      Array.from(
        handler.handleReasoningTextDelta(
          { delta: 'Reasoning' },
          mockState,
          ++sequence,
        ),
      );
      Array.from(handler.handleReasoningTextDone({}, mockState, ++sequence));

      // Add summary
      Array.from(
        handler.handleReasoningSummaryDelta(
          { delta: 'Summary' },
          mockState,
          ++sequence,
        ),
      );
      Array.from(handler.handleReasoningSummaryDone({}, mockState, ++sequence));

      // Verify both are maintained separately
      expect(mockState.reasoning).toBe('Reasoning');
      expect(mockState.reasoningSummary).toBe('Summary');
    });

    it('should handle multiple summary parts in sequence', () => {
      const parts = [
        {
          type: 'response.reasoning_summary_part.added',
          part: { id: 'part_1', order: 1 },
        },
        {
          type: 'response.reasoning_summary_part.added',
          part: { id: 'part_2', order: 2 },
        },
        {
          type: 'response.reasoning_summary_part.done',
          part: { id: 'part_2' },
        },
      ];

      parts.forEach((event, index) => {
        Array.from(
          handler.handleReasoningSummaryPart(event, mockState, index + 1),
        );
      });

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledTimes(3);
      expect(mockLoggerService.logStreamingEvent).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          event_type: 'response.reasoning_summary_part.added',
        }),
      );
      expect(mockLoggerService.logStreamingEvent).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          event_type: 'response.reasoning_summary_part.done',
        }),
      );
    });
  });

  describe('Error Handling & Edge Cases', () => {
    describe('handleReasoningTextDelta - Malformed Events', () => {
      it('should handle null event', () => {
        const event = null;
        const sequence = 1;

        const generator = handler.handleReasoningTextDelta(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(results[0].event).toBe('reasoning_delta');
        expect(mockState.reasoning).toBe('');
      });

      it('should handle undefined event', () => {
        const event = undefined;
        const sequence = 1;

        const generator = handler.handleReasoningTextDelta(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(mockState.reasoning).toBe('');
      });

      it('should handle event with wrong type (string)', () => {
        const event = 'invalid string event' as unknown;
        const sequence = 1;

        const generator = handler.handleReasoningTextDelta(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(mockState.reasoning).toBe('');
      });

      it('should handle event with wrong type (number)', () => {
        const event = 12345 as unknown;
        const sequence = 1;

        const generator = handler.handleReasoningTextDelta(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(mockState.reasoning).toBe('');
      });

      it('should handle delta with wrong type (number)', () => {
        const event = { delta: 12345 };
        const sequence = 1;

        const generator = handler.handleReasoningTextDelta(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(mockState.reasoning).toBe('12345');
      });
    });

    describe('handleReasoningSummaryDelta - Malformed Events', () => {
      it('should handle null event', () => {
        const event = null;
        const sequence = 1;

        const generator = handler.handleReasoningSummaryDelta(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(results[0].event).toBe('reasoning_summary_delta');
        expect(mockState.reasoningSummary).toBe('');
      });

      it('should handle undefined event', () => {
        const event = undefined;
        const sequence = 1;

        const generator = handler.handleReasoningSummaryDelta(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(mockState.reasoningSummary).toBe('');
      });

      it('should handle event with wrong type', () => {
        const event = 'invalid' as unknown;
        const sequence = 1;

        const generator = handler.handleReasoningSummaryDelta(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(mockState.reasoningSummary).toBe('');
      });
    });

    describe('handleReasoningSummaryPart - Malformed Events', () => {
      it('should handle null event', () => {
        const event = null;
        const sequence = 1;

        const generator = handler.handleReasoningSummaryPart(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        // Should still yield an event even with null
        expect(results[0].event).toBeDefined();
      });

      it('should handle undefined event', () => {
        const event = undefined;
        const sequence = 1;

        const generator = handler.handleReasoningSummaryPart(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
      });

      it('should handle event with missing type property', () => {
        const event = { part: { id: 'part_1' } };
        const sequence = 1;

        const generator = handler.handleReasoningSummaryPart(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        // Should handle missing type gracefully
        expect(results[0]).toBeDefined();
      });
    });

    describe('Special Characters & Encoding', () => {
      it('should handle unicode characters in reasoning', () => {
        const event = { delta: '你好世界 🌍 مرحبا' };
        const sequence = 1;

        const generator = handler.handleReasoningTextDelta(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(mockState.reasoning).toBe('你好世界 🌍 مرحبا');
      });

      it('should handle emojis in reasoning summary', () => {
        const event = { delta: '😀 👍 💯 ✨' };
        const sequence = 1;

        const generator = handler.handleReasoningSummaryDelta(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(mockState.reasoningSummary).toBe('😀 👍 💯 ✨');
      });

      it('should handle control characters', () => {
        const event = { delta: 'Line1\nLine2\tTabbed' };
        const sequence = 1;

        const generator = handler.handleReasoningTextDelta(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(mockState.reasoning).toBe('Line1\nLine2\tTabbed');
      });
    });

    describe('Invalid Sequence Numbers', () => {
      it('should handle negative sequence number', () => {
        const event = { delta: 'test' };
        const sequence = -1;

        const generator = handler.handleReasoningTextDelta(
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

        const generator = handler.handleReasoningTextDelta(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(results[0].sequence).toBe(Number.MAX_SAFE_INTEGER);
      });

      it('should handle zero sequence number', () => {
        const event = { delta: 'test' };
        const sequence = 0;

        const generator = handler.handleReasoningTextDelta(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(results[0].sequence).toBe(0);
      });
    });

    describe('State Overflow Scenarios', () => {
      it('should handle very long reasoning accumulation (10k+ characters)', () => {
        const longText = 'x'.repeat(10000);
        const event = { delta: longText };
        const sequence = 1;

        const generator = handler.handleReasoningTextDelta(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(mockState.reasoning).toBe(longText);
        expect(mockState.reasoning.length).toBe(10000);
      });

      it('should handle multiple large reasoning deltas accumulating to 50k+ characters', () => {
        const largeChunk = 'A'.repeat(10000);

        for (let i = 0; i < 6; i++) {
          const event = { delta: largeChunk };
          const generator = handler.handleReasoningTextDelta(
            event,
            mockState,
            i + 1,
          );
          Array.from(generator);
        }

        expect(mockState.reasoning.length).toBe(60000);
        expect(mockState.reasoning).toBe(largeChunk.repeat(6));
      });
    });
  });
});
