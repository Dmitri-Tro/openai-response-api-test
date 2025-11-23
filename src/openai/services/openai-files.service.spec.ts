import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OpenAIFilesService } from './openai-files.service';
import { LoggerService } from '../../common/services/logger.service';
import type { Files } from 'openai/resources/files';

// Mock OpenAI client
const mockOpenAIClient = {
  files: {
    create: jest.fn(),
    retrieve: jest.fn(),
    list: jest.fn(),
    delete: jest.fn(),
    content: jest.fn(),
  },
};

jest.mock('openai', () => {
  const mockToFile = jest.fn((buffer: Buffer, filename: string) => {
    return Promise.resolve({ buffer, filename });
  });

  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => mockOpenAIClient),
    toFile: mockToFile,
  };
});

describe('OpenAIFilesService', () => {
  let service: OpenAIFilesService;
  let configService: ConfigService;
  let loggerService: LoggerService;

  const mockFile: Files.FileObject = {
    id: 'file-abc123xyz789',
    object: 'file',
    bytes: 1024,
    created_at: 1234567890,
    filename: 'test-document.pdf',
    purpose: 'assistants',
    status: 'uploaded',
    status_details: null,
    expires_at: null,
  };

  const mockProcessedFile: Files.FileObject = {
    ...mockFile,
    status: 'processed',
  };

  const mockErrorFile: Files.FileObject = {
    ...mockFile,
    status: 'error',
    status_details: 'Processing failed: invalid format',
  };

  const mockFileWithExpiration: Files.FileObject = {
    ...mockFile,
    expires_at: 1234654290,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenAIFilesService,
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

    service = module.get<OpenAIFilesService>(OpenAIFilesService);
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
        new OpenAIFilesService(configService, loggerService);
      }).toThrow('OpenAI API key is not configured');
    });

    it('should initialize OpenAI client with correct config', () => {
      const getSpy = jest.spyOn(configService, 'get');

      new OpenAIFilesService(configService, loggerService);

      expect(getSpy).toHaveBeenCalledWith('openai.apiKey');
      expect(getSpy).toHaveBeenCalledWith('openai.baseUrl');
      expect(getSpy).toHaveBeenCalledWith('openai.timeout');
      expect(getSpy).toHaveBeenCalledWith('openai.maxRetries');
    });
  });

  describe('uploadFile', () => {
    const fileBuffer = Buffer.from('test file content');
    const filename = 'test-document.pdf';
    const purpose: Files.FilePurpose = 'assistants';

    it('should upload file with all parameters', async () => {
      mockOpenAIClient.files.create.mockResolvedValue(mockFileWithExpiration);

      const expiresAfter: Files.FileCreateParams['expires_after'] = {
        anchor: 'created_at',
        seconds: 86400,
      };

      const result = await service.uploadFile(
        fileBuffer,
        filename,
        purpose,
        expiresAfter,
      );

      expect(mockOpenAIClient.files.create).toHaveBeenCalledWith(
        expect.objectContaining({
          purpose: 'assistants',
          expires_after: expiresAfter,
        }),
      );
      expect(result).toEqual(mockFileWithExpiration);
      expect(loggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'files',
          endpoint: '/v1/files',
          request: expect.objectContaining({
            filename,
            purpose,
            bytes: fileBuffer.length,
            expires_after: expiresAfter,
          }),
          response: mockFileWithExpiration,
        }),
      );
    });

    it('should upload file with only required parameters', async () => {
      mockOpenAIClient.files.create.mockResolvedValue(mockFile);

      const result = await service.uploadFile(fileBuffer, filename, purpose);

      expect(mockOpenAIClient.files.create).toHaveBeenCalledWith(
        expect.objectContaining({
          purpose: 'assistants',
        }),
      );
      expect(result).toEqual(mockFile);
    });

    it('should upload file for vision purpose', async () => {
      const visionFile = { ...mockFile, purpose: 'vision' };
      mockOpenAIClient.files.create.mockResolvedValue(visionFile);

      await service.uploadFile(fileBuffer, filename, 'vision');

      expect(mockOpenAIClient.files.create).toHaveBeenCalledWith(
        expect.objectContaining({
          purpose: 'vision',
        }),
      );
    });

    it('should upload file for batch purpose', async () => {
      const batchFile = { ...mockFile, purpose: 'batch' };
      mockOpenAIClient.files.create.mockResolvedValue(batchFile);

      await service.uploadFile(fileBuffer, filename, 'batch');

      expect(mockOpenAIClient.files.create).toHaveBeenCalledWith(
        expect.objectContaining({
          purpose: 'batch',
        }),
      );
    });

    it('should upload file for fine-tune purpose', async () => {
      const fineTuneFile = { ...mockFile, purpose: 'fine-tune' };
      mockOpenAIClient.files.create.mockResolvedValue(fineTuneFile);

      await service.uploadFile(fileBuffer, filename, 'fine-tune');

      expect(mockOpenAIClient.files.create).toHaveBeenCalledWith(
        expect.objectContaining({
          purpose: 'fine-tune',
        }),
      );
    });

    it('should log interaction metadata', async () => {
      mockOpenAIClient.files.create.mockResolvedValue(mockFile);

      await service.uploadFile(fileBuffer, filename, purpose);

      expect(loggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            latency_ms: expect.any(Number),
            file_id: 'file-abc123xyz789',
            filename: 'test-document.pdf',
            bytes: 1024,
            purpose: 'assistants',
            status: 'uploaded',
            created_at: 1234567890,
          }),
        }),
      );
    });

    it('should throw error on OpenAI API failure', async () => {
      const error = new Error('File upload failed');
      mockOpenAIClient.files.create.mockRejectedValue(error);

      await expect(
        service.uploadFile(fileBuffer, filename, purpose),
      ).rejects.toThrow('File upload failed');
    });

    it('should handle large file upload', async () => {
      const largeBuffer = Buffer.alloc(100 * 1024 * 1024); // 100 MB
      const largeFile = { ...mockFile, bytes: 100 * 1024 * 1024 };
      mockOpenAIClient.files.create.mockResolvedValue(largeFile);

      const result = await service.uploadFile(
        largeBuffer,
        'large-file.pdf',
        purpose,
      );

      expect(result.bytes).toBe(100 * 1024 * 1024);
    });

    it('should handle file with special characters in name', async () => {
      const specialName = 'file (1) [copy].pdf';
      mockOpenAIClient.files.create.mockResolvedValue({
        ...mockFile,
        filename: specialName,
      });

      await service.uploadFile(fileBuffer, specialName, purpose);

      expect(loggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          request: expect.objectContaining({
            filename: specialName,
          }),
        }),
      );
    });
  });

  describe('retrieveFile', () => {
    it('should retrieve file metadata', async () => {
      mockOpenAIClient.files.retrieve.mockResolvedValue(mockFile);

      const result = await service.retrieveFile('file-abc123xyz789');

      expect(mockOpenAIClient.files.retrieve).toHaveBeenCalledWith(
        'file-abc123xyz789',
      );
      expect(result).toEqual(mockFile);
    });

    it('should retrieve processed file', async () => {
      mockOpenAIClient.files.retrieve.mockResolvedValue(mockProcessedFile);

      const result = await service.retrieveFile('file-abc123xyz789');

      expect(result.status).toBe('processed');
    });

    it('should retrieve file with error status', async () => {
      mockOpenAIClient.files.retrieve.mockResolvedValue(mockErrorFile);

      const result = await service.retrieveFile('file-abc123xyz789');

      expect(result.status).toBe('error');
      expect(result.status_details).toBe('Processing failed: invalid format');
    });

    it('should throw error for invalid file ID', async () => {
      const error = new Error('File not found');
      mockOpenAIClient.files.retrieve.mockRejectedValue(error);

      await expect(service.retrieveFile('invalid-id')).rejects.toThrow(
        'File not found',
      );
    });

    it('should retrieve file with expiration', async () => {
      mockOpenAIClient.files.retrieve.mockResolvedValue(mockFileWithExpiration);

      const result = await service.retrieveFile('file-abc123xyz789');

      expect(result.expires_at).toBe(1234654290);
    });
  });

  describe('listFiles', () => {
    const mockFileList = {
      data: [mockFile, mockProcessedFile],
      has_more: false,
      object: 'list',
    };

    it('should list files with default parameters', async () => {
      mockOpenAIClient.files.list.mockResolvedValue(mockFileList);

      const result = await service.listFiles();

      expect(mockOpenAIClient.files.list).toHaveBeenCalledWith({
        order: 'desc',
      });
      expect(result).toEqual([mockFile, mockProcessedFile]);
    });

    it('should list files with purpose filter', async () => {
      mockOpenAIClient.files.list.mockResolvedValue(mockFileList);

      await service.listFiles('assistants');

      expect(mockOpenAIClient.files.list).toHaveBeenCalledWith({
        purpose: 'assistants',
        order: 'desc',
      });
    });

    it('should list files in ascending order', async () => {
      mockOpenAIClient.files.list.mockResolvedValue(mockFileList);

      await service.listFiles(undefined, 'asc');

      expect(mockOpenAIClient.files.list).toHaveBeenCalledWith({
        order: 'asc',
      });
    });

    it('should list files in descending order', async () => {
      mockOpenAIClient.files.list.mockResolvedValue(mockFileList);

      await service.listFiles(undefined, 'desc');

      expect(mockOpenAIClient.files.list).toHaveBeenCalledWith({
        order: 'desc',
      });
    });

    it('should list files with custom limit', async () => {
      mockOpenAIClient.files.list.mockResolvedValue(mockFileList);

      await service.listFiles(undefined, 'desc', 50);

      expect(mockOpenAIClient.files.list).toHaveBeenCalledWith({
        order: 'desc',
        limit: 50,
      });
    });

    it('should list files with all parameters', async () => {
      mockOpenAIClient.files.list.mockResolvedValue(mockFileList);

      await service.listFiles('vision', 'asc', 100);

      expect(mockOpenAIClient.files.list).toHaveBeenCalledWith({
        purpose: 'vision',
        order: 'asc',
        limit: 100,
      });
    });

    it('should return empty array when no files', async () => {
      mockOpenAIClient.files.list.mockResolvedValue({
        data: [],
        has_more: false,
        object: 'list',
      });

      const result = await service.listFiles();

      expect(result).toEqual([]);
    });

    it('should handle pagination', async () => {
      const page1 = {
        data: [mockFile],
        has_more: true,
        object: 'list',
      };
      mockOpenAIClient.files.list.mockResolvedValue(page1);

      const result = await service.listFiles(undefined, 'desc', 1);

      expect(result).toEqual([mockFile]);
    });

    it('should list files filtered by batch purpose', async () => {
      const batchFile = { ...mockFile, purpose: 'batch' };
      mockOpenAIClient.files.list.mockResolvedValue({
        data: [batchFile],
        has_more: false,
        object: 'list',
      });

      const result = await service.listFiles('batch');

      expect(result[0].purpose).toBe('batch');
    });

    it('should list files filtered by fine-tune purpose', async () => {
      const fineTuneFile = { ...mockFile, purpose: 'fine-tune' };
      mockOpenAIClient.files.list.mockResolvedValue({
        data: [fineTuneFile],
        has_more: false,
        object: 'list',
      });

      const result = await service.listFiles('fine-tune');

      expect(result[0].purpose).toBe('fine-tune');
    });
  });

  describe('deleteFile', () => {
    const mockDeleteResponse: Files.FileDeleted = {
      id: 'file-abc123xyz789',
      object: 'file',
      deleted: true,
    };

    it('should delete file successfully', async () => {
      mockOpenAIClient.files.delete.mockResolvedValue(mockDeleteResponse);

      const result = await service.deleteFile('file-abc123xyz789');

      expect(mockOpenAIClient.files.delete).toHaveBeenCalledWith(
        'file-abc123xyz789',
      );
      expect(result).toEqual(mockDeleteResponse);
      expect(result.deleted).toBe(true);
    });

    it('should throw error for invalid file ID', async () => {
      const error = new Error('File not found');
      mockOpenAIClient.files.delete.mockRejectedValue(error);

      await expect(service.deleteFile('invalid-id')).rejects.toThrow(
        'File not found',
      );
    });

    it('should handle already deleted file', async () => {
      const error = new Error('File already deleted');
      mockOpenAIClient.files.delete.mockRejectedValue(error);

      await expect(service.deleteFile('file-abc123xyz789')).rejects.toThrow(
        'File already deleted',
      );
    });

    it('should delete file even if used in processing', async () => {
      mockOpenAIClient.files.delete.mockResolvedValue(mockDeleteResponse);

      const result = await service.deleteFile('file-abc123xyz789');

      expect(result.deleted).toBe(true);
    });
  });

  describe('downloadFileContent', () => {
    const mockResponse = {
      body: {
        getReader: jest.fn(),
      },
    } as unknown as Response;

    it('should download file content', async () => {
      mockOpenAIClient.files.content.mockResolvedValue(mockResponse);

      const result = await service.downloadFileContent('file-abc123xyz789');

      expect(mockOpenAIClient.files.content).toHaveBeenCalledWith(
        'file-abc123xyz789',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw error for assistants purpose file', async () => {
      const error = new Error(
        'Files with purpose "assistants" cannot be downloaded',
      );
      mockOpenAIClient.files.content.mockRejectedValue(error);

      await expect(
        service.downloadFileContent('file-abc123xyz789'),
      ).rejects.toThrow('Files with purpose "assistants" cannot be downloaded');
    });

    it('should throw error for file not found', async () => {
      const error = new Error('File not found');
      mockOpenAIClient.files.content.mockRejectedValue(error);

      await expect(service.downloadFileContent('invalid-id')).rejects.toThrow(
        'File not found',
      );
    });

    it('should download file with vision purpose', async () => {
      mockOpenAIClient.files.content.mockResolvedValue(mockResponse);

      const result = await service.downloadFileContent('file-vision123');

      expect(result).toEqual(mockResponse);
    });

    it('should download file with batch purpose', async () => {
      mockOpenAIClient.files.content.mockResolvedValue(mockResponse);

      const result = await service.downloadFileContent('file-batch123');

      expect(result).toEqual(mockResponse);
    });
  });

  describe('waitForProcessing', () => {
    it('should return processed file immediately', async () => {
      mockOpenAIClient.files.retrieve.mockResolvedValue(mockProcessedFile);

      const result = await service.waitForProcessing('file-abc123xyz789');

      expect(result.status).toBe('processed');
      expect(mockOpenAIClient.files.retrieve).toHaveBeenCalledTimes(1);
    });

    it('should return error file immediately', async () => {
      mockOpenAIClient.files.retrieve.mockResolvedValue(mockErrorFile);

      const result = await service.waitForProcessing('file-abc123xyz789');

      expect(result.status).toBe('error');
      expect(mockOpenAIClient.files.retrieve).toHaveBeenCalledTimes(1);
    });

    it('should poll until file processing completes', async () => {
      const uploadedFile = { ...mockFile, status: 'uploaded' };

      mockOpenAIClient.files.retrieve
        .mockResolvedValueOnce(uploadedFile)
        .mockResolvedValueOnce(uploadedFile)
        .mockResolvedValueOnce(mockProcessedFile);

      const result = await service.waitForProcessing('file-abc123xyz789', {
        pollInterval: 100,
        maxWait: 30000,
      });

      expect(result.status).toBe('processed');
      expect(mockOpenAIClient.files.retrieve).toHaveBeenCalledTimes(3);
    }, 30000);

    it('should throw error on timeout', async () => {
      mockOpenAIClient.files.retrieve.mockResolvedValue({
        ...mockFile,
        status: 'uploaded',
      });

      await expect(
        service.waitForProcessing('file-abc123xyz789', {
          pollInterval: 100,
          maxWait: 500,
        }),
      ).rejects.toThrow(/timeout/i);
    }, 10000);

    it('should use exponential backoff', async () => {
      const uploadedFile = { ...mockFile, status: 'uploaded' };

      // Mock sequence: uploaded → uploaded → processed
      mockOpenAIClient.files.retrieve
        .mockResolvedValueOnce(uploadedFile)
        .mockResolvedValueOnce(uploadedFile)
        .mockResolvedValueOnce(mockProcessedFile);

      const result = await service.waitForProcessing('file-abc123xyz789', {
        pollInterval: 100,
        maxWait: 30000,
      });

      expect(result.status).toBe('processed');
      expect(mockOpenAIClient.files.retrieve).toHaveBeenCalledTimes(3);
    }, 30000);

    it('should respect custom pollInterval', async () => {
      mockOpenAIClient.files.retrieve.mockResolvedValue(mockProcessedFile);

      await service.waitForProcessing('file-abc123xyz789', {
        pollInterval: 1000,
      });

      expect(mockOpenAIClient.files.retrieve).toHaveBeenCalledTimes(1);
    });

    it('should respect custom maxWait', async () => {
      mockOpenAIClient.files.retrieve.mockResolvedValue({
        ...mockFile,
        status: 'uploaded',
      });

      const customTimeout = 2000;

      await expect(
        service.waitForProcessing('file-abc123xyz789', {
          pollInterval: 100,
          maxWait: customTimeout,
        }),
      ).rejects.toThrow(`timeout: exceeded ${customTimeout}ms`);
    }, 10000);

    it('should cap backoff at 20 seconds', async () => {
      const uploadedFile = { ...mockFile, status: 'uploaded' };

      // Mock many calls before completion
      mockOpenAIClient.files.retrieve
        .mockResolvedValueOnce(uploadedFile)
        .mockResolvedValueOnce(uploadedFile)
        .mockResolvedValueOnce(uploadedFile)
        .mockResolvedValueOnce(uploadedFile)
        .mockResolvedValueOnce(mockProcessedFile);

      const result = await service.waitForProcessing('file-abc123xyz789', {
        pollInterval: 100,
        maxWait: 60000,
      });

      expect(result.status).toBe('processed');
      expect(mockOpenAIClient.files.retrieve).toHaveBeenCalled();
    }, 60000);
  });

  describe('extractFileMetadata', () => {
    it('should extract all metadata fields', () => {
      const metadata = service.extractFileMetadata(mockFile);

      expect(metadata).toEqual({
        id: 'file-abc123xyz789',
        object: 'file',
        bytes: 1024,
        created_at: 1234567890,
        filename: 'test-document.pdf',
        purpose: 'assistants',
        status: 'uploaded',
        status_details: null,
        expires_at: null,
      });
    });

    it('should extract processed file metadata', () => {
      const metadata = service.extractFileMetadata(mockProcessedFile);

      expect(metadata.status).toBe('processed');
    });

    it('should extract error file metadata with details', () => {
      const metadata = service.extractFileMetadata(mockErrorFile);

      expect(metadata.status).toBe('error');
      expect(metadata.status_details).toBe('Processing failed: invalid format');
    });

    it('should extract file with expiration', () => {
      const metadata = service.extractFileMetadata(mockFileWithExpiration);

      expect(metadata.expires_at).toBe(1234654290);
    });

    it('should extract vision file metadata', () => {
      const visionFile = { ...mockFile, purpose: 'vision' };
      const metadata = service.extractFileMetadata(visionFile);

      expect(metadata.purpose).toBe('vision');
    });

    it('should extract batch file metadata', () => {
      const batchFile = { ...mockFile, purpose: 'batch' };
      const metadata = service.extractFileMetadata(batchFile);

      expect(metadata.purpose).toBe('batch');
    });

    it('should extract fine-tune file metadata', () => {
      const fineTuneFile = { ...mockFile, purpose: 'fine-tune' };
      const metadata = service.extractFileMetadata(fineTuneFile);

      expect(metadata.purpose).toBe('fine-tune');
    });

    it('should handle file with large size', () => {
      const largeFile = { ...mockFile, bytes: 500 * 1024 * 1024 }; // 500 MB
      const metadata = service.extractFileMetadata(largeFile);

      expect(metadata.bytes).toBe(500 * 1024 * 1024);
    });
  });
});
