import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OpenAIVectorStoresService } from './openai-vector-stores.service';
import { LoggerService } from '../../common/services/logger.service';
import type { VectorStores } from 'openai/resources/vector-stores';

// Mock OpenAI client
const mockOpenAIClient = {
  vectorStores: {
    create: jest.fn(),
    retrieve: jest.fn(),
    update: jest.fn(),
    list: jest.fn(),
    delete: jest.fn(),
    search: jest.fn(),
    files: {
      create: jest.fn(),
      list: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      content: jest.fn(),
    },
    fileBatches: {
      create: jest.fn(),
      retrieve: jest.fn(),
      cancel: jest.fn(),
      listFiles: jest.fn(),
    },
  },
};

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => mockOpenAIClient);
});

describe('OpenAIVectorStoresService', () => {
  let service: OpenAIVectorStoresService;
  let configService: ConfigService;
  let loggerService: LoggerService;

  const mockFileCounts: VectorStores.FileCounts = {
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
    expires_after: null,
    expires_at: null,
    last_active_at: 1234567990,
    metadata: {},
  };

  const mockVectorStoreInProgress: VectorStores.VectorStore = {
    ...mockVectorStore,
    status: 'in_progress',
    file_counts: {
      in_progress: 1,
      completed: 1,
      failed: 0,
      cancelled: 0,
      total: 2,
    },
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
    file_counts: {
      in_progress: 2,
      completed: 0,
      failed: 0,
      cancelled: 0,
      total: 2,
    },
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
    object: 'vector_store.search.result',
    id: 'result_abc123',
    score: 0.95,
    content: 'Sample search result content',
    metadata: {},
  };

  const mockFileContentResponse: VectorStores.FileContentResponse = {
    id: 'chunk_abc123',
    object: 'vector_store.file.chunk',
    content: 'Sample file content chunk',
    metadata: {},
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenAIVectorStoresService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, unknown> = {
                'openai.apiKey': 'test-api-key',
                'openai.baseUrl': 'https://api.openai.com/v1',
                'openai.timeout': 60000,
                'openai.maxRetries': 3,
              };
              return config[key];
            }),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            logOpenAIInteraction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OpenAIVectorStoresService>(OpenAIVectorStoresService);
    configService = module.get<ConfigService>(ConfigService);
    loggerService = module.get<LoggerService>(LoggerService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('should throw error if API key is not configured', () => {
      jest.spyOn(configService, 'get').mockReturnValue(undefined);
      expect(() => {
        new OpenAIVectorStoresService(configService, loggerService);
      }).toThrow('OpenAI API key is not configured');
    });

    it('should initialize OpenAI client with correct config', () => {
      const getSpy = jest.spyOn(configService, 'get');
      new OpenAIVectorStoresService(configService, loggerService);

      expect(getSpy).toHaveBeenCalledWith('openai.apiKey');
      expect(getSpy).toHaveBeenCalledWith('openai.baseUrl');
      expect(getSpy).toHaveBeenCalledWith('openai.timeout');
      expect(getSpy).toHaveBeenCalledWith('openai.maxRetries');
    });
  });

  // ============================================================
  // VECTOR STORE MANAGEMENT METHODS (6 tests)
  // ============================================================

  describe('createVectorStore', () => {
    it('should create vector store with all parameters', async () => {
      mockOpenAIClient.vectorStores.create.mockResolvedValue(mockVectorStore);

      const dto = {
        name: 'Test Vector Store',
        file_ids: ['file-abc123', 'file-def456'],
        chunking_strategy: {
          type: 'static' as const,
          static: {
            max_chunk_size_tokens: 800,
            chunk_overlap_tokens: 400,
          },
        },
        metadata: { category: 'test' },
        expires_after: {
          anchor: 'last_active_at' as const,
          days: 7,
        },
      };

      const result = await service.createVectorStore(dto);

      expect(mockOpenAIClient.vectorStores.create).toHaveBeenCalledWith({
        name: 'Test Vector Store',
        file_ids: ['file-abc123', 'file-def456'],
        chunking_strategy: dto.chunking_strategy,
        metadata: { category: 'test' },
        expires_after: { anchor: 'last_active_at', days: 7 },
      });
      expect(result).toEqual(mockVectorStore);
      expect(loggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'vector_stores',
          endpoint: '/v1/vector_stores',
          request: expect.objectContaining({ name: dto.name }),
          response: mockVectorStore,
        }),
      );
    });

    it('should create vector store with only name', async () => {
      mockOpenAIClient.vectorStores.create.mockResolvedValue(mockVectorStore);

      const dto = { name: 'Minimal Vector Store' };
      const result = await service.createVectorStore(dto);

      expect(mockOpenAIClient.vectorStores.create).toHaveBeenCalledWith({
        name: 'Minimal Vector Store',
      });
      expect(result).toEqual(mockVectorStore);
    });

    it('should create vector store without any parameters', async () => {
      mockOpenAIClient.vectorStores.create.mockResolvedValue(mockVectorStore);

      const result = await service.createVectorStore({});

      expect(mockOpenAIClient.vectorStores.create).toHaveBeenCalledWith({});
      expect(result).toEqual(mockVectorStore);
    });

    it('should log interaction metadata', async () => {
      mockOpenAIClient.vectorStores.create.mockResolvedValue(mockVectorStore);

      await service.createVectorStore({ name: 'Test' });

      expect(loggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            latency_ms: expect.any(Number),
            vector_store_id: 'vs_abc123',
            status: 'completed',
          }),
        }),
      );
    });

    it('should throw error on OpenAI API failure', async () => {
      const error = new Error('API Error');
      mockOpenAIClient.vectorStores.create.mockRejectedValue(error);

      await expect(service.createVectorStore({})).rejects.toThrow('API Error');
    });
  });

  describe('retrieveVectorStore', () => {
    it('should retrieve vector store by ID', async () => {
      mockOpenAIClient.vectorStores.retrieve.mockResolvedValue(mockVectorStore);

      const result = await service.retrieveVectorStore('vs_abc123');

      expect(mockOpenAIClient.vectorStores.retrieve).toHaveBeenCalledWith(
        'vs_abc123',
      );
      expect(result).toEqual(mockVectorStore);
    });

    it('should throw error for invalid vector store ID', async () => {
      const error = new Error('Vector store not found');
      mockOpenAIClient.vectorStores.retrieve.mockRejectedValue(error);

      await expect(service.retrieveVectorStore('invalid_id')).rejects.toThrow(
        'Vector store not found',
      );
    });
  });

  describe('updateVectorStore', () => {
    it('should update vector store with all parameters', async () => {
      mockOpenAIClient.vectorStores.update.mockResolvedValue(mockVectorStore);

      const dto = {
        name: 'Updated Name',
        metadata: { updated: 'true' },
        expires_after: {
          anchor: 'last_active_at' as const,
          days: 14,
        },
      };

      const result = await service.updateVectorStore('vs_abc123', dto);

      expect(mockOpenAIClient.vectorStores.update).toHaveBeenCalledWith(
        'vs_abc123',
        {
          name: 'Updated Name',
          metadata: { updated: 'true' },
          expires_after: { anchor: 'last_active_at', days: 14 },
        },
      );
      expect(result).toEqual(mockVectorStore);
      expect(loggerService.logOpenAIInteraction).toHaveBeenCalled();
    });

    it('should update only name', async () => {
      mockOpenAIClient.vectorStores.update.mockResolvedValue(mockVectorStore);

      await service.updateVectorStore('vs_abc123', { name: 'New Name' });

      expect(mockOpenAIClient.vectorStores.update).toHaveBeenCalledWith(
        'vs_abc123',
        { name: 'New Name' },
      );
    });

    it('should update with empty params', async () => {
      mockOpenAIClient.vectorStores.update.mockResolvedValue(mockVectorStore);

      await service.updateVectorStore('vs_abc123', {});

      expect(mockOpenAIClient.vectorStores.update).toHaveBeenCalledWith(
        'vs_abc123',
        {},
      );
    });
  });

  describe('listVectorStores', () => {
    const mockList = {
      data: [mockVectorStore],
      has_more: false,
      first_id: 'vs_abc123',
      last_id: 'vs_abc123',
    };

    it('should list vector stores with default parameters', async () => {
      mockOpenAIClient.vectorStores.list.mockResolvedValue(mockList);

      const result = await service.listVectorStores();

      expect(mockOpenAIClient.vectorStores.list).toHaveBeenCalledWith({});
      expect(result).toEqual([mockVectorStore]);
    });

    it('should list vector stores with pagination', async () => {
      mockOpenAIClient.vectorStores.list.mockResolvedValue(mockList);

      await service.listVectorStores({
        limit: 20,
        order: 'desc',
        after: 'vs_cursor',
      });

      expect(mockOpenAIClient.vectorStores.list).toHaveBeenCalledWith({
        limit: 20,
        order: 'desc',
        after: 'vs_cursor',
      });
    });

    it('should return empty array when no vector stores', async () => {
      mockOpenAIClient.vectorStores.list.mockResolvedValue({
        data: [],
        has_more: false,
      });

      const result = await service.listVectorStores();

      expect(result).toEqual([]);
    });
  });

  describe('deleteVectorStore', () => {
    it('should delete vector store successfully', async () => {
      mockOpenAIClient.vectorStores.delete.mockResolvedValue(
        mockVectorStoreDeleted,
      );

      const result = await service.deleteVectorStore('vs_abc123');

      expect(mockOpenAIClient.vectorStores.delete).toHaveBeenCalledWith(
        'vs_abc123',
      );
      expect(result).toEqual(mockVectorStoreDeleted);
      expect(result.deleted).toBe(true);
      expect(loggerService.logOpenAIInteraction).toHaveBeenCalled();
    });

    it('should throw error for invalid vector store ID', async () => {
      const error = new Error('Vector store not found');
      mockOpenAIClient.vectorStores.delete.mockRejectedValue(error);

      await expect(service.deleteVectorStore('invalid_id')).rejects.toThrow(
        'Vector store not found',
      );
    });
  });

  describe('searchVectorStore', () => {
    it('should search vector store with query', async () => {
      const mockSearchPage = { data: [mockSearchResult] };
      mockOpenAIClient.vectorStores.search.mockResolvedValue(mockSearchPage);

      const dto = { query: 'test query' };
      const result = await service.searchVectorStore('vs_abc123', dto);

      expect(mockOpenAIClient.vectorStores.search).toHaveBeenCalledWith(
        'vs_abc123',
        { query: 'test query' },
      );
      expect(result).toEqual([mockSearchResult]);
    });

    it('should search with max_num_results', async () => {
      const mockSearchPage = { data: [mockSearchResult] };
      mockOpenAIClient.vectorStores.search.mockResolvedValue(mockSearchPage);

      await service.searchVectorStore('vs_abc123', {
        query: 'test',
        max_num_results: 5,
      });

      expect(mockOpenAIClient.vectorStores.search).toHaveBeenCalledWith(
        'vs_abc123',
        { query: 'test', max_num_results: 5 },
      );
    });

    it('should search with ranking options', async () => {
      const mockSearchPage = { data: [mockSearchResult] };
      mockOpenAIClient.vectorStores.search.mockResolvedValue(mockSearchPage);

      await service.searchVectorStore('vs_abc123', {
        query: 'test',
        ranking_options: {
          ranker: 'default-2024-11-15',
          score_threshold: 0.7,
        },
      });

      expect(mockOpenAIClient.vectorStores.search).toHaveBeenCalledWith(
        'vs_abc123',
        {
          query: 'test',
          ranking_options: {
            ranker: 'default-2024-11-15',
            score_threshold: 0.7,
          },
        },
      );
    });
  });

  // ============================================================
  // FILE OPERATIONS (6 tests)
  // ============================================================

  describe('addFile', () => {
    it('should add file to vector store', async () => {
      mockOpenAIClient.vectorStores.files.create.mockResolvedValue(
        mockVectorStoreFile,
      );

      const dto = { file_id: 'file-abc123' };
      const result = await service.addFile('vs_abc123', dto);

      expect(mockOpenAIClient.vectorStores.files.create).toHaveBeenCalledWith(
        'vs_abc123',
        { file_id: 'file-abc123' },
      );
      expect(result).toEqual(mockVectorStoreFile);
      expect(loggerService.logOpenAIInteraction).toHaveBeenCalled();
    });

    it('should add file with chunking strategy', async () => {
      mockOpenAIClient.vectorStores.files.create.mockResolvedValue(
        mockVectorStoreFile,
      );

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

      await service.addFile('vs_abc123', dto);

      expect(mockOpenAIClient.vectorStores.files.create).toHaveBeenCalledWith(
        'vs_abc123',
        {
          file_id: 'file-abc123',
          chunking_strategy: dto.chunking_strategy,
        },
      );
    });
  });

  describe('listFiles', () => {
    const mockFileList = {
      data: [mockVectorStoreFile],
      has_more: false,
    };

    it('should list files with default parameters', async () => {
      mockOpenAIClient.vectorStores.files.list.mockResolvedValue(mockFileList);

      const result = await service.listFiles('vs_abc123');

      expect(mockOpenAIClient.vectorStores.files.list).toHaveBeenCalledWith(
        'vs_abc123',
        {},
      );
      expect(result).toEqual([mockVectorStoreFile]);
    });

    it('should list files with pagination and filter', async () => {
      mockOpenAIClient.vectorStores.files.list.mockResolvedValue(mockFileList);

      await service.listFiles('vs_abc123', {
        limit: 50,
        order: 'asc',
        filter: 'completed',
      });

      expect(mockOpenAIClient.vectorStores.files.list).toHaveBeenCalledWith(
        'vs_abc123',
        {
          limit: 50,
          order: 'asc',
          filter: 'completed',
        },
      );
    });
  });

  describe('getFile', () => {
    it('should retrieve file from vector store', async () => {
      mockOpenAIClient.vectorStores.files.retrieve.mockResolvedValue(
        mockVectorStoreFile,
      );

      const result = await service.getFile('vs_abc123', 'file-abc123');

      expect(mockOpenAIClient.vectorStores.files.retrieve).toHaveBeenCalledWith(
        'file-abc123',
        { vector_store_id: 'vs_abc123' },
      );
      expect(result).toEqual(mockVectorStoreFile);
    });

    it('should throw error for file not in vector store', async () => {
      const error = new Error('File not found');
      mockOpenAIClient.vectorStores.files.retrieve.mockRejectedValue(error);

      await expect(
        service.getFile('vs_abc123', 'invalid_file'),
      ).rejects.toThrow('File not found');
    });
  });

  describe('updateFile', () => {
    it('should update file attributes', async () => {
      mockOpenAIClient.vectorStores.files.update.mockResolvedValue(
        mockVectorStoreFile,
      );

      const attributes = { category: 'documentation', priority: 1 };
      const result = await service.updateFile(
        'vs_abc123',
        'file-abc123',
        attributes,
      );

      expect(mockOpenAIClient.vectorStores.files.update).toHaveBeenCalledWith(
        'file-abc123',
        {
          vector_store_id: 'vs_abc123',
          attributes,
        },
      );
      expect(result).toEqual(mockVectorStoreFile);
      expect(loggerService.logOpenAIInteraction).toHaveBeenCalled();
    });

    it('should update file attributes to null', async () => {
      mockOpenAIClient.vectorStores.files.update.mockResolvedValue(
        mockVectorStoreFile,
      );

      await service.updateFile('vs_abc123', 'file-abc123', null);

      expect(mockOpenAIClient.vectorStores.files.update).toHaveBeenCalledWith(
        'file-abc123',
        {
          vector_store_id: 'vs_abc123',
          attributes: null,
        },
      );
    });
  });

  describe('removeFile', () => {
    it('should remove file from vector store', async () => {
      mockOpenAIClient.vectorStores.files.delete.mockResolvedValue(
        mockVectorStoreFileDeleted,
      );

      const result = await service.removeFile('vs_abc123', 'file-abc123');

      expect(mockOpenAIClient.vectorStores.files.delete).toHaveBeenCalledWith(
        'file-abc123',
        { vector_store_id: 'vs_abc123' },
      );
      expect(result).toEqual(mockVectorStoreFileDeleted);
      expect(result.deleted).toBe(true);
      expect(loggerService.logOpenAIInteraction).toHaveBeenCalled();
    });

    it('should throw error for file not in vector store', async () => {
      const error = new Error('File not found');
      mockOpenAIClient.vectorStores.files.delete.mockRejectedValue(error);

      await expect(
        service.removeFile('vs_abc123', 'invalid_file'),
      ).rejects.toThrow('File not found');
    });
  });

  describe('getFileContent', () => {
    it('should retrieve file content chunks', async () => {
      const mockContentPage = { data: [mockFileContentResponse] };
      mockOpenAIClient.vectorStores.files.content.mockResolvedValue(
        mockContentPage,
      );

      const result = await service.getFileContent('vs_abc123', 'file-abc123');

      expect(mockOpenAIClient.vectorStores.files.content).toHaveBeenCalledWith(
        'file-abc123',
        { vector_store_id: 'vs_abc123' },
      );
      expect(result).toEqual([mockFileContentResponse]);
    });

    it('should throw error for file not accessible', async () => {
      const error = new Error('Content not available');
      mockOpenAIClient.vectorStores.files.content.mockRejectedValue(error);

      await expect(
        service.getFileContent('vs_abc123', 'file-abc123'),
      ).rejects.toThrow('Content not available');
    });
  });

  // ============================================================
  // BATCH OPERATIONS (4 tests)
  // ============================================================

  describe('createFileBatch', () => {
    it('should create file batch with file_ids', async () => {
      mockOpenAIClient.vectorStores.fileBatches.create.mockResolvedValue(
        mockVectorStoreFileBatch,
      );

      const dto = {
        file_ids: ['file-abc123', 'file-def456'],
      };

      const result = await service.createFileBatch('vs_abc123', dto);

      expect(
        mockOpenAIClient.vectorStores.fileBatches.create,
      ).toHaveBeenCalledWith('vs_abc123', {
        file_ids: ['file-abc123', 'file-def456'],
      });
      expect(result).toEqual(mockVectorStoreFileBatch);
      expect(loggerService.logOpenAIInteraction).toHaveBeenCalled();
    });

    it('should create file batch with files array', async () => {
      mockOpenAIClient.vectorStores.fileBatches.create.mockResolvedValue(
        mockVectorStoreFileBatch,
      );

      const dto = {
        files: [
          { file_id: 'file-abc123', attributes: { type: 'pdf' } },
          { file_id: 'file-def456', attributes: { type: 'txt' } },
        ],
      };

      await service.createFileBatch('vs_abc123', dto);

      expect(
        mockOpenAIClient.vectorStores.fileBatches.create,
      ).toHaveBeenCalledWith('vs_abc123', {
        files: dto.files,
      });
    });

    it('should create file batch with chunking strategy', async () => {
      mockOpenAIClient.vectorStores.fileBatches.create.mockResolvedValue(
        mockVectorStoreFileBatch,
      );

      const dto = {
        file_ids: ['file-abc123'],
        chunking_strategy: {
          type: 'auto' as const,
        },
      };

      await service.createFileBatch('vs_abc123', dto);

      expect(
        mockOpenAIClient.vectorStores.fileBatches.create,
      ).toHaveBeenCalledWith('vs_abc123', {
        file_ids: ['file-abc123'],
        chunking_strategy: { type: 'auto' },
      });
    });
  });

  describe('getFileBatch', () => {
    it('should retrieve file batch', async () => {
      mockOpenAIClient.vectorStores.fileBatches.retrieve.mockResolvedValue(
        mockVectorStoreFileBatch,
      );

      const result = await service.getFileBatch('vs_abc123', 'vsfb_abc123');

      expect(
        mockOpenAIClient.vectorStores.fileBatches.retrieve,
      ).toHaveBeenCalledWith('vsfb_abc123', { vector_store_id: 'vs_abc123' });
      expect(result).toEqual(mockVectorStoreFileBatch);
    });

    it('should throw error for invalid batch ID', async () => {
      const error = new Error('Batch not found');
      mockOpenAIClient.vectorStores.fileBatches.retrieve.mockRejectedValue(
        error,
      );

      await expect(
        service.getFileBatch('vs_abc123', 'invalid_batch'),
      ).rejects.toThrow('Batch not found');
    });
  });

  describe('cancelFileBatch', () => {
    it('should cancel file batch', async () => {
      const cancelledBatch = {
        ...mockVectorStoreFileBatch,
        status: 'cancelled' as const,
      };
      mockOpenAIClient.vectorStores.fileBatches.cancel.mockResolvedValue(
        cancelledBatch,
      );

      const result = await service.cancelFileBatch('vs_abc123', 'vsfb_abc123');

      expect(
        mockOpenAIClient.vectorStores.fileBatches.cancel,
      ).toHaveBeenCalledWith('vsfb_abc123', { vector_store_id: 'vs_abc123' });
      expect(result.status).toBe('cancelled');
      expect(loggerService.logOpenAIInteraction).toHaveBeenCalled();
    });

    it('should throw error for already completed batch', async () => {
      const error = new Error('Batch already completed');
      mockOpenAIClient.vectorStores.fileBatches.cancel.mockRejectedValue(error);

      await expect(
        service.cancelFileBatch('vs_abc123', 'vsfb_abc123'),
      ).rejects.toThrow('Batch already completed');
    });
  });

  describe('listBatchFiles', () => {
    const mockFileList = {
      data: [mockVectorStoreFile],
      has_more: false,
    };

    it('should list files in batch', async () => {
      mockOpenAIClient.vectorStores.fileBatches.listFiles.mockResolvedValue(
        mockFileList,
      );

      const result = await service.listBatchFiles('vs_abc123', 'vsfb_abc123');

      expect(
        mockOpenAIClient.vectorStores.fileBatches.listFiles,
      ).toHaveBeenCalledWith('vsfb_abc123', { vector_store_id: 'vs_abc123' });
      expect(result).toEqual([mockVectorStoreFile]);
    });

    it('should list batch files with filter', async () => {
      mockOpenAIClient.vectorStores.fileBatches.listFiles.mockResolvedValue(
        mockFileList,
      );

      await service.listBatchFiles('vs_abc123', 'vsfb_abc123', {
        filter: 'failed',
        limit: 10,
      });

      expect(
        mockOpenAIClient.vectorStores.fileBatches.listFiles,
      ).toHaveBeenCalledWith('vsfb_abc123', {
        vector_store_id: 'vs_abc123',
        filter: 'failed',
        limit: 10,
      });
    });
  });

  // ============================================================
  // POLLING METHODS (3 tests)
  // ============================================================

  describe('pollUntilComplete', () => {
    it('should return completed vector store immediately', async () => {
      mockOpenAIClient.vectorStores.retrieve.mockResolvedValue(mockVectorStore);

      const result = await service.pollUntilComplete('vs_abc123');

      expect(result.status).toBe('completed');
      expect(mockOpenAIClient.vectorStores.retrieve).toHaveBeenCalledTimes(1);
    });

    it('should poll until vector store completes', async () => {
      mockOpenAIClient.vectorStores.retrieve
        .mockResolvedValueOnce(mockVectorStoreInProgress)
        .mockResolvedValueOnce(mockVectorStoreInProgress)
        .mockResolvedValueOnce(mockVectorStore);

      const result = await service.pollUntilComplete('vs_abc123', 30000);

      expect(result.status).toBe('completed');
      expect(mockOpenAIClient.vectorStores.retrieve).toHaveBeenCalledTimes(3);
    }, 30000);

    it('should throw error on timeout', async () => {
      mockOpenAIClient.vectorStores.retrieve.mockResolvedValue(
        mockVectorStoreInProgress,
      );

      await expect(service.pollUntilComplete('vs_abc123', 100)).rejects.toThrow(
        'did not complete within 100ms',
      );
    }, 10000);
  });

  describe('pollFileUntilComplete', () => {
    it('should return completed file immediately', async () => {
      mockOpenAIClient.vectorStores.files.retrieve.mockResolvedValue(
        mockVectorStoreFile,
      );

      const result = await service.pollFileUntilComplete(
        'vs_abc123',
        'file-abc123',
      );

      expect(result.status).toBe('completed');
      expect(
        mockOpenAIClient.vectorStores.files.retrieve,
      ).toHaveBeenCalledTimes(1);
    });

    it('should poll until file completes', async () => {
      const inProgressFile = {
        ...mockVectorStoreFile,
        status: 'in_progress' as const,
      };
      mockOpenAIClient.vectorStores.files.retrieve
        .mockResolvedValueOnce(inProgressFile)
        .mockResolvedValueOnce(inProgressFile)
        .mockResolvedValueOnce(mockVectorStoreFile);

      const result = await service.pollFileUntilComplete(
        'vs_abc123',
        'file-abc123',
        30000,
      );

      expect(result.status).toBe('completed');
      expect(
        mockOpenAIClient.vectorStores.files.retrieve,
      ).toHaveBeenCalledTimes(3);
    }, 30000);

    it('should throw error on timeout', async () => {
      const inProgressFile = {
        ...mockVectorStoreFile,
        status: 'in_progress' as const,
      };
      mockOpenAIClient.vectorStores.files.retrieve.mockResolvedValue(
        inProgressFile,
      );

      await expect(
        service.pollFileUntilComplete('vs_abc123', 'file-abc123', 100),
      ).rejects.toThrow('did not complete within 100ms');
    }, 10000);
  });

  describe('pollBatchUntilComplete', () => {
    const completedBatch = {
      ...mockVectorStoreFileBatch,
      status: 'completed' as const,
    };

    it('should return completed batch immediately', async () => {
      mockOpenAIClient.vectorStores.fileBatches.retrieve.mockResolvedValue(
        completedBatch,
      );

      const result = await service.pollBatchUntilComplete(
        'vs_abc123',
        'vsfb_abc123',
      );

      expect(result.status).toBe('completed');
      expect(
        mockOpenAIClient.vectorStores.fileBatches.retrieve,
      ).toHaveBeenCalledTimes(1);
    });

    it('should poll until batch completes', async () => {
      mockOpenAIClient.vectorStores.fileBatches.retrieve
        .mockResolvedValueOnce(mockVectorStoreFileBatch)
        .mockResolvedValueOnce(mockVectorStoreFileBatch)
        .mockResolvedValueOnce(completedBatch);

      const result = await service.pollBatchUntilComplete(
        'vs_abc123',
        'vsfb_abc123',
        30000,
      );

      expect(result.status).toBe('completed');
      expect(
        mockOpenAIClient.vectorStores.fileBatches.retrieve,
      ).toHaveBeenCalledTimes(3);
    }, 30000);

    it('should throw error on timeout', async () => {
      mockOpenAIClient.vectorStores.fileBatches.retrieve.mockResolvedValue(
        mockVectorStoreFileBatch,
      );

      await expect(
        service.pollBatchUntilComplete('vs_abc123', 'vsfb_abc123', 100),
      ).rejects.toThrow('did not complete within 100ms');
    }, 10000);
  });

  // ============================================================
  // HELPER METHOD (1 test)
  // ============================================================

  describe('validateChunkingParameters', () => {
    it('should validate auto chunking strategy', () => {
      const strategy = { type: 'auto' as const };
      expect(service.validateChunkingParameters(strategy)).toBe(true);
    });

    it('should validate static chunking strategy with valid params', () => {
      const strategy = {
        type: 'static' as const,
        static: {
          max_chunk_size_tokens: 800,
          chunk_overlap_tokens: 400,
        },
      };
      expect(service.validateChunkingParameters(strategy)).toBe(true);
    });

    it('should reject static chunking with invalid max_chunk_size_tokens', () => {
      const strategy = {
        type: 'static' as const,
        static: {
          max_chunk_size_tokens: 50, // Below minimum
          chunk_overlap_tokens: 10,
        },
      };
      expect(() => service.validateChunkingParameters(strategy)).toThrow(
        'max_chunk_size_tokens must be between 100 and 4096',
      );
    });

    it('should reject static chunking with chunk_overlap exceeding limit', () => {
      const strategy = {
        type: 'static' as const,
        static: {
          max_chunk_size_tokens: 800,
          chunk_overlap_tokens: 500, // Exceeds max/2
        },
      };
      expect(() => service.validateChunkingParameters(strategy)).toThrow(
        'chunk_overlap_tokens cannot exceed half of max_chunk_size_tokens',
      );
    });

    it('should accept static chunking with maximum valid overlap', () => {
      const strategy = {
        type: 'static' as const,
        static: {
          max_chunk_size_tokens: 1000,
          chunk_overlap_tokens: 500, // Exactly max/2
        },
      };
      expect(service.validateChunkingParameters(strategy)).toBe(true);
    });
  });
});
