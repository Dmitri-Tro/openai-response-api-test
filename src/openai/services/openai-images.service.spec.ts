import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OpenAIImagesService } from './openai-images.service';
import { LoggerService } from '../../common/services/logger.service';
import type { ImagesResponse } from '../interfaces/images';
import type {
  CreateImagesDto,
  EditImageDto,
  ImageVariationDto,
} from '../dto/images';

// Mock OpenAI client
const mockOpenAIClient = {
  images: {
    generate: jest.fn(),
    edit: jest.fn(),
    createVariation: jest.fn(),
  },
};

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => mockOpenAIClient),
    toFile: jest.fn((buffer, filename, options) =>
      Promise.resolve({
        name: filename,
        type: options?.type || 'application/octet-stream',
        size: buffer.length,
      }),
    ),
  };
});

describe('OpenAIImagesService', () => {
  let service: OpenAIImagesService;
  let configService: ConfigService;
  let loggerService: LoggerService;

  const mockImageResponse: ImagesResponse = {
    created: 1234567890,
    data: [
      {
        url: 'https://oaidalleapiprodscus.blob.core.windows.net/test-image.png',
      },
    ],
  };

  const mockImageResponseWithRevised: ImagesResponse = {
    created: 1234567890,
    data: [
      {
        url: 'https://oaidalleapiprodscus.blob.core.windows.net/test-image.png',
        revised_prompt:
          'A detailed serene mountain landscape with enhanced details',
      },
    ],
  };

  const mockBase64Response: ImagesResponse = {
    created: 1234567890,
    data: [
      {
        b64_json: 'iVBORw0KGgoAAAANSUhEUgAAAAUA...',
      },
    ],
  };

  const mockMultipleImagesResponse: ImagesResponse = {
    created: 1234567890,
    data: [
      {
        url: 'https://oaidalleapiprodscus.blob.core.windows.net/image1.png',
      },
      {
        url: 'https://oaidalleapiprodscus.blob.core.windows.net/image2.png',
      },
      {
        url: 'https://oaidalleapiprodscus.blob.core.windows.net/image3.png',
      },
    ],
  };

  const mockMulterFile: Express.Multer.File = {
    fieldname: 'image',
    originalname: 'test-image.png',
    encoding: '7bit',
    mimetype: 'image/png',
    buffer: Buffer.from('mock image data'),
    size: 1024,
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
  };

  const mockMaskFile: Express.Multer.File = {
    fieldname: 'mask',
    originalname: 'test-mask.png',
    encoding: '7bit',
    mimetype: 'image/png',
    buffer: Buffer.from('mock mask data'),
    size: 512,
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenAIImagesService,
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

    service = module.get<OpenAIImagesService>(OpenAIImagesService);
    configService = module.get<ConfigService>(ConfigService);
    loggerService = module.get<LoggerService>(LoggerService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateImages', () => {
    it('should generate images with DALL-E 2 default parameters', async () => {
      mockOpenAIClient.images.generate.mockResolvedValue(mockImageResponse);

      const dto: CreateImagesDto = {
        prompt: 'A cute baby sea otter',
      };

      const result = await service.generateImages(dto);

      expect(result).toEqual(mockImageResponse);
      expect(mockOpenAIClient.images.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'A cute baby sea otter',
        }),
      );
      expect(loggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'images',
          endpoint: '/v1/images/generations',
          request: expect.any(Object),
          response: mockImageResponse,
          metadata: expect.objectContaining({
            latency_ms: expect.any(Number),
            model: 'dall-e-2',
            images_generated: 1,
            cost_estimate: expect.any(Number),
          }),
        }),
      );
    });

    it('should generate images with DALL-E 3', async () => {
      mockOpenAIClient.images.generate.mockResolvedValue(
        mockImageResponseWithRevised,
      );

      const dto: CreateImagesDto = {
        model: 'dall-e-3',
        prompt: 'A serene mountain landscape',
        size: '1792x1024',
        quality: 'hd',
        style: 'natural',
      };

      const result = await service.generateImages(dto);

      expect(result).toEqual(mockImageResponseWithRevised);
      expect(mockOpenAIClient.images.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'dall-e-3',
          prompt: 'A serene mountain landscape',
          size: '1792x1024',
          quality: 'hd',
          style: 'natural',
        }),
      );
      expect(loggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            has_revised_prompt: true,
          }),
        }),
      );
    });

    it('should generate multiple images with DALL-E 2', async () => {
      mockOpenAIClient.images.generate.mockResolvedValue(
        mockMultipleImagesResponse,
      );

      const dto: CreateImagesDto = {
        model: 'dall-e-2',
        prompt: 'Abstract art',
        n: 3,
        size: '512x512',
      };

      const result = await service.generateImages(dto);

      expect(result).toEqual(mockMultipleImagesResponse);
      expect(result.data).toHaveLength(3);
      expect(loggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            images_generated: 3,
          }),
        }),
      );
    });

    it('should generate images in base64 format', async () => {
      mockOpenAIClient.images.generate.mockResolvedValue(mockBase64Response);

      const dto: CreateImagesDto = {
        prompt: 'A sunset',
        response_format: 'b64_json',
      };

      const result = await service.generateImages(dto);

      expect(result).toEqual(mockBase64Response);
      expect(mockOpenAIClient.images.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          response_format: 'b64_json',
        }),
      );
    });

    it('should include user parameter when provided', async () => {
      mockOpenAIClient.images.generate.mockResolvedValue(mockImageResponse);

      const dto: CreateImagesDto = {
        prompt: 'Test prompt',
        user: 'user-123',
      };

      await service.generateImages(dto);

      expect(mockOpenAIClient.images.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          user: 'user-123',
        }),
      );
    });

    it('should handle errors and log them', async () => {
      const error = new Error('API rate limit exceeded');
      mockOpenAIClient.images.generate.mockRejectedValue(error);

      const dto: CreateImagesDto = {
        prompt: 'Test prompt',
      };

      await expect(service.generateImages(dto)).rejects.toThrow(error);

      expect(loggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'images',
          endpoint: '/v1/images/generations',
          error: expect.objectContaining({
            message: 'API rate limit exceeded',
          }),
          metadata: expect.objectContaining({
            latency_ms: expect.any(Number),
          }),
        }),
      );
    });
  });

  describe('editImage', () => {
    it('should edit image with prompt', async () => {
      mockOpenAIClient.images.edit.mockResolvedValue(mockImageResponse);

      const dto: EditImageDto = {
        prompt: 'Add a red door',
      };

      const result = await service.editImage(mockMulterFile, undefined, dto);

      expect(result).toEqual(mockImageResponse);
      expect(mockOpenAIClient.images.edit).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Add a red door',
        }),
      );
      expect(loggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'images',
          endpoint: '/v1/images/edits',
          request: expect.objectContaining({
            prompt: 'Add a red door',
            has_mask: false,
            image_size_bytes: mockMulterFile.size,
          }),
        }),
      );
    });

    it('should edit image with mask', async () => {
      mockOpenAIClient.images.edit.mockResolvedValue(mockImageResponse);

      const dto: EditImageDto = {
        prompt: 'Change the sky to sunset colors',
      };

      const result = await service.editImage(mockMulterFile, mockMaskFile, dto);

      expect(result).toEqual(mockImageResponse);
      expect(loggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          request: expect.objectContaining({
            has_mask: true,
            mask_size_bytes: mockMaskFile.size,
          }),
        }),
      );
    });

    it('should edit image with all parameters', async () => {
      mockOpenAIClient.images.edit.mockResolvedValue(
        mockMultipleImagesResponse,
      );

      const dto: EditImageDto = {
        prompt: 'Add a rainbow',
        model: 'dall-e-2',
        n: 3,
        size: '1024x1024',
        response_format: 'url',
        user: 'user-456',
      };

      const result = await service.editImage(mockMulterFile, undefined, dto);

      expect(result).toEqual(mockMultipleImagesResponse);
      expect(mockOpenAIClient.images.edit).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Add a rainbow',
          model: 'dall-e-2',
          n: 3,
          size: '1024x1024',
          response_format: 'url',
          user: 'user-456',
        }),
      );
    });

    it('should handle edit errors', async () => {
      const error = new Error('Invalid image format');
      mockOpenAIClient.images.edit.mockRejectedValue(error);

      const dto: EditImageDto = {
        prompt: 'Test edit',
      };

      await expect(
        service.editImage(mockMulterFile, undefined, dto),
      ).rejects.toThrow(error);

      expect(loggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Invalid image format',
          }),
        }),
      );
    });
  });

  describe('createImageVariation', () => {
    it('should create image variation with default parameters', async () => {
      mockOpenAIClient.images.createVariation.mockResolvedValue(
        mockImageResponse,
      );

      const dto: ImageVariationDto = {};

      const result = await service.createImageVariation(mockMulterFile, dto);

      expect(result).toEqual(mockImageResponse);
      expect(mockOpenAIClient.images.createVariation).toHaveBeenCalled();
      expect(loggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'images',
          endpoint: '/v1/images/variations',
          request: expect.objectContaining({
            image_size_bytes: mockMulterFile.size,
          }),
        }),
      );
    });

    it('should create multiple image variations', async () => {
      mockOpenAIClient.images.createVariation.mockResolvedValue(
        mockMultipleImagesResponse,
      );

      const dto: ImageVariationDto = {
        n: 3,
        size: '1024x1024',
      };

      const result = await service.createImageVariation(mockMulterFile, dto);

      expect(result).toEqual(mockMultipleImagesResponse);
      expect(result.data).toHaveLength(3);
      expect(mockOpenAIClient.images.createVariation).toHaveBeenCalledWith(
        expect.objectContaining({
          n: 3,
          size: '1024x1024',
        }),
      );
    });

    it('should create variations with all parameters', async () => {
      mockOpenAIClient.images.createVariation.mockResolvedValue(
        mockBase64Response,
      );

      const dto: ImageVariationDto = {
        model: 'dall-e-2',
        n: 1,
        size: '512x512',
        response_format: 'b64_json',
        user: 'user-789',
      };

      const result = await service.createImageVariation(mockMulterFile, dto);

      expect(result).toEqual(mockBase64Response);
      expect(mockOpenAIClient.images.createVariation).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'dall-e-2',
          n: 1,
          size: '512x512',
          response_format: 'b64_json',
          user: 'user-789',
        }),
      );
    });

    it('should handle variation errors', async () => {
      const error = new Error('Image must be square');
      mockOpenAIClient.images.createVariation.mockRejectedValue(error);

      const dto: ImageVariationDto = {};

      await expect(
        service.createImageVariation(mockMulterFile, dto),
      ).rejects.toThrow(error);

      expect(loggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Image must be square',
          }),
        }),
      );
    });
  });

  describe('extractImageUrls', () => {
    it('should extract URLs from response with URLs', () => {
      const urls = service.extractImageUrls(mockMultipleImagesResponse);

      expect(urls).toHaveLength(3);
      expect(urls).toEqual([
        'https://oaidalleapiprodscus.blob.core.windows.net/image1.png',
        'https://oaidalleapiprodscus.blob.core.windows.net/image2.png',
        'https://oaidalleapiprodscus.blob.core.windows.net/image3.png',
      ]);
    });

    it('should return empty array for base64 response', () => {
      const urls = service.extractImageUrls(mockBase64Response);

      expect(urls).toEqual([]);
    });

    it('should return empty array when no data', () => {
      const emptyResponse: ImagesResponse = {
        created: 1234567890,
        data: [],
      };

      const urls = service.extractImageUrls(emptyResponse);

      expect(urls).toEqual([]);
    });
  });

  describe('extractBase64Images', () => {
    it('should extract base64 data from response', () => {
      const base64Images = service.extractBase64Images(mockBase64Response);

      expect(base64Images).toHaveLength(1);
      expect(base64Images[0]).toBe('iVBORw0KGgoAAAANSUhEUgAAAAUA...');
    });

    it('should return empty array for URL response', () => {
      const base64Images = service.extractBase64Images(mockImageResponse);

      expect(base64Images).toEqual([]);
    });

    it('should return empty array when no data', () => {
      const emptyResponse: ImagesResponse = {
        created: 1234567890,
        data: [],
      };

      const base64Images = service.extractBase64Images(emptyResponse);

      expect(base64Images).toEqual([]);
    });
  });

  describe('estimateImageCost', () => {
    describe('DALL-E 3 pricing', () => {
      it('should calculate standard 1024x1024 cost', () => {
        const cost = service.estimateImageCost('dall-e-3', '1024x1024');
        expect(cost).toBe(0.04);
      });

      it('should calculate HD 1024x1024 cost', () => {
        const cost = service.estimateImageCost('dall-e-3', '1024x1024', 'hd');
        expect(cost).toBe(0.08);
      });

      it('should calculate HD 1792x1024 cost', () => {
        const cost = service.estimateImageCost('dall-e-3', '1792x1024', 'hd');
        expect(cost).toBe(0.12);
      });

      it('should calculate HD 1024x1792 cost', () => {
        const cost = service.estimateImageCost('dall-e-3', '1024x1792', 'hd');
        expect(cost).toBe(0.12);
      });

      it('should use default price for unknown size with HD', () => {
        const cost = service.estimateImageCost('dall-e-3', '2048x2048', 'hd');
        expect(cost).toBe(0.08);
      });
    });

    describe('DALL-E 2 pricing', () => {
      it('should calculate 1024x1024 cost', () => {
        const cost = service.estimateImageCost('dall-e-2', '1024x1024');
        expect(cost).toBe(0.02);
      });

      it('should calculate 512x512 cost', () => {
        const cost = service.estimateImageCost('dall-e-2', '512x512');
        expect(cost).toBe(0.018);
      });

      it('should calculate 256x256 cost', () => {
        const cost = service.estimateImageCost('dall-e-2', '256x256');
        expect(cost).toBe(0.016);
      });

      it('should use default price for unknown size', () => {
        const cost = service.estimateImageCost('dall-e-2', '128x128');
        expect(cost).toBe(0.02);
      });
    });

    describe('Multiple images', () => {
      it('should calculate cost for multiple DALL-E 2 images', () => {
        const cost = service.estimateImageCost(
          'dall-e-2',
          '512x512',
          undefined,
          5,
        );
        expect(cost).toBe(0.09); // 0.018 * 5
      });

      it('should calculate cost for multiple DALL-E 3 images', () => {
        const cost = service.estimateImageCost(
          'dall-e-3',
          '1024x1024',
          'hd',
          1,
        );
        expect(cost).toBe(0.08);
      });

      it('should handle default n=1', () => {
        const cost = service.estimateImageCost('dall-e-2', '1024x1024');
        expect(cost).toBe(0.02);
      });
    });

    describe('Unknown model', () => {
      it('should use DALL-E 2 default for unknown model', () => {
        const cost = service.estimateImageCost('unknown-model', '1024x1024');
        expect(cost).toBe(0.02);
      });
    });
  });
});
