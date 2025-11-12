/**
 * Jest configuration for integration tests
 *
 * Integration tests verify that multiple components work together correctly.
 * They differ from:
 * - Unit tests: Test individual components in isolation with all dependencies mocked
 * - E2E tests: Test the full application via HTTP requests
 *
 * Integration tests:
 * - Test 2-3 components together (e.g., Controller + Service + Filter)
 * - Use real implementations where possible
 * - Mock only external services (OpenAI API, file system, etc.)
 * - Don't start a full HTTP server
 */

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.integration-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/*.spec.ts',
    '!src/**/*.e2e-spec.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.dto.ts',
    '!src/main.ts',
  ],
  coverageDirectory: './coverage/integration',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  testTimeout: 10000, // 10 seconds for integration tests
  verbose: true,
};
