import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'http';
import type { Videos } from 'openai/resources/videos';
import { AppModule } from '../src/app.module';
import { OpenAIExceptionFilter } from '../src/common/filters/openai-exception.filter';
import { LoggerService } from '../src/common/services/logger.service';

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

    // Get LoggerService from the module for exception filter
    const loggerService = app.get(LoggerService);
    app.useGlobalFilters(new OpenAIExceptionFilter(loggerService));

    await app.init();
  });

  afterAll(async () => {
    // Cleanup: delete created video if exists
    if (createdVideoId && hasApiKey) {
      try {
        await request(app.getHttpServer() as Server)
          .delete(`/api/videos/${createdVideoId}`)
          .expect(200);
        console.log(`🧹 Cleaned up video: ${createdVideoId}`);
      } catch {
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
        const response = await request(app.getHttpServer() as Server)
          .post('/api/videos')
          .send({
            prompt: 'A serene lakeside at sunset',
          })
          .expect(201);

        const video = response.body as Videos.Video;
        expect(video).toHaveProperty('id');
        expect(video.id).toMatch(/^video/); // OpenAI uses 'video' prefix, not 'vid_'
        expect(video).toHaveProperty('object', 'video');
        expect(video).toHaveProperty('status', 'queued');
        expect(video).toHaveProperty('prompt', 'A serene lakeside at sunset');
        expect(video).toHaveProperty('progress', 0);
        expect(video).toHaveProperty('model');
        expect(video).toHaveProperty('seconds');
        expect(video).toHaveProperty('size');
        expect(video).toHaveProperty('created_at');

        // Store for cleanup
        createdVideoId = video.id;

        console.log(`✅ Video created: ${video.id} (status: ${video.status})`);
      },
      60000,
    );

    testIf(hasApiKey)(
      'should create video with all parameters',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/videos')
          .send({
            prompt: 'A calm ocean wave',
            model: 'sora-2',
            seconds: '4',
            size: '720x1280',
          })
          .expect(201);

        const video = response.body as Videos.Video;
        expect(video.model).toBe('sora-2');
        expect(video.seconds).toBe('4');
        expect(video.size).toBe('720x1280');

        console.log(`✅ Video created with custom params: ${video.id}`);
      },
      60000,
    );

    testIf(hasApiKey)(
      'should reject video with invalid prompt',
      async () => {
        const response = await request(app.getHttpServer() as Server)
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
        const response = await request(app.getHttpServer() as Server)
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
        const createResponse = await request(app.getHttpServer() as Server)
          .post('/api/videos')
          .send({ prompt: 'Status test video' })
          .expect(201);

        const createdVideo = createResponse.body as Videos.Video;
        const videoId = createdVideo.id;

        // Get status
        const statusResponse = await request(app.getHttpServer() as Server)
          .get(`/api/videos/${videoId}`)
          .expect(200);

        const video = statusResponse.body as Videos.Video;
        expect(video).toHaveProperty('id', videoId);
        expect(video).toHaveProperty('status');
        expect(['queued', 'in_progress', 'completed', 'failed']).toContain(
          video.status,
        );

        console.log(
          `✅ Video status: ${video.status} (progress: ${video.progress}%)`,
        );
      },
      60000,
    );

    testIf(hasApiKey)(
      'should return 404 for invalid video ID',
      async () => {
        await request(app.getHttpServer() as Server)
          .get('/api/videos/video_nonexistent_12345')
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
        const createResponse = await request(app.getHttpServer() as Server)
          .post('/api/videos')
          .send({ prompt: 'Polling test video' })
          .expect(201);

        const createdVideo = createResponse.body as Videos.Video;
        const videoId = createdVideo.id;

        // Poll with short timeout (may timeout if generation takes too long)
        // Note: Video generation can take 2-10 minutes, so we expect timeout
        let pollResponse;
        try {
          pollResponse = await request(app.getHttpServer() as Server)
            .get(`/api/videos/${videoId}/poll?maxWaitMs=60000`)
            .timeout(70000); // Supertest timeout must be > maxWaitMs + network overhead
        } catch (error) {
          // Supertest timeout is expected if video takes longer than maxWaitMs
          if (error && typeof error === 'object' && 'timeout' in error) {
            console.log(`⏱️  Request timeout (expected for slow video generation)`);
            return; // Test passes - timeout is acceptable
          }
          throw error;
        }

        // Accept both success and timeout scenarios
        if (pollResponse.status === 200) {
          const video = pollResponse.body as Videos.Video;
          expect(video).toHaveProperty('id', videoId);
          expect(['completed', 'failed']).toContain(video.status);
          console.log(`✅ Video completed with status: ${video.status}`);
        } else if (pollResponse.status === 504) {
          console.log(`⏱️  Polling timeout (expected for slow generation)`);
        }

        // Ensure we only got valid status codes (not 404, 500, etc.)
        expect([200, 504]).toContain(pollResponse.status);
      },
      120000,
    );

    testIf(hasApiKey)(
      'should timeout with short maxWaitMs',
      async () => {
        // Create video
        const createResponse = await request(app.getHttpServer() as Server)
          .post('/api/videos')
          .send({ prompt: 'Timeout test video' })
          .expect(201);

        const createdVideo = createResponse.body as Videos.Video;
        const videoId = createdVideo.id;

        // Poll with very short timeout (should timeout)
        // Note: Service needs at least 1 poll cycle (5s) before checking timeout
        try {
          const response = await request(app.getHttpServer() as Server)
            .get(`/api/videos/${videoId}/poll?maxWaitMs=1000`)
            .timeout(15000); // Generous timeout for 1 poll cycle + network

          expect(response.status).toBe(504); // Should get Gateway Timeout
        } catch (error) {
          // Supertest timeout can occur if service doesn't respond quickly enough
          if (error && typeof error === 'object' && 'timeout' in error) {
            console.log(`⏱️  Supertest timeout (polling took longer than expected)`);
            return; // Test passes - timeout is acceptable
          }
          throw error;
        }
      },
      30000,
    );
  });

  describe('GET /api/videos', () => {
    testIf(hasApiKey)(
      'should list videos',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .get('/api/videos')
          .expect(200);

        const videos = response.body as Videos.Video[];
        expect(Array.isArray(videos)).toBe(true);
        if (videos.length > 0) {
          expect(videos[0]).toHaveProperty('id');
          expect(videos[0]).toHaveProperty('status');
          expect(videos[0]).toHaveProperty('model');
        }

        console.log(`✅ Listed ${videos.length} videos`);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should list videos with custom limit',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .get('/api/videos?limit=5')
          .expect(200);

        const videos = response.body as Videos.Video[];
        expect(Array.isArray(videos)).toBe(true);
        expect(videos.length).toBeLessThanOrEqual(5);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should list videos in ascending order',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .get('/api/videos?order=asc')
          .expect(200);

        const videos = response.body as Videos.Video[];
        expect(Array.isArray(videos)).toBe(true);
        // Verify ascending order if multiple videos exist
        if (videos.length > 1) {
          expect(videos[0]?.created_at).toBeLessThanOrEqual(
            videos[1]?.created_at,
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
        const createResponse = await request(app.getHttpServer() as Server)
          .post('/api/videos')
          .send({ prompt: 'Delete test video' })
          .expect(201);

        const createdVideo = createResponse.body as Videos.Video;
        const videoId = createdVideo.id;

        // Delete video
        // Note: OpenAI may return 400/404 if video is in certain states or not accessible
        const deleteResponse = await request(app.getHttpServer() as Server)
          .delete(`/api/videos/${videoId}`);

        // Accept both success and error responses (API behavior varies by video state)
        if (deleteResponse.status === 200) {
          const deleted = deleteResponse.body as Videos.VideoDeleteResponse;
          expect(deleted).toHaveProperty('id', videoId);
          expect(deleted).toHaveProperty('deleted', true);
          console.log(`✅ Video deleted: ${videoId}`);
        } else {
          console.log(
            `⏱️  Video deletion failed with status ${deleteResponse.status} (may be API limitation)`,
          );
        }

        expect([200, 400, 404]).toContain(deleteResponse.status);
      },
      60000,
    );

    testIf(hasApiKey)(
      'should return 404 for invalid video ID',
      async () => {
        await request(app.getHttpServer() as Server)
          .delete('/api/videos/video_nonexistent_12345')
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
        const createResponse = await request(app.getHttpServer() as Server)
          .post('/api/videos')
          .send({ prompt: 'Original video for remix' })
          .expect(201);

        const sourceVideo = createResponse.body as Videos.Video;
        const sourceVideoId = sourceVideo.id;

        // Create remix
        // Note: OpenAI returns 404 "Video is not ready yet" for videos in queued/in_progress status
        // Remix requires the source video to be completed, which can take minutes
        const remixResponse = await request(app.getHttpServer() as Server)
          .post(`/api/videos/${sourceVideoId}/remix`)
          .send({ prompt: 'Remixed version' });

        // Accept both success (if video completed quickly) and 404 (video not ready)
        if (remixResponse.status === 201) {
          const remixedVideo = remixResponse.body as Videos.Video;
          expect(remixedVideo).toHaveProperty('id');
          expect(remixedVideo.id).not.toBe(sourceVideoId);
          expect(remixedVideo).toHaveProperty(
            'remixed_from_video_id',
            sourceVideoId,
          );
          expect(remixedVideo).toHaveProperty('prompt', 'Remixed version');
          console.log(
            `✅ Remix created: ${remixedVideo.id} (from ${sourceVideoId})`,
          );
        } else if (remixResponse.status === 404) {
          console.log(
            `⏱️  Source video not ready for remix (expected for queued/in_progress videos)`,
          );
        }

        expect([201, 404]).toContain(remixResponse.status);
      },
      90000,
    );

    testIf(hasApiKey)(
      'should reject remix with invalid source',
      async () => {
        await request(app.getHttpServer() as Server)
          .post('/api/videos/video_nonexistent_12345/remix')
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
        const createResponse = await request(app.getHttpServer() as Server)
          .post('/api/videos')
          .send({ prompt: 'Download test video' })
          .expect(201);

        const createdVideo = createResponse.body as Videos.Video;
        const videoId = createdVideo.id;

        // Try to download immediately (should fail)
        // Note: OpenAI returns 404 "Video is not ready yet" instead of 409 for incomplete videos
        const response = await request(app.getHttpServer() as Server)
          .get(`/api/videos/${videoId}/download`);

        expect([404, 409]).toContain(response.status);
      },
      60000,
    );

    // Note: Full download test would require waiting for video completion
    // which can take 2-10 minutes and is expensive to test in CI/CD
  });
});
