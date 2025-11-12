import { Test, TestingModule } from '@nestjs/testing';
import { ToolCallingEventsHandler } from './tool-calling-events.handler';
import { LoggerService } from '../../../common/services/logger.service';
import type {
  StreamState,
  SSEEvent,
} from '../../interfaces/streaming-events.interface';
import {
  createMockLoggerService,
  createMockStreamState,
} from '../../../common/testing/test.factories';

describe('ToolCallingEventsHandler', () => {
  let handler: ToolCallingEventsHandler;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockState: StreamState;

  beforeEach(async () => {
    // Mock LoggerService using factory
    mockLoggerService = createMockLoggerService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolCallingEventsHandler,
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    handler = module.get<ToolCallingEventsHandler>(ToolCallingEventsHandler);

    // Initialize mock state using factory
    mockState = createMockStreamState();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===== FUNCTION CALL TESTS =====

  describe('handleFunctionCallDelta', () => {
    it('should yield function_call_delta event and initialize tool call in state', () => {
      const event = {
        call_id: 'call_123',
        delta: '{"query":',
        snapshot: '{"query":',
      };
      const sequence = 1;

      const generator = handler.handleFunctionCallDelta(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('function_call_delta');
      expect(results[0].sequence).toBe(1);

      const data = JSON.parse(results[0].data);
      expect(data).toEqual({
        call_id: 'call_123',
        delta: '{"query":',
        snapshot: '{"query":',
        sequence: 1,
      });

      // Verify state initialization
      expect(mockState.toolCalls.has('call_123')).toBe(true);
      expect(mockState.toolCalls.get('call_123')).toEqual({
        type: 'function',
        input: '{"query":',
        status: 'in_progress',
      });
    });

    it('should accumulate deltas for existing tool call', () => {
      const callId = 'call_456';
      const deltas = ['{"', 'name', '":"', 'value', '"}'];

      deltas.forEach((delta, index) => {
        const event = { call_id: callId, delta };
        const generator = handler.handleFunctionCallDelta(
          event,
          mockState,
          index + 1,
        );
        Array.from(generator);
      });

      expect(mockState.toolCalls.get(callId)?.input).toBe('{"name":"value"}');
    });

    it('should handle event without call_id (uses "unknown")', () => {
      const event = { delta: 'test' };
      const sequence = 1;

      const generator = handler.handleFunctionCallDelta(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results[0].data).toContain('"call_id":"unknown"');
      expect(mockState.toolCalls.has('unknown')).toBe(true);
    });

    it('should log function_call_delta event', () => {
      const event = { call_id: 'call_789', delta: 'arg delta' };
      const sequence = 5;

      const generator = handler.handleFunctionCallDelta(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'function_call_delta',
        sequence: 5,
        delta: 'arg delta',
      });
    });
  });

  describe('handleFunctionCallDone', () => {
    it('should yield function_call_done event and update status', () => {
      // Set up existing tool call
      mockState.toolCalls.set('call_abc', {
        type: 'function',
        input: '{"name":"value"}',
        status: 'in_progress',
      });

      const event = {
        call_id: 'call_abc',
        arguments: '{"name":"value"}',
      };
      const sequence = 10;

      const generator = handler.handleFunctionCallDone(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('function_call_done');

      const data = JSON.parse(results[0].data);
      expect(data).toEqual({
        call_id: 'call_abc',
        arguments: '{"name":"value"}',
        sequence: 10,
      });

      // Verify status updated
      expect(mockState.toolCalls.get('call_abc')?.status).toBe('completed');
    });

    it('should handle call_id not in state', () => {
      const event = { call_id: 'nonexistent', arguments: '{}' };
      const sequence = 1;

      const generator = handler.handleFunctionCallDone(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      // Should not throw, just yield event
    });

    it('should log function_call_done event', () => {
      const event = { call_id: 'call_xyz', arguments: '{"test":true}' };
      const sequence = 8;

      const generator = handler.handleFunctionCallDone(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'function_call_done',
        sequence: 8,
        response: { call_id: 'call_xyz', arguments: '{"test":true}' },
      });
    });
  });

  // ===== CODE INTERPRETER TESTS =====

  describe('handleCodeInterpreterProgress', () => {
    it('should yield code_interpreter progress events', () => {
      const event = {
        type: 'response.code_interpreter_call.in_progress',
        call_id: 'code_123',
      };
      const sequence = 1;

      const generator = handler.handleCodeInterpreterProgress(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('code_interpreter_call.in_progress');
      expect(results[0].data).toContain('"call_id":"code_123"');
    });

    it('should handle interpreting status', () => {
      const event = {
        type: 'response.code_interpreter_call.interpreting',
        call_id: 'code_456',
      };
      const sequence = 5;

      const generator = handler.handleCodeInterpreterProgress(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results[0].event).toBe('code_interpreter_call.interpreting');
    });

    it('should log code interpreter progress', () => {
      const event = {
        type: 'response.code_interpreter_call.in_progress',
        call_id: 'code_789',
      };
      const sequence = 3;

      const generator = handler.handleCodeInterpreterProgress(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'response.code_interpreter_call.in_progress',
        sequence: 3,
      });
    });
  });

  describe('handleCodeInterpreterCodeDelta', () => {
    it('should yield code delta event and initialize tool call', () => {
      const event = {
        call_id: 'code_abc',
        delta: 'import ',
      };
      const sequence = 1;

      const generator = handler.handleCodeInterpreterCodeDelta(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('code_interpreter_code_delta');

      const data = JSON.parse(results[0].data);
      expect(data).toEqual({
        call_id: 'code_abc',
        delta: 'import ',
        sequence: 1,
      });

      // Verify state initialization
      expect(mockState.toolCalls.get('code_abc')).toEqual({
        type: 'code_interpreter',
        input: '',
        code: 'import ',
        status: 'in_progress',
      });
    });

    it('should accumulate code deltas', () => {
      const callId = 'code_def';
      const deltas = [
        'import pandas as pd\n',
        'df = pd.DataFrame()\n',
        'print(df)',
      ];

      deltas.forEach((delta, index) => {
        const event = { call_id: callId, delta };
        const generator = handler.handleCodeInterpreterCodeDelta(
          event,
          mockState,
          index + 1,
        );
        Array.from(generator);
      });

      expect(mockState.toolCalls.get(callId)?.code).toBe(
        'import pandas as pd\ndf = pd.DataFrame()\nprint(df)',
      );
    });

    it('should log code delta event', () => {
      const event = { call_id: 'code_ghi', delta: 'print("hello")' };
      const sequence = 2;

      const generator = handler.handleCodeInterpreterCodeDelta(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'code_interpreter_code_delta',
        sequence: 2,
        delta: 'print("hello")',
      });
    });
  });

  describe('handleCodeInterpreterCodeDone', () => {
    it('should yield code done event', () => {
      const event = {
        call_id: 'code_jkl',
        code: 'import math\nprint(math.pi)',
      };
      const sequence = 10;

      const generator = handler.handleCodeInterpreterCodeDone(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('code_interpreter_code_done');

      const data = JSON.parse(results[0].data);
      expect(data).toEqual({
        call_id: 'code_jkl',
        code: 'import math\nprint(math.pi)',
        sequence: 10,
      });
    });

    it('should log code done event', () => {
      const event = { call_id: 'code_mno', code: 'result = 42' };
      const sequence = 12;

      const generator = handler.handleCodeInterpreterCodeDone(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'code_interpreter_code_done',
        sequence: 12,
        response: { code: 'result = 42' },
      });
    });
  });

  describe('handleCodeInterpreterCompleted', () => {
    it('should yield completed event and update state with results', () => {
      mockState.toolCalls.set('code_pqr', {
        type: 'code_interpreter',
        input: '',
        code: 'print("test")',
        status: 'in_progress',
      });

      const event = {
        call_id: 'code_pqr',
        output: { type: 'text', text: 'test\n' },
      };
      const sequence = 15;

      const generator = handler.handleCodeInterpreterCompleted(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('code_interpreter_completed');

      const data = JSON.parse(results[0].data);
      expect(data.output).toEqual({ type: 'text', text: 'test\n' });

      // Verify state updated
      expect(mockState.toolCalls.get('code_pqr')?.status).toBe('completed');
      expect(mockState.toolCalls.get('code_pqr')?.result).toEqual({
        type: 'text',
        text: 'test\n',
      });
    });

    it('should log completed event', () => {
      const event = {
        call_id: 'code_stu',
        output: { type: 'image', data: 'base64...' },
      };
      const sequence = 20;

      const generator = handler.handleCodeInterpreterCompleted(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'code_interpreter_completed',
        sequence: 20,
        response: {
          call_id: 'code_stu',
          output: { type: 'image', data: 'base64...' },
        },
      });
    });
  });

  // ===== FILE SEARCH TESTS =====

  describe('handleFileSearchProgress', () => {
    it('should yield file search progress events', () => {
      const event = {
        type: 'response.file_search_call.in_progress',
        call_id: 'file_123',
      };
      const sequence = 1;

      const generator = handler.handleFileSearchProgress(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('file_search_call.in_progress');
      expect(results[0].data).toContain('"call_id":"file_123"');
    });

    it('should handle searching status', () => {
      const event = {
        type: 'response.file_search_call.searching',
        call_id: 'file_456',
      };
      const sequence = 2;

      const generator = handler.handleFileSearchProgress(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results[0].event).toBe('file_search_call.searching');
    });

    it('should log file search progress', () => {
      const event = {
        type: 'response.file_search_call.in_progress',
        call_id: 'file_789',
      };
      const sequence = 3;

      const generator = handler.handleFileSearchProgress(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'response.file_search_call.in_progress',
        sequence: 3,
      });
    });
  });

  describe('handleFileSearchCompleted', () => {
    it('should yield file search completed event with results', () => {
      const event = {
        call_id: 'file_abc',
        results: [
          { file_id: 'file_1', content: 'Match 1' },
          { file_id: 'file_2', content: 'Match 2' },
        ],
      };
      const sequence = 10;

      const generator = handler.handleFileSearchCompleted(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('file_search_completed');

      const data = JSON.parse(results[0].data);
      expect(data.results).toHaveLength(2);
      expect(data.call_id).toBe('file_abc');
    });

    it('should log file search completed', () => {
      const event = {
        call_id: 'file_def',
        results: [{ file_id: 'file_3' }],
      };
      const sequence = 12;

      const generator = handler.handleFileSearchCompleted(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'file_search_completed',
        sequence: 12,
        response: { results: [{ file_id: 'file_3' }] },
      });
    });
  });

  // ===== WEB SEARCH TESTS =====

  describe('handleWebSearchProgress', () => {
    it('should yield web search progress events', () => {
      const event = {
        type: 'response.web_search_call.in_progress',
        call_id: 'web_123',
      };
      const sequence = 1;

      const generator = handler.handleWebSearchProgress(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('web_search_call.in_progress');
      expect(results[0].data).toContain('"call_id":"web_123"');
    });

    it('should handle searching status', () => {
      const event = {
        type: 'response.web_search_call.searching',
        call_id: 'web_456',
      };
      const sequence = 2;

      const generator = handler.handleWebSearchProgress(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results[0].event).toBe('web_search_call.searching');
    });

    it('should log web search progress', () => {
      const event = {
        type: 'response.web_search_call.searching',
        call_id: 'web_789',
      };
      const sequence = 3;

      const generator = handler.handleWebSearchProgress(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'response.web_search_call.searching',
        sequence: 3,
      });
    });
  });

  describe('handleWebSearchCompleted', () => {
    it('should yield web search completed event with results', () => {
      const event = {
        call_id: 'web_abc',
        results: [
          { url: 'https://example.com', title: 'Result 1' },
          { url: 'https://test.com', title: 'Result 2' },
        ],
      };
      const sequence = 10;

      const generator = handler.handleWebSearchCompleted(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('web_search_completed');

      const data = JSON.parse(results[0].data);
      expect(data.results).toHaveLength(2);
      expect(data.call_id).toBe('web_abc');
    });

    it('should log web search completed', () => {
      const event = {
        call_id: 'web_def',
        results: [{ url: 'https://example.org' }],
      };
      const sequence = 12;

      const generator = handler.handleWebSearchCompleted(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'web_search_completed',
        sequence: 12,
        response: { results: [{ url: 'https://example.org' }] },
      });
    });
  });

  // ===== CUSTOM TOOL TESTS =====

  describe('handleCustomToolDelta', () => {
    it('should yield custom tool delta event', () => {
      const event = {
        call_id: 'custom_123',
        delta: '{"action":',
      };
      const sequence = 1;

      const generator = handler.handleCustomToolDelta(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('custom_tool_delta');

      const data = JSON.parse(results[0].data);
      expect(data).toEqual({
        call_id: 'custom_123',
        delta: '{"action":',
        sequence: 1,
      });
    });

    it('should log custom tool delta', () => {
      const event = { call_id: 'custom_456', delta: 'input chunk' };
      const sequence = 5;

      const generator = handler.handleCustomToolDelta(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'custom_tool_delta',
        sequence: 5,
        delta: 'input chunk',
      });
    });
  });

  describe('handleCustomToolDone', () => {
    it('should yield custom tool done event', () => {
      const event = {
        call_id: 'custom_abc',
        input: { action: 'execute', params: { value: 42 } },
      };
      const sequence = 10;

      const generator = handler.handleCustomToolDone(
        event,
        mockState,
        sequence,
      );
      const results: SSEEvent[] = Array.from(generator);

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('custom_tool_done');

      const data = JSON.parse(results[0].data);
      expect(data.input).toEqual({ action: 'execute', params: { value: 42 } });
    });

    it('should log custom tool done', () => {
      const event = { call_id: 'custom_def', input: { test: true } };
      const sequence = 12;

      const generator = handler.handleCustomToolDone(
        event,
        mockState,
        sequence,
      );
      Array.from(generator);

      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        api: 'responses',
        endpoint: '/v1/responses (stream)',
        event_type: 'custom_tool_done',
        sequence: 12,
        response: { input: { test: true } },
      });
    });
  });

  // ===== INTEGRATION TESTS =====

  describe('integration scenarios', () => {
    it('should handle complete function call flow', () => {
      let sequence = 0;
      const callId = 'call_integration';

      // Delta events
      const deltas = [
        '{"name":',
        '"get_weather"',
        ',',
        '"location":',
        '"NYC"',
        '}',
      ];
      deltas.forEach((delta) => {
        const event = { call_id: callId, delta };
        Array.from(
          handler.handleFunctionCallDelta(event, mockState, ++sequence),
        );
      });

      // Done event
      const doneEvent = {
        call_id: callId,
        arguments: '{"name":"get_weather","location":"NYC"}',
      };
      Array.from(
        handler.handleFunctionCallDone(doneEvent, mockState, ++sequence),
      );

      expect(mockState.toolCalls.get(callId)).toEqual({
        type: 'function',
        input: '{"name":"get_weather","location":"NYC"}',
        status: 'completed',
      });
      expect(mockLoggerService.logStreamingEvent).toHaveBeenCalledTimes(7);
    });

    it('should handle complete code interpreter flow', () => {
      let sequence = 0;
      const callId = 'code_integration';

      // Progress
      Array.from(
        handler.handleCodeInterpreterProgress(
          {
            type: 'response.code_interpreter_call.in_progress',
            call_id: callId,
          },
          mockState,
          ++sequence,
        ),
      );

      // Code deltas
      const codeChunks = [
        'import math\n',
        'result = math.sqrt(16)\n',
        'print(result)',
      ];
      codeChunks.forEach((delta) => {
        Array.from(
          handler.handleCodeInterpreterCodeDelta(
            { call_id: callId, delta },
            mockState,
            ++sequence,
          ),
        );
      });

      // Code done
      Array.from(
        handler.handleCodeInterpreterCodeDone(
          {
            call_id: callId,
            code: 'import math\nresult = math.sqrt(16)\nprint(result)',
          },
          mockState,
          ++sequence,
        ),
      );

      // Interpreting
      Array.from(
        handler.handleCodeInterpreterProgress(
          {
            type: 'response.code_interpreter_call.interpreting',
            call_id: callId,
          },
          mockState,
          ++sequence,
        ),
      );

      // Completed
      Array.from(
        handler.handleCodeInterpreterCompleted(
          { call_id: callId, output: { type: 'text', text: '4.0\n' } },
          mockState,
          ++sequence,
        ),
      );

      expect(mockState.toolCalls.get(callId)?.status).toBe('completed');
      expect(mockState.toolCalls.get(callId)?.result).toEqual({
        type: 'text',
        text: '4.0\n',
      });
    });

    it('should handle multiple concurrent tool calls', () => {
      const callIds = ['call_1', 'call_2', 'call_3'];
      let sequence = 0;

      callIds.forEach((callId) => {
        Array.from(
          handler.handleFunctionCallDelta(
            { call_id: callId, delta: '{"test":true}' },
            mockState,
            ++sequence,
          ),
        );
        Array.from(
          handler.handleFunctionCallDone(
            { call_id: callId, arguments: '{"test":true}' },
            mockState,
            ++sequence,
          ),
        );
      });

      expect(mockState.toolCalls.size).toBe(3);
      callIds.forEach((callId) => {
        expect(mockState.toolCalls.get(callId)?.status).toBe('completed');
      });
    });
  });

  describe('Error Handling & Edge Cases', () => {
    describe('handleFunctionCallDelta - Malformed Events', () => {
      it('should handle null event', () => {
        const event = null;
        const sequence = 1;

        const generator = handler.handleFunctionCallDelta(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(results[0].event).toBe('function_call_delta');
      });

      it('should handle undefined event', () => {
        const event = undefined;
        const sequence = 1;

        const generator = handler.handleFunctionCallDelta(
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

        const generator = handler.handleFunctionCallDelta(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
      });
    });

    describe('handleCodeInterpreterProgress - Malformed Events', () => {
      it('should handle null event', () => {
        const event = null;
        const sequence = 1;

        const generator = handler.handleCodeInterpreterProgress(
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

        const generator = handler.handleCodeInterpreterProgress(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
      });
    });

    describe('Special Characters & Unicode', () => {
      it('should handle unicode in function call delta', () => {
        const event = {
          call_id: 'call_unicode',
          delta: '{"message":"你好世界 🌍"}',
        };
        const sequence = 1;

        const generator = handler.handleFunctionCallDelta(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(mockState.toolCalls.get('call_unicode')?.input).toBe(
          '{"message":"你好世界 🌍"}',
        );
      });

      it('should handle emojis in code interpreter delta', () => {
        const event = {
          call_id: 'code_emoji',
          delta: 'print("😀 👍 💯")',
        };
        const sequence = 1;

        const generator = handler.handleCodeInterpreterCodeDelta(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(mockState.toolCalls.get('code_emoji')?.code).toBe(
          'print("😀 👍 💯")',
        );
      });
    });

    describe('Invalid Sequence Numbers', () => {
      it('should handle negative sequence number', () => {
        const event = { call_id: 'call_123', delta: '{}' };
        const sequence = -1;

        const generator = handler.handleFunctionCallDelta(
          event,
          mockState,
          sequence,
        );
        const results: SSEEvent[] = Array.from(generator);

        expect(results).toHaveLength(1);
        expect(results[0].sequence).toBe(-1);
      });

      it('should handle very large sequence number', () => {
        const event = { call_id: 'call_123', delta: '{}' };
        const sequence = Number.MAX_SAFE_INTEGER;

        const generator = handler.handleFunctionCallDelta(
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
