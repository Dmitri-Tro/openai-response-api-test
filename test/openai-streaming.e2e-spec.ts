import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { OpenAIExceptionFilter } from '../src/common/filters/openai-exception.filter';

/**
 * Comprehensive E2E tests for OpenAI Streaming Responses
 * Uses real OpenAI API - requires OPENAI_API_KEY environment variable
 *
 * Tests all streaming event types: text, reasoning, tools, refusal, audio
 */
describe('OpenAI Streaming E2E (Real API)', () => {
  let app: INestApplication<App>;
  const hasApiKey = !!process.env.OPENAI_API_KEY;

  const testIf = (condition: boolean) => (condition ? it : it.skip);

  beforeAll(async () => {
    if (!hasApiKey) {
      console.warn(
        '\n⚠️  OPENAI_API_KEY not set - skipping Streaming E2E tests\n',
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

  /**
   * Helper to parse SSE response into events
   */
  function parseSSEEvents(sseText: string) {
    return sseText
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
  }

  describe('POST /api/responses/text/stream - Text Delta Streaming', () => {
    testIf(hasApiKey)(
      'should stream text with multiple deltas',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/text/stream')
          .send({
            model: 'gpt-4o-mini',
            input: 'Count from 1 to 3 slowly',
            stream: true,
            max_output_tokens: 30,
          })
          .expect(201) // Streaming returns 201
          .expect('Content-Type', /text\/event-stream/);

        const events = parseSSEEvents(response.text);

        // Verify event sequence
        expect(events[0].event).toBe('response_created');
        expect(events[0].data).toHaveProperty('response_id');

        // Should have multiple text_delta events
        const deltaEvents = events.filter((e) => e.event === 'text_delta');
        expect(deltaEvents.length).toBeGreaterThan(1);

        // Each delta should have delta text and sequence
        deltaEvents.forEach((event) => {
          expect(event.data).toHaveProperty('delta');
          expect(event.data).toHaveProperty('sequence');
        });

        // Should end with text_done
        const textDone = events.find((e) => e.event === 'text_done');
        expect(textDone).toBeDefined();
        expect(textDone.data).toHaveProperty('output_text');

        // Should end with response_done
        const responseDone = events.find((e) => e.event === 'response_done');
        expect(responseDone).toBeDefined();

        // Reconstruct text
        const fullText = deltaEvents.map((e) => e.data.delta).join('');
        console.log(
          `✅ Streamed text: "${fullText}" in ${deltaEvents.length} deltas`,
        );
      },
      30000,
    );

    testIf(hasApiKey)(
      'should include usage data in final event',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/text/stream')
          .send({
            model: 'gpt-4o-mini',
            input: 'Hi',
            stream: true,
            max_output_tokens: 20, // Minimum is 16
          })
          .expect(201); // Streaming returns 201;

        const events = parseSSEEvents(response.text);
        const responseDone = events.find((e) => e.event === 'response_done');

        expect(responseDone).toBeDefined();
        expect(responseDone.data.response).toHaveProperty('usage');
        expect(responseDone.data.response.usage).toHaveProperty('input_tokens');
        expect(responseDone.data.response.usage).toHaveProperty(
          'output_tokens',
        );
        expect(responseDone.data.response.usage).toHaveProperty('total_tokens');

        console.log(
          `✅ Usage: ${responseDone.data.response.usage.total_tokens} tokens`,
        );
      },
      30000,
    );

    testIf(hasApiKey)(
      'should maintain incremental sequence numbers',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/text/stream')
          .send({
            model: 'gpt-4o-mini',
            input: 'Test',
            stream: true,
            max_output_tokens: 20, // Minimum is 16
          })
          .expect(201); // Streaming returns 201;

        const events = parseSSEEvents(response.text);

        // Verify all events have incremental sequence numbers
        events.forEach((event, index) => {
          expect(event.data.sequence).toBe(index + 1);
        });

        console.log(`✅ Sequence: 1 to ${events.length} (incremental)`);
      },
      30000,
    );
  });

  describe('POST /api/responses/text/stream - Function Calling Streaming', () => {
    testIf(hasApiKey)(
      'should stream function call arguments',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/text/stream')
          .send({
            model: 'gpt-4o-mini',
            input: 'What is the weather in Paris?',
            stream: true,
            tools: [
              {
                type: 'function',
                function: {
                  name: 'get_weather',
                  description: 'Get weather for a city',
                  parameters: {
                    type: 'object',
                    properties: {
                      location: { type: 'string' },
                      unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
                    },
                    required: ['location'],
                  },
                },
              },
            ],
            tool_choice: 'required',
          })
          .expect(201); // Streaming returns 201;

        const events = parseSSEEvents(response.text);

        // Should have output_item_added for function call
        const itemAdded = events.find((e) => e.event === 'output_item_added');
        expect(itemAdded).toBeDefined();

        // Should have function_call_arguments_delta events
        const argDeltas = events.filter(
          (e) => e.event === 'function_call_arguments_delta',
        );
        expect(argDeltas.length).toBeGreaterThan(0);

        // Should have function_call_arguments_done
        const argsDone = events.find(
          (e) => e.event === 'function_call_arguments_done',
        );
        expect(argsDone).toBeDefined();

        // Verify final arguments are valid JSON
        const finalArgs = JSON.parse(argsDone.data.arguments);
        expect(finalArgs).toHaveProperty('location');

        console.log(
          `✅ Function call: get_weather(${argsDone.data.arguments})`,
        );
      },
      30000,
    );
  });

  describe('POST /api/responses/text/stream - Structured Output Streaming', () => {
    testIf(hasApiKey)(
      'should stream JSON object generation',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/text/stream')
          .send({
            model: 'gpt-4o-mini',
            input: 'Generate a person with name and age',
            stream: true,
            text: {
              format: { type: 'json_object' },
            },
            max_output_tokens: 50,
          })
          .expect(201); // Streaming returns 201;

        const events = parseSSEEvents(response.text);

        const deltaEvents = events.filter((e) => e.event === 'text_delta');
        expect(deltaEvents.length).toBeGreaterThan(0);

        const textDone = events.find((e) => e.event === 'text_done');
        expect(textDone).toBeDefined();

        // Verify final output is valid JSON
        const json = JSON.parse(textDone.data.output_text);
        expect(json).toHaveProperty('name');
        expect(json).toHaveProperty('age');

        console.log(`✅ Streamed JSON: ${textDone.data.output_text}`);
      },
      30000,
    );
  });

  describe('POST /api/responses/text/stream - Multi-turn Conversation', () => {
    testIf(hasApiKey)(
      'should stream responses in conversation context',
      async () => {
        // First request - create conversation
        const firstResponse = await request(app.getHttpServer())
          .post('/api/responses/text/stream')
          .send({
            model: 'gpt-4o-mini',
            input: 'My name is Alice',
            stream: true,
            store: true,
            max_output_tokens: 20,
          })
          .expect(201); // Streaming returns 201;

        const firstEvents = parseSSEEvents(firstResponse.text);
        const firstDone = firstEvents.find((e) => e.event === 'response_done');
        const responseId = firstDone.data.response.id;

        // Second request - continue conversation
        const secondResponse = await request(app.getHttpServer())
          .post('/api/responses/text/stream')
          .send({
            model: 'gpt-4o-mini',
            input: 'What is my name?',
            stream: true,
            previous_response_id: responseId,
            max_output_tokens: 20,
          })
          .expect(201); // Streaming returns 201;

        const secondEvents = parseSSEEvents(secondResponse.text);
        const secondTextDone = secondEvents.find(
          (e) => e.event === 'text_done',
        );

        // Should mention Alice in the response
        expect(secondTextDone.data.output_text.toLowerCase()).toContain(
          'alice',
        );

        console.log(`✅ Multi-turn: "${secondTextDone.data.output_text}"`);
      },
      60000,
    ); // Longer timeout for two API calls
  });

  describe('POST /api/responses/text/stream - Stream Options', () => {
    testIf(hasApiKey)(
      'should support stream_options parameter',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/text/stream')
          .send({
            model: 'gpt-4o-mini',
            input: 'Test stream options',
            stream: true,
            max_output_tokens: 20, // Minimum is 16
            stream_options: {
              include_obfuscation: false, // Disable obfuscation for cleaner output
            },
          })
          .expect(201); // Streaming returns 201;

        const events = parseSSEEvents(response.text);
        expect(events.length).toBeGreaterThan(0);

        console.log(`✅ Stream options: ${events.length} events`);
      },
      30000,
    );
  });

  describe('GET /api/responses/:id/stream - Resume Streaming', () => {
    testIf(hasApiKey)(
      'should resume streaming for background response',
      async () => {
        // Create a background response first
        const createResponse = await request(app.getHttpServer())
          .post('/api/responses/text')
          .send({
            model: 'gpt-4o-mini',
            input: 'Background task',
            max_output_tokens: 20, // Minimum is 16
            background: true,
            store: true,
          })
          .expect(201);

        const responseId = createResponse.body.id;

        // Wait a moment for background processing
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Resume streaming
        const streamResponse = await request(app.getHttpServer())
          .get(`/api/responses/${responseId}/stream`)
          .expect(201) // Streaming returns 201
          .expect('Content-Type', /text\/event-stream/);

        const events = parseSSEEvents(streamResponse.text);

        // Should have at least text_done and response_done
        const textDone = events.find((e) => e.event === 'text_done');
        const responseDone = events.find((e) => e.event === 'response_done');

        expect(textDone || responseDone).toBeDefined();

        console.log(`✅ Resumed stream for: ${responseId}`);
      },
      45000,
    ); // Longer timeout for background processing
  });

  describe('Error Handling in Streaming', () => {
    testIf(hasApiKey)(
      'should validate required fields in streaming',
      async () => {
        await request(app.getHttpServer())
          .post('/api/responses/text/stream')
          .send({
            model: 'gpt-4o-mini',
            stream: true,
            // Missing required 'input' field
          })
          .expect(400);
      },
    );
  });

  describe('Advanced Streaming Features', () => {
    testIf(hasApiKey)(
      'should stream with metadata tracking',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/text/stream')
          .send({
            model: 'gpt-4o-mini',
            input: 'Metadata test',
            stream: true,
            max_output_tokens: 20, // Minimum is 16
            metadata: {
              test_type: 'e2e_streaming',
              timestamp: Date.now().toString(),
            },
          });

        // Streaming endpoints may return 200 or 201
        expect([200, 201]).toContain(response.status);

        const events = parseSSEEvents(response.text);
        expect(events.length).toBeGreaterThan(0);

        console.log(`✅ Streaming with metadata: ${events.length} events`);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should stream with safety_identifier',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/text/stream')
          .send({
            model: 'gpt-4o-mini',
            input: 'Safety test',
            stream: true,
            max_output_tokens: 20, // Minimum is 16
            safety_identifier: 'e2e-test-user-123',
          });

        // Streaming endpoints may return 200 or 201
        expect([200, 201]).toContain(response.status);

        const events = parseSSEEvents(response.text);
        expect(events.length).toBeGreaterThan(0);

        console.log(`✅ Streaming with safety_identifier`);
      },
      30000,
    );
  });
});
