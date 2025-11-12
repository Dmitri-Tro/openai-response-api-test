# Integration Tests

Integration tests verify that multiple components work together correctly without requiring a full HTTP server.

## Test Types Comparison

### Unit Tests (`*.spec.ts`)
- **Location**: `src/**/*.spec.ts`
- **Scope**: Individual component in isolation
- **Dependencies**: All dependencies are mocked
- **Example**: Testing `OpenAIResponsesService` with mocked OpenAI client and LoggerService
- **Run**: `npm run test`

### Integration Tests (`*.integration-spec.ts`)
- **Location**: `test/integration/*.integration-spec.ts`
- **Scope**: 2-3 components working together
- **Dependencies**: Real implementations, mock only external services (OpenAI API)
- **Example**: Testing Controller → Service → Filter flow with real service but mocked OpenAI client
- **Run**: `npm run test:integration`

### E2E Tests (`*.e2e-spec.ts`)
- **Location**: `test/*.e2e-spec.ts`
- **Scope**: Full application via HTTP
- **Dependencies**: All real (requires API key for real OpenAI calls)
- **Example**: Making actual HTTP POST to `/api/responses/text` and verifying response
- **Run**: `npm run test:e2e`

## Integration Test Structure

```
test/integration/
├── README.md (this file)
├── setup.ts (test utilities and helpers)
├── controller-service-filter.integration-spec.ts
├── service-dependencies.integration-spec.ts
├── multi-step-workflow.integration-spec.ts
├── error-recovery.integration-spec.ts
└── edge-cases/
    ├── token-limits.integration-spec.ts
    ├── streaming.integration-spec.ts
    ├── data-size.integration-spec.ts
    ├── parameter-validation.integration-spec.ts
    └── rate-limits.integration-spec.ts
```

## Writing Integration Tests

### Basic Pattern

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ResponsesController } from '../../src/openai/controllers/responses.controller';
import { OpenAIResponsesService } from '../../src/openai/services/openai-responses.service';
import { OpenAIExceptionFilter } from '../../src/common/filters/openai-exception.filter';
import { createIntegrationTestModule, MockResponses } from './setup';

describe('Controller + Service + Filter Integration', () => {
  let module: TestingModule;
  let controller: ResponsesController;
  let service: OpenAIResponsesService;
  let mockOpenAIClient: any;

  beforeAll(async () => {
    module = await createIntegrationTestModule(
      [/* modules */],
      [ResponsesController, OpenAIResponsesService, /* other providers */],
    );

    controller = module.get<ResponsesController>(ResponsesController);
    service = module.get<OpenAIResponsesService>(OpenAIResponsesService);
    mockOpenAIClient = module.get('OPENAI_CLIENT');
  });

  afterAll(async () => {
    await module.close();
  });

  it('should handle successful text response end-to-end', async () => {
    // Arrange
    mockOpenAIClient.responses.create.mockResolvedValue(
      MockResponses.textResponse(),
    );

    // Act
    const result = await controller.createTextResponse({
      input: 'Test prompt',
      model: 'gpt-5',
    });

    // Assert
    expect(result.output_text).toBe('This is a test response');
    expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith(
      expect.objectContaining({
        input: 'Test prompt',
        model: 'gpt-5',
      }),
    );
  });
});
```

## Test Categories

### 1. Controller + Service + Filter (20-30 tests)
Tests the complete request/response flow through the application layers:
- Successful requests
- Error handling via exception filter
- Input validation
- Response transformation

### 2. Service + Dependencies (10-15 tests)
Tests service interactions with its dependencies:
- Service + OpenAI Client
- Service + Logger
- Service + Config

### 3. Multi-Step Workflows (15-25 tests)
Tests complex multi-turn interactions:
- Conversation continuity
- Response retrieval
- Response cancellation
- Response deletion

### 4. Error Recovery (10-15 tests)
Tests error handling and recovery scenarios:
- Retry logic with rate limits
- Fallback behavior
- Partial failure handling

### 5. Edge Cases (50-75 tests total)
Tests boundary conditions and unusual inputs:
- **Token Limits** (10-15 tests): max_output_tokens, context windows
- **Streaming** (15-20 tests): interrupted streams, malformed events
- **Data Size** (10-15 tests): large prompts, massive responses
- **Parameter Validation** (10-15 tests): invalid combinations, missing required fields
- **Rate Limits** (5-10 tests): rate limit headers, retry-after behavior

## Running Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific integration test file
npm run test:integration -- controller-service-filter

# Run with coverage
npm run test:integration -- --coverage

# Run in watch mode
npm run test:integration -- --watch
```

## Best Practices

1. **Use Real Implementations**: Don't mock services unless they make external calls
2. **Mock External Services**: Always mock OpenAI API, file system, network calls
3. **Test Realistic Scenarios**: Use actual DTOs and data structures from your app
4. **Verify Side Effects**: Check that logging, caching, and state changes occur correctly
5. **Keep Tests Fast**: Integration tests should complete in <100ms each
6. **Isolate Tests**: Each test should be independent and not rely on others
7. **Use Setup Helpers**: Leverage `setup.ts` utilities to reduce boilerplate

## Coverage Goals

- **Unit Tests**: 80%+ coverage of individual components
- **Integration Tests**: 70%+ coverage of component interactions
- **E2E Tests**: Cover critical user journeys

Integration tests should focus on the "glue code" between components that unit tests miss.
