import { Test, TestingModule } from '@nestjs/testing';
import { TextEventsHandler } from './text-events.handler';
import { LoggerService } from '../../../common/services/logger.service';
import type {
  StreamState,
  SSEEvent,
} from '../../interfaces/streaming-events.interface';
import {
  createMockLoggerService,
  createMockStreamState,
} from '../../../common/testing/test.factories';

describe('TextEventsHandler', () => {
  let handler: TextEventsHandler;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockState: StreamState;

  beforeEach(async () => {
    // Mock LoggerService using factory
    mockLoggerService = createMockLoggerService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TextEventsHandler,
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    handler = module.get<TextEventsHandler>(TextEventsHandler);

    // Initialize mock state using factory
    mockState = createMockStreamState();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleTextDelta', () => {
    it('should yield text_delta event and accumulate text in state', () => {
      const event = { delta: 'Hello' };
      const sequence = 1;

      const generator = handler.handleTextDelta(event, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        event: 'text_delta',
        data: JSON.stringify({ delta: 'Hello', sequence: 1 }),
        sequence: 1,
      });

      // Verify state accumulation
      expect(mockState.fullText).toBe('Hello');
    });

    it('should accumulate multiple text deltas', () => {
      const deltas = ['Hello', ' ', 'world', '!'];
      const sequence = 1;

      deltas.forEach((delta, index) => {
        const event = { delta };
        const generator = handler.handleTextDelta(
          event,
          mockState,
          sequence + index,
        );
        Array.from(generator);
      });

      expect(mockState.fullText).toBe('Hello world!');
    });

    it('should log text_delta event', () => {
      const event = { delta: 'Test text' };
      const sequence = 5;

      const generator = handler.handleTextDelta(event, mockState, sequence);
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'text_delta',
        sequence: 5,
        delta: 'Test text',
      });
    });

    it('should handle empty delta', () => {
      const event = { delta: '' };
      const sequence = 1;

      const generator = handler.handleTextDelta(event, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].data).toContain('"delta":""');
      expect(mockState.fullText).toBe('');
    });

    it('should handle event without delta property', () => {
      const event = {};
      const sequence = 1;
      mockState.fullText = 'existing';

      const generator = handler.handleTextDelta(event, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].data).toContain('"delta":""');
      expect(mockState.fullText).toBe('existing'); // No change
    });

    it('should handle special characters in delta', () => {
      const event = { delta: '{"key": "value"}\n\t' };
      const sequence = 1;

      const generator = handler.handleTextDelta(event, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      // JSON.stringify should properly escape special characters
      const data = JSON.parse(results[0].data);
      expect(data.delta).toBe('{"key": "value"}\n\t');
      expect(mockState.fullText).toBe('{"key": "value"}\n\t');
    });

    it('should handle unicode characters', () => {
      const event = { delta: '你好世界 🌍' };
      const sequence = 1;

      const generator = handler.handleTextDelta(event, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      const data = JSON.parse(results[0].data);
      expect(data.delta).toBe('你好世界 🌍');
      expect(mockState.fullText).toBe('你好世界 🌍');
    });
  });

  describe('handleTextDone', () => {
    it('should yield text_done event with accumulated text', () => {
      mockState.fullText = 'Complete response text';
      mockState.startTime = Date.now() - 1000; // 1 second ago
      const sequence = 10;

      const generator = handler.handleTextDone({}, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('text_done');
      expect(results[0].sequence).toBe(10);

      const data = JSON.parse(results[0].data);
      expect(data).toEqual({
        output_text: 'Complete response text',
        sequence: 10,
      });
    });

    it('should calculate latency correctly', () => {
      const startTime = Date.now() - 2500; // 2.5 seconds ago
      mockState.startTime = startTime;
      mockState.fullText = 'Response';
      const sequence = 10;

      const generator = handler.handleTextDone({}, mockState, sequence);
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'text_done',
        sequence: 10,
        response: { output_text: 'Response' },
        metadata: {
          latency_ms: expect.any(Number),
        },
      });

      // Verify latency is approximately 2500ms (with some tolerance)
      const logCall = mockLoggerService.logStreamingEvent.mock.calls[0][0];
      const latency = (logCall as { metadata?: { latency_ms?: number } })
        .metadata?.latency_ms;
      expect(latency).toBeGreaterThanOrEqual(2400);
      expect(latency).toBeLessThanOrEqual(2600);
    });

    it('should log text_done event with metadata', () => {
      mockState.fullText = 'Final text';
      mockState.startTime = Date.now() - 500;
      const sequence = 15;

      const generator = handler.handleTextDone({}, mockState, sequence);
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'text_done',
        sequence: 15,
        response: { output_text: 'Final text' },
        metadata: { latency_ms: expect.any(Number) },
      });
    });

    it('should handle empty fullText', () => {
      mockState.fullText = '';
      mockState.startTime = Date.now();
      const sequence = 1;

      const generator = handler.handleTextDone({}, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      const data = JSON.parse(results[0].data);
      expect(data.output_text).toBe('');
    });

    it('should handle very long text', () => {
      const longText = 'A'.repeat(10000);
      mockState.fullText = longText;
      mockState.startTime = Date.now();
      const sequence = 1;

      const generator = handler.handleTextDone({}, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      const data = JSON.parse(results[0].data);
      expect(data.output_text).toBe(longText);
      expect(data.output_text.length).toBe(10000);
    });
  });

  describe('handleTextAnnotation', () => {
    it('should yield text_annotation event with annotation data', () => {
      const event = {
        annotation: {
          type: 'citation',
          text: 'Source reference',
          start_index: 10,
          end_index: 25,
        },
      };
      const sequence = 7;

      const generator = handler.handleTextAnnotation(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        event: 'text_annotation',
        data: JSON.stringify({
          annotation: {
            type: 'citation',
            text: 'Source reference',
            start_index: 10,
            end_index: 25,
          },
          sequence: 7,
        }),
        sequence: 7,
      });
    });

    it('should log text_annotation event', () => {
      const event = {
        annotation: {
          type: 'file_citation',
          file_id: 'file_123',
        },
      };
      const sequence = 8;

      const generator = handler.handleTextAnnotation(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'text_annotation',
        sequence: 8,
        response: {
          annotation: {
            type: 'file_citation',
            file_id: 'file_123',
          },
        },
      });
    });

    it('should handle event without annotation property', () => {
      const event = {};
      const sequence = 1;

      const generator = handler.handleTextAnnotation(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      const data = JSON.parse(results[0].data);
      expect(data.annotation).toBeUndefined();
    });

    it('should handle complex annotation objects', () => {
      const event = {
        annotation: {
          type: 'file_path',
          text: 'document.pdf',
          file_citation: {
            file_id: 'file_abc123',
            quote: 'Referenced quote from document',
          },
          start_index: 0,
          end_index: 12,
        },
      };
      const sequence = 5;

      const generator = handler.handleTextAnnotation(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      const data = JSON.parse(results[0].data);
      expect(data.annotation).toEqual(event.annotation);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete text streaming flow', () => {
      const textChunks = ['Hello', ' ', 'World', '!'];
      let sequence = 0;

      // Stream text deltas
      textChunks.forEach((chunk) => {
        const event = { delta: chunk };
        const generator = handler.handleTextDelta(event, mockState, ++sequence);
        Array.from(generator);
      });

      expect(mockState.fullText).toBe('Hello World!');

      // Add annotation
      const annotationEvent = {
        annotation: { type: 'citation', text: 'Source' },
      };
      Array.from(
        handler.handleTextAnnotation(annotationEvent, mockState, ++sequence),
      );

      // Complete text
      Array.from(handler.handleTextDone({}, mockState, ++sequence));

      // Verify all events were logged
      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledTimes(6);
      expect(mockLoggerService.logStreamingEvent).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ event_type: 'text_delta' }),
      );
      expect(mockLoggerService.logStreamingEvent).toHaveBeenNthCalledWith(
        5,
        expect.objectContaining({ event_type: 'text_annotation' }),
      );
      expect(mockLoggerService.logStreamingEvent).toHaveBeenNthCalledWith(
        6,
        expect.objectContaining({ event_type: 'text_done' }),
      );
    });

    it('should handle streaming with no deltas (empty response)', () => {
      // No deltas, just completion
      const generator = handler.handleTextDone({}, mockState, 1);
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      const data = JSON.parse(results[0].data);
      expect(data.output_text).toBe('');
    });

    it('should maintain state.fullText across multiple calls', () => {
      // Simulate streaming session with state persistence
      mockState.fullText = 'Existing text. ';

      const event1 = { delta: 'New ' };
      const event2 = { delta: 'content.' };

      Array.from(handler.handleTextDelta(event1, mockState, 1));
      Array.from(handler.handleTextDelta(event2, mockState, 2));

      expect(mockState.fullText).toBe('Existing text. New content.');

      const doneResults = Array.from(handler.handleTextDone({}, mockState, 3));
      const data = JSON.parse(doneResults[0].data);
      expect(data.output_text).toBe('Existing text. New content.');
    });
  });

  // Advanced Features: Metadata Extraction Tests
  describe('Advanced Features - logprobs extraction', () => {
    it('should extract logprobs from text_delta event', () => {
      const event = {
        delta: 'Hello',
        logprobs: [
          { token: 'Hello', logprob: -0.5, bytes: [72, 101, 108, 108, 111] },
        ],
      };

      const generator = handler.handleTextDelta(event, mockState, 1);
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      const data = JSON.parse(results[0].data);
      expect(data.logprobs).toEqual(event.logprobs);
    });

    it('should extract logprobs from text_done event', () => {
      const event = {
        text: 'Complete text',
        logprobs: [
          { token: 'Complete', logprob: -0.3 },
          { token: ' text', logprob: -0.4 },
        ],
      };

      const generator = handler.handleTextDone(event, mockState, 2);
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      const data = JSON.parse(results[0].data);
      expect(data.logprobs).toEqual(event.logprobs);
    });

    it('should log logprobs in text_delta event', () => {
      const event = {
        delta: 'Test',
        logprobs: [{ token: 'Test', logprob: -0.2 }],
      };

      Array.from(handler.handleTextDelta(event, mockState, 1));

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'text_delta',
          logprobs: event.logprobs,
        }),
      );
    });

    it('should not include logprobs when not present', () => {
      const event = { delta: 'No logprobs' };

      const generator = handler.handleTextDelta(event, mockState, 1);
      const results: SSEEvent[] = Array.from(generator);

      const data = JSON.parse(results[0].data);
      expect(data.logprobs).toBeUndefined();
    });
  });

  describe('Advanced Features - multi-part metadata extraction', () => {
    it('should extract content_index from text_delta', () => {
      const event = {
        delta: 'Part 1',
        content_index: 0,
      };

      const generator = handler.handleTextDelta(event, mockState, 1);
      const results: SSEEvent[] = Array.from(generator);

      const data = JSON.parse(results[0].data);
      expect(data.content_index).toBe(0);
    });

    it('should extract item_id from text_delta', () => {
      const event = {
        delta: 'Text',
        item_id: 'item_abc123',
      };

      const generator = handler.handleTextDelta(event, mockState, 1);
      const results: SSEEvent[] = Array.from(generator);

      const data = JSON.parse(results[0].data);
      expect(data.item_id).toBe('item_abc123');
    });

    it('should extract output_index from text_delta', () => {
      const event = {
        delta: 'Output',
        output_index: 2,
      };

      const generator = handler.handleTextDelta(event, mockState, 1);
      const results: SSEEvent[] = Array.from(generator);

      const data = JSON.parse(results[0].data);
      expect(data.output_index).toBe(2);
    });

    it('should extract all metadata fields together in text_delta', () => {
      const event = {
        delta: 'Full metadata',
        logprobs: [{ token: 'Full', logprob: -0.1 }],
        content_index: 1,
        item_id: 'item_xyz',
        output_index: 3,
      };

      const generator = handler.handleTextDelta(event, mockState, 1);
      const results: SSEEvent[] = Array.from(generator);

      const data = JSON.parse(results[0].data);
      expect(data.logprobs).toEqual(event.logprobs);
      expect(data.content_index).toBe(1);
      expect(data.item_id).toBe('item_xyz');
      expect(data.output_index).toBe(3);
    });

    it('should extract all metadata fields in text_done', () => {
      const event = {
        text: 'Complete',
        logprobs: [{ token: 'Complete', logprob: -0.25 }],
        content_index: 0,
        item_id: 'item_final',
        output_index: 1,
      };

      const generator = handler.handleTextDone(event, mockState, 5);
      const results: SSEEvent[] = Array.from(generator);

      const data = JSON.parse(results[0].data);
      expect(data.logprobs).toEqual(event.logprobs);
      expect(data.content_index).toBe(0);
      expect(data.item_id).toBe('item_final');
      expect(data.output_index).toBe(1);
    });

    it('should log all metadata fields in text_delta', () => {
      const event = {
        delta: 'Logged',
        logprobs: [{ token: 'Log', logprob: -0.15 }],
        content_index: 2,
        item_id: 'item_log',
        output_index: 4,
      };

      Array.from(handler.handleTextDelta(event, mockState, 10));

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'text_delta',
          logprobs: event.logprobs,
          content_index: 2,
          item_id: 'item_log',
          output_index: 4,
          sequence: 10,
        }),
      );
    });

    it('should handle content_index of 0 (falsy value)', () => {
      const event = {
        delta: 'First part',
        content_index: 0,
      };

      const generator = handler.handleTextDelta(event, mockState, 1);
      const results: SSEEvent[] = Array.from(generator);

      const data = JSON.parse(results[0].data);
      expect(data.content_index).toBe(0);
      expect(data).toHaveProperty('content_index');
    });

    it('should handle output_index of 0 (falsy value)', () => {
      const event = {
        delta: 'First output',
        output_index: 0,
      };

      const generator = handler.handleTextDelta(event, mockState, 1);
      const results: SSEEvent[] = Array.from(generator);

      const data = JSON.parse(results[0].data);
      expect(data.output_index).toBe(0);
      expect(data).toHaveProperty('output_index');
    });

    it('should not include metadata when not present', () => {
      const event = { delta: 'Basic event' };

      const generator = handler.handleTextDelta(event, mockState, 1);
      const results: SSEEvent[] = Array.from(generator);

      const data = JSON.parse(results[0].data);
      expect(data.logprobs).toBeUndefined();
      expect(data.content_index).toBeUndefined();
      expect(data.item_id).toBeUndefined();
      expect(data.output_index).toBeUndefined();
    });
  });

  describe('Error Handling & Edge Cases', () => {
    describe('handleTextDelta - Malformed Events', () => {
      it('should handle null event', () => {
        const event = null;
        const sequence = 1;

        const generator = handler.handleTextDelta(event, mockState, sequence);
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(results[0].event).toBe('text_delta');
        // Should use empty string as fallback
        expect(mockState.fullText).toBe('');
      });

      it('should handle undefined event', () => {
        const event = undefined;
        const sequence = 1;

        const generator = handler.handleTextDelta(event, mockState, sequence);
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(mockState.fullText).toBe('');
      });

      it('should handle event with wrong type (string)', () => {
        const event = 'invalid string event' as unknown;
        const sequence = 1;

        const generator = handler.handleTextDelta(event, mockState, sequence);
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(mockState.fullText).toBe('');
      });

      it('should handle event with wrong type (number)', () => {
        const event = 12345 as unknown;
        const sequence = 1;

        const generator = handler.handleTextDelta(event, mockState, sequence);
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(mockState.fullText).toBe('');
      });

      it('should handle event with wrong type (array)', () => {
        const event = ['array', 'event'] as unknown;
        const sequence = 1;

        const generator = handler.handleTextDelta(event, mockState, sequence);
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(mockState.fullText).toBe('');
      });

      it('should handle delta with wrong type (number)', () => {
        const event = { delta: 12345 };
        const sequence = 1;

        const generator = handler.handleTextDelta(event, mockState, sequence);
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        // JavaScript coerces number to string in concatenation
        expect(mockState.fullText).toBe('12345');
      });

      it('should handle delta with wrong type (object)', () => {
        const event = { delta: { nested: 'object' } };
        const sequence = 1;

        const generator = handler.handleTextDelta(event, mockState, sequence);
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        // JavaScript coerces object to "[object Object]" in concatenation
        expect(mockState.fullText).toBe('[object Object]');
      });
    });

    describe('handleTextDone - Malformed Events', () => {
      it('should handle null event', () => {
        mockState.fullText = 'existing text';
        const event = null;
        const sequence = 1;

        const generator = handler.handleTextDone(event, mockState, sequence);
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        const data = JSON.parse(results[0].data);
        // Should fallback to state.fullText
        expect(data.output_text).toBe('existing text');
      });

      it('should handle undefined event', () => {
        mockState.fullText = 'fallback text';
        const event = undefined;
        const sequence = 1;

        const generator = handler.handleTextDone(event, mockState, sequence);
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        const data = JSON.parse(results[0].data);
        expect(data.output_text).toBe('fallback text');
      });

      it('should handle event with wrong type (string)', () => {
        mockState.fullText = 'state text';
        const event = 'invalid' as unknown;
        const sequence = 1;

        const generator = handler.handleTextDone(event, mockState, sequence);
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        const data = JSON.parse(results[0].data);
        expect(data.output_text).toBe('state text');
      });

      it('should handle text with wrong type (number)', () => {
        mockState.fullText = 'fallback';
        const event = { text: 12345 };
        const sequence = 1;

        const generator = handler.handleTextDone(event, mockState, sequence);
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        const data = JSON.parse(results[0].data);
        // JavaScript coerces number to string - number is truthy so || doesn't trigger
        expect(data.output_text).toBe(12345);
      });
    });

    describe('handleTextAnnotation - Malformed Events', () => {
      it('should handle null event', () => {
        const event = null;
        const sequence = 1;

        const generator = handler.handleTextAnnotation(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        const data = JSON.parse(results[0].data);
        expect(data.annotation).toBeUndefined();
      });

      it('should handle undefined event', () => {
        const event = undefined;
        const sequence = 1;

        const generator = handler.handleTextAnnotation(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        const data = JSON.parse(results[0].data);
        expect(data.annotation).toBeUndefined();
      });

      it('should handle event with wrong type (primitive)', () => {
        const event = 'invalid' as unknown;
        const sequence = 1;

        const generator = handler.handleTextAnnotation(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(results[0].event).toBe('text_annotation');
      });
    });

    describe('State Overflow Scenarios', () => {
      it('should handle very long text accumulation (10k+ characters)', () => {
        const longText = 'x'.repeat(10000);
        const event = { delta: longText };
        const sequence = 1;

        const generator = handler.handleTextDelta(event, mockState, sequence);
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(mockState.fullText).toBe(longText);
        expect(mockState.fullText.length).toBe(10000);
      });

      it('should handle multiple large deltas accumulating to 50k+ characters', () => {
        const largeChunk = 'A'.repeat(10000);

        for (let i = 0; i < 6; i++) {
          const event = { delta: largeChunk };
          const generator = handler.handleTextDelta(event, mockState, i + 1);
          Array.from(generator);
        }

        expect(mockState.fullText.length).toBe(60000);
        expect(mockState.fullText).toBe(largeChunk.repeat(6));
      });
    });

    describe('Special Characters & Encoding', () => {
      it('should handle unicode characters', () => {
        const event = { delta: '你好世界 🌍 مرحبا בעולם' };
        const sequence = 1;

        const generator = handler.handleTextDelta(event, mockState, sequence);
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(mockState.fullText).toBe('你好世界 🌍 مرحبا בעולם');
        const data = JSON.parse(results[0].data);
        expect(data.delta).toBe('你好世界 🌍 مرحبا בעולם');
      });

      it('should handle emojis and special symbols', () => {
        const event = { delta: '😀 👍 💯 ✨ 🎉 🚀' };
        const sequence = 1;

        const generator = handler.handleTextDelta(event, mockState, sequence);
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(mockState.fullText).toBe('😀 👍 💯 ✨ 🎉 🚀');
      });

      it('should handle escaped characters and control characters', () => {
        const event = { delta: 'Line1\nLine2\tTabbed\r\nWindows' };
        const sequence = 1;

        const generator = handler.handleTextDelta(event, mockState, sequence);
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(mockState.fullText).toBe('Line1\nLine2\tTabbed\r\nWindows');
      });

      it('should handle JSON special characters', () => {
        const event = { delta: '{"key": "value", "quote": "\\"test\\""}' };
        const sequence = 1;

        const generator = handler.handleTextDelta(event, mockState, sequence);
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        // Should be properly serialized in SSE data
        expect(() => JSON.parse(results[0].data)).not.toThrow();
      });
    });

    describe('Invalid Sequence Numbers', () => {
      it('should handle negative sequence number', () => {
        const event = { delta: 'test' };
        const sequence = -1;

        const generator = handler.handleTextDelta(event, mockState, sequence);
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(results[0].sequence).toBe(-1);
      });

      it('should handle very large sequence number', () => {
        const event = { delta: 'test' };
        const sequence = Number.MAX_SAFE_INTEGER;

        const generator = handler.handleTextDelta(event, mockState, sequence);
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(results[0].sequence).toBe(Number.MAX_SAFE_INTEGER);
      });

      it('should handle zero sequence number', () => {
        const event = { delta: 'test' };
        const sequence = 0;

        const generator = handler.handleTextDelta(event, mockState, sequence);
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(results[0].sequence).toBe(0);
      });
    });

    describe('Complex Nested Objects', () => {
      it('should handle deeply nested logprobs', () => {
        const event = {
          delta: 'test',
          logprobs: [
            {
              token: 'test',
              logprob: -0.5,
              top_logprobs: [
                { token: 'alternative1', logprob: -1.2 },
                { token: 'alternative2', logprob: -2.3 },
              ],
            },
          ],
        };
        const sequence = 1;

        const generator = handler.handleTextDelta(event, mockState, sequence);
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        const data = JSON.parse(results[0].data);
        expect(data.logprobs).toEqual(event.logprobs);
      });

      it('should handle large logprobs array (100+ items)', () => {
        const largeLogprobs = Array.from({ length: 100 }, (_, i) => ({
          token: `token_${i}`,
          logprob: -Math.random(),
        }));

        const event = {
          delta: 'test',
          logprobs: largeLogprobs,
        };
        const sequence = 1;

        const generator = handler.handleTextDelta(event, mockState, sequence);
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        const data = JSON.parse(results[0].data);
        expect(data.logprobs).toHaveLength(100);
      });
    });
  });
});
