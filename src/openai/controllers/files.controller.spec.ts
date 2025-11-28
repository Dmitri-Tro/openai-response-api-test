import { Test, TestingModule } from '@nestjs/testing';
import { FilesController } from './files.controller';
import { OpenAIFilesService } from '../services/openai-files.service';
import { CreateFileDto } from '../dto/create-file.dto';
import { ListFilesDto } from '../dto/list-files.dto';
import { LoggerService } from '../../common/services/logger.service';
import { PricingService } from '../../common/services/pricing.service';
import type { Files } from 'openai/resources/files';
import type { Response } from 'express';

/**
 * Multer file type definition
 * Represents uploaded file from multipart/form-data requests
 */
interface MulterFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

describe('FilesController', () => {
  let controller: FilesController;

  // Spy variables for proper type checking
  let uploadFileSpy: jest.Mock;
  let retrieveFileSpy: jest.Mock;
  let listFilesSpy: jest.Mock;
  let deleteFileSpy: jest.Mock;
  let downloadFileContentSpy: jest.Mock;
  let pollUntilCompleteSpy: jest.Mock;

  const mockFile: Files.FileObject = {
    id: 'file-abc123xyz789',
    object: 'file',
    bytes: 1024,
    created_at: 1234567890,
    filename: 'test-document.pdf',
    purpose: 'assistants',
    status: 'uploaded',
  };

  const mockProcessedFile: Files.FileObject = {
    ...mockFile,
    status: 'processed',
  };

  const mockFileWithExpiration: Files.FileObject = {
    ...mockFile,
    expires_at: 1234654290,
  };

  const mockDeleteResponse: Files.FileDeleted = {
    id: 'file-abc123xyz789',
    object: 'file',
    deleted: true,
  };

  let mockFilesService: {
    uploadFile: jest.Mock;
    retrieveFile: jest.Mock;
    listFiles: jest.Mock;
    deleteFile: jest.Mock;
    downloadFileContent: jest.Mock;
    pollUntilComplete: jest.Mock;
  };

  beforeEach(async () => {
    // Create spy functions
    uploadFileSpy = jest.fn();
    retrieveFileSpy = jest.fn();
    listFilesSpy = jest.fn();
    deleteFileSpy = jest.fn();
    downloadFileContentSpy = jest.fn();
    pollUntilCompleteSpy = jest.fn();

    mockFilesService = {
      uploadFile: uploadFileSpy,
      retrieveFile: retrieveFileSpy,
      listFiles: listFilesSpy,
      deleteFile: deleteFileSpy,
      downloadFileContent: downloadFileContentSpy,
      pollUntilComplete: pollUntilCompleteSpy,
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        {
          provide: OpenAIFilesService,
          useValue: mockFilesService,
        },
        {
          provide: LoggerService,
          useValue: {
            logOpenAIInteraction: jest.fn(),
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

    controller = module.get<FilesController>(FilesController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadFile', () => {
    const fileBuffer = Buffer.from('test file content');
    const multerFile: MulterFile = {
      buffer: fileBuffer,
      originalname: 'test-document.pdf',
      mimetype: 'application/pdf',
      size: 1024,
    };

    it('should upload file with all parameters', async () => {
      mockFilesService.uploadFile.mockResolvedValue(mockFileWithExpiration);

      const dto: CreateFileDto = {
        purpose: 'assistants',
        expires_after: {
          anchor: 'created_at',
          seconds: 86400,
        },
      };

      const result = await controller.uploadFile(
        multerFile as Express.Multer.File,
        dto,
      );

      expect(uploadFileSpy).toHaveBeenCalledWith(
        fileBuffer,
        'test-document.pdf',
        'assistants',
        dto.expires_after,
      );
      expect(result).toEqual(mockFileWithExpiration);
    });

    it('should upload file with only required parameters', async () => {
      mockFilesService.uploadFile.mockResolvedValue(mockFile);

      const dto: CreateFileDto = {
        purpose: 'assistants',
      };

      const result = await controller.uploadFile(
        multerFile as Express.Multer.File,
        dto,
      );

      expect(uploadFileSpy).toHaveBeenCalledWith(
        fileBuffer,
        'test-document.pdf',
        'assistants',
        undefined,
      );
      expect(result).toEqual(mockFile);
    });

    it('should upload file for vision purpose', async () => {
      const visionFile = { ...mockFile, purpose: 'vision' };
      mockFilesService.uploadFile.mockResolvedValue(visionFile);

      const dto: CreateFileDto = {
        purpose: 'vision',
      };

      await controller.uploadFile(multerFile as Express.Multer.File, dto);

      expect(uploadFileSpy).toHaveBeenCalledWith(
        fileBuffer,
        'test-document.pdf',
        'vision',
        undefined,
      );
    });

    it('should upload file for batch purpose', async () => {
      const batchFile = { ...mockFile, purpose: 'batch' };
      mockFilesService.uploadFile.mockResolvedValue(batchFile);

      const dto: CreateFileDto = {
        purpose: 'batch',
      };

      await controller.uploadFile(multerFile as Express.Multer.File, dto);

      expect(uploadFileSpy).toHaveBeenCalledWith(
        fileBuffer,
        'test-document.pdf',
        'batch',
        undefined,
      );
    });

    it('should upload file for fine-tune purpose', async () => {
      const fineTuneFile = { ...mockFile, purpose: 'fine-tune' };
      mockFilesService.uploadFile.mockResolvedValue(fineTuneFile);

      const dto: CreateFileDto = {
        purpose: 'fine-tune',
      };

      await controller.uploadFile(multerFile as Express.Multer.File, dto);

      expect(uploadFileSpy).toHaveBeenCalledWith(
        fileBuffer,
        'test-document.pdf',
        'fine-tune',
        undefined,
      );
    });

    it('should return file with uploaded status', async () => {
      mockFilesService.uploadFile.mockResolvedValue(mockFile);

      const result = await controller.uploadFile(
        multerFile as Express.Multer.File,
        {
          purpose: 'assistants',
        },
      );

      expect(result.status).toBe('uploaded');
      expect(result.id).toBe('file-abc123xyz789');
    });

    it('should throw error on API failure', async () => {
      const error = new Error('File upload failed');
      mockFilesService.uploadFile.mockRejectedValue(error);

      await expect(
        controller.uploadFile(multerFile as Express.Multer.File, {
          purpose: 'assistants',
        }),
      ).rejects.toThrow('File upload failed');
    });

    it('should handle large file upload', async () => {
      const largeMulterFile: MulterFile = {
        buffer: Buffer.alloc(100 * 1024 * 1024),
        originalname: 'large-file.pdf',
        mimetype: 'application/pdf',
        size: 100 * 1024 * 1024,
      };

      const largeFile = { ...mockFile, bytes: 100 * 1024 * 1024 };
      mockFilesService.uploadFile.mockResolvedValue(largeFile);

      const result = await controller.uploadFile(
        largeMulterFile as Express.Multer.File,
        {
          purpose: 'assistants',
        },
      );

      expect(result.bytes).toBe(100 * 1024 * 1024);
    });

    it('should handle file with special characters in name', async () => {
      const specialMulterFile: MulterFile = {
        ...multerFile,
        originalname: 'file (1) [copy].pdf',
      };

      mockFilesService.uploadFile.mockResolvedValue({
        ...mockFile,
        filename: 'file (1) [copy].pdf',
      });

      await controller.uploadFile(specialMulterFile as Express.Multer.File, {
        purpose: 'assistants',
      });

      expect(uploadFileSpy).toHaveBeenCalledWith(
        expect.any(Buffer),
        'file (1) [copy].pdf',
        'assistants',
        undefined,
      );
    });

    it('should throw error for file too large', async () => {
      const error = new Error('File exceeds maximum size limit');
      mockFilesService.uploadFile.mockRejectedValue(error);

      await expect(
        controller.uploadFile(multerFile as Express.Multer.File, {
          purpose: 'assistants',
        }),
      ).rejects.toThrow('File exceeds maximum size limit');
    });

    it('should throw error for invalid file format', async () => {
      const error = new Error('Unsupported file format');
      mockFilesService.uploadFile.mockRejectedValue(error);

      await expect(
        controller.uploadFile(multerFile as Express.Multer.File, {
          purpose: 'assistants',
        }),
      ).rejects.toThrow('Unsupported file format');
    });
  });

  describe('listFiles', () => {
    it('should list files with default parameters', async () => {
      mockFilesService.listFiles.mockResolvedValue([
        mockFile,
        mockProcessedFile,
      ]);

      const query: ListFilesDto = {};
      const result = await controller.listFiles(query);

      expect(listFilesSpy).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
      );
      expect(result).toEqual([mockFile, mockProcessedFile]);
      expect(result).toHaveLength(2);
    });

    it('should list files with purpose filter', async () => {
      mockFilesService.listFiles.mockResolvedValue([mockFile]);

      const query: ListFilesDto = { purpose: 'assistants' };
      const result = await controller.listFiles(query);

      expect(listFilesSpy).toHaveBeenCalledWith(
        'assistants',
        undefined,
        undefined,
      );
      expect(result).toHaveLength(1);
    });

    it('should list files in ascending order', async () => {
      mockFilesService.listFiles.mockResolvedValue([
        mockFile,
        mockProcessedFile,
      ]);

      const query: ListFilesDto = { order: 'asc' };
      const result = await controller.listFiles(query);

      expect(listFilesSpy).toHaveBeenCalledWith(undefined, 'asc', undefined);
      expect(result).toEqual([mockFile, mockProcessedFile]);
    });

    it('should list files in descending order', async () => {
      mockFilesService.listFiles.mockResolvedValue([
        mockProcessedFile,
        mockFile,
      ]);

      const query: ListFilesDto = { order: 'desc' };
      const result = await controller.listFiles(query);

      expect(listFilesSpy).toHaveBeenCalledWith(undefined, 'desc', undefined);
      expect(result).toEqual([mockProcessedFile, mockFile]);
    });

    it('should list files with custom limit', async () => {
      mockFilesService.listFiles.mockResolvedValue([mockFile]);

      const query: ListFilesDto = { limit: 1 };
      const result = await controller.listFiles(query);

      expect(listFilesSpy).toHaveBeenCalledWith(undefined, undefined, 1);
      expect(result).toHaveLength(1);
    });

    it('should list files with all parameters', async () => {
      mockFilesService.listFiles.mockResolvedValue([mockFile]);

      const query: ListFilesDto = {
        purpose: 'vision',
        order: 'asc',
        limit: 50,
      };

      const result = await controller.listFiles(query);

      expect(listFilesSpy).toHaveBeenCalledWith('vision', 'asc', 50);
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no files', async () => {
      mockFilesService.listFiles.mockResolvedValue([]);

      const result = await controller.listFiles({});

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle large limit', async () => {
      const files = Array(100).fill(mockFile);
      mockFilesService.listFiles.mockResolvedValue(files);

      const result = await controller.listFiles({ limit: 100 });

      expect(result).toHaveLength(100);
    });

    it('should list files filtered by batch purpose', async () => {
      const batchFile = { ...mockFile, purpose: 'batch' };
      mockFilesService.listFiles.mockResolvedValue([batchFile]);

      const result = await controller.listFiles({ purpose: 'batch' });

      expect(result[0].purpose).toBe('batch');
    });

    it('should list files filtered by fine-tune purpose', async () => {
      const fineTuneFile = { ...mockFile, purpose: 'fine-tune' };
      mockFilesService.listFiles.mockResolvedValue([fineTuneFile]);

      const result = await controller.listFiles({ purpose: 'fine-tune' });

      expect(result[0].purpose).toBe('fine-tune');
    });
  });

  describe('getFile', () => {
    it('should get file metadata successfully', async () => {
      mockFilesService.retrieveFile.mockResolvedValue(mockFile);

      const result = await controller.getFile('file-abc123xyz789');

      expect(retrieveFileSpy).toHaveBeenCalledWith('file-abc123xyz789');
      expect(result).toEqual(mockFile);
    });

    it('should get processed file metadata', async () => {
      mockFilesService.retrieveFile.mockResolvedValue(mockProcessedFile);

      const result = await controller.getFile('file-abc123xyz789');

      expect(result.status).toBe('processed');
    });

    it('should get file with expiration', async () => {
      mockFilesService.retrieveFile.mockResolvedValue(mockFileWithExpiration);

      const result = await controller.getFile('file-abc123xyz789');

      expect(result.expires_at).toBe(1234654290);
    });

    it('should throw error for invalid file ID', async () => {
      const error = new Error('File not found');
      mockFilesService.retrieveFile.mockRejectedValue(error);

      await expect(controller.getFile('invalid-id')).rejects.toThrow(
        'File not found',
      );
    });

    it('should handle file with error status', async () => {
      const errorFile = {
        ...mockFile,
        status: 'error' as const,
        status_details: 'Processing failed',
      };
      mockFilesService.retrieveFile.mockResolvedValue(errorFile);

      const result = await controller.getFile('file-abc123xyz789');

      expect(result.status).toBe('error');
      expect(result.status_details).toBe('Processing failed');
    });
  });

  describe('downloadFile', () => {
    let mockResponse: Partial<Response>;
    let mockOpenAIResponse: Response;

    beforeEach(() => {
      mockResponse = {
        setHeader: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      };

      mockOpenAIResponse = {
        body: {
          getReader: jest.fn().mockReturnValue({
            read: jest
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new Uint8Array([1, 2, 3]),
              })
              .mockResolvedValueOnce({ done: true, value: undefined }),
          }),
        },
      } as unknown as Response;
    });

    it('should download file content successfully', async () => {
      mockFilesService.retrieveFile.mockResolvedValue({
        ...mockFile,
        purpose: 'vision',
      });
      mockFilesService.downloadFileContent.mockResolvedValue(
        mockOpenAIResponse,
      );

      await controller.downloadFile(
        'file-abc123xyz789',
        mockResponse as Response,
      );

      expect(retrieveFileSpy).toHaveBeenCalledWith('file-abc123xyz789');
      expect(downloadFileContentSpy).toHaveBeenCalledWith('file-abc123xyz789');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/pdf',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="test-document.pdf"',
      );
      expect(mockResponse.write).toHaveBeenCalled();
      expect(mockResponse.end).toHaveBeenCalled();
    });

    it('should set correct content type for PDF', async () => {
      mockFilesService.retrieveFile.mockResolvedValue({
        ...mockFile,
        filename: 'document.pdf',
      });
      mockFilesService.downloadFileContent.mockResolvedValue(
        mockOpenAIResponse,
      );

      await controller.downloadFile(
        'file-abc123xyz789',
        mockResponse as Response,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/pdf',
      );
    });

    it('should set correct content type for PNG', async () => {
      mockFilesService.retrieveFile.mockResolvedValue({
        ...mockFile,
        filename: 'image.png',
      });
      mockFilesService.downloadFileContent.mockResolvedValue(
        mockOpenAIResponse,
      );

      await controller.downloadFile(
        'file-abc123xyz789',
        mockResponse as Response,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'image/png',
      );
    });

    it('should set correct content type for JPEG', async () => {
      mockFilesService.retrieveFile.mockResolvedValue({
        ...mockFile,
        filename: 'image.jpg',
      });
      mockFilesService.downloadFileContent.mockResolvedValue(
        mockOpenAIResponse,
      );

      await controller.downloadFile(
        'file-abc123xyz789',
        mockResponse as Response,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'image/jpeg',
      );
    });

    it('should set correct content type for JSON', async () => {
      mockFilesService.retrieveFile.mockResolvedValue({
        ...mockFile,
        filename: 'data.json',
      });
      mockFilesService.downloadFileContent.mockResolvedValue(
        mockOpenAIResponse,
      );

      await controller.downloadFile(
        'file-abc123xyz789',
        mockResponse as Response,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json',
      );
    });

    it('should set correct content type for CSV', async () => {
      mockFilesService.retrieveFile.mockResolvedValue({
        ...mockFile,
        filename: 'data.csv',
      });
      mockFilesService.downloadFileContent.mockResolvedValue(
        mockOpenAIResponse,
      );

      await controller.downloadFile(
        'file-abc123xyz789',
        mockResponse as Response,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv',
      );
    });

    it('should use default content type for unknown extensions', async () => {
      mockFilesService.retrieveFile.mockResolvedValue({
        ...mockFile,
        filename: 'file.unknown',
      });
      mockFilesService.downloadFileContent.mockResolvedValue(
        mockOpenAIResponse,
      );

      await controller.downloadFile(
        'file-abc123xyz789',
        mockResponse as Response,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/octet-stream',
      );
    });

    it('should handle response without body', async () => {
      const emptyResponse = { body: null } as unknown as Response;
      mockFilesService.retrieveFile.mockResolvedValue(mockFile);
      mockFilesService.downloadFileContent.mockResolvedValue(emptyResponse);

      await controller.downloadFile(
        'file-abc123xyz789',
        mockResponse as Response,
      );

      expect(mockResponse.end).toHaveBeenCalled();
    });

    it('should throw error for assistants purpose file', async () => {
      const error = new Error(
        'Files with purpose "assistants" cannot be downloaded',
      );
      mockFilesService.retrieveFile.mockResolvedValue(mockFile);
      mockFilesService.downloadFileContent.mockRejectedValue(error);

      await expect(
        controller.downloadFile('file-abc123xyz789', mockResponse as Response),
      ).rejects.toThrow('Files with purpose "assistants" cannot be downloaded');
    });

    it('should throw error for file not found', async () => {
      const error = new Error('File not found');
      mockFilesService.retrieveFile.mockRejectedValue(error);

      await expect(
        controller.downloadFile('invalid-id', mockResponse as Response),
      ).rejects.toThrow('File not found');
    });

    it('should handle file with special characters in name', async () => {
      mockFilesService.retrieveFile.mockResolvedValue({
        ...mockFile,
        filename: 'file (1) [copy].pdf',
      });
      mockFilesService.downloadFileContent.mockResolvedValue(
        mockOpenAIResponse,
      );

      await controller.downloadFile(
        'file-abc123xyz789',
        mockResponse as Response,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="file (1) [copy].pdf"',
      );
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      mockFilesService.deleteFile.mockResolvedValue(mockDeleteResponse);

      const result = await controller.deleteFile('file-abc123xyz789');

      expect(deleteFileSpy).toHaveBeenCalledWith('file-abc123xyz789');
      expect(result).toEqual(mockDeleteResponse);
      expect(result.deleted).toBe(true);
    });

    it('should throw error for invalid file ID', async () => {
      const error = new Error('File not found');
      mockFilesService.deleteFile.mockRejectedValue(error);

      await expect(controller.deleteFile('invalid-id')).rejects.toThrow(
        'File not found',
      );
    });

    it('should handle already deleted file', async () => {
      const error = new Error('File already deleted');
      mockFilesService.deleteFile.mockRejectedValue(error);

      await expect(controller.deleteFile('file-abc123xyz789')).rejects.toThrow(
        'File already deleted',
      );
    });

    it('should return deletion confirmation', async () => {
      mockFilesService.deleteFile.mockResolvedValue(mockDeleteResponse);

      const result = await controller.deleteFile('file-abc123xyz789');

      expect(result.id).toBe('file-abc123xyz789');
      expect(result.object).toBe('file');
      expect(result.deleted).toBe(true);
    });

    it('should delete file even if used in processing', async () => {
      mockFilesService.deleteFile.mockResolvedValue(mockDeleteResponse);

      const result = await controller.deleteFile('file-abc123xyz789');

      expect(result.deleted).toBe(true);
    });
  });
});
