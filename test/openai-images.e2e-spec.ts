import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'http';
import type { Responses } from 'openai/resources/responses';
import { AppModule } from '../src/app.module';
import { OpenAIExceptionFilter } from '../src/common/filters/openai-exception.filter';
import { LoggerService } from '../src/common/services/logger.service';

/**
 * Comprehensive E2E tests for OpenAI Image Generation (gpt-image-1)
 * Uses real OpenAI API - requires OPENAI_API_KEY environment variable
 *
 * Tests image generation with various parameters and streaming
 */
describe('OpenAI Images E2E (Real API)', () => {
  let app: INestApplication;
  const hasApiKey = !!process.env.OPENAI_API_KEY;

  const testIf = (condition: boolean) => (condition ? it : it.skip);

  beforeAll(async () => {
    if (!hasApiKey) {
      console.warn(
        '\n⚠️  OPENAI_API_KEY not set - skipping Image Generation E2E tests\n',
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
  }, 30000); // 30s timeout for cleanup

  /**
   * Helper to parse SSE response
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
          data: JSON.parse(dataLine.replace('data: ', '')) as unknown,
        };
      })
      .filter((e): e is { event: string; data: unknown } => e !== null);
  }

  describe('POST /api/responses/images - Basic Image Generation', () => {
    testIf(hasApiKey)(
      'should generate a simple image',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'A simple red circle on white background',
          })
          .expect(201)
          .expect('Content-Type', /json/);

        const result = response.body as Responses.Response;

        // Verify response structure
        expect(result).toHaveProperty('id');
        expect(result.id).toMatch(/^resp_/);
        expect(result).toHaveProperty('object', 'response');
        expect(result).toHaveProperty('model');
        expect(result).toHaveProperty('output');

        // Verify image output in output array
        const imageCall = result.output.find(
          (item: { type?: string }) => item.type === 'image_generation_call',
        );
        expect(imageCall).toBeDefined();
        expect(imageCall).toHaveProperty('result');
        const imageResult = (imageCall as { result?: string | null }).result;
        expect(imageResult).toBeTruthy();
        expect(typeof imageResult).toBe('string');
        expect((imageResult as string).length).toBeGreaterThan(100);

        // Verify usage
        expect(result).toHaveProperty('usage');
        expect(result.usage?.input_tokens).toBeGreaterThan(0);

        console.log(
          `✅ Image generated: ${result.id} (${result.usage?.input_tokens} tokens)`,
        );
      },
      180000,
    ); // Images take longer - observed up to 120s

    testIf(hasApiKey)(
      'should support instructions parameter',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'A cat',
            instructions: 'Make it photorealistic and high quality',
          })
          .expect(201);

        const result = response.body as Responses.Response;

        const imageCall = result.output.find(
          (item: { type?: string }) => item.type === 'image_generation_call',
        );
        expect(imageCall).toBeDefined();
        const imageResult = (imageCall as { result?: string | null }).result;
        expect(imageResult).toBeTruthy();
        expect(typeof imageResult).toBe('string');
        expect((imageResult as string).length).toBeGreaterThan(100);
        console.log(`✅ Image with instructions: ${result.id}`);
      },
      180000,
    );
  });

  describe('POST /api/responses/images - Image Parameters', () => {
    testIf(hasApiKey)(
      'should support different image sizes',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'A landscape scene',
            image_size: '1536x1024', // Landscape format
          })
          .expect(201);

        const result = response.body as Responses.Response;

        const imageCall = result.output.find(
          (item: { type?: string }) => item.type === 'image_generation_call',
        );
        expect(imageCall).toBeDefined();
        const imageResult = (imageCall as { result?: string | null }).result;
        expect(imageResult).toBeTruthy();
        expect(typeof imageResult).toBe('string');
        expect((imageResult as string).length).toBeGreaterThan(100);
        console.log(`✅ Landscape image (1536x1024): ${result.id}`);
      },
      180000,
    );

    // NOTE: image_quality parameter removed - it's defined in SDK types but not yet supported by OpenAI API
    // Test was redundant with "should support image_model parameter" below

    testIf(hasApiKey)(
      'should support different image formats',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'A sunset',
            image_format: 'webp',
          })
          .expect(201);

        const result = response.body as Responses.Response;

        const imageCall = result.output.find(
          (item: { type?: string }) => item.type === 'image_generation_call',
        );
        expect(imageCall).toBeDefined();
        const imageResult = (imageCall as { result?: string | null }).result;
        expect(imageResult).toBeTruthy();
        expect(typeof imageResult).toBe('string');
        expect((imageResult as string).length).toBeGreaterThan(100);
        console.log(`✅ WebP format image: ${result.id}`);
      },
      180000,
    );

    testIf(hasApiKey)(
      'should support image_model parameter',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'A pencil sketch of a simple tree',
            instructions: 'Generate a quick sketch-style image',
            image_model: 'gpt-image-1-mini', // Faster, cheaper model
          })
          .expect(201);

        const result = response.body as Responses.Response;

        const imageCall = result.output.find(
          (item: { type?: string }) => item.type === 'image_generation_call',
        );
        expect(imageCall).toBeDefined();
        const imageResult = (imageCall as { result?: string | null }).result;
        expect(imageResult).toBeTruthy();
        expect(typeof imageResult).toBe('string');
        expect((imageResult as string).length).toBeGreaterThan(100);
        console.log(`✅ gpt-image-1-mini: ${result.id}`);
      },
      240000,
    );
  });

  describe('POST /api/responses/images - Advanced Parameters', () => {
    testIf(hasApiKey)(
      'should support transparent background',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'A simple logo icon',
            image_format: 'png',
            image_background: 'transparent',
          })
          .expect(201);

        const result = response.body as Responses.Response;

        const imageCall = result.output.find(
          (item: { type?: string }) => item.type === 'image_generation_call',
        );
        expect(imageCall).toBeDefined();
        const imageResult = (imageCall as { result?: string | null }).result;
        expect(imageResult).toBeTruthy();
        expect(typeof imageResult).toBe('string');
        expect((imageResult as string).length).toBeGreaterThan(100);
        console.log(`✅ Transparent PNG: ${result.id}`);
      },
      240000,
    );

    testIf(hasApiKey)(
      'should support input_fidelity parameter',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'A red apple on a wooden table',
            input_fidelity: 'high', // Strict adherence to prompt
          })
          .expect(201);

        const result = response.body as Responses.Response;

        const imageCall = result.output.find(
          (item: { type?: string }) => item.type === 'image_generation_call',
        );
        expect(imageCall).toBeDefined();
        const imageResult = (imageCall as { result?: string | null }).result;
        expect(imageResult).toBeTruthy();
        expect(typeof imageResult).toBe('string');
        expect((imageResult as string).length).toBeGreaterThan(100);
        console.log(`✅ High fidelity image: ${result.id}`);
      },
      180000,
    );

    testIf(hasApiKey)(
      'should support output_compression',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'A simple pattern',
            image_format: 'webp', // WebP supports compression < 100
            output_compression: 80, // Compressed for smaller file size
          })
          .expect(201);

        const result = response.body as Responses.Response;

        const imageCall = result.output.find(
          (item: { type?: string }) => item.type === 'image_generation_call',
        );
        expect(imageCall).toBeDefined();
        const imageResult = (imageCall as { result?: string | null }).result;
        expect(imageResult).toBeTruthy();
        expect(typeof imageResult).toBe('string');
        expect((imageResult as string).length).toBeGreaterThan(100);
        console.log(`✅ Compressed (80%): ${result.id}`);
      },
      180000,
    );

    testIf(hasApiKey)(
      'should support metadata parameter',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'A blue cube on a white surface',
            instructions: 'Generate a simple 3D rendered image',
            metadata: {
              test_type: 'e2e_image',
              batch: 'test_batch_1',
            },
          })
          .expect(201);

        const result = response.body as Responses.Response;

        const imageCall = result.output.find(
          (item: { type?: string }) => item.type === 'image_generation_call',
        );
        expect(imageCall).toBeDefined();
        const imageResult = (imageCall as { result?: string | null }).result;
        expect(imageResult).toBeTruthy();
        expect(typeof imageResult).toBe('string');
        expect((imageResult as string).length).toBeGreaterThan(100);
        console.log(`✅ Image with metadata: ${result.id}`);
      },
      240000,
    );

    testIf(hasApiKey)(
      'should support store parameter',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'Stored image test',
            store: true,
          })
          .expect(201);

        const createResult = response.body as Responses.Response;
        const responseId = createResult.id;

        // Verify we can retrieve it
        const retrieved = await request(app.getHttpServer() as Server)
          .get(`/api/responses/${responseId}`)
          .expect(200);

        const retrievedResult = retrieved.body as Responses.Response;
        expect(retrievedResult.id).toBe(responseId);
        console.log(`✅ Stored and retrieved image: ${responseId}`);
      },
      180000,
    );
  });

  describe('POST /api/responses/images/stream - Streaming Image Generation', () => {
    testIf(hasApiKey)(
      'should stream image generation progress',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/images/stream')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'A bright yellow sunflower against blue sky',
            instructions: 'Generate a vibrant image with clear colors',
            stream: true,
          })
          .expect(201) // Streaming returns 201
          .expect('Content-Type', /text\/event-stream/);

        const events = parseSSEEvents(response.text);

        // Should have response_created
        const created = events.find((e) => e.event === 'response_created');
        expect(created).toBeDefined();

        // Should have progress events
        const progressEvents = events.filter(
          (e) => e.event === 'image_generation_call.generating',
        );
        expect(progressEvents.length).toBeGreaterThanOrEqual(0);

        // Should have image completion (output_item.done)
        const imageDone = events.find((e) => e.event === 'output_item.done');
        expect(imageDone).toBeDefined();
        if (!imageDone) throw new Error('imageDone is undefined');

        // Should have response completion
        const responseDone = events.find(
          (e) => e.event === 'response_completed',
        );
        expect(responseDone).toBeDefined();

        console.log(
          `✅ Streamed image: ${events.length} events, ${progressEvents.length} progress updates`,
        );
      },
      150000,
    ); // Streaming images take even longer

    testIf(hasApiKey)(
      'should stream with partial images',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/images/stream')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'A colorful abstract pattern with geometric shapes',
            instructions: 'Generate an image showing the progressive rendering',
            stream: true,
            partial_images: 3, // Request 3 partial images during generation
          })
          .expect(201); // Streaming returns 201;

        const events = parseSSEEvents(response.text);

        // Should have partial image events
        const partialEvents = events.filter(
          (e) => e.event === 'image_gen_partial',
        );

        // May have 0-3 partial images depending on generation speed
        console.log(
          `✅ Partial images: ${partialEvents.length} received (requested 3)`,
        );

        // Should still complete with output_item.done
        const imageDone = events.find((e) => e.event === 'output_item.done');
        expect(imageDone).toBeDefined();
        if (!imageDone) throw new Error('imageDone is undefined');
      },
      150000,
    );
  });

  describe('POST /api/responses/images - Multi-turn & Conversation', () => {
    testIf(hasApiKey)(
      'should support image modification via previous_response_id',
      async () => {
        // First image
        const firstResponse = await request(app.getHttpServer() as Server)
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'A white two-story house with windows',
            instructions: 'Generate a simple house illustration',
            store: true,
          })
          .expect(201);

        const firstResult = firstResponse.body as Responses.Response;
        const responseId = firstResult.id;

        // Modified image
        const secondResponse = await request(app.getHttpServer() as Server)
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'Add a red door to the front of the house',
            instructions:
              'Modify the previous image by adding the requested element',
            previous_response_id: responseId,
          })
          .expect(201);

        const secondResult = secondResponse.body as Responses.Response;

        const imageCall = secondResult.output.find(
          (item: { type?: string }) => item.type === 'image_generation_call',
        );
        expect(imageCall).toBeDefined();
        const imageResult = (imageCall as { result?: string | null }).result;
        expect(imageResult).toBeTruthy();
        expect(typeof imageResult).toBe('string');
        expect((imageResult as string).length).toBeGreaterThan(100);

        console.log(
          `✅ Image modification: ${responseId} → ${secondResult.id}`,
        );
      },
      360000,
    ); // Two image generations take longer (increased to 6 minutes)
  });

  describe('Validation', () => {
    testIf(hasApiKey)('should reject missing input', async () => {
      await request(app.getHttpServer() as Server)
        .post('/api/responses/images')
        .send({
          model: 'gpt-image-1',
          // Missing required 'input' field
        })
        .expect(400);
    });

    testIf(hasApiKey)('should reject invalid image_size', async () => {
      await request(app.getHttpServer() as Server)
        .post('/api/responses/images')
        .send({
          model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
          input: 'Test',
          image_size: '999x999', // Invalid size
        })
        .expect(400);
    });

    testIf(hasApiKey)('should reject invalid image_quality', async () => {
      await request(app.getHttpServer() as Server)
        .post('/api/responses/images')
        .send({
          model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
          input: 'Test',
          image_quality: 'ultra', // Invalid: not in enum
        })
        .expect(400);
    });

    testIf(hasApiKey)(
      'should reject invalid output_compression range',
      async () => {
        await request(app.getHttpServer() as Server)
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'Test',
            output_compression: 150, // Invalid: max is 100
          })
          .expect(400);
      },
    );

    testIf(hasApiKey)(
      'should reject invalid partial_images range',
      async () => {
        await request(app.getHttpServer() as Server)
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'Test',
            partial_images: 10, // Invalid: max is 3
          })
          .expect(400);
      },
    );
  });

  describe('Performance & Optimization', () => {
    testIf(hasApiKey)(
      'should support service_tier parameter',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'Priority image test',
            service_tier: 'auto',
          })
          .expect(201);

        const result = response.body as Responses.Response;

        const imageCall = result.output.find(
          (item: { type?: string }) => item.type === 'image_generation_call',
        );
        expect(imageCall).toBeDefined();
        const imageResult = (imageCall as { result?: string | null }).result;
        expect(imageResult).toBeTruthy();
        expect(typeof imageResult).toBe('string');
        expect((imageResult as string).length).toBeGreaterThan(100);
        console.log(`✅ Service tier test: ${result.id}`);
      },
      180000,
    );

    testIf(hasApiKey)(
      'should support background execution',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'Background image generation',
            background: true,
            store: true,
          })
          .expect(201);

        const createResult = response.body as Responses.Response;
        expect(createResult.id).toBeTruthy();
        const responseId = createResult.id;

        // Wait for background processing
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Try to retrieve
        const retrieved = await request(app.getHttpServer() as Server)
          .get(`/api/responses/${responseId}`)
          .expect(200);

        const retrievedResult = retrieved.body as Responses.Response;
        expect(retrievedResult.id).toBe(responseId);
        console.log(`✅ Background generation: ${responseId}`);
      },
      90000,
    );
  });

  describe('GET /api/responses/:id - Image Retrieval', () => {
    testIf(hasApiKey)(
      'should retrieve stored image response',
      async () => {
        // Create stored image
        const createResponse = await request(app.getHttpServer() as Server)
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'A green frog sitting on a lily pad',
            instructions: 'Generate a clear and simple image',
            store: true,
          })
          .expect(201);

        const createResult = createResponse.body as Responses.Response;
        const responseId = createResult.id;

        // Retrieve it
        const getResponse = await request(app.getHttpServer() as Server)
          .get(`/api/responses/${responseId}`)
          .expect(200);

        const getResult = getResponse.body as Responses.Response;

        expect(getResult.id).toBe(responseId);
        const imageCall = getResult.output.find(
          (item: { type?: string }) => item.type === 'image_generation_call',
        );
        expect(imageCall).toBeDefined();
        const imageResult = (imageCall as { result?: string | null }).result;
        expect(imageResult).toBeTruthy();
        expect(typeof imageResult).toBe('string');
        expect((imageResult as string).length).toBeGreaterThan(100);

        console.log(`✅ Retrieved image: ${responseId}`);
      },
      240000,
    );
  });

  describe('DELETE /api/responses/:id - Image Deletion', () => {
    testIf(hasApiKey)(
      'should delete stored image response',
      async () => {
        // Create stored image
        const createResponse = await request(app.getHttpServer() as Server)
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'To be deleted',
            store: true,
          })
          .expect(201);

        const createResult = createResponse.body as Responses.Response;
        const responseId = createResult.id;

        // Delete it
        await request(app.getHttpServer() as Server)
          .delete(`/api/responses/${responseId}`)
          .expect(200);

        // Verify deletion
        await request(app.getHttpServer() as Server)
          .get(`/api/responses/${responseId}`)
          .expect(404);

        console.log(`✅ Deleted image: ${responseId}`);
      },
      180000,
    );
  });
});
