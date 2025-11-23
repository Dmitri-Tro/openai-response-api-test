import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { OpenAIExceptionFilter } from '../src/common/filters/openai-exception.filter';
import * as fs from 'fs';
import * as path from 'path';

/**
 * E2E Tests for Images API
 *
 * These tests make real calls to OpenAI's Images API and require:
 * 1. OPENAI_API_KEY environment variable set
 * 2. Access to OpenAI Images API (DALL-E 2/3)
 *
 * Tests will auto-skip if requirements are not met.
 *
 * **Cost Estimates**:
 * - DALL-E 2 (256x256): $0.016 per image
 * - DALL-E 2 (512x512): $0.018 per image
 * - DALL-E 2 (1024x1024): $0.020 per image
 * - DALL-E 3 (1024x1024 standard): $0.040 per image
 *
 * These tests primarily use DALL-E 2 with small sizes to minimize cost.
 * Total estimated cost: ~$0.10-$0.15 for full test suite.
 */

// Auto-skip pattern
const hasApiKey = !!process.env.OPENAI_API_KEY;
const testIf = (condition: boolean) => (condition ? it : it.skip);

describe('Images API (E2E)', () => {
  let app: INestApplication;
  let testImagePath: string;
  let testMaskPath: string;

  beforeAll(async () => {
    if (!hasApiKey) {
      console.log('⏭️  Skipping Images API E2E tests (OPENAI_API_KEY not set)');
      return;
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    app.useGlobalFilters(new OpenAIExceptionFilter());
    await app.init();

    // Create test image files for editing/variations
    const testDir = path.join(__dirname, 'fixtures');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Create a simple 256x256 test image (PNG)
    testImagePath = path.join(testDir, 'test-image.png');
    if (!fs.existsSync(testImagePath)) {
      // Create a minimal valid PNG (1x1 pixel, black)
      const pngData = Buffer.from([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a, // PNG signature
        0x00,
        0x00,
        0x00,
        0x0d,
        0x49,
        0x48,
        0x44,
        0x52, // IHDR chunk
        0x00,
        0x00,
        0x00,
        0x01,
        0x00,
        0x00,
        0x00,
        0x01, // 1x1 size
        0x08,
        0x02,
        0x00,
        0x00,
        0x00,
        0x90,
        0x77,
        0x53,
        0xde,
        0x00,
        0x00,
        0x00,
        0x0c,
        0x49,
        0x44,
        0x41, // IDAT chunk
        0x54,
        0x08,
        0xd7,
        0x63,
        0x00,
        0x00,
        0x00,
        0x02,
        0x00,
        0x01,
        0xe2,
        0x21,
        0xbc,
        0x33,
        0x00,
        0x00,
        0x00,
        0x00,
        0x49,
        0x45,
        0x4e,
        0x44,
        0xae,
        0x42, // IEND chunk
        0x60,
        0x82,
      ]);
      fs.writeFileSync(testImagePath, pngData);
    }

    // Create a minimal test mask (same size)
    testMaskPath = path.join(testDir, 'test-mask.png');
    if (!fs.existsSync(testMaskPath)) {
      fs.writeFileSync(testMaskPath, fs.readFileSync(testImagePath));
    }
  });

  afterAll(async () => {
    // Cleanup test files
    try {
      if (testImagePath && fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
      if (testMaskPath && fs.existsSync(testMaskPath)) {
        fs.unlinkSync(testMaskPath);
      }
    } catch (error) {
      console.log('Failed to cleanup test files');
    }

    if (app) {
      await app.close();
    }
  });

  describe('POST /api/images/generate', () => {
    testIf(hasApiKey)(
      'should generate image with DALL-E 2 minimal parameters',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/images/generate')
          .send({
            prompt: 'A cute baby sea otter',
          })
          .expect(200);

        expect(response.body).toHaveProperty('created');
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);
        expect(response.body.data[0]).toHaveProperty('url');
        expect(response.body.data[0].url).toMatch(/^https?:\/\//);
      },
      60000,
    ); // 60s timeout for image generation

    testIf(hasApiKey)(
      'should generate image with DALL-E 2 with all parameters',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/images/generate')
          .send({
            model: 'dall-e-2',
            prompt: 'Abstract geometric art',
            n: 2,
            size: '256x256',
            response_format: 'url',
          })
          .expect(200);

        expect(response.body.data).toHaveLength(2);
        response.body.data.forEach((image: any) => {
          expect(image).toHaveProperty('url');
        });
      },
      90000,
    ); // 90s timeout for multiple images

    testIf(hasApiKey)(
      'should generate image with base64 response format',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/images/generate')
          .send({
            prompt: 'A sunset',
            response_format: 'b64_json',
            size: '256x256',
          })
          .expect(200);

        expect(response.body.data[0]).toHaveProperty('b64_json');
        expect(response.body.data[0]).not.toHaveProperty('url');
        expect(typeof response.body.data[0].b64_json).toBe('string');
        expect(response.body.data[0].b64_json.length).toBeGreaterThan(100);
      },
      60000,
    );

    testIf(hasApiKey)(
      'should generate image with gpt-image-1 minimal parameters',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/images/generate')
          .send({
            model: 'gpt-image-1',
            prompt: 'A serene mountain landscape',
            response_format: 'b64_json', // Required for gpt-image-1
          })
          .expect(200);

        expect(response.body).toHaveProperty('created');
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBe(1); // gpt-image-1 only generates 1 image
        expect(response.body.data[0]).toHaveProperty('b64_json');
        expect(response.body.data[0]).not.toHaveProperty('url'); // gpt-image-1 returns b64_json only
        expect(typeof response.body.data[0].b64_json).toBe('string');
      },
      90000,
    ); // 90s timeout for gpt-image-1

    testIf(hasApiKey)(
      'should generate image with gpt-image-1 and auto size',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/images/generate')
          .send({
            model: 'gpt-image-1',
            prompt: 'A futuristic cityscape',
            size: 'auto', // auto size for gpt-image-1
            response_format: 'b64_json',
          })
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(response.body.data[0]).toHaveProperty('b64_json');
      },
      90000,
    );

    testIf(hasApiKey)(
      'should generate image with gpt-image-1 portrait size',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/images/generate')
          .send({
            model: 'gpt-image-1',
            prompt: 'A tall tower',
            size: '1024x1536', // Portrait size for gpt-image-1
            response_format: 'b64_json',
          })
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(response.body.data[0]).toHaveProperty('b64_json');
      },
      90000,
    );

    testIf(hasApiKey)(
      'should generate image with gpt-image-1 landscape size',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/images/generate')
          .send({
            model: 'gpt-image-1',
            prompt: 'A wide landscape',
            size: '1536x1024', // Landscape size for gpt-image-1
            response_format: 'b64_json',
          })
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(response.body.data[0]).toHaveProperty('b64_json');
      },
      90000,
    );

    testIf(hasApiKey)('should reject invalid prompt (too long)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/images/generate')
        .send({
          prompt: 'A'.repeat(4001), // Exceeds 4000 char limit
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    testIf(hasApiKey)('should reject invalid model', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/images/generate')
        .send({
          model: 'invalid-model',
          prompt: 'Test',
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    testIf(hasApiKey)('should reject invalid n value', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/images/generate')
        .send({
          prompt: 'Test',
          n: 11, // Exceeds max of 10
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/images/edit', () => {
    testIf(hasApiKey)(
      'should edit image without mask',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/images/edit')
          .field('prompt', 'Add a red door')
          .field('size', '256x256')
          .attach('image', testImagePath)
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data[0]).toHaveProperty('url');
      },
      60000,
    );

    testIf(hasApiKey)(
      'should edit image with mask',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/images/edit')
          .field('prompt', 'Change the sky to sunset')
          .field('size', '256x256')
          .attach('image', testImagePath)
          .attach('mask', testMaskPath)
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(response.body.data[0]).toHaveProperty('url');
      },
      60000,
    );

    testIf(hasApiKey)('should reject edit without image file', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/images/edit')
        .field('prompt', 'Test')
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Image file is required');
    });

    testIf(hasApiKey)('should reject edit without prompt', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/images/edit')
        .attach('image', testImagePath)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/images/variations', () => {
    testIf(hasApiKey)(
      'should create image variation',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/images/variations')
          .field('size', '256x256')
          .attach('image', testImagePath)
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data[0]).toHaveProperty('url');
      },
      60000,
    );

    testIf(hasApiKey)(
      'should create multiple variations',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/images/variations')
          .field('n', '2')
          .field('size', '256x256')
          .attach('image', testImagePath)
          .expect(200);

        expect(response.body.data).toHaveLength(2);
        response.body.data.forEach((image: any) => {
          expect(image).toHaveProperty('url');
        });
      },
      90000,
    );

    testIf(hasApiKey)(
      'should reject variation without image file',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/images/variations')
          .expect(400);

        expect(response.body).toHaveProperty('message');
      },
    );
  });

  describe('Validation Edge Cases', () => {
    testIf(hasApiKey)(
      'should reject generation with invalid size for model',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/images/generate')
          .send({
            model: 'dall-e-3',
            prompt: 'Test',
            size: '256x256', // Invalid for DALL-E 3
          })
          .expect(400);

        expect(response.body).toHaveProperty('message');
      },
    );

    testIf(hasApiKey)(
      'should reject generation with invalid size for gpt-image-1',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/images/generate')
          .send({
            model: 'gpt-image-1',
            prompt: 'Test',
            size: '512x512', // Invalid for gpt-image-1
            response_format: 'b64_json',
          })
          .expect(400);

        expect(response.body).toHaveProperty('message');
      },
    );

    // SKIPPED: OpenAI API currently does not support the 'quality' parameter
    // despite it being in the SDK types. The API returns "Unknown parameter: 'quality'."
    // This test is kept here for future reference if OpenAI adds support for this parameter.
    it.skip('should reject generation with invalid quality for model', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/images/generate')
        .send({
          model: 'dall-e-2',
          prompt: 'Test',
          quality: 'hd', // Invalid for DALL-E 2
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    testIf(hasApiKey)(
      'should reject generation with invalid response format',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/images/generate')
          .send({
            prompt: 'Test',
            response_format: 'invalid',
          })
          .expect(400);

        expect(response.body).toHaveProperty('message');
      },
    );
  });
});
