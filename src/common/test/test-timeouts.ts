/**
 * Standardized test timeout constants for consistent test behavior
 *
 * **Purpose**: Centralize timeout values to ensure consistent test timing
 * across the entire test suite and simplify adjustments when needed.
 *
 * **Usage**:
 * ```typescript
 * import { TEST_TIMEOUTS } from '@common/test/test-timeouts';
 *
 * it('should poll until complete', async () => {
 *   // test code
 * }, TEST_TIMEOUTS.POLLING_TEST);
 * ```
 *
 * **Guidelines**:
 * - Use appropriate timeout for test type (unit vs integration vs polling)
 * - Never use magic numbers in test timeouts
 * - Adjust these constants instead of individual test values
 */

/**
 * Standard test timeout values (in milliseconds)
 */
export const TEST_TIMEOUTS = {
  /**
   * Unit tests (default)
   * Fast tests with no async operations or minimal delays
   * @example Component/service unit tests, validator tests
   */
  UNIT: 5000, // 5 seconds

  /**
   * Integration tests
   * Tests involving mocked API calls, multiple service interactions
   * @example Controller tests, service integration tests
   */
  INTEGRATION: 10000, // 10 seconds

  /**
   * Polling tests
   * Tests that simulate polling behavior with delays
   * @example pollUntilComplete(), pollFileUntilComplete()
   */
  POLLING: 30000, // 30 seconds

  /**
   * Long-running tests
   * Tests with extensive async operations or multiple polling cycles
   * @example E2E tests, complex integration tests
   */
  LONG_RUNNING: 60000, // 60 seconds

  /**
   * Extended tests
   * Tests requiring very long timeouts (e.g., file uploads, video generation)
   * @example Large file operations, video generation polling
   */
  EXTENDED: 120000, // 120 seconds (2 minutes)

  /**
   * Extra long tests
   * Tests requiring extra long timeouts (e.g., controller polling tests)
   * @example Controller-level polling operations
   */
  EXTRA_LONG: 300000, // 300 seconds (5 minutes)
} as const;

/**
 * Polling configuration constants
 */
export const POLLING_CONFIG = {
  /**
   * Default max wait time for polling operations
   */
  DEFAULT_MAX_WAIT: 30000, // 30 seconds

  /**
   * Custom max wait time for longer polling operations
   */
  CUSTOM_MAX_WAIT: 60000, // 60 seconds

  /**
   * Controller-level max wait time
   */
  CONTROLLER_MAX_WAIT: 300000, // 300 seconds (5 minutes)
} as const;

/**
 * OpenAI client configuration constants
 */
export const OPENAI_CONFIG = {
  /**
   * Default OpenAI client timeout
   */
  DEFAULT_TIMEOUT: 60000, // 60 seconds

  /**
   * Custom OpenAI client timeout (for testing timeout behavior)
   */
  CUSTOM_TIMEOUT: 30000, // 30 seconds

  /**
   * Extended OpenAI client timeout
   */
  EXTENDED_TIMEOUT: 120000, // 120 seconds (2 minutes)
} as const;

/**
 * Type-safe timeout getter
 * @param type - Timeout type
 * @returns Timeout value in milliseconds
 */
export function getTestTimeout(
  type: keyof typeof TEST_TIMEOUTS,
): number {
  return TEST_TIMEOUTS[type];
}

/**
 * Type-safe polling config getter
 * @param type - Polling config type
 * @returns Config value in milliseconds
 */
export function getPollingConfig(
  type: keyof typeof POLLING_CONFIG,
): number {
  return POLLING_CONFIG[type];
}

/**
 * Type-safe OpenAI config getter
 * @param type - OpenAI config type
 * @returns Config value in milliseconds
 */
export function getOpenAIConfig(
  type: keyof typeof OPENAI_CONFIG,
): number {
  return OPENAI_CONFIG[type];
}
