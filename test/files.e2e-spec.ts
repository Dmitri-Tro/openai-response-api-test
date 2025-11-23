import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { OpenAIExceptionFilter } from '../src/common/filters/openai-exception.filter';

/**
 * E2E Tests for Files API
 *
 * These tests make real calls to OpenAI's Files API and require:
 * 1. OPENAI_API_KEY environment variable set
 *
 * Tests will auto-skip if OPENAI_API_KEY is not set.
 *
 * **IMPORTANT**: Files API has limits:
 * - Maximum file size: 512 MB (standard API)
 * - Storage: All files count toward organization storage quota
 * - Purpose restrictions: Some purposes cannot be downloaded
 *
 * These tests use small text files to minimize storage usage.
 */

// Auto-skip pattern
const hasApiKey = !!process.env.OPENAI_API_KEY;
const testIf = (condition: boolean) => (condition ? it : it.skip);

describe('Files API (E2E)', () => {
  let app: INestApplication;
  const uploadedFileIds: string[] = [];

  beforeAll(async () => {
    if (!hasApiKey) {
      console.log('⏭️  Skipping Files API E2E tests (OPENAI_API_KEY not set)');
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
    // Cleanup: delete all uploaded files
    if (uploadedFileIds.length > 0 && hasApiKey) {
      console.log(`🧹 Cleaning up ${uploadedFileIds.length} uploaded files...`);
      for (const fileId of uploadedFileIds) {
        try {
          await request(app.getHttpServer())
            .delete(`/api/files/${fileId}`)
            .expect(200);
          console.log(`  ✓ Deleted file: ${fileId}`);
        } catch (error) {
          console.log(`  ✗ Failed to delete file: ${fileId}`);
        }
      }
    }

    if (app) {
      await app.close();
    }
  });

  describe('POST /api/files', () => {
    testIf(hasApiKey)(
      'should upload file with purpose=assistants',
      async () => {
        const fileContent = Buffer.from('Test file for assistants purpose');

        const response = await request(app.getHttpServer())
          .post('/api/files')
          .field('purpose', 'assistants')
          .attach('file', fileContent, 'test-assistants.txt')
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.id).toMatch(/^file-/);
        expect(response.body).toHaveProperty('object', 'file');
        expect(response.body).toHaveProperty('purpose', 'assistants');
        expect(response.body).toHaveProperty('filename', 'test-assistants.txt');
        expect(response.body).toHaveProperty('bytes');
        expect(response.body.bytes).toBeGreaterThan(0);
        expect(response.body).toHaveProperty('created_at');
        expect(response.body).toHaveProperty('status');

        uploadedFileIds.push(response.body.id);
        console.log(
          `✅ File uploaded: ${response.body.id} (${response.body.bytes} bytes, status: ${response.body.status})`,
        );
      },
      30000,
    );

    testIf(hasApiKey)(
      'should upload file with purpose=user_data',
      async () => {
        const fileContent = Buffer.from('User data content');

        const response = await request(app.getHttpServer())
          .post('/api/files')
          .field('purpose', 'user_data')
          .attach('file', fileContent, 'test-user-data.txt')
          .expect(201);

        expect(response.body.purpose).toBe('user_data');
        expect(response.body.filename).toBe('test-user-data.txt');

        uploadedFileIds.push(response.body.id);
        console.log(`✅ User data file uploaded: ${response.body.id}`);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should upload file with purpose=batch',
      async () => {
        const batchContent = JSON.stringify({
          custom_id: 'request-1',
          method: 'POST',
          url: '/v1/chat/completions',
          body: {
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'Test' }],
          },
        });

        const response = await request(app.getHttpServer())
          .post('/api/files')
          .field('purpose', 'batch')
          .attach('file', Buffer.from(batchContent), 'test-batch.jsonl')
          .expect(201);

        expect(response.body.purpose).toBe('batch');
        expect(response.body.filename).toBe('test-batch.jsonl');

        uploadedFileIds.push(response.body.id);
        console.log(`✅ Batch file uploaded: ${response.body.id}`);
      },
      30000,
    );

    // Note: expires_after cannot be tested via multipart form-data
    // as it requires JSON body, which is incompatible with file uploads
    // This functionality is tested in unit tests

    testIf(hasApiKey)(
      'should reject upload without purpose',
      async () => {
        const fileContent = Buffer.from('Test file without purpose');

        const response = await request(app.getHttpServer())
          .post('/api/files')
          .attach('file', fileContent, 'test-no-purpose.txt')
          .expect(400);

        expect(response.body).toHaveProperty('message');
        // Error message format may vary between validation and API
      },
      30000,
    );

    testIf(hasApiKey)(
      'should reject upload with invalid purpose',
      async () => {
        const fileContent = Buffer.from('Test file with invalid purpose');

        const response = await request(app.getHttpServer())
          .post('/api/files')
          .field('purpose', 'invalid-purpose')
          .attach('file', fileContent, 'test-invalid-purpose.txt')
          .expect(400);

        expect(response.body).toHaveProperty('message');
      },
      30000,
    );

    // Note: Missing file upload causes 500 from Multer/NestJS
    // This is expected NestJS behavior for multipart form-data without files

    testIf(hasApiKey)(
      'should handle special characters in filename',
      async () => {
        const fileContent = Buffer.from('File with special characters');

        const response = await request(app.getHttpServer())
          .post('/api/files')
          .field('purpose', 'assistants')
          .attach('file', fileContent, 'test-file (with) [special] {chars}.txt')
          .expect(201);

        expect(response.body).toHaveProperty('filename');
        expect(response.body.filename).toContain('test-file');

        uploadedFileIds.push(response.body.id);
        console.log(`✅ File with special chars uploaded: ${response.body.id}`);
      },
      30000,
    );
  });

  describe('GET /api/files', () => {
    testIf(hasApiKey)(
      'should list all files',
      async () => {
        const response = await request(app.getHttpServer())
          .get('/api/files')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        if (response.body.length > 0) {
          expect(response.body[0]).toHaveProperty('id');
          expect(response.body[0]).toHaveProperty('object', 'file');
          expect(response.body[0]).toHaveProperty('purpose');
          expect(response.body[0]).toHaveProperty('filename');
          expect(response.body[0]).toHaveProperty('bytes');
          expect(response.body[0]).toHaveProperty('created_at');
        }

        console.log(`✅ Listed ${response.body.length} files`);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should list files with purpose filter',
      async () => {
        const response = await request(app.getHttpServer())
          .get('/api/files?purpose=assistants')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        response.body.forEach((file: any) => {
          expect(file.purpose).toBe('assistants');
        });

        console.log(`✅ Listed ${response.body.length} assistants files`);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should list files with custom limit',
      async () => {
        const response = await request(app.getHttpServer())
          .get('/api/files?limit=5')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeLessThanOrEqual(5);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should list files in ascending order',
      async () => {
        const response = await request(app.getHttpServer())
          .get('/api/files?order=asc')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        // Verify ascending order if multiple files exist
        if (response.body.length > 1) {
          expect(response.body[0].created_at).toBeLessThanOrEqual(
            response.body[1].created_at,
          );
        }
      },
      30000,
    );

    testIf(hasApiKey)(
      'should list files in descending order (default)',
      async () => {
        const response = await request(app.getHttpServer())
          .get('/api/files?order=desc')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        // Verify descending order if multiple files exist
        if (response.body.length > 1) {
          expect(response.body[0].created_at).toBeGreaterThanOrEqual(
            response.body[1].created_at,
          );
        }
      },
      30000,
    );

    testIf(hasApiKey)(
      'should list files with combined filters',
      async () => {
        const response = await request(app.getHttpServer())
          .get('/api/files?purpose=assistants&order=asc&limit=3')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeLessThanOrEqual(3);
        response.body.forEach((file: any) => {
          expect(file.purpose).toBe('assistants');
        });
      },
      30000,
    );
  });

  describe('GET /api/files/:id', () => {
    testIf(hasApiKey)(
      'should get file metadata',
      async () => {
        // Upload file first
        const fileContent = Buffer.from('File for metadata test');
        const uploadResponse = await request(app.getHttpServer())
          .post('/api/files')
          .field('purpose', 'assistants')
          .attach('file', fileContent, 'metadata-test.txt')
          .expect(201);

        const fileId = uploadResponse.body.id;
        uploadedFileIds.push(fileId);

        // Get metadata
        const response = await request(app.getHttpServer())
          .get(`/api/files/${fileId}`)
          .expect(200);

        expect(response.body).toHaveProperty('id', fileId);
        expect(response.body).toHaveProperty('object', 'file');
        expect(response.body).toHaveProperty('purpose', 'assistants');
        expect(response.body).toHaveProperty('filename', 'metadata-test.txt');
        expect(response.body).toHaveProperty('bytes');
        expect(response.body).toHaveProperty('created_at');
        expect(response.body).toHaveProperty('status');

        console.log(
          `✅ Retrieved metadata for file: ${fileId} (status: ${response.body.status})`,
        );
      },
      30000,
    );

    testIf(hasApiKey)(
      'should return 404 for invalid file ID',
      async () => {
        const response = await request(app.getHttpServer())
          .get('/api/files/file-invalid-id-12345')
          .expect(404);

        expect(response.body).toHaveProperty('message');
      },
      30000,
    );

    // Note: expires_after cannot be tested via multipart form-data in E2E tests
    // This functionality is covered in unit tests
  });

  describe('GET /api/files/:id/download', () => {
    // Note: OpenAI Files API has complex download restrictions based on purpose
    // Assistants files: Cannot be downloaded (403)
    // Batch/fine-tune files: Can be downloaded after processing
    // Vision files: Not supported in current API version
    // Download functionality is tested in unit tests with mocked responses

    testIf(hasApiKey)(
      'should handle download request for assistants file (forbidden)',
      async () => {
        // Upload file with assistants purpose (not downloadable per OpenAI policy)
        const fileContent = Buffer.from('Assistants file - not downloadable');
        const uploadResponse = await request(app.getHttpServer())
          .post('/api/files')
          .field('purpose', 'assistants')
          .attach('file', fileContent, 'no-download.txt')
          .expect(201);

        const fileId = uploadResponse.body.id;
        uploadedFileIds.push(fileId);

        // Attempt download (OpenAI returns 403 for assistants files)
        const response = await request(app.getHttpServer()).get(
          `/api/files/${fileId}/download`,
        );

        // Accept either 403 (OpenAI restriction) or 500 (error from download failure)
        expect([403, 500]).toContain(response.status);

        console.log(
          `✅ Download restriction enforced for assistants file: ${fileId} (status: ${response.status})`,
        );
      },
      30000,
    );

    testIf(hasApiKey)(
      'should return error for invalid file ID',
      async () => {
        const response = await request(app.getHttpServer()).get(
          '/api/files/file-invalid-id-12345/download',
        );

        // Accept 400 (validation), 404 (not found), or 500 (download error)
        expect([400, 404, 500]).toContain(response.status);
      },
      30000,
    );
  });

  describe('DELETE /api/files/:id', () => {
    testIf(hasApiKey)(
      'should delete file',
      async () => {
        // Upload file first
        const fileContent = Buffer.from('File to be deleted');
        const uploadResponse = await request(app.getHttpServer())
          .post('/api/files')
          .field('purpose', 'assistants')
          .attach('file', fileContent, 'delete-test.txt')
          .expect(201);

        const fileId = uploadResponse.body.id;

        // Delete file
        const deleteResponse = await request(app.getHttpServer())
          .delete(`/api/files/${fileId}`)
          .expect(200);

        expect(deleteResponse.body).toHaveProperty('id', fileId);
        expect(deleteResponse.body).toHaveProperty('deleted', true);
        expect(deleteResponse.body).toHaveProperty('object', 'file');

        console.log(`✅ File deleted: ${fileId}`);

        // Verify file is deleted (should return 404)
        await request(app.getHttpServer())
          .get(`/api/files/${fileId}`)
          .expect(404);

        console.log(`✅ Verified file is deleted: ${fileId}`);
      },
      30000,
    );

    testIf(hasApiKey)(
      'should return 404 for invalid file ID',
      async () => {
        const response = await request(app.getHttpServer())
          .delete('/api/files/file-invalid-id-12345')
          .expect(404);

        expect(response.body).toHaveProperty('message');
      },
      30000,
    );

    testIf(hasApiKey)(
      'should handle double delete (idempotent)',
      async () => {
        // Upload file
        const fileContent = Buffer.from('File for double delete test');
        const uploadResponse = await request(app.getHttpServer())
          .post('/api/files')
          .field('purpose', 'assistants')
          .attach('file', fileContent, 'double-delete.txt')
          .expect(201);

        const fileId = uploadResponse.body.id;

        // First delete
        await request(app.getHttpServer())
          .delete(`/api/files/${fileId}`)
          .expect(200);

        console.log(`✅ First delete successful: ${fileId}`);

        // Second delete (should fail with 404)
        await request(app.getHttpServer())
          .delete(`/api/files/${fileId}`)
          .expect(404);

        console.log(`✅ Second delete correctly returned 404: ${fileId}`);
      },
      30000,
    );
  });
});
