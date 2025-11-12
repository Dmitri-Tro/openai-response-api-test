import { Test, TestingModule } from '@nestjs/testing';
import { ImageEventsHandler } from './image-events.handler';
import { LoggerService } from '../../../common/services/logger.service';
import type {
  StreamState,
  SSEEvent,
} from '../../interfaces/streaming-events.interface';
import {
  createMockLoggerService,
  createMockStreamState,
} from '../../../common/testing/test.factories';

describe('ImageEventsHandler', () => {
  let handler: ImageEventsHandler;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockState: StreamState;

  beforeEach(async () => {
    // Mock LoggerService using factory
    mockLoggerService = createMockLoggerService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImageEventsHandler,
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    handler = module.get<ImageEventsHandler>(ImageEventsHandler);

    // Initialize mock state using factory
    mockState = createMockStreamState();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleImageGenProgress', () => {
    it('should yield image_generation_call.in_progress event', () => {
      const event = {
        type: 'response.image_generation_call.in_progress',
        call_id: 'img_123',
      };
      const sequence = 1;

      const generator = handler.handleImageGenProgress(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        event: 'image_generation_call.in_progress',
        data: JSON.stringify({ call_id: 'img_123', sequence: 1 }),
        sequence: 1,
      });
    });

    it('should yield image_generation_call.generating event', () => {
      const event = {
        type: 'response.image_generation_call.generating',
        call_id: 'img_456',
      };
      const sequence = 2;

      const generator = handler.handleImageGenProgress(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('image_generation_call.generating');
      expect(results[0].data).toContain('"call_id":"img_456"');
    });

    it('should strip "response." prefix from event type', () => {
      const event = {
        type: 'response.image_generation_call.in_progress',
        call_id: 'img_789',
      };
      const sequence = 3;

      const generator = handler.handleImageGenProgress(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results[0].event).toBe('image_generation_call.in_progress');
      expect(results[0].event).not.toContain('response.');
    });

    it('should log image generation progress event', () => {
      const event = {
        type: 'response.image_generation_call.generating',
        call_id: 'img_abc',
      };
      const sequence = 5;

      const generator = handler.handleImageGenProgress(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'response.image_generation_call.generating',
        sequence: 5,
      });
    });

    it('should handle event without call_id', () => {
      const event = {
        type: 'response.image_generation_call.in_progress',
      };
      const sequence = 1;

      const generator = handler.handleImageGenProgress(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      const data = JSON.parse(results[0].data);
      expect(data.call_id).toBeUndefined();
    });
  });

  describe('handleImageGenPartial', () => {
    it('should yield image_gen_partial event with base64 data', () => {
      const event = {
        call_id: 'img_partial_123',
        image_data: 'base64_encoded_partial_image_data',
      };
      const sequence = 10;

      const generator = handler.handleImageGenPartial(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        event: 'image_gen_partial',
        data: JSON.stringify({
          call_id: 'img_partial_123',
          image_data: 'base64_encoded_partial_image_data',
          sequence: 10,
        }),
        sequence: 10,
      });
    });

    it('should handle large base64 image data', () => {
      const largeBase64 = 'A'.repeat(10000); // Simulate large base64 string
      const event = {
        call_id: 'img_large',
        image_data: largeBase64,
      };
      const sequence = 5;

      const generator = handler.handleImageGenPartial(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      const data = JSON.parse(results[0].data);
      expect(data.image_data).toBe(largeBase64);
      expect(data.image_data.length).toBe(10000);
    });

    it('should log image_gen_partial event', () => {
      const event = {
        call_id: 'img_log_test',
        image_data: 'partial_image',
      };
      const sequence = 8;

      const generator = handler.handleImageGenPartial(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'image_gen_partial',
        sequence: 8,
      });
    });

    it('should handle event without image_data', () => {
      const event = {
        call_id: 'img_no_data',
      };
      const sequence = 1;

      const generator = handler.handleImageGenPartial(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      const data = JSON.parse(results[0].data);
      expect(data.image_data).toBeUndefined();
      expect(data.call_id).toBe('img_no_data');
    });

    it('should handle event without call_id', () => {
      const event = {
        image_data: 'some_data',
      };
      const sequence = 1;

      const generator = handler.handleImageGenPartial(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      const data = JSON.parse(results[0].data);
      expect(data.call_id).toBeUndefined();
      expect(data.image_data).toBe('some_data');
    });
  });

  describe('handleImageGenCompleted', () => {
    it('should yield image_gen_completed event with final image', () => {
      const event = {
        call_id: 'img_completed_123',
        image_data: 'base64_encoded_final_image_data',
      };
      const sequence = 20;

      const generator = handler.handleImageGenCompleted(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        event: 'image_gen_completed',
        data: JSON.stringify({
          call_id: 'img_completed_123',
          image_data: 'base64_encoded_final_image_data',
          sequence: 20,
        }),
        sequence: 20,
      });
    });

    it('should handle high quality image data', () => {
      const highQualityBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAUA'.repeat(100); // Simulated PNG base64
      const event = {
        call_id: 'img_hq',
        image_data: highQualityBase64,
      };
      const sequence = 15;

      const generator = handler.handleImageGenCompleted(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      const data = JSON.parse(results[0].data);
      expect(data.image_data).toBe(highQualityBase64);
    });

    it('should log image_gen_completed event', () => {
      const event = {
        call_id: 'img_final',
        image_data: 'final_image',
      };
      const sequence = 25;

      const generator = handler.handleImageGenCompleted(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'image_gen_completed',
        sequence: 25,
      });
    });

    it('should handle completed event without image_data (error case)', () => {
      const event = {
        call_id: 'img_error',
      };
      const sequence = 1;

      const generator = handler.handleImageGenCompleted(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      const data = JSON.parse(results[0].data);
      expect(data.image_data).toBeUndefined();
    });

    it('should handle event without call_id', () => {
      const event = {
        image_data: 'final_data',
      };
      const sequence = 1;

      const generator = handler.handleImageGenCompleted(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      const data = JSON.parse(results[0].data);
      expect(data.call_id).toBeUndefined();
      expect(data.image_data).toBe('final_data');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete image generation flow', () => {
      let sequence = 0;
      const callId = 'img_integration';

      // In progress
      Array.from(
        handler.handleImageGenProgress(
          {
            type: 'response.image_generation_call.in_progress',
            call_id: callId,
          },
          mockState,
          ++sequence,
        ),
      );

      // Generating
      Array.from(
        handler.handleImageGenProgress(
          {
            type: 'response.image_generation_call.generating',
            call_id: callId,
          },
          mockState,
          ++sequence,
        ),
      );

      // Partial images (progressive rendering)
      const partialImages = ['partial_1', 'partial_2', 'partial_3'];
      partialImages.forEach((imageData) => {
        Array.from(
          handler.handleImageGenPartial(
            { call_id: callId, image_data: imageData },
            mockState,
            ++sequence,
          ),
        );
      });

      // Completed
      Array.from(
        handler.handleImageGenCompleted(
          { call_id: callId, image_data: 'final_image_base64' },
          mockState,
          ++sequence,
        ),
      );

      // Verify all events were logged
      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledTimes(6);
      expect(mockLoggerService.logStreamingEvent).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          event_type: 'response.image_generation_call.in_progress',
        }),
      );
      expect(mockLoggerService.logStreamingEvent).toHaveBeenNthCalledWith(
        6,
        expect.objectContaining({ event_type: 'image_gen_completed' }),
      );
    });

    it('should handle image generation without partial images', () => {
      let sequence = 0;
      const callId = 'img_no_partials';

      // In progress -> generating -> completed (no partials)
      Array.from(
        handler.handleImageGenProgress(
          {
            type: 'response.image_generation_call.in_progress',
            call_id: callId,
          },
          mockState,
          ++sequence,
        ),
      );
      Array.from(
        handler.handleImageGenProgress(
          {
            type: 'response.image_generation_call.generating',
            call_id: callId,
          },
          mockState,
          ++sequence,
        ),
      );
      Array.from(
        handler.handleImageGenCompleted(
          { call_id: callId, image_data: 'final_image' },
          mockState,
          ++sequence,
        ),
      );

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledTimes(3);
    });

    it('should handle multiple concurrent image generations', () => {
      const callIds = ['img_1', 'img_2', 'img_3'];
      let sequence = 0;

      callIds.forEach((callId) => {
        Array.from(
          handler.handleImageGenProgress(
            {
              type: 'response.image_generation_call.in_progress',
              call_id: callId,
            },
            mockState,
            ++sequence,
          ),
        );
        Array.from(
          handler.handleImageGenCompleted(
            { call_id: callId, image_data: `image_${callId}` },
            mockState,
            ++sequence,
          ),
        );
      });

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledTimes(6);
    });

    it('should handle progressive rendering with many partial images', () => {
      const callId = 'img_progressive';
      let sequence = 0;

      // Start
      Array.from(
        handler.handleImageGenProgress(
          {
            type: 'response.image_generation_call.generating',
            call_id: callId,
          },
          mockState,
          ++sequence,
        ),
      );

      // Stream 10 partial images (simulating progressive rendering)
      for (let i = 0; i < 10; i++) {
        Array.from(
          handler.handleImageGenPartial(
            {
              call_id: callId,
              image_data: `partial_${i}_progress_${(i + 1) * 10}%`,
            },
            mockState,
            ++sequence,
          ),
        );
      }

      // Complete
      Array.from(
        handler.handleImageGenCompleted(
          { call_id: callId, image_data: 'final_100%' },
          mockState,
          ++sequence,
        ),
      );

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledTimes(12);
    });
  });

  describe('Error Handling & Edge Cases', () => {
    it('should handle null event in handleImageGenProgress', () => {
      const generator = handler.handleImageGenProgress(null, mockState, 1);
      const results: SSEEvent[] = Array.from(generator);
      expect(results).toHaveLength(1);
    });

    it('should handle undefined event in handleImageGenPartial', () => {
      const generator = handler.handleImageGenPartial(undefined, mockState, 1);
      const results: SSEEvent[] = Array.from(generator);
      expect(results).toHaveLength(1);
    });

    it('should handle negative sequence number', () => {
      const generator = handler.handleImageGenProgress(
        { type: 'response.image_generation_call.in_progress' },
        mockState,
        -1,
      );
      const results: SSEEvent[] = Array.from(generator);
      expect(results[0].sequence).toBe(-1);
    });
  });
});
