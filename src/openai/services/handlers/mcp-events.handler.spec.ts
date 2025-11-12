import { Test, TestingModule } from '@nestjs/testing';
import { MCPEventsHandler } from './mcp-events.handler';
import { LoggerService } from '../../../common/services/logger.service';
import type {
  StreamState,
  SSEEvent,
} from '../../interfaces/streaming-events.interface';
import {
  createMockLoggerService,
  createMockStreamState,
} from '../../../common/testing/test.factories';

describe('MCPEventsHandler', () => {
  let handler: MCPEventsHandler;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockState: StreamState;

  beforeEach(async () => {
    // Mock LoggerService using factory
    mockLoggerService = createMockLoggerService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MCPEventsHandler,
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    handler = module.get<MCPEventsHandler>(MCPEventsHandler);

    // Initialize mock state using factory
    mockState = createMockStreamState();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleMCPCallProgress', () => {
    it('should yield mcp_call_in_progress event', () => {
      const event = { call_id: 'mcp_123' };
      const sequence = 1;

      const generator = handler.handleMCPCallProgress(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        event: 'mcp_call_in_progress',
        data: JSON.stringify({ call_id: 'mcp_123', sequence: 1 }),
        sequence: 1,
      });
    });

    it('should log mcp_call_in_progress event', () => {
      const event = { call_id: 'mcp_456' };
      const sequence = 2;

      Array.from(handler.handleMCPCallProgress(event, mockState, sequence));

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'mcp_call_in_progress',
        sequence: 2,
      });
    });
  });

  describe('handleMCPCallDelta', () => {
    it('should yield mcp_call_delta event with arguments', () => {
      const event = { call_id: 'mcp_789', delta: '{"action":"' };
      const sequence = 5;

      const generator = handler.handleMCPCallDelta(event, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      const data = JSON.parse(results[0].data);
      expect(data).toEqual({
        call_id: 'mcp_789',
        delta: '{"action":"',
        sequence: 5,
      });
    });

    it('should log mcp_call_delta event', () => {
      const event = { call_id: 'mcp_abc', delta: 'args_delta' };
      const sequence = 6;

      Array.from(handler.handleMCPCallDelta(event, mockState, sequence));

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'mcp_call_delta',
        sequence: 6,
        delta: 'args_delta',
      });
    });
  });

  describe('handleMCPCallDone', () => {
    it('should yield mcp_call_done event', () => {
      const event = {
        call_id: 'mcp_done',
        arguments: { server: 'zapier', action: 'send_email' },
      };
      const sequence = 10;

      const generator = handler.handleMCPCallDone(event, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      const data = JSON.parse(results[0].data);
      expect(data.arguments).toEqual({
        server: 'zapier',
        action: 'send_email',
      });
    });

    it('should log mcp_call_done event', () => {
      const event = { call_id: 'mcp_def', arguments: { test: true } };
      const sequence = 12;

      Array.from(handler.handleMCPCallDone(event, mockState, sequence));

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'mcp_call_done',
        sequence: 12,
        response: { arguments: { test: true } },
      });
    });
  });

  describe('handleMCPCallCompleted', () => {
    it('should yield mcp_call_completed event with result', () => {
      const event = {
        call_id: 'mcp_completed',
        result: { status: 'success', data: { email_sent: true } },
      };
      const sequence = 15;

      const generator = handler.handleMCPCallCompleted(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      const data = JSON.parse(results[0].data);
      expect(data.result).toEqual({
        status: 'success',
        data: { email_sent: true },
      });
    });

    it('should log mcp_call_completed event', () => {
      const event = { call_id: 'mcp_ghi', result: { output: 'completed' } };
      const sequence = 18;

      Array.from(handler.handleMCPCallCompleted(event, mockState, sequence));

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'mcp_call_completed',
        sequence: 18,
        response: { result: { output: 'completed' } },
      });
    });
  });

  describe('handleMCPCallFailed', () => {
    it('should yield mcp_call_failed event with error', () => {
      const event = {
        call_id: 'mcp_failed',
        error: { code: 'authentication_failed', message: 'Invalid API key' },
      };
      const sequence = 20;

      const generator = handler.handleMCPCallFailed(event, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      const data = JSON.parse(results[0].data);
      expect(data.error).toEqual({
        code: 'authentication_failed',
        message: 'Invalid API key',
      });
    });

    it('should log mcp_call_failed event', () => {
      const event = {
        call_id: 'mcp_error',
        error: { message: 'Server unavailable' },
      };
      const sequence = 22;

      Array.from(handler.handleMCPCallFailed(event, mockState, sequence));

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'mcp_call_failed',
        sequence: 22,
        error: { message: 'Server unavailable' },
      });
    });
  });

  describe('handleMCPListTools', () => {
    it('should yield mcp_list_tools event for in_progress', () => {
      const event = {
        type: 'response.mcp_list_tools.in_progress',
      };
      const sequence = 1;

      const generator = handler.handleMCPListTools(event, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('mcp_list_tools.in_progress');
    });

    it('should yield mcp_list_tools.completed with tools list', () => {
      const event = {
        type: 'response.mcp_list_tools.completed',
        tools: [
          { name: 'send_email', description: 'Send email via Zapier' },
          { name: 'create_task', description: 'Create task in project' },
        ],
      };
      const sequence = 5;

      const generator = handler.handleMCPListTools(event, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      const data = JSON.parse(results[0].data);
      expect(data.tools).toHaveLength(2);
      expect(data.tools[0].name).toBe('send_email');
    });

    it('should yield mcp_list_tools.failed with error', () => {
      const event = {
        type: 'response.mcp_list_tools.failed',
        error: { message: 'Connection timeout' },
      };
      const sequence = 8;

      const generator = handler.handleMCPListTools(event, mockState, sequence);
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      const data = JSON.parse(results[0].data);
      expect(data.error).toEqual({ message: 'Connection timeout' });
    });

    it('should log mcp_list_tools events', () => {
      const event = {
        type: 'response.mcp_list_tools.completed',
        tools: [{ name: 'tool1' }],
      };
      const sequence = 10;

      Array.from(handler.handleMCPListTools(event, mockState, sequence));

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'response.mcp_list_tools.completed',
        sequence: 10,
        response: { tools: [{ name: 'tool1' }] },
        error: undefined,
      });
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete MCP call flow', () => {
      let sequence = 0;
      const callId = 'mcp_integration';

      // Progress
      Array.from(
        handler.handleMCPCallProgress(
          { call_id: callId },
          mockState,
          ++sequence,
        ),
      );

      // Arguments delta
      Array.from(
        handler.handleMCPCallDelta(
          { call_id: callId, delta: '{"server":"zapier"' },
          mockState,
          ++sequence,
        ),
      );

      // Arguments done
      Array.from(
        handler.handleMCPCallDone(
          { call_id: callId, arguments: { server: 'zapier', action: 'send' } },
          mockState,
          ++sequence,
        ),
      );

      // Completed
      Array.from(
        handler.handleMCPCallCompleted(
          { call_id: callId, result: { status: 'sent' } },
          mockState,
          ++sequence,
        ),
      );

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledTimes(4);
    });

    it('should handle MCP call failure flow', () => {
      let sequence = 0;
      const callId = 'mcp_fail';

      Array.from(
        handler.handleMCPCallProgress(
          { call_id: callId },
          mockState,
          ++sequence,
        ),
      );
      Array.from(
        handler.handleMCPCallFailed(
          { call_id: callId, error: { code: 'timeout' } },
          mockState,
          ++sequence,
        ),
      );

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledTimes(2);
    });

    it('should handle MCP list tools flow', () => {
      let sequence = 0;

      Array.from(
        handler.handleMCPListTools(
          { type: 'response.mcp_list_tools.in_progress' },
          mockState,
          ++sequence,
        ),
      );
      Array.from(
        handler.handleMCPListTools(
          {
            type: 'response.mcp_list_tools.completed',
            tools: [{ name: 't1' }, { name: 't2' }],
          },
          mockState,
          ++sequence,
        ),
      );

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling & Edge Cases', () => {
    it('should handle null event in handleMCPCallProgress', () => {
      const generator = handler.handleMCPCallProgress(null, mockState, 1);
      const results: SSEEvent[] = Array.from(generator);
      expect(results).toHaveLength(1);
    });

    it('should handle undefined event in handleMCPCallDelta', () => {
      const generator = handler.handleMCPCallDelta(undefined, mockState, 1);
      const results: SSEEvent[] = Array.from(generator);
      expect(results).toHaveLength(1);
    });

    it('should handle negative sequence number', () => {
      const generator = handler.handleMCPCallProgress(
        { call_id: 'test' },
        mockState,
        -1,
      );
      const results: SSEEvent[] = Array.from(generator);
      expect(results[0].sequence).toBe(-1);
    });
  });
});
