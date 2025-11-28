import { Test, TestingModule } from '@nestjs/testing';
import { ComputerUseEventsHandler } from './computer-use-events.handler';
import { LoggerService } from '../../../common/services/logger.service';
import type {
  StreamState,
  SSEEvent,
} from '../../interfaces/streaming-events.interface';
import {
  createMockLoggerService,
  createMockStreamState,
} from '../../../common/testing/test.factories';

// Type definitions for parsed event data
interface ComputerUseActionData {
  call_id: string;
  action: {
    action_type: string;
    coordinates?: { x: number; y: number };
    text?: string;
    key?: string;
  };
}

interface ComputerUseProgressData {
  call_id: string;
}

interface ComputerUseOutputData {
  call_id: string;
  output_index?: number;
  output?: Record<string, unknown>;
}

describe('ComputerUseEventsHandler', () => {
  let handler: ComputerUseEventsHandler;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockState: StreamState;

  beforeEach(async () => {
    // Mock LoggerService using factory
    mockLoggerService = createMockLoggerService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComputerUseEventsHandler,
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    handler = module.get<ComputerUseEventsHandler>(ComputerUseEventsHandler);

    // Initialize mock state using factory
    mockState = createMockStreamState();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleActionDelta', () => {
    it('should yield computer_use_action_delta event for mouse_move', () => {
      const event = {
        call_id: 'computer_123',
        delta: {
          action_type: 'mouse_move' as const,
          coordinates: { x: 100, y: 200 },
        },
      };
      const sequence = 1;

      const generator = handler.handleActionDelta(event, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('computer_use_action_delta');
      const data = JSON.parse(results[0].data) as ComputerUseActionData;
      expect(data.call_id).toBe('computer_123');
      expect(data.action.action_type).toBe('mouse_move');
      expect(data.action.coordinates).toEqual({ x: 100, y: 200 });
    });

    it('should yield computer_use_action_delta event for click', () => {
      const event = {
        call_id: 'computer_456',
        delta: {
          action_type: 'click' as const,
          coordinates: { x: 50, y: 75 },
        },
      };
      const sequence = 2;

      const generator = handler.handleActionDelta(event, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      expect(results[0].event).toBe('computer_use_action_delta');
      const data = JSON.parse(results[0].data) as ComputerUseActionData;
      expect(data.action.action_type).toBe('click');
    });

    it('should yield computer_use_action_delta event for type', () => {
      const event = {
        call_id: 'computer_789',
        delta: {
          action_type: 'type' as const,
          text: 'Hello, World!',
        },
      };
      const sequence = 3;

      const generator = handler.handleActionDelta(event, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      const data = JSON.parse(results[0].data) as ComputerUseActionData;
      expect(data.action.action_type).toBe('type');
      expect(data.action.text).toBe('Hello, World!');
    });

    it('should yield computer_use_action_delta event for key', () => {
      const event = {
        call_id: 'computer_abc',
        delta: {
          action_type: 'key' as const,
          key: 'Enter',
        },
      };
      const sequence = 4;

      const generator = handler.handleActionDelta(event, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      const data = JSON.parse(results[0].data) as ComputerUseActionData;
      expect(data.action.action_type).toBe('key');
      expect(data.action.key).toBe('Enter');
    });

    it('should yield computer_use_action_delta event for screenshot', () => {
      const event = {
        call_id: 'computer_screenshot',
        delta: {
          action_type: 'screenshot' as const,
        },
      };
      const sequence = 5;

      const generator = handler.handleActionDelta(event, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      const data = JSON.parse(results[0].data) as ComputerUseActionData;
      expect(data.action.action_type).toBe('screenshot');
    });

    it('should initialize tool call state when not present', () => {
      const event = {
        call_id: 'new_call',
        delta: {
          action_type: 'click' as const,
          coordinates: { x: 10, y: 20 },
        },
      };
      const sequence = 1;

      expect(mockState.toolCalls.has('new_call')).toBe(false);

      const generator = handler.handleActionDelta(event, mockState, sequence);
      Array.from(generator);

      expect(mockState.toolCalls.has('new_call')).toBe(true);
      const toolCall = mockState.toolCalls.get('new_call')!;
      expect(toolCall.type).toBe('computer_use');
      expect(toolCall.status).toBe('in_progress');
    });

    it('should log computer_use_action_delta event', () => {
      const event = {
        call_id: 'log_test',
        delta: {
          action_type: 'mouse_move' as const,
          coordinates: { x: 300, y: 400 },
        },
      };
      const sequence = 10;

      const generator = handler.handleActionDelta(event, mockState, sequence);
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'responses',
          endpoint: '/v1/responses (stream)',
          event_type: 'computer_use_action_delta',
          sequence: 10,
        }),
      );
      const call = mockLoggerService.logStreamingEvent.mock.calls[0][0];
      expect(typeof call.timestamp).toBe('string');
    });

    it('should handle event without call_id', () => {
      const event = {
        delta: {
          action_type: 'click' as const,
        },
      };
      const sequence = 1;

      const generator = handler.handleActionDelta(event, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      const data = JSON.parse(results[0].data) as ComputerUseActionData;
      expect(data.call_id).toBe('unknown');
    });

    it('should handle long text input', () => {
      const longText = 'A'.repeat(1000);
      const event = {
        call_id: 'long_text',
        delta: {
          action_type: 'type' as const,
          text: longText,
        },
      };
      const sequence = 1;

      const generator = handler.handleActionDelta(event, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      const data = JSON.parse(results[0].data) as ComputerUseActionData;
      expect(data.action.text).toBe(longText);
      expect(data.action.text?.length).toBe(1000);
    });
  });

  describe('handleActionDone', () => {
    it('should yield computer_use_action_done event with complete action', () => {
      const event = {
        call_id: 'done_123',
        action: {
          action_type: 'click',
          coordinates: { x: 150, y: 250 },
        },
      };
      const sequence = 20;

      const generator = handler.handleActionDone(event, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('computer_use_action_done');
      const data = JSON.parse(results[0].data) as ComputerUseActionData;
      expect(data.call_id).toBe('done_123');
      expect(data.action).toEqual(event.action);
    });

    it('should log computer_use_action_done event', () => {
      const event = {
        call_id: 'done_log',
        action: {
          action_type: 'type',
          text: 'Test',
        },
      };
      const sequence = 15;

      const generator = handler.handleActionDone(event, mockState, sequence);
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'responses',
          endpoint: '/v1/responses (stream)',
          event_type: 'computer_use_action_done',
          sequence: 15,
          response: { action: event.action },
        }),
      );
      const call = mockLoggerService.logStreamingEvent.mock.calls[0][0];
      expect(typeof call.timestamp).toBe('string');
    });

    it('should handle event without call_id', () => {
      const event = {
        action: {
          action_type: 'key',
          key: 'Escape',
        },
      };
      const sequence = 1;

      const generator = handler.handleActionDone(event, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      const data = JSON.parse(results[0].data) as ComputerUseActionData;
      expect(data.call_id).toBe('unknown');
    });
  });

  describe('handleComputerUseProgress', () => {
    it('should yield computer_use.in_progress event', () => {
      const event = {
        type: 'response.computer_use_call.in_progress',
        call_id: 'progress_123',
      };
      const sequence = 1;

      const generator = handler.handleComputerUseProgress(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('computer_use_call.in_progress');
      const data = JSON.parse(results[0].data) as ComputerUseProgressData;
      expect(data.call_id).toBe('progress_123');
    });

    it('should strip "response." prefix from event type', () => {
      const event = {
        type: 'response.computer_use_call.in_progress',
        call_id: 'prefix_test',
      };
      const sequence = 1;

      const generator = handler.handleComputerUseProgress(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results[0].event).toBe('computer_use_call.in_progress');
      expect(results[0].event).not.toContain('response.');
    });

    it('should log computer use progress event', () => {
      const event = {
        type: 'response.computer_use_call.in_progress',
        call_id: 'log_progress',
      };
      const sequence = 5;

      const generator = handler.handleComputerUseProgress(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'responses',
          endpoint: '/v1/responses (stream)',
          event_type: 'response.computer_use_call.in_progress',
          sequence: 5,
        }),
      );
      const call = mockLoggerService.logStreamingEvent.mock.calls[0][0];
      expect(typeof call.timestamp).toBe('string');
    });
  });

  describe('handleOutputItemAdded', () => {
    it('should yield computer_use_output_item_added event', () => {
      const event = {
        call_id: 'output_123',
        output_index: 0,
      };
      const sequence = 30;

      const generator = handler.handleOutputItemAdded(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('computer_use_output_item_added');
      const data = JSON.parse(results[0].data) as ComputerUseOutputData;
      expect(data.call_id).toBe('output_123');
      expect(data.output_index).toBe(0);
    });

    it('should log computer_use_output_item_added event', () => {
      const event = {
        call_id: 'output_log',
        output_index: 1,
      };
      const sequence = 25;

      const generator = handler.handleOutputItemAdded(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'responses',
          endpoint: '/v1/responses (stream)',
          event_type: 'computer_use_output_item_added',
          sequence: 25,
        }),
      );
      const call = mockLoggerService.logStreamingEvent.mock.calls[0][0];
      expect(typeof call.timestamp).toBe('string');
    });
  });

  describe('handleOutputItemDone', () => {
    it('should yield computer_use_output_item_done event with screenshot', () => {
      const event = {
        call_id: 'screenshot_123',
        output: {
          type: 'image',
          image_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA',
        },
      };
      const sequence = 40;

      const generator = handler.handleOutputItemDone(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('computer_use_output_item_done');
      const data = JSON.parse(results[0].data) as ComputerUseOutputData;
      expect(data.call_id).toBe('screenshot_123');
      expect(data.output).toEqual(event.output);
    });

    it('should log computer_use_output_item_done event with image flag', () => {
      const event = {
        call_id: 'screenshot_log',
        output: {
          type: 'image',
          image_url: 'base64_image_data',
        },
      };
      const sequence = 35;

      const generator = handler.handleOutputItemDone(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'responses',
          endpoint: '/v1/responses (stream)',
          event_type: 'computer_use_output_item_done',
          sequence: 35,
          response: {
            type: 'image',
            has_image: true,
          },
        }),
      );
      const call = mockLoggerService.logStreamingEvent.mock.calls[0][0];
      expect(typeof call.timestamp).toBe('string');
    });

    it('should handle output without image_url', () => {
      const event = {
        call_id: 'no_image',
        output: {
          type: 'text',
        },
      };
      const sequence = 1;

      const generator = handler.handleOutputItemDone(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      const data = JSON.parse(results[0].data) as ComputerUseOutputData;
      expect(data.output?.image_url).toBeUndefined();
    });
  });

  describe('handleComputerUseCompleted', () => {
    it('should yield computer_use_completed event with results', () => {
      const event = {
        call_id: 'completed_123',
        output: {
          actions_performed: 5,
          screenshots_captured: 2,
        },
      };
      const sequence = 50;

      const generator = handler.handleComputerUseCompleted(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('computer_use_completed');
      const data = JSON.parse(results[0].data) as ComputerUseOutputData;
      expect(data.call_id).toBe('completed_123');
      expect(data.output).toEqual(event.output);
    });

    it('should mark tool call as completed in state', () => {
      const callId = 'state_test';
      mockState.toolCalls.set(callId, {
        type: 'computer_use',
        input: '',
        status: 'in_progress',
      });

      const event = {
        call_id: callId,
        output: { result: 'success' },
      };
      const sequence = 1;

      const generator = handler.handleComputerUseCompleted(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      const toolCall = mockState.toolCalls.get(callId)!;
      expect(toolCall.status).toBe('completed');
      expect(toolCall.result).toEqual({ result: 'success' });
    });

    it('should log computer_use_completed event', () => {
      const event = {
        call_id: 'completed_log',
        output: { actions: 3 },
      };
      const sequence = 45;

      const generator = handler.handleComputerUseCompleted(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'responses',
          endpoint: '/v1/responses (stream)',
          event_type: 'computer_use_completed',
          sequence: 45,
          response: { call_id: 'completed_log', output: { actions: 3 } },
        }),
      );
      const call = mockLoggerService.logStreamingEvent.mock.calls[0][0];
      expect(typeof call.timestamp).toBe('string');
    });

    it('should handle completion without existing tool call state', () => {
      const event = {
        call_id: 'no_prior_state',
        output: {},
      };
      const sequence = 1;

      const generator = handler.handleComputerUseCompleted(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(mockState.toolCalls.has('no_prior_state')).toBe(false);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete computer use flow', () => {
      let sequence = 0;
      const callId = 'integration_test';

      // 1. In progress
      Array.from(
        handler.handleComputerUseProgress(
          {
            type: 'response.computer_use_call.in_progress',
            call_id: callId,
          },
          mockState,
          ++sequence,
        ),
      );

      // 2. Mouse move
      Array.from(
        handler.handleActionDelta(
          {
            call_id: callId,
            delta: {
              action_type: 'mouse_move',
              coordinates: { x: 100, y: 100 },
            },
          },
          mockState,
          ++sequence,
        ),
      );

      // 3. Click
      Array.from(
        handler.handleActionDelta(
          {
            call_id: callId,
            delta: { action_type: 'click', coordinates: { x: 100, y: 100 } },
          },
          mockState,
          ++sequence,
        ),
      );

      // 4. Type text
      Array.from(
        handler.handleActionDelta(
          {
            call_id: callId,
            delta: { action_type: 'type', text: 'Hello' },
          },
          mockState,
          ++sequence,
        ),
      );

      // 5. Screenshot
      Array.from(
        handler.handleOutputItemAdded(
          { call_id: callId, output_index: 0 },
          mockState,
          ++sequence,
        ),
      );

      Array.from(
        handler.handleOutputItemDone(
          {
            call_id: callId,
            output: {
              type: 'image',
              image_url: 'base64_screenshot',
            },
          },
          mockState,
          ++sequence,
        ),
      );

      // 6. Completed
      Array.from(
        handler.handleComputerUseCompleted(
          { call_id: callId, output: { success: true } },
          mockState,
          ++sequence,
        ),
      );

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledTimes(7);
    });

    it('should handle multiple concurrent computer use sessions', () => {
      const callIds = ['session_1', 'session_2', 'session_3'];
      let sequence = 0;

      callIds.forEach((callId) => {
        Array.from(
          handler.handleComputerUseProgress(
            {
              type: 'response.computer_use_call.in_progress',
              call_id: callId,
            },
            mockState,
            ++sequence,
          ),
        );
        Array.from(
          handler.handleComputerUseCompleted(
            { call_id: callId, output: {} },
            mockState,
            ++sequence,
          ),
        );
      });

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledTimes(6);
    });

    it('should handle complex automation workflow', () => {
      const callId = 'complex_workflow';
      let sequence = 0;

      // Simulate complex UI automation
      const actions = [
        { type: 'mouse_move', coords: { x: 50, y: 50 } },
        { type: 'click', coords: { x: 50, y: 50 } },
        { type: 'type', text: 'username' },
        { type: 'key', key: 'Tab' },
        { type: 'type', text: 'password' },
        { type: 'key', key: 'Enter' },
      ];

      actions.forEach((action) => {
        Array.from(
          handler.handleActionDelta(
            {
              call_id: callId,
              delta: {
                action_type: action.type as
                  | 'mouse_move'
                  | 'click'
                  | 'type'
                  | 'key'
                  | 'screenshot',
                coordinates: action.coords,
                text: action.text,
                key: action.key,
              },
            },
            mockState,
            ++sequence,
          ),
        );
      });

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledTimes(6);
    });
  });

  describe('Error Handling & Edge Cases', () => {
    it('should handle null event in handleActionDelta', () => {
      const generator = handler.handleActionDelta(null, mockState, 1);
      const results: SSEEvent[] = Array.from(generator);
      expect(results).toHaveLength(1);
    });

    it('should handle undefined event in handleComputerUseProgress', () => {
      const generator = handler.handleComputerUseProgress(
        undefined,
        mockState,
        1,
      );
      const results: SSEEvent[] = Array.from(generator);
      expect(results).toHaveLength(1);
    });

    it('should handle negative sequence number', () => {
      const generator = handler.handleActionDelta(
        { call_id: 'test', delta: { action_type: 'click' } },
        mockState,
        -1,
      );
      const results: SSEEvent[] = Array.from(generator);
      expect(results[0].sequence).toBe(-1);
    });

    it('should handle large coordinate values', () => {
      const event = {
        call_id: 'large_coords',
        delta: {
          action_type: 'mouse_move' as const,
          coordinates: { x: 99999, y: 99999 },
        },
      };

      const generator = handler.handleActionDelta(event, mockState, 1);
      const results: SSEEvent[] = Array.from(generator);

      const data = JSON.parse(results[0].data) as ComputerUseActionData;
      expect(data.action.coordinates).toEqual({ x: 99999, y: 99999 });
    });
  });
});
