import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'http';
import type { VectorStores } from 'openai/resources/vector-stores';
import type { FileObject } from 'openai/resources/files';
import { AppModule } from '../src/app.module';
import { OpenAIExceptionFilter } from '../src/common/filters/openai-exception.filter';
import { LoggerService } from '../src/common/services/logger.service';

/**
 * E2E Tests for Vector Stores API
 *
 * These tests make real calls to OpenAI's Vector Stores API and require:
 * 1. OPENAI_API_KEY environment variable set
 *
 * Tests will auto-skip if OPENAI_API_KEY is not set.
 *
 * **IMPORTANT**: Vector Stores API has limits:
 * - Vector stores: Limited by plan (Free: 1, Pro: 100+)
 * - Files per vector store: Up to 10,000 files
 * - Storage: Files count toward organization storage quota
 * - Indexing time: Depends on file size and chunking strategy
 *
 * These tests use small text files and cleanup all resources.
 *
 * **Test Flow**:
 * 1. Upload files (Files API dependency)
 * 2. Create vector stores
 * 3. Add files to vector stores
 * 4. Test file batches
 * 5. Test polling operations
 * 6. Test search functionality
 * 7. Cleanup: delete vector stores and files
 */

// Auto-skip pattern
const hasApiKey = !!process.env.OPENAI_API_KEY;
const testIf = (condition: boolean) => (condition ? it : it.skip);

describe('Vector Stores API (E2E)', () => {
  let app: INestApplication;
  const uploadedFileIds: string[] = [];
  const createdVectorStoreIds: string[] = [];

  beforeAll(async () => {
    if (!hasApiKey) {
      console.log(
        '⏭️  Skipping Vector Stores API E2E tests (OPENAI_API_KEY not set)',
      );
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

    // Upload test files for vector store operations
    console.log('📤 Uploading test files for vector stores...');
    const testFiles = [
      {
        content: 'Machine learning is a subset of artificial intelligence.',
        filename: 'ml-intro.txt',
      },
      {
        content:
          'Neural networks are computing systems inspired by biological neural networks.',
        filename: 'neural-nets.txt',
      },
      {
        content:
          'Deep learning uses multiple layers to progressively extract higher-level features.',
        filename: 'deep-learning.txt',
      },
    ];

    for (const { content, filename } of testFiles) {
      try {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/files')
          .field('purpose', 'assistants')
          .attach('file', Buffer.from(content), filename)
          .expect(201);

        const file = response.body as FileObject;
        uploadedFileIds.push(file.id);
        console.log(`  ✓ Uploaded file: ${file.id} (${filename})`);
      } catch {
        console.log(`  ✗ Failed to upload file: ${filename}`);
      }
    }
  }, 30000); // 30 second timeout for file uploads

  afterAll(async () => {
    // Cleanup: delete all vector stores
    if (createdVectorStoreIds.length > 0 && hasApiKey) {
      console.log(
        `🧹 Cleaning up ${createdVectorStoreIds.length} vector stores...`,
      );
      for (const vectorStoreId of createdVectorStoreIds) {
        try {
          await request(app.getHttpServer() as Server)
            .delete(`/api/vector-stores/${vectorStoreId}`)
            .expect(200);
          console.log(`  ✓ Deleted vector store: ${vectorStoreId}`);
        } catch {
          console.log(`  ✗ Failed to delete vector store: ${vectorStoreId}`);
        }
      }
    }

    // Cleanup: delete all uploaded files
    if (uploadedFileIds.length > 0 && hasApiKey) {
      console.log(`🧹 Cleaning up ${uploadedFileIds.length} uploaded files...`);
      for (const fileId of uploadedFileIds) {
        try {
          await request(app.getHttpServer() as Server)
            .delete(`/api/files/${fileId}`)
            .expect(200);
          console.log(`  ✓ Deleted file: ${fileId}`);
        } catch {
          console.log(`  ✗ Failed to delete file: ${fileId}`);
        }
      }
    }

    if (app) {
      await app.close();
    }
  });

  // ============================================================
  // VECTOR STORE MANAGEMENT (6 tests)
  // ============================================================

  describe('POST /api/vector-stores', () => {
    testIf(hasApiKey)(
      'should create vector store with minimal parameters',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/vector-stores')
          .send({})
          .expect(201);

        const vectorStore = response.body as VectorStores.VectorStore;

        expect(vectorStore).toHaveProperty('id');
        expect(vectorStore.id).toMatch(/^vs_/);
        expect(vectorStore).toHaveProperty('object', 'vector_store');
        expect(vectorStore).toHaveProperty('status');
        expect(vectorStore).toHaveProperty('file_counts');
        expect(vectorStore).toHaveProperty('usage_bytes');
        expect(vectorStore).toHaveProperty('created_at');

        createdVectorStoreIds.push(vectorStore.id);
        console.log(
          `✅ Vector store created: ${vectorStore.id} (status: ${vectorStore.status})`,
        );
      },
      60000,
    );

    testIf(hasApiKey)(
      'should create vector store with name and metadata',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/vector-stores')
          .send({
            name: 'Test Vector Store',
            metadata: {
              category: 'e2e-test',
              environment: 'testing',
            },
          })
          .expect(201);

        const vectorStore = response.body as VectorStores.VectorStore;

        expect(vectorStore.name).toBe('Test Vector Store');
        expect(vectorStore.metadata).toEqual({
          category: 'e2e-test',
          environment: 'testing',
        });

        createdVectorStoreIds.push(vectorStore.id);
        console.log(`✅ Named vector store created: ${vectorStore.id}`);
      },
      60000,
    );

    testIf(hasApiKey)(
      'should create vector store with files and auto chunking',
      async () => {
        if (uploadedFileIds.length === 0) {
          console.log('⏭️  Skipping: No uploaded files available');
          return;
        }

        const response = await request(app.getHttpServer() as Server)
          .post('/api/vector-stores')
          .send({
            name: 'Vector Store with Files',
            file_ids: [uploadedFileIds[0]],
            chunking_strategy: { type: 'auto' },
          })
          .expect(201);

        const vectorStore = response.body as VectorStores.VectorStore;

        expect(vectorStore).toHaveProperty('id');
        expect(vectorStore.name).toBe('Vector Store with Files');

        createdVectorStoreIds.push(vectorStore.id);
        console.log(
          `✅ Vector store with files created: ${vectorStore.id} (files: ${uploadedFileIds[0]})`,
        );
      },
      60000,
    );

    testIf(hasApiKey)(
      'should reject vector store with invalid metadata (too many keys)',
      async () => {
        const metadata: Record<string, string> = {};
        for (let i = 0; i < 17; i++) {
          metadata[`key${i}`] = `value${i}`;
        }

        const response = await request(app.getHttpServer() as Server)
          .post('/api/vector-stores')
          .send({ metadata })
          .expect(400);

        const error = response.body as { message: string };
        expect(error).toHaveProperty('message');
      },
      60000,
    );
  });

  describe('GET /api/vector-stores/:vectorStoreId', () => {
    testIf(hasApiKey)(
      'should retrieve vector store by ID',
      async () => {
        if (createdVectorStoreIds.length === 0) {
          console.log('⏭️  Skipping: No vector stores created yet');
          return;
        }

        const vectorStoreId = createdVectorStoreIds[0];
        const response = await request(app.getHttpServer() as Server)
          .get(`/api/vector-stores/${vectorStoreId}`)
          .expect(200);

        const vectorStore = response.body as VectorStores.VectorStore;

        expect(vectorStore.id).toBe(vectorStoreId);
        expect(vectorStore).toHaveProperty('status');
        expect(vectorStore).toHaveProperty('file_counts');

        console.log(`✅ Retrieved vector store: ${vectorStoreId}`);
      },
      60000,
    );

    testIf(hasApiKey)(
      'should return 404 for non-existent vector store',
      async () => {
        await request(app.getHttpServer() as Server)
          .get('/api/vector-stores/vs_nonexistent')
          .expect(404);
      },
      60000,
    );
  });

  describe('PATCH /api/vector-stores/:vectorStoreId', () => {
    testIf(hasApiKey)(
      'should update vector store name and metadata',
      async () => {
        if (createdVectorStoreIds.length === 0) {
          console.log('⏭️  Skipping: No vector stores created yet');
          return;
        }

        const vectorStoreId = createdVectorStoreIds[0];
        const response = await request(app.getHttpServer() as Server)
          .patch(`/api/vector-stores/${vectorStoreId}`)
          .send({
            name: 'Updated Name',
            metadata: { updated: 'true' },
          })
          .expect(200);

        const vectorStore = response.body as VectorStores.VectorStore;

        expect(vectorStore.name).toBe('Updated Name');
        expect(vectorStore.metadata?.updated).toBe('true');

        console.log(`✅ Updated vector store: ${vectorStoreId}`);
      },
      60000,
    );
  });

  describe('GET /api/vector-stores', () => {
    testIf(hasApiKey)(
      'should list vector stores',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .get('/api/vector-stores')
          .expect(200);

        const vectorStores = response.body as VectorStores.VectorStore[];

        expect(Array.isArray(vectorStores)).toBe(true);
        if (vectorStores.length > 0) {
          expect(vectorStores[0]).toHaveProperty('id');
          expect(vectorStores[0]).toHaveProperty('object', 'vector_store');
        }

        console.log(`✅ Listed ${vectorStores.length} vector stores`);
      },
      60000,
    );

    testIf(hasApiKey)(
      'should list vector stores with pagination',
      async () => {
        const response = await request(app.getHttpServer() as Server)
          .get('/api/vector-stores?limit=2&order=desc')
          .expect(200);

        const vectorStores = response.body as VectorStores.VectorStore[];

        expect(Array.isArray(vectorStores)).toBe(true);
        expect(vectorStores.length).toBeLessThanOrEqual(2);

        console.log(`✅ Listed ${vectorStores.length} vector stores (limit=2)`);
      },
      60000,
    );
  });

  describe('DELETE /api/vector-stores/:vectorStoreId', () => {
    testIf(hasApiKey)(
      'should delete vector store',
      async () => {
        // Create a new vector store specifically for deletion
        const createResponse = await request(app.getHttpServer() as Server)
          .post('/api/vector-stores')
          .send({ name: 'To be deleted' })
          .expect(201);

        const created = createResponse.body as VectorStores.VectorStore;
        const vectorStoreId = created.id;

        const deleteResponse = await request(app.getHttpServer() as Server)
          .delete(`/api/vector-stores/${vectorStoreId}`)
          .expect(200);

        const deleted = deleteResponse.body as VectorStores.VectorStoreDeleted;

        expect(deleted).toHaveProperty('id', vectorStoreId);
        expect(deleted).toHaveProperty('deleted', true);
        expect(deleted).toHaveProperty('object', 'vector_store.deleted');

        console.log(`✅ Deleted vector store: ${vectorStoreId}`);
      },
      60000,
    );
  });

  describe('POST /api/vector-stores/:vectorStoreId/search', () => {
    testIf(hasApiKey)(
      'should search vector store',
      async () => {
        if (createdVectorStoreIds.length < 2) {
          console.log('⏭️  Skipping: Need vector store with indexed files');
          return;
        }

        // Use the vector store created with files
        const vectorStoreId = createdVectorStoreIds[2];

        // Poll until indexing completes
        console.log(`⏳ Waiting for file indexing to complete...`);
        await request(app.getHttpServer() as Server)
          .post(`/api/vector-stores/${vectorStoreId}/poll`)
          .expect(200);

        const response = await request(app.getHttpServer() as Server)
          .post(`/api/vector-stores/${vectorStoreId}/search`)
          .send({ query: 'machine learning' })
          .expect(200);

        const results = response.body as Array<{
          score: number;
          content: string;
        }>;

        expect(Array.isArray(results)).toBe(true);
        if (results.length > 0) {
          expect(results[0]).toHaveProperty('score');
          expect(results[0]).toHaveProperty('content');
        }

        console.log(`✅ Search returned ${results.length} results`);
      },
      120000,
    );
  });

  // ============================================================
  // FILE OPERATIONS (6 tests)
  // ============================================================

  describe('POST /api/vector-stores/:vectorStoreId/files', () => {
    testIf(hasApiKey)(
      'should add file to vector store',
      async () => {
        if (
          createdVectorStoreIds.length === 0 ||
          uploadedFileIds.length === 0
        ) {
          console.log('⏭️  Skipping: No resources available');
          return;
        }

        const vectorStoreId = createdVectorStoreIds[0];
        const fileId = uploadedFileIds[1];

        const response = await request(app.getHttpServer() as Server)
          .post(`/api/vector-stores/${vectorStoreId}/files`)
          .send({ file_id: fileId })
          .expect(201);

        const vectorStoreFile = response.body as VectorStores.VectorStoreFile;

        expect(vectorStoreFile).toHaveProperty('id', fileId);
        expect(vectorStoreFile).toHaveProperty(
          'vector_store_id',
          vectorStoreId,
        );
        expect(vectorStoreFile).toHaveProperty('status');

        console.log(
          `✅ Added file ${fileId} to vector store ${vectorStoreId} (status: ${vectorStoreFile.status})`,
        );
      },
      60000,
    );

    testIf(hasApiKey)(
      'should add file with static chunking strategy',
      async () => {
        if (createdVectorStoreIds.length === 0 || uploadedFileIds.length < 2) {
          console.log('⏭️  Skipping: No resources available');
          return;
        }

        const vectorStoreId = createdVectorStoreIds[0];
        const fileId = uploadedFileIds[2];

        const response = await request(app.getHttpServer() as Server)
          .post(`/api/vector-stores/${vectorStoreId}/files`)
          .send({
            file_id: fileId,
            chunking_strategy: {
              type: 'static',
              static: {
                max_chunk_size_tokens: 800,
                chunk_overlap_tokens: 400,
              },
            },
          })
          .expect(201);

        const vectorStoreFile = response.body as VectorStores.VectorStoreFile;

        expect(vectorStoreFile).toHaveProperty('id', fileId);
        expect(vectorStoreFile.chunking_strategy).toHaveProperty(
          'type',
          'static',
        );

        console.log(
          `✅ Added file with static chunking: ${fileId} to ${vectorStoreId}`,
        );
      },
      60000,
    );
  });

  describe('GET /api/vector-stores/:vectorStoreId/files', () => {
    testIf(hasApiKey)(
      'should list files in vector store',
      async () => {
        if (createdVectorStoreIds.length === 0) {
          console.log('⏭️  Skipping: No vector stores created yet');
          return;
        }

        const vectorStoreId = createdVectorStoreIds[0];
        const response = await request(app.getHttpServer() as Server)
          .get(`/api/vector-stores/${vectorStoreId}/files`)
          .expect(200);

        const files = response.body as VectorStores.VectorStoreFile[];

        expect(Array.isArray(files)).toBe(true);
        if (files.length > 0) {
          expect(files[0]).toHaveProperty('id');
          expect(files[0]).toHaveProperty('vector_store_id');
          expect(files[0]).toHaveProperty('status');
        }

        console.log(
          `✅ Listed ${files.length} files in vector store ${vectorStoreId}`,
        );
      },
      60000,
    );

    testIf(hasApiKey)(
      'should list files with filter and pagination',
      async () => {
        if (createdVectorStoreIds.length === 0) {
          console.log('⏭️  Skipping: No vector stores created yet');
          return;
        }

        const vectorStoreId = createdVectorStoreIds[0];
        const response = await request(app.getHttpServer() as Server)
          .get(
            `/api/vector-stores/${vectorStoreId}/files?filter=completed&limit=10`,
          )
          .expect(200);

        const files = response.body as VectorStores.VectorStoreFile[];

        expect(Array.isArray(files)).toBe(true);
        files.forEach((file: VectorStores.VectorStoreFile) => {
          expect(file.status).toBe('completed');
        });

        console.log(`✅ Listed ${files.length} completed files`);
      },
      60000,
    );
  });

  describe('GET /api/vector-stores/:vectorStoreId/files/:fileId', () => {
    testIf(hasApiKey)(
      'should retrieve file from vector store',
      async () => {
        if (
          createdVectorStoreIds.length === 0 ||
          uploadedFileIds.length === 0
        ) {
          console.log('⏭️  Skipping: No resources available');
          return;
        }

        const vectorStoreId = createdVectorStoreIds[0];
        const fileId = uploadedFileIds[1];

        const response = await request(app.getHttpServer() as Server)
          .get(`/api/vector-stores/${vectorStoreId}/files/${fileId}`)
          .expect(200);

        const vectorStoreFile = response.body as VectorStores.VectorStoreFile;

        expect(vectorStoreFile.id).toBe(fileId);
        expect(vectorStoreFile.vector_store_id).toBe(vectorStoreId);

        console.log(`✅ Retrieved file ${fileId} from ${vectorStoreId}`);
      },
      60000,
    );
  });

  describe('DELETE /api/vector-stores/:vectorStoreId/files/:fileId', () => {
    testIf(hasApiKey)(
      'should remove file from vector store',
      async () => {
        if (
          createdVectorStoreIds.length === 0 ||
          uploadedFileIds.length === 0
        ) {
          console.log('⏭️  Skipping: No resources available');
          return;
        }

        const vectorStoreId = createdVectorStoreIds[0];
        const fileId = uploadedFileIds[1];

        const response = await request(app.getHttpServer() as Server)
          .delete(`/api/vector-stores/${vectorStoreId}/files/${fileId}`)
          .expect(200);

        const deleted = response.body as VectorStores.VectorStoreFileDeleted;

        expect(deleted).toHaveProperty('id', fileId);
        expect(deleted).toHaveProperty('deleted', true);
        expect(deleted).toHaveProperty('object', 'vector_store.file.deleted');

        console.log(
          `✅ Removed file ${fileId} from vector store ${vectorStoreId}`,
        );
      },
      60000,
    );
  });

  // ============================================================
  // BATCH OPERATIONS (4 tests)
  // ============================================================

  describe('POST /api/vector-stores/:vectorStoreId/file-batches', () => {
    testIf(hasApiKey)(
      'should create file batch with file_ids',
      async () => {
        // Create a new vector store for batch operations
        const createResponse = await request(app.getHttpServer() as Server)
          .post('/api/vector-stores')
          .send({ name: 'Batch Test Vector Store' })
          .expect(201);

        const created = createResponse.body as VectorStores.VectorStore;
        const vectorStoreId = created.id;
        createdVectorStoreIds.push(vectorStoreId);

        if (uploadedFileIds.length < 2) {
          console.log('⏭️  Skipping: Need at least 2 uploaded files');
          return;
        }

        const response = await request(app.getHttpServer() as Server)
          .post(`/api/vector-stores/${vectorStoreId}/file-batches`)
          .send({
            file_ids: [uploadedFileIds[0], uploadedFileIds[1]],
          })
          .expect(201);

        const fileBatch = response.body as VectorStores.VectorStoreFileBatch;

        expect(fileBatch).toHaveProperty('id');
        expect(fileBatch.id).toMatch(/^vsfb_/);
        expect(fileBatch).toHaveProperty('vector_store_id', vectorStoreId);
        expect(fileBatch).toHaveProperty('status');
        expect(fileBatch).toHaveProperty('file_counts');

        console.log(
          `✅ Created file batch: ${fileBatch.id} (status: ${fileBatch.status})`,
        );
      },
      60000,
    );
  });

  // ============================================================
  // POLLING OPERATIONS (2 tests)
  // ============================================================

  describe('POST /api/vector-stores/:vectorStoreId/poll', () => {
    testIf(hasApiKey)(
      'should poll vector store until complete',
      async () => {
        if (createdVectorStoreIds.length === 0) {
          console.log('⏭️  Skipping: No vector stores created yet');
          return;
        }

        const vectorStoreId = createdVectorStoreIds[0];
        const response = await request(app.getHttpServer() as Server)
          .post(`/api/vector-stores/${vectorStoreId}/poll`)
          .query({ max_wait_ms: 30000 })
          .expect(200);

        const vectorStore = response.body as VectorStores.VectorStore;

        expect(vectorStore).toHaveProperty('id', vectorStoreId);
        expect(vectorStore).toHaveProperty('status');
        expect(['completed', 'expired'].includes(vectorStore.status)).toBe(
          true,
        );

        console.log(
          `✅ Polled vector store ${vectorStoreId}: ${vectorStore.status}`,
        );
      },
      60000,
    );
  });

  describe('POST /api/vector-stores/:vectorStoreId/files/:fileId/poll', () => {
    testIf(hasApiKey)(
      'should poll file until complete',
      async () => {
        if (
          createdVectorStoreIds.length === 0 ||
          uploadedFileIds.length === 0
        ) {
          console.log('⏭️  Skipping: No resources available');
          return;
        }

        const vectorStoreId = createdVectorStoreIds[0];
        const fileId = uploadedFileIds[2];

        const response = await request(app.getHttpServer() as Server)
          .post(`/api/vector-stores/${vectorStoreId}/files/${fileId}/poll`)
          .query({ max_wait_ms: 30000 })
          .expect(200);

        const vectorStoreFile = response.body as VectorStores.VectorStoreFile;

        expect(vectorStoreFile).toHaveProperty('id', fileId);
        expect(vectorStoreFile).toHaveProperty('status');
        expect(
          ['completed', 'failed', 'cancelled'].includes(vectorStoreFile.status),
        ).toBe(true);

        console.log(`✅ Polled file ${fileId}: ${vectorStoreFile.status}`);
      },
      60000,
    );
  });
});
