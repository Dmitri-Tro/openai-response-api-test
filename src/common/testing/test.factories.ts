/**
 * Test Factory Functions
 *
 * Centralized factory functions for creating test mocks and fixtures.
 * Reduces code duplication across test files.
 */

import OpenAI from 'openai';
import type { ConfigService } from '@nestjs/config';
import type { LoggerService } from '../services/logger.service';
import type { StreamState } from '../../openai/interfaces/streaming-events.interface';
import type { Responses } from 'openai/resources/responses';

/**
 * Creates a mock LoggerService with all required methods
 */
export const createMockLoggerService = (): jest.Mocked<LoggerService> => {
  return {
    logOpenAIInteraction: jest.fn(),
    logStreamingEvent: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  } as unknown as jest.Mocked<LoggerService>;
};

/**
 * Creates a mock OpenAI client with responses and files methods
 */
export const createMockOpenAIClient = (): jest.Mocked<OpenAI> => {
  return {
    responses: {
      create: jest.fn(),
      retrieve: jest.fn(),
      delete: jest.fn(),
      cancel: jest.fn(),
    },
    files: {
      create: jest.fn(),
      retrieve: jest.fn(),
      list: jest.fn(),
      del: jest.fn(),
      retrieveContent: jest.fn(),
    },
  } as unknown as jest.Mocked<OpenAI>;
};

/**
 * Creates a fresh StreamState object with default values
 * Optional fields are left undefined to match expected behavior
 */
export const createMockStreamState = (): StreamState => {
  return {
    fullText: '',
    reasoning: '',
    reasoningSummary: '',
    refusal: '',
    toolCalls: new Map(),
    audio: '',
    audioTranscript: '',
    startTime: Date.now(),
  } as StreamState;
};

/**
 * Creates a mock ConfigService with common configuration values
 */
export const createMockConfigService = (): jest.Mocked<ConfigService> => {
  return {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        OPENAI_API_KEY: 'test-api-key',
        NODE_ENV: 'test',
        LOG_LEVEL: 'info',
      };
      return config[key];
    }),
    getOrThrow: jest.fn(),
  } as unknown as jest.Mocked<ConfigService>;
};

/**
 * Creates a mock OpenAI Response object for non-streaming responses
 */
export const createMockOpenAIResponse = (
  overrides?: Partial<Responses.Response>,
): Responses.Response => {
  const defaults: Responses.Response = {
    id: 'resp_test123',
    object: 'response' as const,
    created_at: 1234567890,
    model: 'gpt-5',
    output_text: 'This is a test response',
    status: 'completed' as const,
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
      input_tokens_details: {
        cached_tokens: 0,
      },
      output_tokens_details: {
        reasoning_tokens: 0,
      },
    },
    // Required fields from SDK
    conversation: null,
    error: null,
    incomplete_details: null,
    instructions: null,
    metadata: null,
    output: [],
    parallel_tool_calls: false,
    temperature: null,
    tool_choice: 'auto' as const,
    tools: [],
    top_p: null,
  };

  return { ...defaults, ...overrides };
};

/**
 * Creates a mock streaming event for testing event handlers
 */
export const createMockStreamingEvent = (
  type: string,
  data: Record<string, unknown>,
): unknown => {
  return {
    type,
    ...data,
  };
};

/**
 * Injects a mock OpenAI client into a service instance
 * Workaround for accessing private client property in tests
 *
 * @param service - The service instance
 * @param mockClient - The mock OpenAI client
 */
export const injectMockOpenAIClient = (
  service: unknown,
  mockClient: jest.Mocked<OpenAI>,
): void => {
  (service as { client: OpenAI }).client = mockClient;
};

/**
 * Creates a mock NestJS ExecutionContext for testing interceptors and filters
 */
export const createMockExecutionContext = (
  request?: Partial<Request>,
  response?: Partial<Response>,
) => {
  const mockRequest = {
    url: '/api/responses/text',
    method: 'POST',
    body: {},
    headers: {},
    ...request,
  };

  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    ...response,
  };

  return {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(mockRequest),
      getResponse: jest.fn().mockReturnValue(mockResponse),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  };
};

/**
 * Creates a mock NestJS CallHandler for testing interceptors
 */
export const createMockCallHandler = (returnValue?: unknown) => {
  return {
    handle: jest.fn().mockReturnValue({
      pipe: jest.fn().mockReturnThis(),
      subscribe: jest.fn((observer: { next?: (v: unknown) => void }) => {
        if (observer.next && returnValue !== undefined) {
          observer.next(returnValue);
        }
        return {
          unsubscribe: jest.fn(),
        };
      }),
    }),
  };
};

/**
 * Creates a mock NestJS ArgumentsHost for testing exception filters
 */
export const createMockArgumentsHost = () => {
  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  const mockRequest = {
    url: '/api/responses/text',
    method: 'POST',
  };

  return {
    switchToHttp: jest.fn().mockReturnValue({
      getResponse: jest.fn().mockReturnValue(mockResponse),
      getRequest: jest.fn().mockReturnValue(mockRequest),
    }),
    getArgByIndex: jest.fn(),
    getArgs: jest.fn(),
    getType: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
  };
};

/**
 * Helper to create OpenAI SDK error with proper typing
 * @param ErrorClass - OpenAI error class constructor
 * @param status - HTTP status code
 * @param message - Error message
 * @param requestId - Optional request ID
 * @param headers - Optional headers
 */
export const createOpenAIError = <
  T extends new (...args: unknown[]) => unknown,
>(
  ErrorClass: T,
  status: number,
  message: string,
  requestId?: string,
  headers?: Headers,
): InstanceType<T> => {
  const error = new ErrorClass(
    status,
    {
      error: {
        message,
        type: 'api_error',
        code: 'test_error',
      },
    },
    message,
    headers,
  ) as InstanceType<T>;

  if (requestId) {
    (error as unknown as { request_id: string }).request_id = requestId;
  }

  return error;
};

/**
 * Helper to create Headers object with rate limit information
 */
export const createRateLimitHeaders = (
  retryAfter?: string,
  limitRequests?: string,
  remainingRequests?: string,
  limitTokens?: string,
  remainingTokens?: string,
): Headers => {
  const headers = new Headers();

  if (retryAfter) headers.set('retry-after', retryAfter);
  if (limitRequests) headers.set('x-ratelimit-limit-requests', limitRequests);
  if (remainingRequests)
    headers.set('x-ratelimit-remaining-requests', remainingRequests);
  if (limitTokens) headers.set('x-ratelimit-limit-tokens', limitTokens);
  if (remainingTokens)
    headers.set('x-ratelimit-remaining-tokens', remainingTokens);

  return headers;
};

/**
 * Helper to wait for async operations in tests
 */
export const waitForAsync = (ms = 0): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Helper to create a generator that yields test events
 */
export function* createMockEventGenerator(
  events: Array<{ type: string; data: Record<string, unknown> }>,
): Generator<unknown> {
  for (const event of events) {
    yield createMockStreamingEvent(event.type, event.data);
  }
}
