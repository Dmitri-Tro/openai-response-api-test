import { Injectable, Inject } from '@nestjs/common';
import OpenAI from 'openai';
import { OPENAI_CLIENT } from '../providers/openai-client.provider';
import type { VectorStores } from 'openai/resources/vector-stores';
import { LoggerService } from '../../common/services/logger.service';
import { CreateVectorStoreDto } from '../dto/vector-stores/create-vector-store.dto';
import { UpdateVectorStoreDto } from '../dto/vector-stores/update-vector-store.dto';
import { ListVectorStoresDto } from '../dto/vector-stores/list-vector-stores.dto';
import { SearchVectorStoreDto } from '../dto/vector-stores/search-vector-store.dto';
import { AddFileDto } from '../dto/vector-stores/add-file.dto';
import { AddFileBatchDto } from '../dto/vector-stores/add-file-batch.dto';
import { ListVectorStoreFilesDto } from '../dto/vector-stores/list-vector-store-files.dto';
import { validateChunkingParametersOrThrow } from '../validators/chunking-strategy.validator';

/**
 * Service for interacting with OpenAI Vector Stores API
 *
 * Provides semantic search capabilities over uploaded files via embeddings.
 * Essential for RAG (Retrieval-Augmented Generation) workflows.
 *
 * **Core Operations:**
 * - Vector Store Management: create, retrieve, update, list, delete, search
 * - File Operations: add, list, get, update, remove, getContent
 * - Batch Operations: createBatch, getBatch, cancelBatch, listBatchFiles
 * - Polling: pollUntilComplete, pollFileUntilComplete, pollBatchUntilComplete
 *
 * **Polling Pattern:**
 * - Exponential backoff: 5s → 10s → 15s → 20s (max)
 * - Default timeout: 10 minutes
 * - Pattern from Videos API
 *
 * **Integration Points:**
 * - Phase 4 (Files API): Upload files before adding to vector store
 * - Phase 2.14 (file_search tool): Use vector_store_ids in Responses API
 * - ToolCallingEventsHandler: Handles file_search events (3 handlers)
 *
 * @see {@link https://platform.openai.com/docs/api-reference/vector-stores}
 * @see {@link https://platform.openai.com/docs/guides/file-search}
 */
@Injectable()
export class OpenAIVectorStoresService {
  constructor(
    @Inject(OPENAI_CLIENT) private readonly client: OpenAI,
    private readonly loggerService: LoggerService,
  ) {}

  // ============================================================
  // VECTOR STORE MANAGEMENT (6 methods)
  // ============================================================

  /**
   * Create a new vector store for semantic search over files
   *
   * **Chunking Strategies**:
   * - `auto`: OpenAI determines optimal chunk size
   * - `static`: Manual control (max_chunk_size_tokens: 100-4096, chunk_overlap_tokens: ≤ max/2)
   *
   * **Expiration**: Files auto-delete after inactivity (anchor: 'last_active_at', days: 1-365)
   *
   * @param dto - Vector store creation parameters
   * @returns Created vector store with status: 'in_progress' | 'completed'
   *
   * @example
   * ```typescript
   * // Basic vector store
   * const vectorStore = await service.createVectorStore({
   *   name: 'Product Documentation',
   *   file_ids: ['file-abc123', 'file-xyz789']
   * });
   *
   * // With custom chunking
   * const vectorStore = await service.createVectorStore({
   *   name: 'Technical Docs',
   *   file_ids: ['file-abc123'],
   *   chunking_strategy: {
   *     type: 'static',
   *     static: {
   *       max_chunk_size_tokens: 800,
   *       chunk_overlap_tokens: 400
   *     }
   *   },
   *   expires_after: { anchor: 'last_active_at', days: 30 }
   * });
   * ```
   */
  async createVectorStore(
    dto: CreateVectorStoreDto,
  ): Promise<VectorStores.VectorStore> {
    const startTime = Date.now();

    const params: VectorStores.VectorStoreCreateParams = {
      ...(dto.name && { name: dto.name }),
      ...(dto.file_ids && { file_ids: dto.file_ids }),
      ...(dto.chunking_strategy && {
        chunking_strategy: dto.chunking_strategy,
      }),
      ...(dto.expires_after && { expires_after: dto.expires_after }),
      ...(dto.metadata && { metadata: dto.metadata }),
      ...(dto.description && { description: dto.description }),
    };

    const vectorStore: VectorStores.VectorStore =
      await this.client.vectorStores.create(params);

    this.loggerService.logOpenAIInteraction({
      timestamp: new Date().toISOString(),
      api: 'vector_stores',
      endpoint: '/v1/vector_stores',
      request: params,
      response: vectorStore,
      metadata: {
        latency_ms: Date.now() - startTime,
        vector_store_id: vectorStore.id,
        status: vectorStore.status,
        file_counts: vectorStore.file_counts,
      },
    });

    return vectorStore;
  }

  /**
   * Retrieve a vector store by ID
   *
   * @param vectorStoreId - Vector store ID (starts with "vs_")
   * @returns Vector store details
   */
  async retrieveVectorStore(
    vectorStoreId: string,
  ): Promise<VectorStores.VectorStore> {
    const startTime = Date.now();

    const vectorStore: VectorStores.VectorStore =
      await this.client.vectorStores.retrieve(vectorStoreId);

    this.loggerService.logOpenAIInteraction({
      timestamp: new Date().toISOString(),
      api: 'vector_stores',
      endpoint: `/v1/vector_stores/${vectorStoreId}`,
      request: {},
      response: vectorStore,
      metadata: {
        latency_ms: Date.now() - startTime,
        vector_store_id: vectorStore.id,
        status: vectorStore.status,
        file_counts: vectorStore.file_counts,
      },
    });

    return vectorStore;
  }

  /**
   * Update a vector store
   *
   * @param vectorStoreId - Vector store ID
   * @param dto - Update parameters
   * @returns Updated vector store
   */
  async updateVectorStore(
    vectorStoreId: string,
    dto: UpdateVectorStoreDto,
  ): Promise<VectorStores.VectorStore> {
    const startTime = Date.now();

    const params: VectorStores.VectorStoreUpdateParams = {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.expires_after !== undefined && {
        expires_after: dto.expires_after,
      }),
      ...(dto.metadata !== undefined && { metadata: dto.metadata }),
    };

    const vectorStore: VectorStores.VectorStore =
      await this.client.vectorStores.update(vectorStoreId, params);

    this.loggerService.logOpenAIInteraction({
      timestamp: new Date().toISOString(),
      api: 'vector_stores',
      endpoint: `/v1/vector_stores/${vectorStoreId}`,
      request: params,
      response: vectorStore,
      metadata: {
        latency_ms: Date.now() - startTime,
        vector_store_id: vectorStore.id,
        status: vectorStore.status,
      },
    });

    return vectorStore;
  }

  /**
   * List vector stores with pagination
   *
   * @param dto - Pagination and filtering parameters
   * @returns Array of vector stores
   */
  async listVectorStores(
    dto?: ListVectorStoresDto,
  ): Promise<VectorStores.VectorStore[]> {
    const startTime = Date.now();

    const params: VectorStores.VectorStoreListParams = {
      ...(dto?.limit && { limit: dto.limit }),
      ...(dto?.order && { order: dto.order }),
      ...(dto?.after && { after: dto.after }),
      ...(dto?.before && { before: dto.before }),
    };

    const page = await this.client.vectorStores.list(params);

    this.loggerService.logOpenAIInteraction({
      timestamp: new Date().toISOString(),
      api: 'vector_stores',
      endpoint: '/v1/vector_stores',
      request: params,
      response: page.data,
      metadata: {
        latency_ms: Date.now() - startTime,
        result_count: page.data.length,
      },
    });

    return page.data;
  }

  /**
   * Delete a vector store
   *
   * @param vectorStoreId - Vector store ID
   * @returns Deletion confirmation
   */
  async deleteVectorStore(
    vectorStoreId: string,
  ): Promise<VectorStores.VectorStoreDeleted> {
    const startTime = Date.now();

    const result: VectorStores.VectorStoreDeleted =
      await this.client.vectorStores.delete(vectorStoreId);

    this.loggerService.logOpenAIInteraction({
      timestamp: new Date().toISOString(),
      api: 'vector_stores',
      endpoint: `/v1/vector_stores/${vectorStoreId}`,
      request: {},
      response: result,
      metadata: {
        latency_ms: Date.now() - startTime,
        vector_store_id: vectorStoreId,
        deleted: result.deleted,
      },
    });

    return result;
  }

  /**
   * Search a vector store using semantic similarity
   *
   * **Search Parameters**:
   * - `query`: Search text (single string or array for batch queries)
   * - `max_num_results`: 1-50 results (default: 20)
   * - `ranking_options`: Ranker type and score threshold (0-1)
   * - `filters`: Filter by file_id array
   *
   * @param vectorStoreId - Vector store ID
   * @param dto - Search parameters
   * @returns Array of search results with scores and content
   *
   * @example
   * ```typescript
   * // Basic search
   * const results = await service.searchVectorStore('vs_abc123', {
   *   query: 'What is the return policy?',
   *   max_num_results: 5
   * });
   *
   * // Advanced search with filters
   * const results = await service.searchVectorStore('vs_abc123', {
   *   query: 'API authentication methods',
   *   max_num_results: 10,
   *   ranking_options: {
   *     ranker: 'default-2024-11-15',
   *     score_threshold: 0.7
   *   },
   *   filters: {
   *     file_ids: ['file-doc1', 'file-doc2']
   *   }
   * });
   * ```
   */
  async searchVectorStore(
    vectorStoreId: string,
    dto: SearchVectorStoreDto,
  ): Promise<VectorStores.VectorStoreSearchResponse[]> {
    const startTime = Date.now();

    const params: VectorStores.VectorStoreSearchParams = {
      query: dto.query,
      ...(dto.max_num_results && { max_num_results: dto.max_num_results }),
      ...(dto.filters && { filters: dto.filters }),
      ...(dto.ranking_options && { ranking_options: dto.ranking_options }),
      ...(dto.rewrite_query !== undefined && {
        rewrite_query: dto.rewrite_query,
      }),
    };

    const page = await this.client.vectorStores.search(vectorStoreId, params);

    this.loggerService.logOpenAIInteraction({
      timestamp: new Date().toISOString(),
      api: 'vector_stores',
      endpoint: `/v1/vector_stores/${vectorStoreId}/search`,
      request: params,
      response: page.data,
      metadata: {
        latency_ms: Date.now() - startTime,
        vector_store_id: vectorStoreId,
        result_count: page.data.length,
        query:
          typeof dto.query === 'string'
            ? dto.query
            : `[${dto.query.length} queries]`,
      },
    });

    return page.data;
  }

  // ============================================================
  // FILE OPERATIONS (6 methods)
  // ============================================================

  /**
   * Add a file to a vector store
   *
   * @param vectorStoreId - Vector store ID
   * @param dto - File addition parameters
   * @returns Vector store file with status: 'in_progress'
   */
  async addFile(
    vectorStoreId: string,
    dto: AddFileDto,
  ): Promise<VectorStores.VectorStoreFile> {
    const startTime = Date.now();

    const params: VectorStores.FileCreateParams = {
      file_id: dto.file_id,
      ...(dto.attributes && { attributes: dto.attributes }),
      ...(dto.chunking_strategy && {
        chunking_strategy: dto.chunking_strategy,
      }),
    };

    const file: VectorStores.VectorStoreFile =
      await this.client.vectorStores.files.create(vectorStoreId, params);

    this.loggerService.logOpenAIInteraction({
      timestamp: new Date().toISOString(),
      api: 'vector_stores',
      endpoint: `/v1/vector_stores/${vectorStoreId}/files`,
      request: params,
      response: file,
      metadata: {
        latency_ms: Date.now() - startTime,
        vector_store_id: vectorStoreId,
        file_id: file.id,
        status: file.status,
      },
    });

    return file;
  }

  /**
   * List files in a vector store
   *
   * @param vectorStoreId - Vector store ID
   * @param dto - Pagination and filtering parameters
   * @returns Array of vector store files
   */
  async listFiles(
    vectorStoreId: string,
    dto?: ListVectorStoreFilesDto,
  ): Promise<VectorStores.VectorStoreFile[]> {
    const startTime = Date.now();

    const params: VectorStores.FileListParams = {
      ...(dto?.limit && { limit: dto.limit }),
      ...(dto?.order && { order: dto.order }),
      ...(dto?.after && { after: dto.after }),
      ...(dto?.before && { before: dto.before }),
      ...(dto?.filter && { filter: dto.filter }),
    };

    const page = await this.client.vectorStores.files.list(
      vectorStoreId,
      params,
    );

    this.loggerService.logOpenAIInteraction({
      timestamp: new Date().toISOString(),
      api: 'vector_stores',
      endpoint: `/v1/vector_stores/${vectorStoreId}/files`,
      request: params,
      response: page.data,
      metadata: {
        latency_ms: Date.now() - startTime,
        vector_store_id: vectorStoreId,
        result_count: page.data.length,
      },
    });

    return page.data;
  }

  /**
   * Get a file from a vector store
   *
   * @param vectorStoreId - Vector store ID
   * @param fileId - File ID
   * @returns Vector store file details
   */
  async getFile(
    vectorStoreId: string,
    fileId: string,
  ): Promise<VectorStores.VectorStoreFile> {
    const startTime = Date.now();

    const file: VectorStores.VectorStoreFile =
      await this.client.vectorStores.files.retrieve(fileId, {
        vector_store_id: vectorStoreId,
      });

    this.loggerService.logOpenAIInteraction({
      timestamp: new Date().toISOString(),
      api: 'vector_stores',
      endpoint: `/v1/vector_stores/${vectorStoreId}/files/${fileId}`,
      request: {},
      response: file,
      metadata: {
        latency_ms: Date.now() - startTime,
        vector_store_id: vectorStoreId,
        file_id: file.id,
        status: file.status,
      },
    });

    return file;
  }

  /**
   * Update file attributes in a vector store
   *
   * @param vectorStoreId - Vector store ID
   * @param fileId - File ID
   * @param attributes - Updated attributes
   * @returns Updated vector store file
   */
  async updateFile(
    vectorStoreId: string,
    fileId: string,
    attributes: Record<string, string | number | boolean> | null,
  ): Promise<VectorStores.VectorStoreFile> {
    const startTime = Date.now();

    const file: VectorStores.VectorStoreFile =
      await this.client.vectorStores.files.update(fileId, {
        vector_store_id: vectorStoreId,
        attributes,
      });

    this.loggerService.logOpenAIInteraction({
      timestamp: new Date().toISOString(),
      api: 'vector_stores',
      endpoint: `/v1/vector_stores/${vectorStoreId}/files/${fileId}`,
      request: { attributes },
      response: file,
      metadata: {
        latency_ms: Date.now() - startTime,
        vector_store_id: vectorStoreId,
        file_id: fileId,
      },
    });

    return file;
  }

  /**
   * Remove a file from a vector store
   *
   * @param vectorStoreId - Vector store ID
   * @param fileId - File ID
   * @returns Deletion confirmation
   */
  async removeFile(
    vectorStoreId: string,
    fileId: string,
  ): Promise<VectorStores.VectorStoreFileDeleted> {
    const startTime = Date.now();

    const result: VectorStores.VectorStoreFileDeleted =
      await this.client.vectorStores.files.delete(fileId, {
        vector_store_id: vectorStoreId,
      });

    this.loggerService.logOpenAIInteraction({
      timestamp: new Date().toISOString(),
      api: 'vector_stores',
      endpoint: `/v1/vector_stores/${vectorStoreId}/files/${fileId}`,
      request: {},
      response: result,
      metadata: {
        latency_ms: Date.now() - startTime,
        vector_store_id: vectorStoreId,
        file_id: fileId,
        deleted: result.deleted,
      },
    });

    return result;
  }

  /**
   * Get file content from a vector store
   *
   * @param vectorStoreId - Vector store ID
   * @param fileId - File ID
   * @returns File content chunks
   */
  async getFileContent(
    vectorStoreId: string,
    fileId: string,
  ): Promise<VectorStores.FileContentResponse[]> {
    const startTime = Date.now();

    const page = await this.client.vectorStores.files.content(fileId, {
      vector_store_id: vectorStoreId,
    });

    this.loggerService.logOpenAIInteraction({
      timestamp: new Date().toISOString(),
      api: 'vector_stores',
      endpoint: `/v1/vector_stores/${vectorStoreId}/files/${fileId}/content`,
      request: {},
      response: page.data,
      metadata: {
        latency_ms: Date.now() - startTime,
        vector_store_id: vectorStoreId,
        file_id: fileId,
        result_count: page.data.length,
      },
    });

    return page.data;
  }

  // ============================================================
  // BATCH OPERATIONS (4 methods)
  // ============================================================

  /**
   * Create a file batch operation
   *
   * @param vectorStoreId - Vector store ID
   * @param dto - Batch creation parameters
   * @returns File batch with status: 'in_progress'
   */
  async createFileBatch(
    vectorStoreId: string,
    dto: AddFileBatchDto,
  ): Promise<VectorStores.VectorStoreFileBatch> {
    const startTime = Date.now();

    const params: VectorStores.FileBatchCreateParams = {
      ...(dto.file_ids && { file_ids: dto.file_ids }),
      ...(dto.files && {
        files: dto.files as VectorStores.FileBatchCreateParams['files'],
      }),
      ...(dto.attributes && { attributes: dto.attributes }),
      ...(dto.chunking_strategy && {
        chunking_strategy: dto.chunking_strategy,
      }),
    };

    const batch: VectorStores.VectorStoreFileBatch =
      await this.client.vectorStores.fileBatches.create(vectorStoreId, params);

    this.loggerService.logOpenAIInteraction({
      timestamp: new Date().toISOString(),
      api: 'vector_stores',
      endpoint: `/v1/vector_stores/${vectorStoreId}/file_batches`,
      request: params,
      response: batch,
      metadata: {
        latency_ms: Date.now() - startTime,
        vector_store_id: vectorStoreId,
        batch_id: batch.id,
        status: batch.status,
        file_counts: batch.file_counts,
      },
    });

    return batch;
  }

  /**
   * Get a file batch
   *
   * @param vectorStoreId - Vector store ID
   * @param batchId - Batch ID
   * @returns File batch details
   */
  async getFileBatch(
    vectorStoreId: string,
    batchId: string,
  ): Promise<VectorStores.VectorStoreFileBatch> {
    const startTime = Date.now();

    const batch: VectorStores.VectorStoreFileBatch =
      await this.client.vectorStores.fileBatches.retrieve(batchId, {
        vector_store_id: vectorStoreId,
      });

    this.loggerService.logOpenAIInteraction({
      timestamp: new Date().toISOString(),
      api: 'vector_stores',
      endpoint: `/v1/vector_stores/${vectorStoreId}/file_batches/${batchId}`,
      request: {},
      response: batch,
      metadata: {
        latency_ms: Date.now() - startTime,
        vector_store_id: vectorStoreId,
        batch_id: batch.id,
        status: batch.status,
        file_counts: batch.file_counts,
      },
    });

    return batch;
  }

  /**
   * Cancel a file batch operation
   *
   * @param vectorStoreId - Vector store ID
   * @param batchId - Batch ID
   * @returns Cancelled batch
   */
  async cancelFileBatch(
    vectorStoreId: string,
    batchId: string,
  ): Promise<VectorStores.VectorStoreFileBatch> {
    const startTime = Date.now();

    const batch: VectorStores.VectorStoreFileBatch =
      await this.client.vectorStores.fileBatches.cancel(batchId, {
        vector_store_id: vectorStoreId,
      });

    this.loggerService.logOpenAIInteraction({
      timestamp: new Date().toISOString(),
      api: 'vector_stores',
      endpoint: `/v1/vector_stores/${vectorStoreId}/file_batches/${batchId}/cancel`,
      request: {},
      response: batch,
      metadata: {
        latency_ms: Date.now() - startTime,
        vector_store_id: vectorStoreId,
        batch_id: batchId,
        status: batch.status,
      },
    });

    return batch;
  }

  /**
   * List files in a batch
   *
   * @param vectorStoreId - Vector store ID
   * @param batchId - Batch ID
   * @param dto - Pagination parameters
   * @returns Array of files in batch
   */
  async listBatchFiles(
    vectorStoreId: string,
    batchId: string,
    dto?: ListVectorStoreFilesDto,
  ): Promise<VectorStores.VectorStoreFile[]> {
    const startTime = Date.now();

    const params: VectorStores.FileBatchListFilesParams = {
      vector_store_id: vectorStoreId,
      ...(dto?.limit && { limit: dto.limit }),
      ...(dto?.order && { order: dto.order }),
      ...(dto?.after && { after: dto.after }),
      ...(dto?.before && { before: dto.before }),
      ...(dto?.filter && { filter: dto.filter }),
    };

    const page = await this.client.vectorStores.fileBatches.listFiles(
      batchId,
      params,
    );

    this.loggerService.logOpenAIInteraction({
      timestamp: new Date().toISOString(),
      api: 'vector_stores',
      endpoint: `/v1/vector_stores/${vectorStoreId}/file_batches/${batchId}/files`,
      request: params,
      response: page.data,
      metadata: {
        latency_ms: Date.now() - startTime,
        vector_store_id: vectorStoreId,
        batch_id: batchId,
        result_count: page.data.length,
      },
    });

    return page.data;
  }

  // ============================================================
  // POLLING METHODS (3 methods)
  // ============================================================

  /**
   * Poll until vector store indexing completes
   * Uses exponential backoff: 5s → 10s → 15s → 20s (max)
   *
   * @param vectorStoreId - Vector store ID
   * @param maxWaitMs - Maximum wait time (default: 10 minutes)
   * @returns Completed vector store (status: 'completed' or 'expired')
   * @throws Error if timeout exceeded
   */
  async pollUntilComplete(
    vectorStoreId: string,
    maxWaitMs: number = 600000,
  ): Promise<VectorStores.VectorStore> {
    const startTime = Date.now();
    let waitTime = 5000; // Start with 5 seconds

    while (Date.now() - startTime < maxWaitMs) {
      const vectorStore: VectorStores.VectorStore =
        await this.retrieveVectorStore(vectorStoreId);

      if (
        vectorStore.status === 'completed' ||
        vectorStore.status === 'expired'
      ) {
        this.loggerService.logOpenAIInteraction({
          timestamp: new Date().toISOString(),
          api: 'vector_stores',
          endpoint: `/v1/vector_stores/${vectorStoreId}/poll`,
          request: { max_wait_ms: maxWaitMs },
          response: vectorStore,
          metadata: {
            latency_ms: Date.now() - startTime,
            vector_store_id: vectorStore.id,
            status: vectorStore.status,
            file_counts: vectorStore.file_counts,
          },
        });

        return vectorStore;
      }

      await this.sleep(waitTime);
      waitTime = Math.min(waitTime + 5000, 20000); // Increase by 5s, max 20s
    }

    throw new Error(
      `Vector store ${vectorStoreId} did not complete within ${maxWaitMs}ms`,
    );
  }

  /**
   * Poll until file indexing completes
   * Uses exponential backoff: 5s → 10s → 15s → 20s (max)
   *
   * @param vectorStoreId - Vector store ID
   * @param fileId - File ID
   * @param maxWaitMs - Maximum wait time (default: 10 minutes)
   * @returns Completed file (status: 'completed', 'failed', or 'cancelled')
   * @throws Error if timeout exceeded
   */
  async pollFileUntilComplete(
    vectorStoreId: string,
    fileId: string,
    maxWaitMs: number = 600000,
  ): Promise<VectorStores.VectorStoreFile> {
    const startTime = Date.now();
    let waitTime = 5000;

    while (Date.now() - startTime < maxWaitMs) {
      const file: VectorStores.VectorStoreFile = await this.getFile(
        vectorStoreId,
        fileId,
      );

      if (
        file.status === 'completed' ||
        file.status === 'failed' ||
        file.status === 'cancelled'
      ) {
        this.loggerService.logOpenAIInteraction({
          timestamp: new Date().toISOString(),
          api: 'vector_stores',
          endpoint: `/v1/vector_stores/${vectorStoreId}/files/${fileId}/poll`,
          request: { max_wait_ms: maxWaitMs },
          response: file,
          metadata: {
            latency_ms: Date.now() - startTime,
            vector_store_id: vectorStoreId,
            file_id: file.id,
            status: file.status,
          },
        });

        return file;
      }

      await this.sleep(waitTime);
      waitTime = Math.min(waitTime + 5000, 20000);
    }

    throw new Error(
      `File ${fileId} in vector store ${vectorStoreId} did not complete within ${maxWaitMs}ms`,
    );
  }

  /**
   * Poll until batch processing completes
   * Uses exponential backoff: 5s → 10s → 15s → 20s (max)
   *
   * @param vectorStoreId - Vector store ID
   * @param batchId - Batch ID
   * @param maxWaitMs - Maximum wait time (default: 10 minutes)
   * @returns Completed batch (status: 'completed' or 'cancelled')
   * @throws Error if timeout exceeded
   */
  async pollBatchUntilComplete(
    vectorStoreId: string,
    batchId: string,
    maxWaitMs: number = 600000,
  ): Promise<VectorStores.VectorStoreFileBatch> {
    const startTime = Date.now();
    let waitTime = 5000;

    while (Date.now() - startTime < maxWaitMs) {
      const batch: VectorStores.VectorStoreFileBatch = await this.getFileBatch(
        vectorStoreId,
        batchId,
      );

      if (batch.status === 'completed' || batch.status === 'cancelled') {
        this.loggerService.logOpenAIInteraction({
          timestamp: new Date().toISOString(),
          api: 'vector_stores',
          endpoint: `/v1/vector_stores/${vectorStoreId}/file_batches/${batchId}/poll`,
          request: { max_wait_ms: maxWaitMs },
          response: batch,
          metadata: {
            latency_ms: Date.now() - startTime,
            vector_store_id: vectorStoreId,
            batch_id: batch.id,
            status: batch.status,
            file_counts: batch.file_counts,
          },
        });

        return batch;
      }

      await this.sleep(waitTime);
      waitTime = Math.min(waitTime + 5000, 20000);
    }

    throw new Error(
      `Batch ${batchId} in vector store ${vectorStoreId} did not complete within ${maxWaitMs}ms`,
    );
  }

  // ============================================================
  // HELPER METHODS (2 methods)
  // ============================================================

  /**
   * Extract vector store metadata for logging
   *
   * @param vectorStore - Vector store object
   * @returns Restructured metadata
   */
  extractVectorStoreMetadata(
    vectorStore: VectorStores.VectorStore,
  ): Record<string, unknown> {
    return {
      id: vectorStore.id,
      name: vectorStore.name,
      status: vectorStore.status,
      file_counts: vectorStore.file_counts,
      usage_bytes: vectorStore.usage_bytes,
      created_at: vectorStore.created_at,
      last_active_at: vectorStore.last_active_at,
      expires_at: vectorStore.expires_at,
    };
  }

  /**
   * Validate chunking strategy parameters
   *
   * Delegates to the validator function for consistency.
   * Kept as public method for backward compatibility.
   *
   * @param strategy - Chunking strategy to validate
   * @returns true if valid
   * @throws Error if invalid
   */
  validateChunkingParameters(
    strategy: VectorStores.FileChunkingStrategyParam,
  ): boolean {
    return validateChunkingParametersOrThrow(
      strategy as unknown as Record<string, unknown>,
    );
  }

  /**
   * Sleep helper for polling
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
