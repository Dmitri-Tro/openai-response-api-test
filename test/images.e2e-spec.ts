import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'http';
import type { ImagesResponse } from 'openai/resources/images';
import { AppModule } from '../src/app.module';
import { OpenAIExceptionFilter } from '../src/common/filters/openai-exception.filter';
import { LoggerService } from '../src/common/services/logger.service';
import * as fs from 'fs';
import * as path from 'path';
import { deflateSync, crc32 } from 'zlib';

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

    // Get LoggerService from the module for exception filter
    const loggerService = app.get(LoggerService);
    app.useGlobalFilters(new OpenAIExceptionFilter(loggerService));
    await app.init();

    // Create test image files for editing/variations
    const testDir = path.join(__dirname, 'fixtures');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Generate 256x256 RGBA test image (required for edit/variation endpoints)
    testImagePath = path.join(testDir, 'test-image.png');
    testMaskPath = path.join(testDir, 'test-mask.png');

    if (!fs.existsSync(testImagePath)) {
      console.log('📸 Generating 256x256 RGBA test image...');

      // Create a simple 256x256 white image with alpha channel (RGBA)
      // OpenAI edit/variation requires RGBA format
      const width = 256;
      const height = 256;
      const pixelData: number[] = [];

      // Create white pixels with full opacity (RGBA = 255, 255, 255, 255)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          pixelData.push(255, 255, 255, 255); // White with alpha
        }
      }

      // Compress using simple zlib deflate
      const pixelBuffer = Buffer.from(pixelData);

      // PNG requires scanline filter bytes (0 = no filter)
      const scanlines: number[] = [];
      for (let y = 0; y < height; y++) {
        scanlines.push(0); // Filter type: None
        for (let x = 0; x < width * 4; x++) {
          scanlines.push(pixelBuffer[y * width * 4 + x]);
        }
      }

      const compressedData = deflateSync(Buffer.from(scanlines));

      // Build PNG file structure
      const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

      // IHDR chunk (image header)
      const ihdr = Buffer.alloc(13);
      ihdr.writeUInt32BE(width, 0);
      ihdr.writeUInt32BE(height, 4);
      ihdr[8] = 8; // Bit depth
      ihdr[9] = 6; // Color type: RGBA (6)
      ihdr[10] = 0; // Compression method
      ihdr[11] = 0; // Filter method
      ihdr[12] = 0; // Interlace method

      const ihdrChunk = createPNGChunk('IHDR', ihdr);
      const idatChunk = createPNGChunk('IDAT', compressedData);
      const iendChunk = createPNGChunk('IEND', Buffer.alloc(0));

      const pngBuffer = Buffer.concat([
        pngSignature,
        ihdrChunk,
        idatChunk,
        iendChunk,
      ]);

      fs.writeFileSync(testImagePath, pngBuffer);
      console.log(`✅ Test image generated: ${testImagePath} (256x256 RGBA)`);
    }

    // Create mask by copying the test image
    if (!fs.existsSync(testMaskPath)) {
      fs.copyFileSync(testImagePath, testMaskPath);
      console.log(`✅ Test mask created: ${testMaskPath}`);
    }

    // Helper function to create PNG chunks
    function createPNGChunk(type: string, data: Buffer): Buffer {
      const length = Buffer.alloc(4);
      length.writeUInt32BE(data.length, 0);

      const typeBuffer = Buffer.from(type, 'ascii');
      const crcValue = crc32(Buffer.concat([typeBuffer, data]));
      const crcBuffer = Buffer.alloc(4);
      crcBuffer.writeUInt32BE(crcValue, 0);

      return Buffer.concat([length, typeBuffer, data, crcBuffer]);
    }
  }, 120000); // 120s timeout for image generation in beforeAll

  afterAll(async () => {
    // Cleanup test files
    try {
      if (testImagePath && fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
      if (testMaskPath && fs.existsSync(testMaskPath)) {
        fs.unlinkSync(testMaskPath);
      }
    } catch {
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
        const response = await request(app.getHttpServer() as Server)
          .post('/api/images/generate')
          .send({
            prompt: 'A cute baby sea otter',
          })
          .expect(200);

        const imagesResponse = response.body as ImagesResponse;

        expect(imagesResponse).toHaveProperty('created');
        expect(imagesResponse).toHaveProperty('data');
        expect(Array.isArray(imagesResponse.data)).toBe(true);
        expect(imagesResponse.data?.length).toBeGreaterThan(0);
        expect(imagesResponse.data?.[0]).toHaveProperty('url');
        expect(imagesResponse.data?.[0].url).toMatch(/^https?:\/\//);
      },
      60000,
    ); // 60s timeout for image generation

    testIf(hasApiKey)(
      'should generate image with DALL-E 2 with all parameters',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/images/generate')
          .send({
            model: 'dall-e-2',
            prompt: 'Abstract geometric art',
            n: 2,
            size: '256x256',
            response_format: 'url',
          })
          .expect(200);

        const imagesResponse = response.body as ImagesResponse;

        expect(imagesResponse.data).toHaveLength(2);
        imagesResponse.data?.forEach((image) => {
          expect(image).toHaveProperty('url');
        });
      },
      90000,
    ); // 90s timeout for multiple images

    testIf(hasApiKey)(
      'should generate image with base64 response format',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/images/generate')
          .send({
            model: 'dall-e-2',
            prompt: 'A sunset',
            response_format: 'b64_json',
            size: '256x256',
          })
          .expect(200);

        const imagesResponse = response.body as ImagesResponse;

        expect(imagesResponse.data?.[0]).toHaveProperty('b64_json');
        expect(imagesResponse.data?.[0]).not.toHaveProperty('url');
        expect(typeof imagesResponse.data?.[0].b64_json).toBe('string');
        expect(imagesResponse.data?.[0].b64_json?.length).toBeGreaterThan(100);
      },
      60000,
    );

    testIf(hasApiKey)(
      'should generate image with gpt-image-1 minimal parameters',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/images/generate')
          .send({
            model: 'gpt-image-1',
            prompt: 'A serene mountain landscape',
            response_format: 'b64_json', // Required for gpt-image-1
          })
          .expect(200);

        const imagesResponse = response.body as ImagesResponse;

        expect(imagesResponse).toHaveProperty('created');
        expect(imagesResponse).toHaveProperty('data');
        expect(Array.isArray(imagesResponse.data)).toBe(true);
        expect(imagesResponse.data?.length).toBe(1); // gpt-image-1 only generates 1 image
        expect(imagesResponse.data?.[0]).toHaveProperty('b64_json');
        expect(imagesResponse.data?.[0]).not.toHaveProperty('url'); // gpt-image-1 returns b64_json only
        expect(typeof imagesResponse.data?.[0].b64_json).toBe('string');
      },
      90000,
    ); // 90s timeout for gpt-image-1

    testIf(hasApiKey)(
      'should generate image with gpt-image-1 and auto size',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/images/generate')
          .send({
            model: 'gpt-image-1',
            prompt: 'A futuristic cityscape',
            size: 'auto', // auto size for gpt-image-1
            response_format: 'b64_json',
          })
          .expect(200);

        const imagesResponse = response.body as ImagesResponse;

        expect(imagesResponse).toHaveProperty('data');
        expect(imagesResponse.data?.[0]).toHaveProperty('b64_json');
      },
      120000,
    ); // 120s timeout for gpt-image-1 with auto size

    testIf(hasApiKey)(
      'should generate image with gpt-image-1 portrait size',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/images/generate')
          .send({
            model: 'gpt-image-1',
            prompt: 'A tall tower',
            size: '1024x1536', // Portrait size for gpt-image-1
            response_format: 'b64_json',
          })
          .expect(200);

        const imagesResponse = response.body as ImagesResponse;

        expect(imagesResponse).toHaveProperty('data');
        expect(imagesResponse.data?.[0]).toHaveProperty('b64_json');
      },
      90000,
    );

    testIf(hasApiKey)(
      'should generate image with gpt-image-1 landscape size',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/images/generate')
          .send({
            model: 'gpt-image-1',
            prompt: 'A wide landscape',
            size: '1536x1024', // Landscape size for gpt-image-1
            response_format: 'b64_json',
          })
          .expect(200);

        const imagesResponse = response.body as ImagesResponse;

        expect(imagesResponse).toHaveProperty('data');
        expect(imagesResponse.data?.[0]).toHaveProperty('b64_json');
      },
      90000,
    );

    testIf(hasApiKey)('should reject invalid prompt (too long)', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/images/generate')
        .send({
          prompt: 'A'.repeat(4001), // Exceeds 4000 char limit
        })
        .expect(400);

      const error = response.body as { message: string };
      expect(error).toHaveProperty('message');
    });

    testIf(hasApiKey)('should reject invalid model', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/images/generate')
        .send({
          model: 'invalid-model',
          prompt: 'Test',
        })
        .expect(400);

      const error = response.body as { message: string };
      expect(error).toHaveProperty('message');
    });

    testIf(hasApiKey)('should reject invalid n value', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/images/generate')
        .send({
          prompt: 'Test',
          n: 11, // Exceeds max of 10
        })
        .expect(400);

      const error = response.body as { message: string };
      expect(error).toHaveProperty('message');
    });
  });

  describe('POST /api/images/edit', () => {
    testIf(hasApiKey)(
      'should edit image without mask',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/images/edit')
          .field('prompt', 'Add a red door')
          .field('size', '256x256')
          .attach('image', testImagePath)
          .expect(200);

        const imagesResponse = response.body as ImagesResponse;

        expect(imagesResponse).toHaveProperty('data');
        expect(Array.isArray(imagesResponse.data)).toBe(true);
        expect(imagesResponse.data?.[0]).toHaveProperty('url');
      },
      60000,
    );

    testIf(hasApiKey)(
      'should edit image with mask',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/images/edit')
          .field('prompt', 'Change the sky to sunset')
          .field('size', '256x256')
          .attach('image', testImagePath)
          .attach('mask', testMaskPath)
          .expect(200);

        const imagesResponse = response.body as ImagesResponse;

        expect(imagesResponse).toHaveProperty('data');
        expect(imagesResponse.data?.[0]).toHaveProperty('url');
      },
      60000,
    );

    testIf(hasApiKey)('should reject edit without image file', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/images/edit')
        .field('prompt', 'Test')
        .expect(400);

      const error = response.body as { message: string };
      expect(error).toHaveProperty('message');
      expect(error.message).toContain('Image file is required');
    });

    testIf(hasApiKey)('should reject edit without prompt', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/images/edit')
        .attach('image', testImagePath)
        .expect(400);

      const error = response.body as { message: string };
      expect(error).toHaveProperty('message');
    });
  });

  describe('POST /api/images/variations', () => {
    testIf(hasApiKey)(
      'should create image variation',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/images/variations')
          .field('size', '256x256')
          .attach('image', testImagePath)
          .expect(200);

        const imagesResponse = response.body as ImagesResponse;

        expect(imagesResponse).toHaveProperty('data');
        expect(Array.isArray(imagesResponse.data)).toBe(true);
        expect(imagesResponse.data?.[0]).toHaveProperty('url');
      },
      60000,
    );

    testIf(hasApiKey)(
      'should create multiple variations',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/images/variations')
          .field('n', '2')
          .field('size', '256x256')
          .attach('image', testImagePath)
          .expect(200);

        const imagesResponse = response.body as ImagesResponse;

        expect(imagesResponse.data).toHaveLength(2);
        imagesResponse.data?.forEach((image) => {
          expect(image).toHaveProperty('url');
        });
      },
      90000,
    );

    testIf(hasApiKey)(
      'should reject variation without image file',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/images/variations')
          .expect(400);

        const error = response.body as { message: string };
        expect(error).toHaveProperty('message');
      },
    );
  });

  describe('Validation Edge Cases', () => {
    testIf(hasApiKey)(
      'should reject generation with invalid size for model',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/images/generate')
          .send({
            model: 'dall-e-3',
            prompt: 'Test',
            size: '256x256', // Invalid for DALL-E 3
          })
          .expect(400);

        const error = response.body as { message: string };
        expect(error).toHaveProperty('message');
      },
    );

    testIf(hasApiKey)(
      'should reject generation with invalid size for gpt-image-1',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/images/generate')
          .send({
            model: 'gpt-image-1',
            prompt: 'Test',
            size: '512x512', // Invalid for gpt-image-1
            response_format: 'b64_json',
          })
          .expect(400);

        const error = response.body as { message: string };
        expect(error).toHaveProperty('message');
      },
    );

    // SKIPPED: OpenAI API currently does not support the 'quality' parameter
    // despite it being in the SDK types. The API returns "Unknown parameter: 'quality'."
    // This test is kept here for future reference if OpenAI adds support for this parameter.
    it.skip('should reject generation with invalid quality for model', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/images/generate')
        .send({
          model: 'dall-e-2',
          prompt: 'Test',
          quality: 'hd', // Invalid for DALL-E 2
        })
        .expect(400);

      const error = response.body as { message: string };
      expect(error).toHaveProperty('message');
    });

    testIf(hasApiKey)(
      'should reject generation with invalid response format',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/images/generate')
          .send({
            prompt: 'Test',
            response_format: 'invalid',
          })
          .expect(400);

        const error = response.body as { message: string };
        expect(error).toHaveProperty('message');
      },
    );
  });
});
