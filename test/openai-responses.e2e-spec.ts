import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { OpenAIExceptionFilter } from '../src/common/filters/openai-exception.filter';

/**
 * Comprehensive E2E tests for OpenAI Text Responses API
 * Uses real OpenAI API - requires OPENAI_API_KEY environment variable
 *
 * To run: OPENAI_API_KEY=sk-... npm run test:e2e
 */
describe('OpenAI Responses E2E (Real API)', () => {
  let app: INestApplication<App>;
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
    app.useGlobalFilters(new OpenAIExceptionFilter());
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
        const response = await request(app.getHttpServer())
          .post('/api/responses/text')
          .send({
            model: 'gpt-4o-mini', // Using mini for faster/cheaper tests
            input: 'Say "Hello World" and nothing else',
            max_output_tokens: 20, // Minimum is 16
          })
          .expect(201)
          .expect('Content-Type', /json/);

        // Verify response structure
        expect(response.body).toHaveProperty('id');
        expect(response.body.id).toMatch(/^resp_/);
        expect(response.body).toHaveProperty('object', 'response');
        expect(response.body).toHaveProperty('model');
        expect(response.body).toHaveProperty('output_text');
        expect(response.body.output_text).toBeTruthy();

        // Verify usage data
        expect(response.body).toHaveProperty('usage');
        expect(response.body.usage).toHaveProperty('input_tokens');
        expect(response.body.usage).toHaveProperty('output_tokens');
        expect(response.body.usage).toHaveProperty('total_tokens');
        expect(response.body.usage.input_tokens).toBeGreaterThan(0);
        expect(response.body.usage.output_tokens).toBeGreaterThan(0);

        console.log(
          `✅ Text response: "${response.body.output_text}" (${response.body.usage.total_tokens} tokens)`,
        );
      },
      30000,
    ); // 30s timeout for API calls

    testIf(hasApiKey)(
      'should respect temperature parameter',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/text')
          .send({
            model: 'gpt-4o-mini',
            input: 'Generate a random number between 1 and 100',
            temperature: 0.1, // Low temperature for more deterministic output
            max_output_tokens: 20, // Minimum is 16
          })
          .expect(201);

        expect(response.body.output_text).toBeTruthy();
        console.log(`✅ Temperature test: "${response.body.output_text}"`);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should handle instructions parameter',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/text')
          .send({
            model: 'gpt-4o-mini',
            input: 'What is 2+2?',
            instructions: 'Answer in exactly one word',
            max_output_tokens: 16, // Minimum is 16
          })
          .expect(201);

        expect(response.body.output_text).toBeTruthy();
        expect(
          response.body.output_text.split(/\s+/).length,
        ).toBeLessThanOrEqual(3); // Should be very short
        console.log(`✅ Instructions test: "${response.body.output_text}"`);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should respect max_output_tokens',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/text')
          .send({
            model: 'gpt-4o-mini',
            input: 'Write a story',
            max_output_tokens: 16, // Minimum allowed
          })
          .expect(201);

        expect(response.body.usage.output_tokens).toBeLessThanOrEqual(16);
        console.log(
          `✅ Token limit: ${response.body.usage.output_tokens} tokens (max 16)`,
        );
      },
      30000,
    );
  });

  describe('POST /api/responses/text - Validation', () => {
    testIf(hasApiKey)('should reject missing input field', async () => {
      await request(app.getHttpServer())
        .post('/api/responses/text')
        .send({
          model: 'gpt-4o-mini',
          // Missing required 'input' field
        })
        .expect(400);
    });

    testIf(hasApiKey)('should reject invalid temperature', async () => {
      await request(app.getHttpServer())
        .post('/api/responses/text')
        .send({
          model: 'gpt-4o-mini',
          input: 'Test',
          temperature: 5.0, // Invalid: max is 2.0
        })
        .expect(400);
    });

    testIf(hasApiKey)('should reject invalid top_p', async () => {
      await request(app.getHttpServer())
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
        const response = await request(app.getHttpServer())
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

        expect(response.body.output_text).toBeTruthy();
        // Should be valid JSON
        expect(() => JSON.parse(response.body.output_text)).not.toThrow();
        const parsed = JSON.parse(response.body.output_text);
        expect(parsed).toHaveProperty('name');
        expect(parsed).toHaveProperty('age');
        console.log(`✅ JSON output: ${response.body.output_text}`);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should support function calling',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/text')
          .send({
            model: 'gpt-4o-mini',
            input: 'What is the weather in San Francisco?',
            tools: [
              {
                type: 'function',
                function: {
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
              },
            ],
            tool_choice: 'required',
          })
          .expect(201);

        expect(response.body).toHaveProperty('output_tool_call');
        expect(response.body.output_tool_call).toHaveProperty(
          'type',
          'function',
        );
        expect(response.body.output_tool_call.function).toHaveProperty(
          'name',
          'get_weather',
        );
        expect(response.body.output_tool_call.function).toHaveProperty(
          'arguments',
        );

        const args = JSON.parse(
          response.body.output_tool_call.function.arguments,
        );
        expect(args).toHaveProperty('location');
        expect(args.location.toLowerCase()).toContain('san francisco');
        console.log(
          `✅ Function call: get_weather(${response.body.output_tool_call.function.arguments})`,
        );
      },
      30000,
    );

    testIf(hasApiKey)(
      'should support metadata parameter',
      async () => {
        const response = await request(app.getHttpServer())
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

        expect(response.body.output_text).toBeTruthy();
        console.log(`✅ Metadata test passed`);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should support store parameter for retrieval',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/text')
          .send({
            model: 'gpt-4o-mini',
            input: 'Remember this message',
            max_output_tokens: 16, // Minimum is 16
            store: true,
          })
          .expect(201);

        expect(response.body.id).toBeTruthy();
        const responseId = response.body.id;

        // Try to retrieve the stored response
        const retrieved = await request(app.getHttpServer())
          .get(`/api/responses/${responseId}`)
          .expect(200);

        expect(retrieved.body.id).toBe(responseId);
        expect(retrieved.body.output_text).toBe(response.body.output_text);
        console.log(`✅ Stored and retrieved response: ${responseId}`);
      },
      30000,
    );
  });

  describe('POST /api/responses/text/stream - Streaming', () => {
    testIf(hasApiKey)(
      'should stream text deltas',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/text/stream')
          .send({
            model: 'gpt-4o-mini',
            input: 'Count from 1 to 5',
            stream: true,
            max_output_tokens: 30, // Higher for better streaming
          })
          .expect(201) // Streaming returns 201
          .expect('Content-Type', /text\/event-stream/);

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
              data: JSON.parse(dataLine.replace('data: ', '')),
            };
          })
          .filter(Boolean);

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

        // Should have response_done event
        const responseDone = events.find((e) => e.event === 'response_done');
        expect(responseDone).toBeDefined();

        // Reconstruct full text from deltas
        const fullText = deltaEvents.map((e) => e.data.delta).join('');

        console.log(
          `✅ Streaming: ${deltaEvents.length} deltas, text: "${fullText}"`,
        );
      },
      30000,
    );

    testIf(hasApiKey)(
      'should include sequence numbers',
      async () => {
        const response = await request(app.getHttpServer())
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
            return JSON.parse(dataLine.replace('data: ', ''));
          })
          .filter(Boolean);

        // Verify sequence numbers are incremental
        events.forEach((event, index) => {
          expect(event.sequence).toBe(index + 1);
        });

        console.log(`✅ Sequence numbers: 1 to ${events.length}`);
      },
      30000,
    );
  });

  describe('Error Handling', () => {
    testIf(hasApiKey)(
      'should handle invalid model gracefully',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/text')
          .send({
            model: 'invalid-model-name-xyz',
            input: 'Test',
          })
          .expect(400);

        expect(response.body).toHaveProperty('statusCode', 400);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('model');
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
        const createResponse = await request(app.getHttpServer())
          .post('/api/responses/text')
          .send({
            model: 'gpt-4o-mini',
            input: 'Hello',
            max_output_tokens: 16, // Minimum is 16
            store: true,
          })
          .expect(201);

        const responseId = createResponse.body.id;

        // Now retrieve it
        const getResponse = await request(app.getHttpServer())
          .get(`/api/responses/${responseId}`)
          .expect(200);

        expect(getResponse.body.id).toBe(responseId);
        expect(getResponse.body.output_text).toBe(
          createResponse.body.output_text,
        );

        console.log(`✅ Retrieved response: ${responseId}`);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should return 404 for non-existent response',
      async () => {
        await request(app.getHttpServer())
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
        const createResponse = await request(app.getHttpServer())
          .post('/api/responses/text')
          .send({
            model: 'gpt-4o-mini',
            input: 'To be deleted',
            max_output_tokens: 16, // Minimum is 16
            store: true,
          })
          .expect(201);

        const responseId = createResponse.body.id;

        // Delete it
        await request(app.getHttpServer())
          .delete(`/api/responses/${responseId}`)
          .expect(200);

        // Verify it's deleted (should 404)
        await request(app.getHttpServer())
          .get(`/api/responses/${responseId}`)
          .expect(404);

        console.log(`✅ Deleted response: ${responseId}`);
      },
      30000,
    );
  });
});
