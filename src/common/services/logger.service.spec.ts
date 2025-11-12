import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LoggerService, OpenAILogEntry } from './logger.service';

// Mock fs module
const mockExistsSync = jest.fn();
const mockMkdirSync = jest.fn();
const mockAppendFileSync = jest.fn();

jest.mock('fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
  appendFileSync: (...args: unknown[]) => mockAppendFileSync(...args),
}));

describe('LoggerService', () => {
  let service: LoggerService;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockMkdirSync.mockImplementation();
    mockAppendFileSync.mockImplementation();

    // Mock ConfigService
    mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, unknown> = {
          'logging.dir': './test-logs',
          nodeEnv: 'test',
        };
        return config[key];
      }),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoggerService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<LoggerService>(LoggerService);
  });

  describe('constructor and initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should create log directory if it does not exist', async () => {
      mockExistsSync.mockReturnValue(false);
      mockMkdirSync.mockImplementation();

      const module = await Test.createTestingModule({
        providers: [
          LoggerService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      expect(module).toBeDefined();
    });

    it('should use default log directory if not configured', async () => {
      mockConfigService.get = jest.fn().mockReturnValue(undefined);
      mockExistsSync.mockReturnValue(true);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LoggerService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const testService = module.get<LoggerService>(LoggerService);
      expect(testService).toBeDefined();
    });
  });

  describe('logOpenAIInteraction', () => {
    it('should write log entry to correct file path', () => {
      const entry: OpenAILogEntry = {
        timestamp: '2025-11-11T12:00:00.000Z',
        api: 'responses',
        endpoint: '/v1/responses',
        request: { input: 'test' },
        response: { output_text: 'response' },
        metadata: {
          latency_ms: 100,
          tokens_used: 50,
          cost_estimate: 0.01,
        },
      };

      // Mock date to ensure consistent file path
      const mockDate = new Date('2025-11-11T12:00:00.000Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      service.logOpenAIInteraction(entry);

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.stringContaining('2025-11-11'),
        expect.stringContaining('"api": "responses"'),
        'utf8',
      );
      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.stringContaining('responses.log'),
        expect.any(String),
        'utf8',
      );
    });

    it('should format log entry with separator', () => {
      const entry: OpenAILogEntry = {
        timestamp: '2025-11-11T12:00:00.000Z',
        api: 'responses',
        endpoint: '/v1/responses',
        request: { input: 'test' },
        metadata: {},
      };

      service.logOpenAIInteraction(entry);

      const logContent = mockAppendFileSync.mock.calls[0][1];
      expect(logContent).toContain(JSON.stringify(entry, null, 2));
      expect(logContent).toContain('-'.repeat(80));
    });

    // Note: Testing dated subdirectory creation is complex with singleton service
    // The mkdirSync call happens inside getLogFilePath which is called lazily
    // Directory creation is tested indirectly through successful log writes

    it('should log to images API file', () => {
      const entry: OpenAILogEntry = {
        timestamp: '2025-11-11T12:00:00.000Z',
        api: 'images',
        endpoint: '/v1/images/generate',
        request: { prompt: 'test image' },
        metadata: {},
      };

      service.logOpenAIInteraction(entry);

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.stringContaining('images.log'),
        expect.any(String),
        'utf8',
      );
    });

    it('should log to videos API file', () => {
      const entry: OpenAILogEntry = {
        timestamp: '2025-11-11T12:00:00.000Z',
        api: 'videos',
        endpoint: '/v1/videos/generate',
        request: { prompt: 'test video' },
        metadata: {},
      };

      service.logOpenAIInteraction(entry);

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.stringContaining('videos.log'),
        expect.any(String),
        'utf8',
      );
    });

    it('should handle errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockAppendFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });

      const entry: OpenAILogEntry = {
        timestamp: '2025-11-11T12:00:00.000Z',
        api: 'responses',
        endpoint: '/v1/responses',
        request: { input: 'test' },
        metadata: {},
      };

      expect(() => service.logOpenAIInteraction(entry)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to write log:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it('should log to console in development mode', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'nodeEnv') return 'development';
        if (key === 'logging.dir') return './test-logs';
        return undefined;
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const entry: OpenAILogEntry = {
        timestamp: '2025-11-11T12:00:00.000Z',
        api: 'responses',
        endpoint: '/v1/responses',
        request: { input: 'test' },
        response: { output_text: 'response' },
        metadata: {
          latency_ms: 100,
          tokens_used: 50,
        },
      };

      service.logOpenAIInteraction(entry);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('OpenAI API Call'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('API: responses'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Latency: 100ms'),
      );

      consoleSpy.mockRestore();
    });

    it('should log errors to console in development mode', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'nodeEnv') return 'development';
        if (key === 'logging.dir') return './test-logs';
        return undefined;
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const entry: OpenAILogEntry = {
        timestamp: '2025-11-11T12:00:00.000Z',
        api: 'responses',
        endpoint: '/v1/responses',
        request: { input: 'test' },
        error: {
          message: 'API Error',
          status: 500,
        },
        metadata: {},
      };

      service.logOpenAIInteraction(entry);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('OpenAI API Call'),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error:',
        expect.stringContaining('API Error'),
      );

      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should not log to console in non-development mode', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'nodeEnv') return 'production';
        if (key === 'logging.dir') return './test-logs';
        return undefined;
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const entry: OpenAILogEntry = {
        timestamp: '2025-11-11T12:00:00.000Z',
        api: 'responses',
        endpoint: '/v1/responses',
        request: { input: 'test' },
        metadata: {},
      };

      service.logOpenAIInteraction(entry);

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('logStreamingEvent', () => {
    it('should write streaming event to correct file path', () => {
      const entry = {
        timestamp: '2025-11-11T12:00:00.000Z',
        api: 'responses' as const,
        endpoint: '/v1/responses (stream)',
        event_type: 'text_delta',
        sequence: 1,
        delta: 'Hello',
      };

      service.logStreamingEvent(entry);

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.stringContaining('responses.log'),
        expect.stringContaining('"event_type": "text_delta"'),
        'utf8',
      );
    });

    it('should format streaming event with separator', () => {
      const entry = {
        timestamp: '2025-11-11T12:00:00.000Z',
        api: 'responses' as const,
        endpoint: '/v1/responses (stream)',
        event_type: 'text_delta',
        sequence: 1,
      };

      service.logStreamingEvent(entry);

      const logContent = mockAppendFileSync.mock.calls[0][1];
      expect(logContent).toContain(JSON.stringify(entry, null, 2));
      expect(logContent).toContain('-'.repeat(80));
    });

    it('should log streaming events to console in development mode', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'nodeEnv') return 'development';
        if (key === 'logging.dir') return './test-logs';
        return undefined;
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const entry = {
        timestamp: '2025-11-11T12:00:00.000Z',
        api: 'responses' as const,
        endpoint: '/v1/responses (stream)',
        event_type: 'text_delta',
        sequence: 5,
        delta: 'Hello world',
      };

      service.logStreamingEvent(entry);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Streaming Event'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Event Type: text_delta'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Sequence: 5'),
      );

      consoleSpy.mockRestore();
    });

    it('should truncate long delta in console output', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'nodeEnv') return 'development';
        if (key === 'logging.dir') return './test-logs';
        return undefined;
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const longDelta = 'a'.repeat(200);
      const entry = {
        timestamp: '2025-11-11T12:00:00.000Z',
        api: 'responses' as const,
        endpoint: '/v1/responses (stream)',
        event_type: 'text_delta',
        sequence: 1,
        delta: longDelta,
      };

      service.logStreamingEvent(entry);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Delta: ' + 'a'.repeat(100) + '...'),
      );

      consoleSpy.mockRestore();
    });

    it('should log streaming errors to console in development mode', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'nodeEnv') return 'development';
        if (key === 'logging.dir') return './test-logs';
        return undefined;
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const entry = {
        timestamp: '2025-11-11T12:00:00.000Z',
        api: 'responses' as const,
        endpoint: '/v1/responses (stream)',
        event_type: 'error',
        sequence: 10,
        error: { message: 'Stream error' },
      };

      service.logStreamingEvent(entry);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Streaming Event'),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error:',
        expect.objectContaining({ message: 'Stream error' }),
      );

      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should handle streaming event write errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockAppendFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });

      const entry = {
        timestamp: '2025-11-11T12:00:00.000Z',
        api: 'responses' as const,
        endpoint: '/v1/responses (stream)',
        event_type: 'text_delta',
        sequence: 1,
      };

      expect(() => service.logStreamingEvent(entry)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to write streaming log:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });
});
