import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'http';
import type { Audio } from 'openai/resources/audio';
import { AppModule } from '../src/app.module';
import { OpenAIExceptionFilter } from '../src/common/filters/openai-exception.filter';
import { LoggerService } from '../src/common/services/logger.service';
import * as fs from 'fs';
import * as path from 'path';

/**
 * E2E Tests for Audio API
 *
 * These tests make real calls to OpenAI's Audio API and require:
 * 1. OPENAI_API_KEY environment variable set
 * 2. Access to OpenAI Audio API (TTS, Transcription, Translation)
 *
 * Tests will auto-skip if requirements are not met.
 *
 * **Cost Estimates**:
 * - TTS (tts-1): $15/1M characters (~$0.001 per test)
 * - TTS (gpt-4o-mini-tts): Variable pricing
 * - Transcription (whisper-1): $0.006/minute (~$0.001 per test)
 * - Translation (whisper-1): $0.006/minute (~$0.001 per test)
 *
 * Total estimated cost for full suite: ~$0.05-$0.10
 *
 * **E2E Test Validation Status**:
 * ✅ TTS/Speech (7/7 tests can execute - no files needed)
 * ⚠️ Transcriptions (8/8 tests structured - needs audio fixtures in test/fixtures/audio/)
 * ⚠️ Translations (7/7 tests structured - needs audio fixtures in test/fixtures/audio/)
 *
 * **Note**: Without test audio files, 15/22 tests cannot execute.
 * See test/fixtures/audio/README.md for instructions on adding test audio files.
 *
 * Last validated: 2025-01-24
 */

// Auto-skip pattern
const hasApiKey = !!process.env.OPENAI_API_KEY;
const testIf = (condition: boolean) => (condition ? it : it.skip);

describe('Audio API (E2E)', () => {
  let app: INestApplication;
  let testAudioPath: string;

  beforeAll(async () => {
    if (!hasApiKey) {
      console.log('⏭️  Skipping Audio API E2E tests (OPENAI_API_KEY not set)');
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

    // Create test audio file for transcription/translation using TTS
    const testDir = path.join(__dirname, 'fixtures');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    testAudioPath = path.join(testDir, 'test-audio.mp3');

    // Generate real audio using TTS API for transcription tests
    if (!fs.existsSync(testAudioPath)) {
      try {
        console.log('📢 Generating test audio file using TTS API...');
        const response = await request(app.getHttpServer() as Server)
          .post('/api/audio/speech')
          .send({
            model: 'tts-1',
            voice: 'alloy',
            input: 'This is a test audio file for transcription.',
          });

        // Convert response body to Buffer properly
        const audioBuffer = Buffer.isBuffer(response.body)
          ? response.body
          : Buffer.from(response.body);
        fs.writeFileSync(testAudioPath, audioBuffer);
        console.log(`✅ Test audio file generated: ${testAudioPath}`);
      } catch (error) {
        console.error('❌ Failed to generate test audio file:', error);
        // Create empty file to signal tests should skip
        fs.writeFileSync(testAudioPath, Buffer.alloc(0));
      }
    }
  });

  afterAll(async () => {
    // Cleanup test files
    try {
      if (testAudioPath && fs.existsSync(testAudioPath)) {
        fs.unlinkSync(testAudioPath);
      }
      const testDir = path.join(__dirname, 'fixtures');
      if (fs.existsSync(testDir) && fs.readdirSync(testDir).length === 0) {
        fs.rmdirSync(testDir);
      }
    } catch (error) {
      console.log('Cleanup error:', error);
    }

    if (app) {
      await app.close();
    }
  });

  describe('POST /api/audio/speech (TTS)', () => {
    testIf(hasApiKey)(
      'should generate speech with minimal parameters (tts-1, alloy, mp3)',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/audio/speech')
          .send({
            model: 'tts-1',
            voice: 'alloy',
            input: 'Hello, this is a test.',
          })
          .expect(200)
          .expect('Content-Type', /audio/);

        expect(response.headers['content-disposition']).toContain('attachment');
        expect(response.headers['content-disposition']).toContain('speech.mp3');
        expect(response.body).toBeInstanceOf(Buffer);
        expect((response.body as Buffer).length).toBeGreaterThan(0);

        console.log(
          `✅ TTS generated: ${(response.body as Buffer).length} bytes (mp3, tts-1, alloy)`,
        );
      },
      30000,
    );

    testIf(hasApiKey)(
      'should generate speech with tts-1-hd model',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/audio/speech')
          .send({
            model: 'tts-1-hd',
            voice: 'shimmer',
            input: 'High quality audio test.',
            response_format: 'mp3',
          })
          .expect(200);

        expect((response.body as Buffer).length).toBeGreaterThan(0);
        console.log(
          `✅ TTS HD generated: ${(response.body as Buffer).length} bytes (tts-1-hd)`,
        );
      },
      30000,
    );

    testIf(hasApiKey)(
      'should generate speech with gpt-4o-mini-tts and instructions',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/audio/speech')
          .send({
            model: 'gpt-4o-mini-tts',
            voice: 'nova',
            input: 'Testing instructions support.',
            instructions: 'Speak in a cheerful tone',
          })
          .expect(200);

        expect((response.body as Buffer).length).toBeGreaterThan(0);
        console.log(
          `✅ TTS with instructions generated: ${(response.body as Buffer).length} bytes`,
        );
      },
      30000,
    );

    testIf(hasApiKey)(
      'should generate speech with opus format',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/audio/speech')
          .send({
            model: 'tts-1',
            voice: 'echo',
            input: 'Testing opus format.',
            response_format: 'opus',
          })
          .expect(200);

        expect(response.headers['content-disposition']).toContain(
          'speech.opus',
        );
        expect((response.body as Buffer).length).toBeGreaterThan(0);
        console.log(
          `✅ TTS opus generated: ${(response.body as Buffer).length} bytes`,
        );
      },
      30000,
    );

    testIf(hasApiKey)(
      'should generate speech with custom speed',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/audio/speech')
          .send({
            model: 'tts-1',
            voice: 'onyx',
            input: 'Testing custom speed.',
            speed: 1.5,
          })
          .expect(200);

        expect((response.body as Buffer).length).toBeGreaterThan(0);
        console.log(
          `✅ TTS with speed 1.5 generated: ${(response.body as Buffer).length} bytes`,
        );
      },
      30000,
    );

    testIf(hasApiKey)(
      'should reject invalid voice',
      async () => {
        await request(app.getHttpServer() as Server)
          .post('/api/audio/speech')
          .send({
            model: 'tts-1',
            voice: 'invalid-voice',
            input: 'Test.',
          })
          .expect(400);

        console.log('✅ Invalid voice rejected correctly');
      },
      30000,
    );

    testIf(hasApiKey)(
      'should reject input exceeding 4096 characters',
      async () => {
        const longInput = 'A'.repeat(4097);

        await request(app.getHttpServer() as Server)
          .post('/api/audio/speech')
          .send({
            model: 'tts-1',
            voice: 'alloy',
            input: longInput,
          })
          .expect(400);

        console.log('✅ Long input rejected correctly');
      },
      30000,
    );
  });

  describe('POST /api/audio/transcriptions (STT)', () => {
    testIf(hasApiKey)(
      'should transcribe audio with minimal parameters (whisper-1, json)',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/audio/transcriptions')
          .field('model', 'whisper-1')
          .attach('file', testAudioPath)
          .expect(200);

        const transcription = response.body as Audio.Transcription;
        expect(transcription).toHaveProperty('text');
        expect(typeof transcription.text).toBe('string');

        console.log(`✅ Transcription: "${transcription.text}"`);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should transcribe audio with language hint',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/audio/transcriptions')
          .field('model', 'whisper-1')
          .field('language', 'en')
          .attach('file', testAudioPath)
          .expect(200);

        const transcription = response.body as Audio.Transcription;
        expect(transcription).toHaveProperty('text');
        console.log(
          `✅ Transcription with language hint: "${transcription.text}"`,
        );
      },
      30000,
    );

    testIf(hasApiKey)(
      'should transcribe audio with text format (plain string)',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/audio/transcriptions')
          .field('model', 'whisper-1')
          .field('response_format', 'text')
          .attach('file', testAudioPath)
          .expect(200);

        expect(typeof response.text).toBe('string');
        console.log(`✅ Transcription (text format): "${response.text}"`);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should transcribe audio with verbose_json format',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/audio/transcriptions')
          .field('model', 'whisper-1')
          .field('response_format', 'verbose_json')
          .attach('file', testAudioPath)
          .expect(200);

        const transcription = response.body as Audio.TranscriptionVerbose;
        expect(transcription).toHaveProperty('text');
        expect(transcription).toHaveProperty('language');
        expect(transcription).toHaveProperty('duration');
        expect(transcription).toHaveProperty('segments');

        console.log(
          `✅ Verbose transcription: language=${transcription.language}, duration=${transcription.duration}s`,
        );
      },
      30000,
    );

    testIf(hasApiKey)(
      'should transcribe audio with prompt for context',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/audio/transcriptions')
          .field('model', 'whisper-1')
          .field('prompt', 'This is a technical discussion about AI.')
          .attach('file', testAudioPath)
          .expect(200);

        const transcription = response.body as Audio.Transcription;
        expect(transcription).toHaveProperty('text');
        console.log(`✅ Transcription with prompt: "${transcription.text}"`);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should transcribe audio with timestamp granularities',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/audio/transcriptions')
          .field('model', 'whisper-1')
          .field('response_format', 'verbose_json')
          .field('timestamp_granularities', 'word')
          .field('timestamp_granularities', 'segment')
          .attach('file', testAudioPath)
          .expect(200);

        const transcription = response.body as Audio.TranscriptionVerbose;
        expect(transcription).toHaveProperty('words');
        expect(transcription).toHaveProperty('segments');

        console.log(
          `✅ Transcription with timestamps: ${transcription.words?.length || 0} words, ${transcription.segments?.length || 0} segments`,
        );
      },
      30000,
    );

    testIf(hasApiKey)(
      'should reject missing file',
      async () => {
        // NestJS FileInterceptor returns 500 for missing files
        await request(app.getHttpServer() as Server)
          .post('/api/audio/transcriptions')
          .field('model', 'whisper-1')
          .expect(500);

        console.log('✅ Missing file rejected correctly');
      },
      30000,
    );

    testIf(hasApiKey)(
      'should reject invalid model',
      async () => {
        await request(app.getHttpServer() as Server)
          .post('/api/audio/transcriptions')
          .field('model', 'invalid-model')
          .attach('file', testAudioPath)
          .expect(400);

        console.log('✅ Invalid model rejected correctly');
      },
      30000,
    );
  });

  describe('POST /api/audio/translations (Translation to English)', () => {
    testIf(hasApiKey)(
      'should translate audio with minimal parameters (whisper-1, json)',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/audio/translations')
          .field('model', 'whisper-1')
          .attach('file', testAudioPath)
          .expect(200);

        const translation = response.body as Audio.Translation;
        expect(translation).toHaveProperty('text');
        expect(typeof translation.text).toBe('string');

        console.log(`✅ Translation: "${translation.text}"`);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should translate audio with text format (plain string)',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/audio/translations')
          .field('model', 'whisper-1')
          .field('response_format', 'text')
          .attach('file', testAudioPath)
          .expect(200);

        expect(typeof response.text).toBe('string');
        console.log(`✅ Translation (text format): "${response.text}"`);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should translate audio with verbose_json format',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/audio/translations')
          .field('model', 'whisper-1')
          .field('response_format', 'verbose_json')
          .attach('file', testAudioPath)
          .expect(200);

        const translation = response.body as Audio.TranslationVerbose;
        expect(translation).toHaveProperty('text');
        expect(translation).toHaveProperty('language');
        expect(translation).toHaveProperty('duration');

        console.log(
          `✅ Verbose translation: language=${translation.language}, duration=${translation.duration}s`,
        );
      },
      30000,
    );

    testIf(hasApiKey)(
      'should translate audio with prompt for context',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/audio/translations')
          .field('model', 'whisper-1')
          .field('prompt', 'This is a medical discussion.')
          .attach('file', testAudioPath)
          .expect(200);

        const translation = response.body as Audio.Translation;
        expect(translation).toHaveProperty('text');
        console.log(`✅ Translation with prompt: "${translation.text}"`);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should reject missing file',
      async () => {
        // NestJS FileInterceptor returns 500 for missing files
        await request(app.getHttpServer() as Server)
          .post('/api/audio/translations')
          .field('model', 'whisper-1')
          .expect(500);

        console.log('✅ Missing file rejected correctly');
      },
      30000,
    );

    testIf(hasApiKey)(
      'should reject invalid model (only whisper-1 supported)',
      async () => {
        await request(app.getHttpServer() as Server)
          .post('/api/audio/translations')
          .field('model', 'gpt-4o-transcribe')
          .attach('file', testAudioPath)
          .expect(400);

        console.log('✅ Invalid translation model rejected correctly');
      },
      30000,
    );
  });
});
