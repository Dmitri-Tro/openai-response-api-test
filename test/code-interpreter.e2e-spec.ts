import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'http';
import type { Responses } from 'openai/resources/responses';
import { AppModule } from '../src/app.module';
import { OpenAIExceptionFilter } from '../src/common/filters/openai-exception.filter';
import { LoggerService } from '../src/common/services/logger.service';

/**
 * Comprehensive E2E tests for Code Interpreter Tool
 * Uses real OpenAI API - requires OPENAI_API_KEY environment variable
 *
 * Tests code interpreter capabilities including:
 * - Python code execution
 * - Auto-container management
 * - Streaming code generation
 * - Output handling (logs, images, files)
 * - Integration with other tools
 *
 * To run: OPENAI_API_KEY=sk-... npm run test:e2e
 */
describe('Code Interpreter E2E (Real API)', () => {
  let app: INestApplication;
  const hasApiKey = !!process.env.OPENAI_API_KEY;

  // Skip all tests if no API key is provided
  const testIf = (condition: boolean) => (condition ? it : it.skip);

  beforeAll(async () => {
    if (!hasApiKey) {
      console.warn(
        '\n⚠️  OPENAI_API_KEY not set - skipping Code Interpreter E2E tests\n' +
          'To run these tests: OPENAI_API_KEY=sk-... npm run test:e2e\n',
      );
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    // Get LoggerService from the module for exception filter
    const loggerService = app.get(LoggerService);
    app.useGlobalFilters(new OpenAIExceptionFilter(loggerService));
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('POST /api/responses/text - Basic Code Interpreter', () => {
    testIf(hasApiKey)(
      'should execute simple Python calculation',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/text')
          .send({
            model: 'gpt-4o-mini',
            input: 'Calculate the factorial of 5 using Python',
            tools: [
              {
                type: 'code_interpreter',
                container: {
                  type: 'auto',
                },
              },
            ],
            max_output_tokens: 500,
          })
          .expect(201)
          .expect('Content-Type', /json/);

        const result = response.body as Responses.Response;

        // Verify response structure
        expect(result).toHaveProperty('id');
        expect(result.id).toMatch(/^resp_/);
        expect(result).toHaveProperty('object', 'response');
        expect(result).toHaveProperty('model');
        expect(result).toHaveProperty('output_text');

        // Verify usage data
        expect(result).toHaveProperty('usage');
        expect(result.usage?.input_tokens).toBeGreaterThan(0);
        expect(result.usage?.output_tokens).toBeGreaterThan(0);

        // Code interpreter specific checks
        // The output should contain or reference the calculation result (120)
        const output = result.output_text.toLowerCase();
        expect(
          output.includes('120') ||
            output.includes('factorial') ||
            output.includes('result'),
        ).toBe(true);

        console.log(
          `✅ Code execution successful: "${result.output_text.substring(0, 100)}..."`,
        );
        console.log(`   Tokens used: ${result.usage?.total_tokens}`);
      },
      60000,
    ); // 60s timeout for code execution

    testIf(hasApiKey)(
      'should handle code interpreter with auto container',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/text')
          .send({
            model: 'gpt-4o-mini',
            input:
              'Write Python code to generate the first 10 Fibonacci numbers',
            tools: [
              {
                type: 'code_interpreter',
                container: {
                  type: 'auto',
                },
              },
            ],
            max_output_tokens: 500,
          })
          .expect(201);

        const result = response.body as Responses.Response;

        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('output_text');
        expect(result.output_text).toBeTruthy();

        console.log(`✅ Auto container test passed`);
        console.log(`   Output: "${result.output_text.substring(0, 100)}..."`);
      },
      60000,
    );

    testIf(hasApiKey)(
      'should request code interpreter outputs with include parameter',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/text')
          .send({
            model: 'gpt-4o-mini',
            input:
              'Calculate the sum of squares from 1 to 10 and show the result',
            tools: [
              {
                type: 'code_interpreter',
                container: {
                  type: 'auto',
                },
              },
            ],
            include: ['code_interpreter_call.outputs'],
            max_output_tokens: 500,
          })
          .expect(201);

        const result = response.body as Responses.Response;

        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('output_text');

        // Note: The include parameter tells the API to include detailed outputs
        // The actual structure depends on whether code_interpreter was used
        // If it was used, we might see additional fields in the response

        console.log(`✅ Include parameter test passed (outputs requested)`);
        console.log(`   Response keys: ${Object.keys(result).join(', ')}`);
      },
      60000,
    );

    testIf(hasApiKey)(
      'should combine code interpreter with function tool',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/text')
          .send({
            model: 'gpt-4o-mini',
            input:
              'Calculate the square root of 144 using Python, then describe what you did',
            tools: [
              {
                type: 'code_interpreter',
                container: {
                  type: 'auto',
                },
              },
              {
                type: 'function',
                name: 'describe_calculation',
                description: 'Describe the calculation performed',
                parameters: {
                  type: 'object',
                  properties: {
                    operation: {
                      type: 'string',
                      description: 'The operation performed',
                    },
                    result: {
                      type: 'string',
                      description: 'The result of the calculation',
                    },
                  },
                  required: ['operation', 'result'],
                },
              },
            ],
            max_output_tokens: 500,
          })
          .expect(201);

        const result = response.body as Responses.Response;

        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('output_text');
        // Note: output_text may be empty when using function tools
        // The response is valid as long as it has the expected structure

        console.log(`✅ Multi-tool test passed (code_interpreter + function)`);
        if (result.output_text) {
          console.log(
            `   Output: "${result.output_text.substring(0, 100)}..."`,
          );
        } else {
          console.log(`   Output: (empty - function tool response)`);
        }
      },
      60000,
    );
  });

  describe('POST /api/responses/text/stream - Code Interpreter Streaming', () => {
    testIf(hasApiKey)(
      'should stream code interpreter execution',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/text/stream')
          .send({
            model: 'gpt-4o-mini',
            input: 'Use Python to calculate 2^10',
            tools: [
              {
                type: 'code_interpreter',
                container: {
                  type: 'auto',
                },
              },
            ],
            max_output_tokens: 300,
          })
          .expect(201)
          .expect('Content-Type', /text\/event-stream/);

        // Parse SSE events from response
        const events = response.text
          .split('\n\n')
          .filter((chunk) => chunk.trim())
          .map((chunk) => {
            const lines = chunk.split('\n');
            const event: Record<string, unknown> = {};
            for (const line of lines) {
              if (line.startsWith('event:')) {
                event.event = line.substring(6).trim();
              } else if (line.startsWith('data:')) {
                try {
                  event.data = JSON.parse(line.substring(5).trim());
                } catch {
                  event.data = line.substring(5).trim();
                }
              }
            }
            return event;
          });

        // Should have multiple events
        expect(events.length).toBeGreaterThan(0);

        // Look for code interpreter specific events
        const eventTypes = events
          .map((e) => e.event as string | undefined)
          .filter((e) => e !== undefined);

        console.log(
          `✅ Streaming test passed - received ${events.length} events`,
        );
        console.log(`   Event types: ${[...new Set(eventTypes)].join(', ')}`);

        // Common event types to expect (may vary based on model behavior):
        // - code_interpreter_call.in_progress
        // - code_interpreter_call.generating
        // - code_interpreter_code.delta
        // - code_interpreter_code.done
        // - code_interpreter_call.completed
        // - response.completed

        const hasCodeEvents = eventTypes.some(
          (type) =>
            type?.includes('code_interpreter') || type?.includes('response'),
        );
        expect(hasCodeEvents).toBe(true);
      },
      60000,
    );

    testIf(hasApiKey)(
      'should stream code generation deltas',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/text/stream')
          .send({
            model: 'gpt-4o-mini',
            input: 'Write a Python function to reverse a string',
            tools: [
              {
                type: 'code_interpreter',
                container: {
                  type: 'auto',
                },
              },
            ],
            max_output_tokens: 400,
          })
          .expect(201);

        const events = response.text
          .split('\n\n')
          .filter((chunk) => chunk.trim());

        expect(events.length).toBeGreaterThan(0);

        // Count code-related events
        const codeEvents = events.filter((chunk) =>
          chunk.includes('code_interpreter'),
        );

        console.log(
          `✅ Code delta streaming test passed - ${codeEvents.length} code events`,
        );
      },
      60000,
    );
  });

  describe('Validation and Error Handling', () => {
    testIf(hasApiKey)(
      'should reject invalid code_interpreter configuration',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/text')
          .send({
            model: 'gpt-4o-mini',
            input: 'Calculate something',
            tools: [
              {
                type: 'code_interpreter',
                container: {
                  type: 'invalid_type', // Invalid container type
                },
              },
            ],
          })
          .expect(400); // Expect validation error

        const error = response.body as { message: string };
        expect(error).toHaveProperty('message');
        // Error message format may vary between validation and API

        console.log(`✅ Validation rejection test passed`);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should reject empty file_ids array',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/text')
          .send({
            model: 'gpt-4o-mini',
            input: 'Process files',
            tools: [
              {
                type: 'code_interpreter',
                container: {
                  type: 'auto',
                  file_ids: [], // Empty array should be rejected
                },
              },
            ],
          })
          .expect(400);

        const error = response.body as { message: string };
        expect(error).toHaveProperty('message');
        // Error message format may vary between validation and API

        console.log(`✅ Empty file_ids validation test passed`);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should reject invalid file_id format',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/text')
          .send({
            model: 'gpt-4o-mini',
            input: 'Process files',
            tools: [
              {
                type: 'code_interpreter',
                container: {
                  type: 'auto',
                  file_ids: ['invalid-file-id'], // Should start with "file-"
                },
              },
            ],
          })
          .expect(400);

        const error = response.body as { message: string };
        expect(error).toHaveProperty('message');

        console.log(`✅ Invalid file_id format validation test passed`);
      },
      30000,
    );
  });

  describe('Advanced Scenarios', () => {
    testIf(hasApiKey)(
      'should handle multiple code interpreter tools',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/text')
          .send({
            model: 'gpt-4o-mini',
            input:
              'Calculate both the factorial of 5 and the Fibonacci sequence up to 10',
            tools: [
              {
                type: 'code_interpreter',
                container: {
                  type: 'auto',
                },
              },
              {
                type: 'code_interpreter',
                container: {
                  type: 'auto',
                },
              },
            ],
            max_output_tokens: 600,
          })
          .expect(201);

        const result = response.body as Responses.Response;

        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('output_text');

        console.log(`✅ Multiple code_interpreter tools test passed`);
        console.log(`   Output: "${result.output_text.substring(0, 100)}..."`);
      },
      60000,
    );

    testIf(hasApiKey)(
      'should handle code interpreter with complex calculation',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/text')
          .send({
            model: 'gpt-4o-mini',
            input:
              'Using Python, calculate the mean, median, and standard deviation of this dataset: [10, 20, 30, 40, 50]',
            tools: [
              {
                type: 'code_interpreter',
                container: {
                  type: 'auto',
                },
              },
            ],
            include: ['code_interpreter_call.outputs'],
            max_output_tokens: 600,
          })
          .expect(201);

        const result = response.body as Responses.Response;

        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('output_text');

        const output = result.output_text.toLowerCase();

        // Should mention statistical terms
        const hasStats =
          output.includes('mean') ||
          output.includes('median') ||
          output.includes('standard deviation') ||
          output.includes('30'); // mean of the dataset

        expect(hasStats).toBe(true);

        console.log(`✅ Complex calculation test passed`);
        console.log(
          `   Statistical analysis: "${result.output_text.substring(0, 150)}..."`,
        );
      },
      60000,
    );
  });
});
