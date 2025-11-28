import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'http';
import type { Responses } from 'openai/resources/responses';
import { AppModule } from '../src/app.module';
import { OpenAIExceptionFilter } from '../src/common/filters/openai-exception.filter';
import { LoggerService } from '../src/common/services/logger.service';

/**
 * Comprehensive E2E tests for OpenAI Text Responses API
 * Uses real OpenAI API - requires OPENAI_API_KEY environment variable
 *
 * To run: OPENAI_API_KEY=sk-... npm run test:e2e
 */
describe('OpenAI Responses E2E (Real API)', () => {
  let app: INestApplication;
  const hasApiKey = !!process.env.OPENAI_API_KEY;

  // Skip all tests if no API key is provided
  const testIf = (condition: boolean) => (condition ? it : it.skip);

  beforeAll(async () => {
    if (!hasApiKey) {
      console.warn(
        '\n⚠️  OPENAI_API_KEY not set - skipping OpenAI E2E tests\n' +
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

  describe('POST /api/responses/text - Basic Text Generation', () => {
    testIf(hasApiKey)(
      'should generate a simple text response',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/text')
          .send({
            model: 'gpt-4o-mini', // Using mini for faster/cheaper tests
            input: 'Say "Hello World" and nothing else',
            max_output_tokens: 20, // Minimum is 16
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
        expect(result.output_text).toBeTruthy();

        // Verify usage data
        expect(result).toHaveProperty('usage');
        expect(result.usage).toHaveProperty('input_tokens');
        expect(result.usage).toHaveProperty('output_tokens');
        expect(result.usage).toHaveProperty('total_tokens');
        expect(result.usage?.input_tokens).toBeGreaterThan(0);
        expect(result.usage?.output_tokens).toBeGreaterThan(0);

        console.log(
          `✅ Text response: "${result.output_text}" (${result.usage?.total_tokens} tokens)`,
        );
      },
      30000,
    ); // 30s timeout for API calls

    testIf(hasApiKey)(
      'should respect temperature parameter',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/text')
          .send({
            model: 'gpt-4o-mini',
            input: 'Generate a random number between 1 and 100',
            temperature: 0.1, // Low temperature for more deterministic output
            max_output_tokens: 20, // Minimum is 16
          })
          .expect(201);

        const result = response.body as Responses.Response;
        expect(result.output_text).toBeTruthy();
        console.log(`✅ Temperature test: "${result.output_text}"`);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should handle instructions parameter',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/text')
          .send({
            model: 'gpt-4o-mini',
            input: 'What is 2+2?',
            instructions: 'Answer in exactly one word',
            max_output_tokens: 16, // Minimum is 16
          })
          .expect(201);

        const result = response.body as Responses.Response;
        expect(result.output_text).toBeTruthy();
        expect(result.output_text.split(/\s+/).length).toBeLessThanOrEqual(3); // Should be very short
        console.log(`✅ Instructions test: "${result.output_text}"`);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should respect max_output_tokens',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/text')
          .send({
            model: 'gpt-4o-mini',
            input: 'Write a story',
            max_output_tokens: 16, // Minimum allowed
          })
          .expect(201);

        const result = response.body as Responses.Response;
        expect(result.usage?.output_tokens).toBeLessThanOrEqual(16);
        console.log(
          `✅ Token limit: ${result.usage?.output_tokens} tokens (max 16)`,
        );
      },
      30000,
    );
  });

  describe('POST /api/responses/text - Validation', () => {
    testIf(hasApiKey)('should reject missing input field', async () => {
      await request(app.getHttpServer() as Server)
        .post('/api/responses/text')
        .send({
          model: 'gpt-4o-mini',
          // Missing required 'input' field
        })
        .expect(400);
    });

    testIf(hasApiKey)('should reject invalid temperature', async () => {
      await request(app.getHttpServer() as Server)
        .post('/api/responses/text')
        .send({
          model: 'gpt-4o-mini',
          input: 'Test',
          temperature: 5.0, // Invalid: max is 2.0
        })
        .expect(400);
    });

    testIf(hasApiKey)('should reject invalid top_p', async () => {
      await request(app.getHttpServer() as Server)
        .post('/api/responses/text')
        .send({
          model: 'gpt-4o-mini',
          input: 'Test',
          top_p: 1.5, // Invalid: max is 1.0
        })
        .expect(400);
    });
  });

  describe('POST /api/responses/text - Advanced Features', () => {
    testIf(hasApiKey)(
      'should support structured output (JSON)',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/text')
          .send({
            model: 'gpt-4o-mini',
            input: 'Generate a JSON object with name and age fields',
            text: {
              format: { type: 'json_object' },
            },
            max_output_tokens: 50,
          })
          .expect(201);

        const result = response.body as Responses.Response;
        expect(result.output_text).toBeTruthy();
        // Should be valid JSON
        const parsed = JSON.parse(result.output_text) as Record<
          string,
          unknown
        >;
        expect(parsed).toHaveProperty('name');
        expect(parsed).toHaveProperty('age');
        console.log(`✅ JSON output: ${result.output_text}`);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should support function calling',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/text')
          .send({
            model: 'gpt-4o-mini',
            input: 'What is the weather in San Francisco?',
            tools: [
              {
                type: 'function',
                name: 'get_weather',
                description: 'Get the current weather for a location',
                parameters: {
                  type: 'object',
                  properties: {
                    location: {
                      type: 'string',
                      description: 'The city name',
                    },
                    unit: {
                      type: 'string',
                      enum: ['celsius', 'fahrenheit'],
                    },
                  },
                  required: ['location'],
                },
              },
            ],
            tool_choice: 'required',
          });

        expect(response.status).toBe(201);

        const result = response.body as Responses.Response;
        expect(result).toHaveProperty('output');
        expect(Array.isArray(result.output)).toBe(true);
        expect(result.output.length).toBeGreaterThan(0);

        const functionCall = result.output[0] as {
          type: string;
          name: string;
          arguments: string;
        };
        expect(functionCall).toHaveProperty('type', 'function_call');
        expect(functionCall).toHaveProperty('name', 'get_weather');
        expect(functionCall).toHaveProperty('arguments');

        const args = JSON.parse(functionCall.arguments || '{}') as {
          location?: string;
        };
        expect(args).toHaveProperty('location');
        expect(args.location?.toLowerCase()).toContain('san francisco');
        console.log(`✅ Function call: get_weather(${functionCall.arguments})`);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should support metadata parameter',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/text')
          .send({
            model: 'gpt-4o-mini',
            input: 'Say hello',
            max_output_tokens: 16, // Minimum is 16
            metadata: {
              test_id: 'e2e-metadata-test',
              user: 'test-user',
            },
          })
          .expect(201);

        const result = response.body as Responses.Response;
        expect(result.output_text).toBeTruthy();
        console.log(`✅ Metadata test passed`);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should support store parameter for retrieval',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/text')
          .send({
            model: 'gpt-4o-mini',
            input: 'Remember this message',
            max_output_tokens: 16, // Minimum is 16
            store: true,
          })
          .expect(201);

        const result = response.body as Responses.Response;
        expect(result.id).toBeTruthy();
        const responseId = result.id;

        // Try to retrieve the stored response
        const retrieved = await request(app.getHttpServer() as Server)
          .get(`/api/responses/${responseId}`)
          .expect(200);

        const retrievedResult = retrieved.body as Responses.Response;
        expect(retrievedResult.id).toBe(responseId);
        expect(retrievedResult.output_text).toBe(result.output_text);
        console.log(`✅ Stored and retrieved response: ${responseId}`);
      },
      30000,
    );
  });

  describe('POST /api/responses/text/stream - Streaming', () => {
    testIf(hasApiKey)(
      'should stream text deltas',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/text/stream')
          .send({
            model: 'gpt-4o-mini',
            input: 'Count from 1 to 5',
            stream: true,
            max_output_tokens: 30, // Higher for better streaming
          })
          .expect(201) // Streaming returns 201
          .expect('Content-Type', /text\/event-stream/);

        interface SSEEvent {
          event: string;
          data: { delta?: string; [key: string]: unknown };
        }

        // Parse SSE response
        const events = response.text
          .split('\n\n')
          .filter((chunk) => chunk.trim())
          .map((chunk) => {
            const lines = chunk.split('\n');
            const eventLine = lines.find((line) => line.startsWith('event: '));
            const dataLine = lines.find((line) => line.startsWith('data: '));

            if (!eventLine || !dataLine) return null;

            return {
              event: eventLine.replace('event: ', ''),
              data: JSON.parse(dataLine.replace('data: ', '')) as {
                delta?: string;
                [key: string]: unknown;
              },
            } as SSEEvent;
          })
          .filter((e): e is SSEEvent => e !== null);

        // Verify we got streaming events
        expect(events.length).toBeGreaterThan(0);

        // Should have response_created event
        const createdEvent = events.find((e) => e.event === 'response_created');
        expect(createdEvent).toBeDefined();

        // Should have text_delta events
        const deltaEvents = events.filter((e) => e.event === 'text_delta');
        expect(deltaEvents.length).toBeGreaterThan(0);

        // Should have text_done event
        const doneEvent = events.find((e) => e.event === 'text_done');
        expect(doneEvent).toBeDefined();

        // Should have completion event (response_done or response_completed)
        const completionEvent = events.find(
          (e) =>
            e.event === 'response_done' || e.event === 'response_completed',
        );
        expect(completionEvent).toBeDefined();

        // Reconstruct full text from deltas
        const fullText = deltaEvents.map((e) => e.data.delta || '').join('');

        console.log(
          `✅ Streaming: ${deltaEvents.length} deltas, text: "${fullText}"`,
        );
      },
      30000,
    );

    testIf(hasApiKey)(
      'should include sequence numbers',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/text/stream')
          .send({
            model: 'gpt-4o-mini',
            input: 'Say hi',
            stream: true,
            max_output_tokens: 16, // Minimum is 16
          })
          .expect(201); // Streaming returns 201

        const events = response.text
          .split('\n\n')
          .filter((chunk) => chunk.trim())
          .map((chunk) => {
            const dataLine = chunk
              .split('\n')
              .find((line) => line.startsWith('data: '));
            if (!dataLine) return null;
            return JSON.parse(dataLine.replace('data: ', '')) as {
              sequence?: number;
              [key: string]: unknown;
            };
          })
          .filter((e): e is { sequence: number; [key: string]: unknown } => {
            return e !== null && typeof e.sequence === 'number';
          });

        // Verify sequence numbers are incremental (0-based)
        events.forEach((event, index) => {
          expect(event.sequence).toBe(index);
        });

        console.log(
          `✅ Sequence numbers: 0 to ${events.length - 1} (${events.length} events)`,
        );
      },
      30000,
    );
  });

  describe('Error Handling', () => {
    testIf(hasApiKey)(
      'should handle invalid model gracefully',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/text')
          .send({
            model: 'invalid-model-name-xyz',
            input: 'Test',
          })
          .expect(400);

        const error = response.body as {
          statusCode: number;
          message: string;
        };
        expect(error).toHaveProperty('statusCode', 400);
        expect(error).toHaveProperty('message');
        expect(error.message.length).toBeGreaterThan(0);
      },
      30000,
    );

    // Note: We can't easily test rate limits or auth errors without
    // actually triggering them, so we skip those in normal e2e runs
  });

  describe('GET /api/responses/:id - Retrieval', () => {
    testIf(hasApiKey)(
      'should retrieve a stored response',
      async () => {
        // First create a stored response
        const createResponse = await request(app.getHttpServer() as Server)
          .post('/api/responses/text')
          .send({
            model: 'gpt-4o-mini',
            input: 'Hello',
            max_output_tokens: 16, // Minimum is 16
            store: true,
          })
          .expect(201);

        const createResult = createResponse.body as Responses.Response;
        const responseId = createResult.id;

        // Now retrieve it
        const getResponse = await request(app.getHttpServer() as Server)
          .get(`/api/responses/${responseId}`)
          .expect(200);

        const getResult = getResponse.body as Responses.Response;
        expect(getResult.id).toBe(responseId);
        expect(getResult.output_text).toBe(createResult.output_text);

        console.log(`✅ Retrieved response: ${responseId}`);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should return 404 for non-existent response',
      async () => {
        await request(app.getHttpServer() as Server)
          .get('/api/responses/resp_nonexistent123')
          .expect(404);
      },
      30000,
    );
  });

  describe('DELETE /api/responses/:id - Deletion', () => {
    testIf(hasApiKey)(
      'should delete a stored response',
      async () => {
        // First create a stored response
        const createResponse = await request(app.getHttpServer() as Server)
          .post('/api/responses/text')
          .send({
            model: 'gpt-4o-mini',
            input: 'To be deleted',
            max_output_tokens: 16, // Minimum is 16
            store: true,
          })
          .expect(201);

        const createResult = createResponse.body as Responses.Response;
        const responseId = createResult.id;

        // Delete it
        await request(app.getHttpServer() as Server)
          .delete(`/api/responses/${responseId}`)
          .expect(200);

        // Verify it's deleted (should 404)
        await request(app.getHttpServer() as Server)
          .get(`/api/responses/${responseId}`)
          .expect(404);

        console.log(`✅ Deleted response: ${responseId}`);
      },
      30000,
    );
  });
});
