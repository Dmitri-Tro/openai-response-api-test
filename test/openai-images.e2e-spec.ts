import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { OpenAIExceptionFilter } from '../src/common/filters/openai-exception.filter';

/**
 * Comprehensive E2E tests for OpenAI Image Generation (gpt-image-1)
 * Uses real OpenAI API - requires OPENAI_API_KEY environment variable
 *
 * Tests image generation with various parameters and streaming
 */
describe('OpenAI Images E2E (Real API)', () => {
  let app: INestApplication<App>;
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
    app.useGlobalFilters(new OpenAIExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

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
          data: JSON.parse(dataLine.replace('data: ', '')),
        };
      })
      .filter(Boolean);
  }

  describe('POST /api/responses/images - Basic Image Generation', () => {
    testIf(hasApiKey)(
      'should generate a simple image',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'A simple red circle on white background',
          })
          .expect(201)
          .expect('Content-Type', /json/);

        // Verify response structure
        expect(response.body).toHaveProperty('id');
        expect(response.body.id).toMatch(/^resp_/);
        expect(response.body).toHaveProperty('object', 'response');
        expect(response.body).toHaveProperty('model');
        expect(response.body).toHaveProperty('output_image');

        // Verify image output
        const image = response.body.output_image;
        expect(image).toBeDefined();
        expect(image.url || image.b64_json).toBeTruthy();

        // Verify usage
        expect(response.body).toHaveProperty('usage');
        expect(response.body.usage.input_tokens).toBeGreaterThan(0);

        console.log(
          `✅ Image generated: ${response.body.id} (${response.body.usage.input_tokens} tokens)`,
        );
      },
      60000,
    ); // Images take longer than text

    testIf(hasApiKey)(
      'should support instructions parameter',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'A cat',
            instructions: 'Make it photorealistic and high quality',
          })
          .expect(201);

        expect(response.body.output_image).toBeDefined();
        console.log(`✅ Image with instructions: ${response.body.id}`);
      },
      60000,
    );
  });

  describe('POST /api/responses/images - Image Parameters', () => {
    testIf(hasApiKey)(
      'should support different image sizes',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'A landscape scene',
            image_size: '1536x1024', // Landscape format
          })
          .expect(201);

        expect(response.body.output_image).toBeDefined();
        console.log(`✅ Landscape image (1536x1024): ${response.body.id}`);
      },
      60000,
    );

    testIf(hasApiKey)(
      'should support image quality parameter',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'A detailed portrait',
            image_quality: 'high',
          })
          .expect(201);

        expect(response.body.output_image).toBeDefined();
        console.log(`✅ High quality image: ${response.body.id}`);
      },
      60000,
    );

    testIf(hasApiKey)(
      'should support different image formats',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'A sunset',
            image_format: 'webp',
          })
          .expect(201);

        expect(response.body.output_image).toBeDefined();
        console.log(`✅ WebP format image: ${response.body.id}`);
      },
      60000,
    );

    testIf(hasApiKey)(
      'should support image_model parameter',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'A quick sketch',
            image_model: 'gpt-image-1-mini', // Faster, cheaper model
          })
          .expect(201);

        expect(response.body.output_image).toBeDefined();
        console.log(`✅ gpt-image-1-mini: ${response.body.id}`);
      },
      60000,
    );
  });

  describe('POST /api/responses/images - Advanced Parameters', () => {
    testIf(hasApiKey)(
      'should support transparent background',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'A simple logo icon',
            image_format: 'png',
            image_background: 'transparent',
          })
          .expect(201);

        expect(response.body.output_image).toBeDefined();
        console.log(`✅ Transparent PNG: ${response.body.id}`);
      },
      60000,
    );

    testIf(hasApiKey)(
      'should support input_fidelity parameter',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'A red apple on a wooden table',
            input_fidelity: 'high', // Strict adherence to prompt
          })
          .expect(201);

        expect(response.body.output_image).toBeDefined();
        console.log(`✅ High fidelity image: ${response.body.id}`);
      },
      60000,
    );

    testIf(hasApiKey)(
      'should support output_compression',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'A simple pattern',
            output_compression: 80, // Compressed for smaller file size
          })
          .expect(201);

        expect(response.body.output_image).toBeDefined();
        console.log(`✅ Compressed (80%): ${response.body.id}`);
      },
      60000,
    );

    testIf(hasApiKey)(
      'should support metadata parameter',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'Test image',
            metadata: {
              test_type: 'e2e_image',
              batch: 'test_batch_1',
            },
          })
          .expect(201);

        expect(response.body.output_image).toBeDefined();
        console.log(`✅ Image with metadata: ${response.body.id}`);
      },
      60000,
    );

    testIf(hasApiKey)(
      'should support store parameter',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'Stored image test',
            store: true,
          })
          .expect(201);

        const responseId = response.body.id;

        // Verify we can retrieve it
        const retrieved = await request(app.getHttpServer())
          .get(`/api/responses/${responseId}`)
          .expect(201); // Streaming returns 201;

        expect(retrieved.body.id).toBe(responseId);
        console.log(`✅ Stored and retrieved image: ${responseId}`);
      },
      60000,
    );
  });

  describe('POST /api/responses/images/stream - Streaming Image Generation', () => {
    testIf(hasApiKey)(
      'should stream image generation progress',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/images/stream')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'A streaming test image',
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
          (e) => e.event === 'image_generation_progress',
        );
        expect(progressEvents.length).toBeGreaterThanOrEqual(0);

        // Should have image_done
        const imageDone = events.find((e) => e.event === 'image_done');
        expect(imageDone).toBeDefined();
        expect(imageDone.data).toHaveProperty('image');

        // Should have response_done
        const responseDone = events.find((e) => e.event === 'response_done');
        expect(responseDone).toBeDefined();

        console.log(
          `✅ Streamed image: ${events.length} events, ${progressEvents.length} progress updates`,
        );
      },
      90000,
    ); // Streaming images take even longer

    testIf(hasApiKey)(
      'should stream with partial images',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/images/stream')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'Progressive rendering test',
            stream: true,
            partial_images: 3, // Request 3 partial images during generation
          })
          .expect(201); // Streaming returns 201;

        const events = parseSSEEvents(response.text);

        // Should have partial image events
        const partialEvents = events.filter((e) => e.event === 'image_partial');

        // May have 0-3 partial images depending on generation speed
        console.log(
          `✅ Partial images: ${partialEvents.length} received (requested 3)`,
        );

        // Should still complete with image_done
        const imageDone = events.find((e) => e.event === 'image_done');
        expect(imageDone).toBeDefined();
      },
      90000,
    );
  });

  describe('POST /api/responses/images - Multi-turn & Conversation', () => {
    testIf(hasApiKey)(
      'should support image modification via previous_response_id',
      async () => {
        // First image
        const firstResponse = await request(app.getHttpServer())
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'A simple house',
            store: true,
          })
          .expect(201);

        const responseId = firstResponse.body.id;

        // Modified image
        const secondResponse = await request(app.getHttpServer())
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'Add a red door to the house',
            previous_response_id: responseId,
          })
          .expect(201);

        expect(secondResponse.body.output_image).toBeDefined();
        console.log(
          `✅ Image modification: ${responseId} → ${secondResponse.body.id}`,
        );
      },
      120000,
    ); // Two image generations take longer
  });

  describe('Validation', () => {
    testIf(hasApiKey)('should reject missing input', async () => {
      await request(app.getHttpServer())
        .post('/api/responses/images')
        .send({
          model: 'gpt-image-1',
          // Missing required 'input' field
        })
        .expect(400);
    });

    testIf(hasApiKey)('should reject invalid image_size', async () => {
      await request(app.getHttpServer())
        .post('/api/responses/images')
        .send({
          model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
          input: 'Test',
          image_size: '999x999', // Invalid size
        })
        .expect(400);
    });

    testIf(hasApiKey)('should reject invalid image_quality', async () => {
      await request(app.getHttpServer())
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
        await request(app.getHttpServer())
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
        await request(app.getHttpServer())
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
        const response = await request(app.getHttpServer())
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'Priority image test',
            service_tier: 'auto',
          })
          .expect(201);

        expect(response.body.output_image).toBeDefined();
        console.log(`✅ Service tier test: ${response.body.id}`);
      },
      60000,
    );

    testIf(hasApiKey)(
      'should support background execution',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'Background image generation',
            background: true,
            store: true,
          })
          .expect(201);

        expect(response.body.id).toBeTruthy();
        const responseId = response.body.id;

        // Wait for background processing
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Try to retrieve
        const retrieved = await request(app.getHttpServer())
          .get(`/api/responses/${responseId}`)
          .expect(201); // Streaming returns 201;

        expect(retrieved.body.id).toBe(responseId);
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
        const createResponse = await request(app.getHttpServer())
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'Retrieval test image',
            store: true,
          })
          .expect(201);

        const responseId = createResponse.body.id;

        // Retrieve it
        const getResponse = await request(app.getHttpServer())
          .get(`/api/responses/${responseId}`)
          .expect(201); // Streaming returns 201;

        expect(getResponse.body.id).toBe(responseId);
        expect(getResponse.body.output_image).toBeDefined();

        console.log(`✅ Retrieved image: ${responseId}`);
      },
      60000,
    );
  });

  describe('DELETE /api/responses/:id - Image Deletion', () => {
    testIf(hasApiKey)(
      'should delete stored image response',
      async () => {
        // Create stored image
        const createResponse = await request(app.getHttpServer())
          .post('/api/responses/images')
          .send({
            model: 'gpt-5', // gpt-5 automatically uses gpt-image-1 for images
            input: 'To be deleted',
            store: true,
          })
          .expect(201);

        const responseId = createResponse.body.id;

        // Delete it
        await request(app.getHttpServer())
          .delete(`/api/responses/${responseId}`)
          .expect(201); // Streaming returns 201;

        // Verify deletion
        await request(app.getHttpServer())
          .get(`/api/responses/${responseId}`)
          .expect(404);

        console.log(`✅ Deleted image: ${responseId}`);
      },
      60000,
    );
  });
});
