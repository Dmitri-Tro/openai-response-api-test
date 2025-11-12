/**
 * Integration Test Setup Utilities
 *
 * Provides helper functions and configurations for integration tests.
 * These utilities help create test modules with real dependencies while
 * mocking only external services like the OpenAI API.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import OpenAI from 'openai';
import type { Responses } from 'openai/resources/responses';
import configuration from '../../src/config/configuration';
import { createMockOpenAIResponse } from '../../src/common/testing/test.factories';

/**
 * Creates a test module with OpenAI module dependencies
 * Mocks the OpenAI client while keeping all other services real
 */
export async function createIntegrationTestModule(
  imports: unknown[],
  providers: unknown[],
): Promise<TestingModule> {
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        load: [configuration],
        isGlobal: true,
      }),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      ...(imports as any[]),
    ],
    providers: [
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      ...(providers as any[]),
      {
        provide: 'OPENAI_CLIENT',
        useValue: createMockOpenAIClient(),
      },
    ],
  }).compile();
}

/**
 * Creates a mock OpenAI client with typical method implementations
 * Override specific methods in tests as needed
 */
export function createMockOpenAIClient(): jest.Mocked<OpenAI> {
  const mockResponses = {
    create: jest.fn(),
    retrieve: jest.fn(),
    cancel: jest.fn(),
    delete: jest.fn(),
  };

  return {
    responses: mockResponses,
  } as unknown as jest.Mocked<OpenAI>;
}

/**
 * Creates a mock streaming response (AsyncIterable)
 */
export async function* createMockStreamingResponse(
  events: Array<{ type: string; data?: any }>,
): AsyncIterable<any> {
  for (const event of events) {
    yield await Promise.resolve({
      type: event.type,
      ...event.data,
    });
  }
}

/**
 * Mock response generators for common scenarios
 */
export const MockResponses = {
  /**
   * Creates a successful text response
   */
  textResponse: (overrides?: Partial<Responses.Response>): Responses.Response =>
    createMockOpenAIResponse({
      output_text: 'This is a test response',
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30,
      },
      ...overrides,
    }),

  /**
   * Creates a successful image response
   */
  imageResponse: (
    overrides?: Partial<Responses.Response>,
  ): Responses.Response =>
    createMockOpenAIResponse({
      output_image: {
        url: 'https://example.com/image.png',
      },
      usage: {
        input_tokens: 15,
        output_tokens: 0,
        total_tokens: 15,
      },
      ...overrides,
    }),

  /**
   * Creates a rate limit error
   */
  rateLimitError: (): Error => {
    const error = new Error('Rate limit exceeded') as Error & {
      status: number;
      headers: Record<string, string>;
    };
    error.status = 429;
    error.headers = {
      'retry-after': '60',
      'x-ratelimit-limit-requests': '100',
      'x-ratelimit-remaining-requests': '0',
    };
    return error;
  },

  /**
   * Creates a server error
   */
  serverError: (): Error => {
    const error = new Error('Internal server error') as Error & {
      status: number;
    };
    error.status = 500;
    return error;
  },

  /**
   * Creates a validation error
   */
  validationError: (): Error => {
    const error = new Error('Invalid request') as Error & {
      status: number;
      code: string;
    };
    error.status = 400;
    error.code = 'invalid_request_error';
    return error;
  },
};

/**
 * Helper to wait for async operations
 */
export const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Test environment setup
 */
export function setupIntegrationTestEnvironment() {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.OPENAI_API_KEY = 'sk-test-integration-key-123456789';
  process.env.LOG_LEVEL = 'error'; // Reduce noise in integration tests

  // Disable actual API calls
  process.env.OPENAI_API_BASE_URL = 'http://localhost:9999'; // Non-existent endpoint
}

/**
 * Cleanup after integration tests
 */
export function cleanupIntegrationTestEnvironment() {
  // Restore original environment
  delete process.env.OPENAI_API_KEY;
  delete process.env.LOG_LEVEL;
  delete process.env.OPENAI_API_BASE_URL;
}
