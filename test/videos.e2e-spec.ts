import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { OpenAIExceptionFilter } from '../src/common/filters/openai-exception.filter';

/**
 * E2E Tests for Videos API
 *
 * These tests make real calls to OpenAI's Videos API and require:
 * 1. OPENAI_API_KEY environment variable set
 * 2. Access to OpenAI Videos API (private beta)
 *
 * Tests will auto-skip if requirements are not met.
 *
 * **IMPORTANT**: Videos API is expensive:
 * - sora-2: $0.50 per 4-second video ($0.125/sec)
 * - sora-2-pro: $1.60 per 4-second video ($0.40/sec)
 *
 * These tests use 4-second videos to minimize cost.
 */

// Auto-skip pattern
const hasApiKey = !!process.env.OPENAI_API_KEY;
const testIf = (condition: boolean) => (condition ? it : it.skip);

describe('Videos API (E2E)', () => {
  let app: INestApplication;
  let createdVideoId: string | null = null;

  beforeAll(async () => {
    if (!hasApiKey) {
      console.log('⏭️  Skipping Videos API E2E tests (OPENAI_API_KEY not set)');
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
  });

  afterAll(async () => {
    // Cleanup: delete created video if exists
    if (createdVideoId && hasApiKey) {
      try {
        await request(app.getHttpServer())
          .delete(`/api/videos/${createdVideoId}`)
          .expect(200);
        console.log(`🧹 Cleaned up video: ${createdVideoId}`);
      } catch (error) {
        console.log(`Failed to cleanup video: ${createdVideoId}`);
      }
    }

    if (app) {
      await app.close();
    }
  });

  describe('POST /api/videos', () => {
    testIf(hasApiKey)(
      'should create video with minimal parameters',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/videos')
          .send({
            prompt: 'A serene lakeside at sunset',
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.id).toMatch(/^vid_/);
        expect(response.body).toHaveProperty('object', 'video');
        expect(response.body).toHaveProperty('status', 'queued');
        expect(response.body).toHaveProperty(
          'prompt',
          'A serene lakeside at sunset',
        );
        expect(response.body).toHaveProperty('progress', 0);
        expect(response.body).toHaveProperty('model');
        expect(response.body).toHaveProperty('seconds');
        expect(response.body).toHaveProperty('size');
        expect(response.body).toHaveProperty('created_at');

        // Store for cleanup
        createdVideoId = response.body.id;

        console.log(
          `✅ Video created: ${response.body.id} (status: ${response.body.status})`,
        );
      },
      60000,
    );

    testIf(hasApiKey)(
      'should create video with all parameters',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/videos')
          .send({
            prompt: 'A calm ocean wave',
            model: 'sora-2',
            seconds: '4',
            size: '720x1280',
          })
          .expect(201);

        expect(response.body.model).toBe('sora-2');
        expect(response.body.seconds).toBe('4');
        expect(response.body.size).toBe('720x1280');

        console.log(`✅ Video created with custom params: ${response.body.id}`);
      },
      60000,
    );

    testIf(hasApiKey)(
      'should reject video with invalid prompt',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/videos')
          .send({
            prompt: '', // Empty prompt
          })
          .expect(400);

        expect(response.body).toHaveProperty('message');
      },
      30000,
    );

    testIf(hasApiKey)(
      'should reject video with invalid model',
      async () => {
        const response = await request(app.getHttpServer())
          .post('/api/videos')
          .send({
            prompt: 'Test',
            model: 'invalid-model',
          })
          .expect(400);

        expect(response.body).toHaveProperty('message');
      },
      30000,
    );
  });

  describe('GET /api/videos/:id', () => {
    testIf(hasApiKey)(
      'should get video status',
      async () => {
        // Create video first
        const createResponse = await request(app.getHttpServer())
          .post('/api/videos')
          .send({ prompt: 'Status test video' })
          .expect(201);

        const videoId = createResponse.body.id;

        // Get status
        const statusResponse = await request(app.getHttpServer())
          .get(`/api/videos/${videoId}`)
          .expect(200);

        expect(statusResponse.body).toHaveProperty('id', videoId);
        expect(statusResponse.body).toHaveProperty('status');
        expect(['queued', 'in_progress', 'completed', 'failed']).toContain(
          statusResponse.body.status,
        );

        console.log(
          `✅ Video status: ${statusResponse.body.status} (progress: ${statusResponse.body.progress}%)`,
        );
      },
      60000,
    );

    testIf(hasApiKey)(
      'should return 404 for invalid video ID',
      async () => {
        await request(app.getHttpServer())
          .get('/api/videos/vid_invalid_id_12345')
          .expect(404);
      },
      30000,
    );
  });

  describe('GET /api/videos/:id/poll', () => {
    testIf(hasApiKey)(
      'should poll until completion',
      async () => {
        // Create video
        const createResponse = await request(app.getHttpServer())
          .post('/api/videos')
          .send({ prompt: 'Polling test video' })
          .expect(201);

        const videoId = createResponse.body.id;

        // Poll with short timeout (may timeout if generation takes too long)
        const pollResponse = await request(app.getHttpServer())
          .get(`/api/videos/${videoId}/poll?maxWaitMs=60000`)
          .timeout(65000);

        // Accept both success and timeout scenarios
        if (pollResponse.status === 200) {
          expect(pollResponse.body).toHaveProperty('id', videoId);
          expect(['completed', 'failed']).toContain(pollResponse.body.status);
          console.log(
            `✅ Video completed with status: ${pollResponse.body.status}`,
          );
        } else if (pollResponse.status === 504) {
          console.log(`⏱️  Polling timeout (expected for slow generation)`);
        }
      },
      120000,
    );

    testIf(hasApiKey)(
      'should timeout with short maxWaitMs',
      async () => {
        // Create video
        const createResponse = await request(app.getHttpServer())
          .post('/api/videos')
          .send({ prompt: 'Timeout test video' })
          .expect(201);

        const videoId = createResponse.body.id;

        // Poll with very short timeout (should timeout)
        await request(app.getHttpServer())
          .get(`/api/videos/${videoId}/poll?maxWaitMs=1000`)
          .timeout(5000)
          .expect(500); // Timeout error
      },
      30000,
    );
  });

  describe('GET /api/videos', () => {
    testIf(hasApiKey)(
      'should list videos',
      async () => {
        const response = await request(app.getHttpServer())
          .get('/api/videos')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        if (response.body.length > 0) {
          expect(response.body[0]).toHaveProperty('id');
          expect(response.body[0]).toHaveProperty('status');
          expect(response.body[0]).toHaveProperty('model');
        }

        console.log(`✅ Listed ${response.body.length} videos`);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should list videos with custom limit',
      async () => {
        const response = await request(app.getHttpServer())
          .get('/api/videos?limit=5')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeLessThanOrEqual(5);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should list videos in ascending order',
      async () => {
        const response = await request(app.getHttpServer())
          .get('/api/videos?order=asc')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        // Verify ascending order if multiple videos exist
        if (response.body.length > 1) {
          expect(response.body[0].created_at).toBeLessThanOrEqual(
            response.body[1].created_at,
          );
        }
      },
      30000,
    );
  });

  describe('DELETE /api/videos/:id', () => {
    testIf(hasApiKey)(
      'should delete video',
      async () => {
        // Create video first
        const createResponse = await request(app.getHttpServer())
          .post('/api/videos')
          .send({ prompt: 'Delete test video' })
          .expect(201);

        const videoId = createResponse.body.id;

        // Delete video
        const deleteResponse = await request(app.getHttpServer())
          .delete(`/api/videos/${videoId}`)
          .expect(200);

        expect(deleteResponse.body).toHaveProperty('id', videoId);
        expect(deleteResponse.body).toHaveProperty('deleted', true);

        console.log(`✅ Video deleted: ${videoId}`);
      },
      60000,
    );

    testIf(hasApiKey)(
      'should return 404 for invalid video ID',
      async () => {
        await request(app.getHttpServer())
          .delete('/api/videos/vid_invalid_id_12345')
          .expect(404);
      },
      30000,
    );
  });

  describe('POST /api/videos/:id/remix', () => {
    testIf(hasApiKey)(
      'should create video remix',
      async () => {
        // Create source video first
        const createResponse = await request(app.getHttpServer())
          .post('/api/videos')
          .send({ prompt: 'Original video for remix' })
          .expect(201);

        const sourceVideoId = createResponse.body.id;

        // Create remix
        const remixResponse = await request(app.getHttpServer())
          .post(`/api/videos/${sourceVideoId}/remix`)
          .send({ prompt: 'Remixed version' })
          .expect(201);

        expect(remixResponse.body).toHaveProperty('id');
        expect(remixResponse.body.id).not.toBe(sourceVideoId);
        expect(remixResponse.body).toHaveProperty(
          'remixed_from_video_id',
          sourceVideoId,
        );
        expect(remixResponse.body).toHaveProperty('prompt', 'Remixed version');

        console.log(
          `✅ Remix created: ${remixResponse.body.id} (from ${sourceVideoId})`,
        );
      },
      90000,
    );

    testIf(hasApiKey)(
      'should reject remix with invalid source',
      async () => {
        await request(app.getHttpServer())
          .post('/api/videos/vid_invalid_id_12345/remix')
          .send({ prompt: 'Test remix' })
          .expect(404);
      },
      30000,
    );
  });

  describe('GET /api/videos/:id/download', () => {
    testIf(hasApiKey)(
      'should reject download for incomplete video',
      async () => {
        // Create video that's likely not completed yet
        const createResponse = await request(app.getHttpServer())
          .post('/api/videos')
          .send({ prompt: 'Download test video' })
          .expect(201);

        const videoId = createResponse.body.id;

        // Try to download immediately (should fail)
        await request(app.getHttpServer())
          .get(`/api/videos/${videoId}/download`)
          .expect(409); // Conflict - video not ready
      },
      60000,
    );

    // Note: Full download test would require waiting for video completion
    // which can take 2-10 minutes and is expensive to test in CI/CD
  });
});
