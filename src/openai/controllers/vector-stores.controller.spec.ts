import { Test, TestingModule } from '@nestjs/testing';
import { VectorStoresController } from './vector-stores.controller';
import { OpenAIVectorStoresService } from '../services/openai-vector-stores.service';
import { LoggerService } from '../../common/services/logger.service';
import { PricingService } from '../../common/services/pricing.service';
import type { VectorStores } from 'openai/resources/vector-stores';

describe('VectorStoresController', () => {
  let controller: VectorStoresController;
  let createVectorStoreSpy: jest.Mock;
  let retrieveVectorStoreSpy: jest.Mock;
  let updateVectorStoreSpy: jest.Mock;
  let listVectorStoresSpy: jest.Mock;
  let deleteVectorStoreSpy: jest.Mock;
  let searchVectorStoreSpy: jest.Mock;
  let addFileSpy: jest.Mock;
  let listFilesSpy: jest.Mock;
  let getFileSpy: jest.Mock;
  let updateFileSpy: jest.Mock;
  let removeFileSpy: jest.Mock;
  let getFileContentSpy: jest.Mock;
  let createFileBatchSpy: jest.Mock;
  let getFileBatchSpy: jest.Mock;
  let cancelFileBatchSpy: jest.Mock;
  let listBatchFilesSpy: jest.Mock;
  let pollUntilCompleteSpy: jest.Mock;
  let pollFileUntilCompleteSpy: jest.Mock;
  let pollBatchUntilCompleteSpy: jest.Mock;

  const mockFileCounts = {
    in_progress: 0,
    completed: 2,
    failed: 0,
    cancelled: 0,
    total: 2,
  };

  const mockVectorStore: VectorStores.VectorStore = {
    id: 'vs_abc123',
    object: 'vector_store',
    created_at: 1234567890,
    name: 'Test Vector Store',
    usage_bytes: 1024,
    file_counts: mockFileCounts,
    status: 'completed',
    expires_after: undefined,
    expires_at: null,
    last_active_at: 1234567990,
    metadata: {},
  };

  const mockVectorStoreFile: VectorStores.VectorStoreFile = {
    id: 'file-abc123',
    object: 'vector_store.file',
    usage_bytes: 512,
    created_at: 1234567890,
    vector_store_id: 'vs_abc123',
    status: 'completed',
    last_error: null,
    chunking_strategy: {
      type: 'static',
      static: {
        max_chunk_size_tokens: 800,
        chunk_overlap_tokens: 400,
      },
    },
  };

  const mockVectorStoreFileBatch: VectorStores.VectorStoreFileBatch = {
    id: 'vsfb_abc123',
    object: 'vector_store.files_batch',
    created_at: 1234567890,
    vector_store_id: 'vs_abc123',
    status: 'in_progress',
    file_counts: mockFileCounts,
  };

  const mockVectorStoreDeleted: VectorStores.VectorStoreDeleted = {
    id: 'vs_abc123',
    object: 'vector_store.deleted',
    deleted: true,
  };

  const mockVectorStoreFileDeleted: VectorStores.VectorStoreFileDeleted = {
    id: 'file-abc123',
    object: 'vector_store.file.deleted',
    deleted: true,
  };

  const mockSearchResult: VectorStores.VectorStoreSearchResponse = {
    score: 0.95,
    content: [
      {
        type: 'text',
        text: 'Sample search result content',
      },
    ],
    attributes: null,
    file_id: 'file-abc123',
    filename: 'test-document.txt',
  };

  const mockFileContentResponse: VectorStores.FileContentResponse = {
    type: 'text',
    text: 'Sample file content chunk',
  };

  let mockVectorStoreService: jest.Mocked<OpenAIVectorStoresService>;

  beforeEach(async () => {
    createVectorStoreSpy = jest.fn();
    retrieveVectorStoreSpy = jest.fn();
    updateVectorStoreSpy = jest.fn();
    listVectorStoresSpy = jest.fn();
    deleteVectorStoreSpy = jest.fn();
    searchVectorStoreSpy = jest.fn();
    addFileSpy = jest.fn();
    listFilesSpy = jest.fn();
    getFileSpy = jest.fn();
    updateFileSpy = jest.fn();
    removeFileSpy = jest.fn();
    getFileContentSpy = jest.fn();
    createFileBatchSpy = jest.fn();
    getFileBatchSpy = jest.fn();
    cancelFileBatchSpy = jest.fn();
    listBatchFilesSpy = jest.fn();
    pollUntilCompleteSpy = jest.fn();
    pollFileUntilCompleteSpy = jest.fn();
    pollBatchUntilCompleteSpy = jest.fn();

    mockVectorStoreService = {
      createVectorStore: createVectorStoreSpy,
      retrieveVectorStore: retrieveVectorStoreSpy,
      updateVectorStore: updateVectorStoreSpy,
      listVectorStores: listVectorStoresSpy,
      deleteVectorStore: deleteVectorStoreSpy,
      searchVectorStore: searchVectorStoreSpy,
      addFile: addFileSpy,
      listFiles: listFilesSpy,
      getFile: getFileSpy,
      updateFile: updateFileSpy,
      removeFile: removeFileSpy,
      getFileContent: getFileContentSpy,
      createFileBatch: createFileBatchSpy,
      getFileBatch: getFileBatchSpy,
      cancelFileBatch: cancelFileBatchSpy,
      listBatchFiles: listBatchFilesSpy,
      pollUntilComplete: pollUntilCompleteSpy,
      pollFileUntilComplete: pollFileUntilCompleteSpy,
      pollBatchUntilComplete: pollBatchUntilCompleteSpy,
    } as unknown as jest.Mocked<OpenAIVectorStoresService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VectorStoresController],
      providers: [
        {
          provide: OpenAIVectorStoresService,
          useValue: mockVectorStoreService,
        },
        {
          provide: LoggerService,
          useValue: {
            logOpenAIInteraction: jest.fn(),
            logStreamingEvent: jest.fn(),
          },
        },
        {
          provide: PricingService,
          useValue: {
            calculateCost: jest.fn().mockReturnValue(0.01),
          },
        },
      ],
    }).compile();

    controller = module.get<VectorStoresController>(VectorStoresController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ============================================================
  // VECTOR STORE MANAGEMENT ENDPOINTS (6 tests)
  // ============================================================

  describe('createVectorStore', () => {
    it('should create vector store with all parameters', async () => {
      mockVectorStoreService.createVectorStore.mockResolvedValue(
        mockVectorStore,
      );

      const dto = {
        name: 'Test Vector Store',
        file_ids: ['file-abc123'],
        chunking_strategy: {
          type: 'auto' as const,
        },
        metadata: { category: 'test' },
      };

      const result = await controller.createVectorStore(dto);

      expect(createVectorStoreSpy).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockVectorStore);
    });

    it('should create vector store with minimal parameters', async () => {
      mockVectorStoreService.createVectorStore.mockResolvedValue(
        mockVectorStore,
      );

      const dto = { name: 'Minimal Store' };
      const result = await controller.createVectorStore(dto);

      expect(createVectorStoreSpy).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockVectorStore);
    });

    it('should return vector store with completed status', async () => {
      mockVectorStoreService.createVectorStore.mockResolvedValue(
        mockVectorStore,
      );

      const result = await controller.createVectorStore({});

      expect(result.status).toBe('completed');
      expect(result.file_counts).toEqual(mockFileCounts);
    });

    it('should throw error on invalid parameters', async () => {
      const error = new Error('Invalid parameters');
      mockVectorStoreService.createVectorStore.mockRejectedValue(error);

      await expect(controller.createVectorStore({})).rejects.toThrow(
        'Invalid parameters',
      );
    });
  });

  describe('retrieveVectorStore', () => {
    it('should retrieve vector store successfully', async () => {
      mockVectorStoreService.retrieveVectorStore.mockResolvedValue(
        mockVectorStore,
      );

      const result = await controller.retrieveVectorStore('vs_abc123');

      expect(retrieveVectorStoreSpy).toHaveBeenCalledWith('vs_abc123');
      expect(result).toEqual(mockVectorStore);
    });

    it('should throw error for invalid vector store ID', async () => {
      const error = new Error('Vector store not found');
      mockVectorStoreService.retrieveVectorStore.mockRejectedValue(error);

      await expect(
        controller.retrieveVectorStore('invalid_id'),
      ).rejects.toThrow('Vector store not found');
    });

    it('should return vector store metadata', async () => {
      mockVectorStoreService.retrieveVectorStore.mockResolvedValue(
        mockVectorStore,
      );

      const result = await controller.retrieveVectorStore('vs_abc123');

      expect(result.id).toBe('vs_abc123');
      expect(result.object).toBe('vector_store');
      expect(result.file_counts).toBeDefined();
    });
  });

  describe('updateVectorStore', () => {
    it('should update vector store with all parameters', async () => {
      mockVectorStoreService.updateVectorStore.mockResolvedValue(
        mockVectorStore,
      );

      const dto = {
        name: 'Updated Name',
        metadata: { updated: 'true' },
        expires_after: {
          anchor: 'last_active_at' as const,
          days: 7,
        },
      };

      const result = await controller.updateVectorStore('vs_abc123', dto);

      expect(updateVectorStoreSpy).toHaveBeenCalledWith('vs_abc123', dto);
      expect(result).toEqual(mockVectorStore);
    });

    it('should update only name', async () => {
      mockVectorStoreService.updateVectorStore.mockResolvedValue(
        mockVectorStore,
      );

      const dto = { name: 'New Name' };
      await controller.updateVectorStore('vs_abc123', dto);

      expect(updateVectorStoreSpy).toHaveBeenCalledWith('vs_abc123', dto);
    });

    it('should handle empty update', async () => {
      mockVectorStoreService.updateVectorStore.mockResolvedValue(
        mockVectorStore,
      );

      await controller.updateVectorStore('vs_abc123', {});

      expect(updateVectorStoreSpy).toHaveBeenCalledWith('vs_abc123', {});
    });
  });

  describe('listVectorStores', () => {
    it('should list vector stores with default parameters', async () => {
      mockVectorStoreService.listVectorStores.mockResolvedValue([
        mockVectorStore,
      ]);

      const result = await controller.listVectorStores();

      expect(listVectorStoresSpy).toHaveBeenCalledWith(undefined);
      expect(result).toEqual([mockVectorStore]);
    });

    it('should list vector stores with pagination', async () => {
      mockVectorStoreService.listVectorStores.mockResolvedValue([
        mockVectorStore,
      ]);

      const dto = { limit: 20, order: 'desc' as const };
      const result = await controller.listVectorStores(dto);

      expect(listVectorStoresSpy).toHaveBeenCalledWith(dto);
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no vector stores', async () => {
      mockVectorStoreService.listVectorStores.mockResolvedValue([]);

      const result = await controller.listVectorStores();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('deleteVectorStore', () => {
    it('should delete vector store successfully', async () => {
      mockVectorStoreService.deleteVectorStore.mockResolvedValue(
        mockVectorStoreDeleted,
      );

      const result = await controller.deleteVectorStore('vs_abc123');

      expect(deleteVectorStoreSpy).toHaveBeenCalledWith('vs_abc123');
      expect(result).toEqual(mockVectorStoreDeleted);
      expect(result.deleted).toBe(true);
    });

    it('should throw error for invalid vector store ID', async () => {
      const error = new Error('Vector store not found');
      mockVectorStoreService.deleteVectorStore.mockRejectedValue(error);

      await expect(controller.deleteVectorStore('invalid_id')).rejects.toThrow(
        'Vector store not found',
      );
    });

    it('should return deletion confirmation', async () => {
      mockVectorStoreService.deleteVectorStore.mockResolvedValue(
        mockVectorStoreDeleted,
      );

      const result = await controller.deleteVectorStore('vs_abc123');

      expect(result.id).toBe('vs_abc123');
      expect(result.object).toBe('vector_store.deleted');
    });
  });

  describe('searchVectorStore', () => {
    it('should search vector store successfully', async () => {
      mockVectorStoreService.searchVectorStore.mockResolvedValue([
        mockSearchResult,
      ]);

      const dto = { query: 'test query' };
      const result = await controller.searchVectorStore('vs_abc123', dto);

      expect(searchVectorStoreSpy).toHaveBeenCalledWith('vs_abc123', dto);
      expect(result).toEqual([mockSearchResult]);
    });

    it('should search with ranking options', async () => {
      mockVectorStoreService.searchVectorStore.mockResolvedValue([
        mockSearchResult,
      ]);

      const dto = {
        query: 'test',
        max_num_results: 5,
        ranking_options: {
          ranker: 'default-2024-11-15' as const,
          score_threshold: 0.7,
        },
      };

      await controller.searchVectorStore('vs_abc123', dto);

      expect(searchVectorStoreSpy).toHaveBeenCalledWith('vs_abc123', dto);
    });

    it('should return search results with scores', async () => {
      mockVectorStoreService.searchVectorStore.mockResolvedValue([
        mockSearchResult,
      ]);

      const result = await controller.searchVectorStore('vs_abc123', {
        query: 'test',
      });

      expect(result[0].score).toBe(0.95);
      expect(result[0].content).toBeDefined();
    });
  });

  // ============================================================
  // FILE OPERATIONS ENDPOINTS (6 tests)
  // ============================================================

  describe('addFile', () => {
    it('should add file to vector store', async () => {
      mockVectorStoreService.addFile.mockResolvedValue(mockVectorStoreFile);

      const dto = { file_id: 'file-abc123' };
      const result = await controller.addFile('vs_abc123', dto);

      expect(addFileSpy).toHaveBeenCalledWith('vs_abc123', dto);
      expect(result).toEqual(mockVectorStoreFile);
    });

    it('should add file with chunking strategy', async () => {
      mockVectorStoreService.addFile.mockResolvedValue(mockVectorStoreFile);

      const dto = {
        file_id: 'file-abc123',
        chunking_strategy: {
          type: 'static' as const,
          static: {
            max_chunk_size_tokens: 800,
            chunk_overlap_tokens: 400,
          },
        },
      };

      await controller.addFile('vs_abc123', dto);

      expect(addFileSpy).toHaveBeenCalledWith('vs_abc123', dto);
    });

    it('should return file with completed status', async () => {
      mockVectorStoreService.addFile.mockResolvedValue(mockVectorStoreFile);

      const result = await controller.addFile('vs_abc123', {
        file_id: 'file-abc123',
      });

      expect(result.status).toBe('completed');
      expect(result.vector_store_id).toBe('vs_abc123');
    });
  });

  describe('listFiles', () => {
    it('should list files with default parameters', async () => {
      mockVectorStoreService.listFiles.mockResolvedValue([mockVectorStoreFile]);

      const result = await controller.listFiles('vs_abc123');

      expect(listFilesSpy).toHaveBeenCalledWith('vs_abc123', undefined);
      expect(result).toEqual([mockVectorStoreFile]);
    });

    it('should list files with pagination and filter', async () => {
      mockVectorStoreService.listFiles.mockResolvedValue([mockVectorStoreFile]);

      const dto = {
        limit: 50,
        order: 'asc' as const,
        filter: 'completed' as const,
      };

      await controller.listFiles('vs_abc123', dto);

      expect(listFilesSpy).toHaveBeenCalledWith('vs_abc123', dto);
    });

    it('should return empty array when no files', async () => {
      mockVectorStoreService.listFiles.mockResolvedValue([]);

      const result = await controller.listFiles('vs_abc123');

      expect(result).toEqual([]);
    });
  });

  describe('getFile', () => {
    it('should retrieve file from vector store', async () => {
      mockVectorStoreService.getFile.mockResolvedValue(mockVectorStoreFile);

      const result = await controller.getFile('vs_abc123', 'file-abc123');

      expect(getFileSpy).toHaveBeenCalledWith('vs_abc123', 'file-abc123');
      expect(result).toEqual(mockVectorStoreFile);
    });

    it('should throw error for file not in vector store', async () => {
      const error = new Error('File not found');
      mockVectorStoreService.getFile.mockRejectedValue(error);

      await expect(
        controller.getFile('vs_abc123', 'invalid_file'),
      ).rejects.toThrow('File not found');
    });

    it('should return file metadata', async () => {
      mockVectorStoreService.getFile.mockResolvedValue(mockVectorStoreFile);

      const result = await controller.getFile('vs_abc123', 'file-abc123');

      expect(result.id).toBe('file-abc123');
      expect(result.chunking_strategy).toBeDefined();
    });
  });

  describe('updateFile', () => {
    it('should update file attributes', async () => {
      mockVectorStoreService.updateFile.mockResolvedValue(mockVectorStoreFile);

      const attributes = { category: 'documentation', priority: 1 };
      const result = await controller.updateFile(
        'vs_abc123',
        'file-abc123',
        attributes,
      );

      expect(updateFileSpy).toHaveBeenCalledWith(
        'vs_abc123',
        'file-abc123',
        attributes,
      );
      expect(result).toEqual(mockVectorStoreFile);
    });

    it('should update file attributes to null', async () => {
      mockVectorStoreService.updateFile.mockResolvedValue(mockVectorStoreFile);

      await controller.updateFile('vs_abc123', 'file-abc123', null);

      expect(updateFileSpy).toHaveBeenCalledWith(
        'vs_abc123',
        'file-abc123',
        null,
      );
    });
  });

  describe('removeFile', () => {
    it('should remove file from vector store', async () => {
      mockVectorStoreService.removeFile.mockResolvedValue(
        mockVectorStoreFileDeleted,
      );

      const result = await controller.removeFile('vs_abc123', 'file-abc123');

      expect(removeFileSpy).toHaveBeenCalledWith('vs_abc123', 'file-abc123');
      expect(result).toEqual(mockVectorStoreFileDeleted);
      expect(result.deleted).toBe(true);
    });

    it('should throw error for file not in vector store', async () => {
      const error = new Error('File not found');
      mockVectorStoreService.removeFile.mockRejectedValue(error);

      await expect(
        controller.removeFile('vs_abc123', 'invalid_file'),
      ).rejects.toThrow('File not found');
    });

    it('should return deletion confirmation', async () => {
      mockVectorStoreService.removeFile.mockResolvedValue(
        mockVectorStoreFileDeleted,
      );

      const result = await controller.removeFile('vs_abc123', 'file-abc123');

      expect(result.id).toBe('file-abc123');
      expect(result.object).toBe('vector_store.file.deleted');
    });
  });

  describe('getFileContent', () => {
    it('should retrieve file content chunks', async () => {
      mockVectorStoreService.getFileContent.mockResolvedValue([
        mockFileContentResponse,
      ]);

      const result = await controller.getFileContent(
        'vs_abc123',
        'file-abc123',
      );

      expect(getFileContentSpy).toHaveBeenCalledWith(
        'vs_abc123',
        'file-abc123',
      );
      expect(result).toEqual([mockFileContentResponse]);
    });

    it('should throw error for file not accessible', async () => {
      const error = new Error('Content not available');
      mockVectorStoreService.getFileContent.mockRejectedValue(error);

      await expect(
        controller.getFileContent('vs_abc123', 'file-abc123'),
      ).rejects.toThrow('Content not available');
    });

    it('should return content chunks', async () => {
      mockVectorStoreService.getFileContent.mockResolvedValue([
        mockFileContentResponse,
      ]);

      const result = await controller.getFileContent(
        'vs_abc123',
        'file-abc123',
      );

      expect(result[0].text).toBeDefined();
      expect(result[0].type).toBe('text');
    });
  });

  // ============================================================
  // BATCH OPERATIONS ENDPOINTS (4 tests)
  // ============================================================

  describe('createFileBatch', () => {
    it('should create file batch with file_ids', async () => {
      mockVectorStoreService.createFileBatch.mockResolvedValue(
        mockVectorStoreFileBatch,
      );

      const dto = {
        file_ids: ['file-abc123', 'file-def456'],
      };

      const result = await controller.createFileBatch('vs_abc123', dto);

      expect(createFileBatchSpy).toHaveBeenCalledWith('vs_abc123', dto);
      expect(result).toEqual(mockVectorStoreFileBatch);
    });

    it('should create file batch with files array', async () => {
      mockVectorStoreService.createFileBatch.mockResolvedValue(
        mockVectorStoreFileBatch,
      );

      const dto = {
        files: [
          { file_id: 'file-abc123', attributes: { type: 'pdf' } },
          { file_id: 'file-def456', attributes: { type: 'txt' } },
        ],
      };

      await controller.createFileBatch('vs_abc123', dto);

      expect(createFileBatchSpy).toHaveBeenCalledWith('vs_abc123', dto);
    });

    it('should return batch with file_counts', async () => {
      mockVectorStoreService.createFileBatch.mockResolvedValue(
        mockVectorStoreFileBatch,
      );

      const result = await controller.createFileBatch('vs_abc123', {
        file_ids: ['file-abc123'],
      });

      expect(result.status).toBe('in_progress');
      expect(result.file_counts).toBeDefined();
    });
  });

  describe('getFileBatch', () => {
    it('should retrieve file batch', async () => {
      mockVectorStoreService.getFileBatch.mockResolvedValue(
        mockVectorStoreFileBatch,
      );

      const result = await controller.getFileBatch('vs_abc123', 'vsfb_abc123');

      expect(getFileBatchSpy).toHaveBeenCalledWith('vs_abc123', 'vsfb_abc123');
      expect(result).toEqual(mockVectorStoreFileBatch);
    });

    it('should throw error for invalid batch ID', async () => {
      const error = new Error('Batch not found');
      mockVectorStoreService.getFileBatch.mockRejectedValue(error);

      await expect(
        controller.getFileBatch('vs_abc123', 'invalid_batch'),
      ).rejects.toThrow('Batch not found');
    });

    it('should return batch metadata', async () => {
      mockVectorStoreService.getFileBatch.mockResolvedValue(
        mockVectorStoreFileBatch,
      );

      const result = await controller.getFileBatch('vs_abc123', 'vsfb_abc123');

      expect(result.id).toBe('vsfb_abc123');
      expect(result.vector_store_id).toBe('vs_abc123');
    });
  });

  describe('cancelFileBatch', () => {
    it('should cancel file batch', async () => {
      const cancelledBatch = {
        ...mockVectorStoreFileBatch,
        status: 'cancelled' as const,
      };
      mockVectorStoreService.cancelFileBatch.mockResolvedValue(cancelledBatch);

      const result = await controller.cancelFileBatch(
        'vs_abc123',
        'vsfb_abc123',
      );

      expect(cancelFileBatchSpy).toHaveBeenCalledWith(
        'vs_abc123',
        'vsfb_abc123',
      );
      expect(result.status).toBe('cancelled');
    });

    it('should throw error for already completed batch', async () => {
      const error = new Error('Batch already completed');
      mockVectorStoreService.cancelFileBatch.mockRejectedValue(error);

      await expect(
        controller.cancelFileBatch('vs_abc123', 'vsfb_abc123'),
      ).rejects.toThrow('Batch already completed');
    });
  });

  describe('listBatchFiles', () => {
    it('should list files in batch', async () => {
      mockVectorStoreService.listBatchFiles.mockResolvedValue([
        mockVectorStoreFile,
      ]);

      const result = await controller.listBatchFiles(
        'vs_abc123',
        'vsfb_abc123',
      );

      expect(listBatchFilesSpy).toHaveBeenCalledWith(
        'vs_abc123',
        'vsfb_abc123',
        undefined,
      );
      expect(result).toEqual([mockVectorStoreFile]);
    });

    it('should list batch files with filter', async () => {
      mockVectorStoreService.listBatchFiles.mockResolvedValue([
        mockVectorStoreFile,
      ]);

      const dto = { filter: 'failed' as const, limit: 10 };

      await controller.listBatchFiles('vs_abc123', 'vsfb_abc123', dto);

      expect(listBatchFilesSpy).toHaveBeenCalledWith(
        'vs_abc123',
        'vsfb_abc123',
        dto,
      );
    });

    it('should return empty array when no files in batch', async () => {
      mockVectorStoreService.listBatchFiles.mockResolvedValue([]);

      const result = await controller.listBatchFiles(
        'vs_abc123',
        'vsfb_abc123',
      );

      expect(result).toEqual([]);
    });
  });

  // ============================================================
  // POLLING ENDPOINTS (2 tests)
  // ============================================================

  describe('pollVectorStore', () => {
    it('should poll vector store until complete with default timeout', async () => {
      mockVectorStoreService.pollUntilComplete.mockResolvedValue(
        mockVectorStore,
      );

      const result = await controller.pollVectorStore('vs_abc123');

      expect(pollUntilCompleteSpy).toHaveBeenCalledWith('vs_abc123', 30000);
      expect(result).toEqual(mockVectorStore);
      expect(result.status).toBe('completed');
    });

    it('should poll vector store with custom timeout', async () => {
      mockVectorStoreService.pollUntilComplete.mockResolvedValue(
        mockVectorStore,
      );

      const result = await controller.pollVectorStore('vs_abc123', 60000);

      expect(pollUntilCompleteSpy).toHaveBeenCalledWith('vs_abc123', 60000);
      expect(result).toEqual(mockVectorStore);
    });

    it('should throw error on timeout', async () => {
      const error = new Error('Polling timeout exceeded');
      mockVectorStoreService.pollUntilComplete.mockRejectedValue(error);

      await expect(controller.pollVectorStore('vs_abc123')).rejects.toThrow(
        'Polling timeout exceeded',
      );
    });
  });

  describe('pollFile', () => {
    it('should poll file until complete with default timeout', async () => {
      mockVectorStoreService.pollFileUntilComplete.mockResolvedValue(
        mockVectorStoreFile,
      );

      const result = await controller.pollFile('vs_abc123', 'file-abc123');

      expect(pollFileUntilCompleteSpy).toHaveBeenCalledWith(
        'vs_abc123',
        'file-abc123',
        30000,
      );
      expect(result).toEqual(mockVectorStoreFile);
      expect(result.status).toBe('completed');
    });

    it('should poll file with custom timeout', async () => {
      mockVectorStoreService.pollFileUntilComplete.mockResolvedValue(
        mockVectorStoreFile,
      );

      const result = await controller.pollFile(
        'vs_abc123',
        'file-abc123',
        60000,
      );

      expect(pollFileUntilCompleteSpy).toHaveBeenCalledWith(
        'vs_abc123',
        'file-abc123',
        60000,
      );
      expect(result).toEqual(mockVectorStoreFile);
    });

    it('should throw error on timeout', async () => {
      const error = new Error('Polling timeout exceeded');
      mockVectorStoreService.pollFileUntilComplete.mockRejectedValue(error);

      await expect(
        controller.pollFile('vs_abc123', 'file-abc123'),
      ).rejects.toThrow('Polling timeout exceeded');
    });
  });
});
