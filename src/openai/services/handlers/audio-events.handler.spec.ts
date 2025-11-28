import { Test, TestingModule } from '@nestjs/testing';
import { AudioEventsHandler } from './audio-events.handler';
import { LoggerService } from '../../../common/services/logger.service';
import type {
  StreamState,
  SSEEvent,
} from '../../interfaces/streaming-events.interface';
import {
  createMockLoggerService,
  createMockStreamState,
} from '../../../common/testing/test.factories';

describe('AudioEventsHandler', () => {
  let handler: AudioEventsHandler;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockState: StreamState;

  beforeEach(async () => {
    // Mock LoggerService using factory
    mockLoggerService = createMockLoggerService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AudioEventsHandler,
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    handler = module.get<AudioEventsHandler>(AudioEventsHandler);

    // Initialize mock state using factory
    mockState = createMockStreamState();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleAudioDelta', () => {
    it('should yield audio_delta event and accumulate audio in state', () => {
      const event = { delta: 'audio_chunk_1' };
      const sequence = 1;

      const generator = handler.handleAudioDelta(event, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        event: 'audio_delta',
        data: JSON.stringify({ delta: 'audio_chunk_1', sequence: 1 }),
        sequence: 1,
      });

      expect(mockState.audio).toBe('audio_chunk_1');
    });

    it('should accumulate multiple audio deltas', () => {
      const deltas = ['chunk1', 'chunk2', 'chunk3'];

      deltas.forEach((delta, index) => {
        const event = { delta };
        Array.from(handler.handleAudioDelta(event, mockState, index + 1));
      });

      expect(mockState.audio).toBe('chunk1chunk2chunk3');
    });

    it('should log audio_delta event', () => {
      const event = { delta: 'audio_data' };
      const sequence = 5;

      Array.from(handler.handleAudioDelta(event, mockState, sequence));

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'responses',
          endpoint: '/v1/responses (stream)',
          event_type: 'audio_delta',
          sequence: 5,
          delta: 'audio_data',
        }),
      );
      const call = mockLoggerService.logStreamingEvent.mock.calls[0][0];
      expect(typeof call.timestamp).toBe('string');
    });

    it('should handle empty delta', () => {
      const event = { delta: '' };
      const sequence = 1;

      const generator = handler.handleAudioDelta(event, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(mockState.audio).toBe('');
    });

    it('should handle event without delta property', () => {
      const event = {};
      const sequence = 1;
      mockState.audio = 'existing';

      Array.from(handler.handleAudioDelta(event, mockState, sequence));

      expect(mockState.audio).toBe('existing');
    });
  });

  describe('handleAudioDone', () => {
    it('should yield audio_done event with accumulated audio', () => {
      mockState.audio = 'complete_audio_base64';
      const sequence = 10;

      const generator = handler.handleAudioDone({}, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        event: 'audio_done',
        data: JSON.stringify({ audio: 'complete_audio_base64', sequence: 10 }),
        sequence: 10,
      });
    });

    it('should log audio_done event', () => {
      mockState.audio = 'final_audio';
      const sequence = 15;

      Array.from(handler.handleAudioDone({}, mockState, sequence));

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'responses',
          endpoint: '/v1/responses (stream)',
          event_type: 'audio_done',
          sequence: 15,
          response: { audio: 'final_audio' },
        }),
      );
      const call = mockLoggerService.logStreamingEvent.mock.calls[0][0];
      expect(typeof call.timestamp).toBe('string');
    });

    it('should handle empty audio', () => {
      mockState.audio = '';
      const sequence = 1;

      const generator = handler.handleAudioDone({}, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      const data = JSON.parse(results[0].data) as { audio: string };
      expect(data.audio).toBe('');
    });
  });

  describe('handleAudioTranscriptDelta', () => {
    it('should yield audio_transcript_delta event and accumulate transcript', () => {
      const event = { delta: 'Hello ' };
      const sequence = 1;

      const generator = handler.handleAudioTranscriptDelta(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        event: 'audio_transcript_delta',
        data: JSON.stringify({ delta: 'Hello ', sequence: 1 }),
        sequence: 1,
      });

      expect(mockState.audioTranscript).toBe('Hello ');
    });

    it('should accumulate multiple transcript deltas', () => {
      const deltas = ['Hello', ' ', 'world', '!'];

      deltas.forEach((delta, index) => {
        const event = { delta };
        Array.from(
          handler.handleAudioTranscriptDelta(event, mockState, index + 1),
        );
      });

      expect(mockState.audioTranscript).toBe('Hello world!');
    });

    it('should log audio_transcript_delta event', () => {
      const event = { delta: 'transcript chunk' };
      const sequence = 7;

      Array.from(
        handler.handleAudioTranscriptDelta(event, mockState, sequence),
      );

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'responses',
          endpoint: '/v1/responses (stream)',
          event_type: 'audio_transcript_delta',
          sequence: 7,
          delta: 'transcript chunk',
        }),
      );
      const call = mockLoggerService.logStreamingEvent.mock.calls[0][0];
      expect(typeof call.timestamp).toBe('string');
    });

    it('should handle empty delta', () => {
      const event = { delta: '' };
      const sequence = 1;

      Array.from(
        handler.handleAudioTranscriptDelta(event, mockState, sequence),
      );

      expect(mockState.audioTranscript).toBe('');
    });

    it('should handle event without delta property', () => {
      const event = {};
      const sequence = 1;
      mockState.audioTranscript = 'existing transcript';

      Array.from(
        handler.handleAudioTranscriptDelta(event, mockState, sequence),
      );

      expect(mockState.audioTranscript).toBe('existing transcript');
    });
  });

  describe('handleAudioTranscriptDone', () => {
    it('should yield audio_transcript_done event with complete transcript', () => {
      mockState.audioTranscript = 'Complete transcript text';
      const sequence = 12;

      const generator = handler.handleAudioTranscriptDone(
        {},
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        event: 'audio_transcript_done',
        data: JSON.stringify({
          transcript: 'Complete transcript text',
          sequence: 12,
        }),
        sequence: 12,
      });
    });

    it('should log audio_transcript_done event', () => {
      mockState.audioTranscript = 'Final transcript';
      const sequence = 20;

      Array.from(handler.handleAudioTranscriptDone({}, mockState, sequence));

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'responses',
          endpoint: '/v1/responses (stream)',
          event_type: 'audio_transcript_done',
          sequence: 20,
          response: { transcript: 'Final transcript' },
        }),
      );
      const call = mockLoggerService.logStreamingEvent.mock.calls[0][0];
      expect(typeof call.timestamp).toBe('string');
    });

    it('should handle empty transcript', () => {
      mockState.audioTranscript = '';
      const sequence = 1;

      const generator = handler.handleAudioTranscriptDone(
        {},
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      const data = JSON.parse(results[0].data) as { transcript: string };
      expect(data.transcript).toBe('');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete audio streaming flow', () => {
      let sequence = 0;

      // Stream audio chunks
      const audioChunks = ['chunk1_base64', 'chunk2_base64', 'chunk3_base64'];
      audioChunks.forEach((chunk) => {
        Array.from(
          handler.handleAudioDelta({ delta: chunk }, mockState, ++sequence),
        );
      });

      // Stream transcript chunks (parallel to audio)
      const transcriptChunks = ['The ', 'quick ', 'brown ', 'fox'];
      transcriptChunks.forEach((chunk) => {
        Array.from(
          handler.handleAudioTranscriptDelta(
            { delta: chunk },
            mockState,
            ++sequence,
          ),
        );
      });

      // Complete audio
      Array.from(handler.handleAudioDone({}, mockState, ++sequence));

      // Complete transcript
      Array.from(handler.handleAudioTranscriptDone({}, mockState, ++sequence));

      expect(mockState.audio).toBe('chunk1_base64chunk2_base64chunk3_base64');
      expect(mockState.audioTranscript).toBe('The quick brown fox');
      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledTimes(9);
    });

    it('should handle audio without transcript', () => {
      let sequence = 0;

      // Only audio, no transcript
      Array.from(
        handler.handleAudioDelta(
          { delta: 'audio_only' },
          mockState,
          ++sequence,
        ),
      );
      Array.from(handler.handleAudioDone({}, mockState, ++sequence));

      expect(mockState.audio).toBe('audio_only');
      expect(mockState.audioTranscript).toBe('');
      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledTimes(2);
    });

    it('should handle transcript without audio (text-only mode)', () => {
      let sequence = 0;

      // Only transcript, no audio
      Array.from(
        handler.handleAudioTranscriptDelta(
          { delta: 'Text response' },
          mockState,
          ++sequence,
        ),
      );
      Array.from(handler.handleAudioTranscriptDone({}, mockState, ++sequence));

      expect(mockState.audio).toBe('');
      expect(mockState.audioTranscript).toBe('Text response');
      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledTimes(2);
    });

    it('should maintain separate audio and transcript state', () => {
      let sequence = 0;

      // Add audio
      Array.from(
        handler.handleAudioDelta(
          { delta: 'audio_data' },
          mockState,
          ++sequence,
        ),
      );
      Array.from(handler.handleAudioDone({}, mockState, ++sequence));

      // Add transcript
      Array.from(
        handler.handleAudioTranscriptDelta(
          { delta: 'transcript_text' },
          mockState,
          ++sequence,
        ),
      );
      Array.from(handler.handleAudioTranscriptDone({}, mockState, ++sequence));

      // Verify both maintained separately
      expect(mockState.audio).toBe('audio_data');
      expect(mockState.audioTranscript).toBe('transcript_text');
    });
  });

  describe('Error Handling & Edge Cases', () => {
    it('should handle null event in handleAudioDelta', () => {
      const generator = handler.handleAudioDelta(null, mockState, 1);
      const results: SSEEvent[] = Array.from(generator);
      expect(results).toHaveLength(1);
    });

    it('should handle undefined event in handleAudioTranscriptDelta', () => {
      const generator = handler.handleAudioTranscriptDelta(
        undefined,
        mockState,
        1,
      );
      const results: SSEEvent[] = Array.from(generator);
      expect(results).toHaveLength(1);
    });

    it('should handle negative sequence number', () => {
      const generator = handler.handleAudioDelta(
        { delta: 'test' },
        mockState,
        -1,
      );
      const results: SSEEvent[] = Array.from(generator);
      expect(results[0].sequence).toBe(-1);
    });
  });
});
