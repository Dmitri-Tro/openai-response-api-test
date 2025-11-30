import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'http';
import { AppModule } from '../../src/app.module';
import { OpenAIExceptionFilter } from '../../src/common/filters/openai-exception.filter';
import { LoggerService } from '../../src/common/services/logger.service';

/**
 * Load test for Code Interpreter API
 * Tests system stability under concurrent requests
 *
 * This test sends multiple concurrent requests to validate:
 * - Service handles multiple code interpreter requests simultaneously
 * - No race conditions or resource conflicts
 * - Graceful handling of rate limits
 * - Response times remain reasonable under load
 *
 * Note: Uses real OpenAI API - requires OPENAI_API_KEY
 * Load tests are intensive and may hit rate limits - use with caution
 *
 * To run: OPENAI_API_KEY=sk-... npm run test:e2e -- code-interpreter.load
 */
describe('Code Interpreter Load Test', () => {
  let app: INestApplication;
  const hasApiKey = !!process.env.OPENAI_API_KEY;

  // Skip if no API key
  const testIf = (condition: boolean) => (condition ? it : it.skip);

  beforeAll(async () => {
    if (!hasApiKey) {
      console.warn(
        '\n⚠️  OPENAI_API_KEY not set - skipping Code Interpreter load tests\n',
      );
      return;
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    const loggerService = app.get(LoggerService);
    app.useGlobalFilters(new OpenAIExceptionFilter(loggerService));
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Concurrent Code Execution', () => {
    testIf(hasApiKey)(
      'should handle 5 concurrent code interpreter requests',
      async () => {
        const concurrentRequests = 5;
        const startTime = Date.now();

        // Create array of concurrent requests
        const requests = Array.from({ length: concurrentRequests }, (_, i) =>
          request(app.getHttpServer() as Server)
            .post('/api/responses/text')
            .send({
              model: 'gpt-4o-mini',
              input: `Calculate the factorial of ${i + 3}`, // 3! to 7!
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
            .then((res) => {
              // Type-safe check without accessing any properties directly
              const hasResponse = !!res.body;
              const isObject = hasResponse && typeof res.body === 'object';
              const bodyHasText: boolean =
                isObject && 'output_text' in res.body;
              return {
                status: res.status,
                index: i,
                responseTime: Date.now() - startTime,
                hasOutput: bodyHasText,
              };
            })
            .catch(() => ({
              status: 500,
              index: i,
              responseTime: Date.now() - startTime,
              hasOutput: false,
            })),
        );

        // Execute all requests concurrently
        const results = await Promise.all(requests);
        const totalTime = Date.now() - startTime;

        // Analyze results
        const successful = results.filter((r) => r.status === 201);
        const failed = results.filter((r) => r.status !== 201);
        const avgResponseTime =
          results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;

        // Log statistics
        console.log(`\n📊 Load Test Results:`);
        console.log(`   Total requests: ${concurrentRequests}`);
        console.log(`   Successful: ${successful.length}`);
        console.log(`   Failed: ${failed.length}`);
        console.log(`   Total time: ${totalTime}ms`);
        console.log(`   Avg response time: ${avgResponseTime.toFixed(0)}ms`);

        if (failed.length > 0) {
          console.log(`   Failed requests:`, failed);
        }

        // Assertions
        expect(results.length).toBe(concurrentRequests);

        // At least 80% should succeed (allowing for rate limits)
        const successRate = (successful.length / concurrentRequests) * 100;
        expect(successRate).toBeGreaterThanOrEqual(80);

        // All successful requests should have output
        successful.forEach((result) => {
          expect(result.hasOutput).toBe(true);
        });

        console.log(
          `✅ Load test passed - ${successRate.toFixed(0)}% success rate`,
        );
      },
      120000, // 2 minutes timeout for concurrent requests
    );
  });

  describe('Sequential Stress Test', () => {
    testIf(hasApiKey)(
      'should handle 3 sequential requests without degradation',
      async () => {
        const requestCount = 3;
        const responseTimes: number[] = [];
        const results: Array<{ status: number; hasOutput: boolean }> = [];

        for (let i = 0; i < requestCount; i++) {
          const startTime = Date.now();

          try {
            const response = await request(app.getHttpServer() as Server)
              .post('/api/responses/text')
              .send({
                model: 'gpt-4o-mini',
                input: `Calculate ${i + 1} + ${i + 2}`,
                tools: [
                  {
                    type: 'code_interpreter',
                    container: {
                      type: 'auto',
                    },
                  },
                ],
                max_output_tokens: 300,
              });

            const responseTime = Date.now() - startTime;
            responseTimes.push(responseTime);

            // Type-safe check without accessing any properties directly
            const hasResponse = !!response.body;
            const isObject = hasResponse && typeof response.body === 'object';
            const bodyHasText: boolean =
              isObject && 'output_text' in response.body;
            results.push({
              status: response.status,
              hasOutput: bodyHasText,
            });

            console.log(`   Request ${i + 1}: ${responseTime}ms`);
          } catch {
            const responseTime = Date.now() - startTime;
            responseTimes.push(responseTime);
            results.push({ status: 500, hasOutput: false });
            console.log(`   Request ${i + 1}: FAILED after ${responseTime}ms`);
          }

          // Small delay to avoid immediate rate limiting
          if (i < requestCount - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }

        // Calculate statistics
        const avgTime =
          responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        const maxTime = Math.max(...responseTimes);
        const minTime = Math.min(...responseTimes);

        console.log(`\n📊 Sequential Test Results:`);
        console.log(`   Requests: ${requestCount}`);
        console.log(`   Avg time: ${avgTime.toFixed(0)}ms`);
        console.log(`   Min time: ${minTime}ms`);
        console.log(`   Max time: ${maxTime}ms`);

        // Assertions
        const successful = results.filter((r) => r.status === 201);
        expect(successful.length).toBeGreaterThanOrEqual(
          Math.ceil(requestCount * 0.8),
        );

        // Response times shouldn't degrade significantly
        // Last request should be within 2x of first request
        const degradationRatio =
          responseTimes[requestCount - 1] / responseTimes[0];
        expect(degradationRatio).toBeLessThan(2);

        console.log(`✅ Sequential stress test passed`);
      },
      180000, // 3 minutes for sequential requests with delays
    );
  });

  describe('Error Recovery', () => {
    testIf(hasApiKey)(
      'should recover gracefully from validation errors',
      async () => {
        const validRequest = {
          model: 'gpt-4o-mini',
          input: 'Calculate 5!',
          tools: [
            {
              type: 'code_interpreter',
              container: {
                type: 'auto',
              },
            },
          ],
          max_output_tokens: 300,
        };

        const invalidRequest = {
          model: 'gpt-4o-mini',
          input: 'Invalid request',
          tools: [
            {
              type: 'code_interpreter',
              container: {
                type: 'invalid_type', // This will fail validation
              },
            },
          ],
        };

        // Send invalid request
        const invalidResponse = await request(app.getHttpServer() as Server)
          .post('/api/responses/text')
          .send(invalidRequest);

        expect(invalidResponse.status).toBe(400);

        // Immediately send valid request - should work
        const validResponse = await request(app.getHttpServer() as Server)
          .post('/api/responses/text')
          .send(validRequest);

        expect(validResponse.status).toBe(201);
        expect(validResponse.body).toHaveProperty('output_text');

        console.log(`✅ Service recovered from validation error successfully`);
      },
      90000,
    );
  });
});
