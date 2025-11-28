import { Test, TestingModule } from '@nestjs/testing';
import { ImagesController } from './images.controller';
import { OpenAIImagesService } from '../services/openai-images.service';
import { LoggerService } from '../../common/services/logger.service';
import { PricingService } from '../../common/services/pricing.service';
import type {
  CreateImagesDto,
  EditImageDto,
  ImageVariationDto,
} from '../dto/images';
import type { ImagesResponse } from '../interfaces/images';
import type { Readable } from 'stream';

describe('ImagesController', () => {
  let controller: ImagesController;
  let generateImagesSpy: jest.Mock;
  let editImageSpy: jest.Mock;
  let createImageVariationSpy: jest.Mock;

  const mockImageResponse: ImagesResponse = {
    created: 1234567890,
    data: [
      {
        url: 'https://oaidalleapiprodscus.blob.core.windows.net/test-image.png',
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
    ],
  };

  const mockMulterFile: Express.Multer.File = {
    fieldname: 'image',
    originalname: 'test-image.png',
    encoding: '7bit',
    mimetype: 'image/png',
    buffer: Buffer.from('mock image data'),
    size: 1024,
    stream: null as unknown as Readable,
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
    stream: null as unknown as Readable,
    destination: '',
    filename: '',
    path: '',
  };

  let mockImagesService: jest.Mocked<OpenAIImagesService>;

  beforeEach(async () => {
    generateImagesSpy = jest.fn();
    editImageSpy = jest.fn();
    createImageVariationSpy = jest.fn();

    mockImagesService = {
      generateImages: generateImagesSpy,
      editImage: editImageSpy,
      createImageVariation: createImageVariationSpy,
    } as unknown as jest.Mocked<OpenAIImagesService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImagesController],
      providers: [
        {
          provide: OpenAIImagesService,
          useValue: mockImagesService,
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

    controller = module.get<ImagesController>(ImagesController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generateImages', () => {
    it('should generate images with minimal parameters', async () => {
      mockImagesService.generateImages.mockResolvedValue(mockImageResponse);

      const dto: CreateImagesDto = {
        prompt: 'A cute baby sea otter',
      };

      const result = await controller.generateImages(dto);

      expect(result).toEqual(mockImageResponse);
      expect(generateImagesSpy).toHaveBeenCalledWith(dto);
      expect(generateImagesSpy).toHaveBeenCalledTimes(1);
    });

    it('should generate images with DALL-E 3 parameters', async () => {
      mockImagesService.generateImages.mockResolvedValue(mockImageResponse);

      const dto: CreateImagesDto = {
        model: 'dall-e-3',
        prompt: 'A serene mountain landscape',
        size: '1792x1024',
        quality: 'hd',
        style: 'natural',
      };

      const result = await controller.generateImages(dto);

      expect(result).toEqual(mockImageResponse);
      expect(generateImagesSpy).toHaveBeenCalledWith(dto);
    });

    it('should generate multiple images with DALL-E 2', async () => {
      mockImagesService.generateImages.mockResolvedValue(
        mockMultipleImagesResponse,
      );

      const dto: CreateImagesDto = {
        model: 'dall-e-2',
        prompt: 'Abstract art',
        n: 2,
        size: '512x512',
      };

      const result = await controller.generateImages(dto);

      expect(result).toEqual(mockMultipleImagesResponse);
      expect(generateImagesSpy).toHaveBeenCalledWith(dto);
    });

    it('should generate images in base64 format', async () => {
      mockImagesService.generateImages.mockResolvedValue({
        created: 1234567890,
        data: [{ b64_json: 'base64data...' }],
      });

      const dto: CreateImagesDto = {
        prompt: 'A sunset',
        response_format: 'b64_json',
      };

      const result = await controller.generateImages(dto);

      expect(result.data![0]).toHaveProperty('b64_json');
      expect(generateImagesSpy).toHaveBeenCalledWith(dto);
    });

    it('should pass user parameter to service', async () => {
      mockImagesService.generateImages.mockResolvedValue(mockImageResponse);

      const dto: CreateImagesDto = {
        prompt: 'Test',
        user: 'user-123',
      };

      await controller.generateImages(dto);

      expect(generateImagesSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          user: 'user-123',
        }),
      );
    });

    it('should handle service errors', async () => {
      const error = new Error('Invalid prompt');
      mockImagesService.generateImages.mockRejectedValue(error);

      const dto: CreateImagesDto = {
        prompt: 'Test',
      };

      await expect(controller.generateImages(dto)).rejects.toThrow(error);
      expect(generateImagesSpy).toHaveBeenCalledWith(dto);
    });
  });

  describe('editImage', () => {
    it('should edit image without mask', async () => {
      mockImagesService.editImage.mockResolvedValue(mockImageResponse);

      const dto: EditImageDto = {
        prompt: 'Add a red door',
      };

      const files: {
        image?: Express.Multer.File[];
        mask?: Express.Multer.File[];
      } = {
        image: [mockMulterFile],
      };

      const result = await controller.editImage(files, dto);

      expect(result).toEqual(mockImageResponse);
      expect(editImageSpy).toHaveBeenCalledWith(mockMulterFile, undefined, dto);
    });

    it('should edit image with mask', async () => {
      mockImagesService.editImage.mockResolvedValue(mockImageResponse);

      const dto: EditImageDto = {
        prompt: 'Change the sky',
      };

      const files: {
        image?: Express.Multer.File[];
        mask?: Express.Multer.File[];
      } = {
        image: [mockMulterFile],
        mask: [mockMaskFile],
      };

      const result = await controller.editImage(files, dto);

      expect(result).toEqual(mockImageResponse);
      expect(editImageSpy).toHaveBeenCalledWith(
        mockMulterFile,
        mockMaskFile,
        dto,
      );
    });

    it('should edit image with all parameters', async () => {
      mockImagesService.editImage.mockResolvedValue(mockMultipleImagesResponse);

      const dto: EditImageDto = {
        prompt: 'Add a rainbow',
        model: 'dall-e-2',
        n: 2,
        size: '1024x1024',
        response_format: 'url',
        user: 'user-456',
      };

      const files: {
        image?: Express.Multer.File[];
        mask?: Express.Multer.File[];
      } = {
        image: [mockMulterFile],
      };

      const result = await controller.editImage(files, dto);

      expect(result).toEqual(mockMultipleImagesResponse);
      expect(editImageSpy).toHaveBeenCalledWith(mockMulterFile, undefined, dto);
    });

    it('should throw error when image is missing', async () => {
      const dto: EditImageDto = {
        prompt: 'Test',
      };

      const files: {
        image?: Express.Multer.File[];
        mask?: Express.Multer.File[];
      } = {};

      await expect(controller.editImage(files, dto)).rejects.toThrow(
        'Image file is required',
      );
      expect(editImageSpy).not.toHaveBeenCalled();
    });

    it('should throw error when image array is empty', async () => {
      const dto: EditImageDto = {
        prompt: 'Test',
      };

      const files: {
        image?: Express.Multer.File[];
        mask?: Express.Multer.File[];
      } = {
        image: [],
      };

      await expect(controller.editImage(files, dto)).rejects.toThrow(
        'Image file is required',
      );
      expect(editImageSpy).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const error = new Error('Invalid image format');
      mockImagesService.editImage.mockRejectedValue(error);

      const dto: EditImageDto = {
        prompt: 'Test',
      };

      const files: {
        image?: Express.Multer.File[];
        mask?: Express.Multer.File[];
      } = {
        image: [mockMulterFile],
      };

      await expect(controller.editImage(files, dto)).rejects.toThrow(error);
      expect(editImageSpy).toHaveBeenCalled();
    });
  });

  describe('createImageVariation', () => {
    it('should create variation with minimal parameters', async () => {
      mockImagesService.createImageVariation.mockResolvedValue(
        mockImageResponse,
      );

      const dto: ImageVariationDto = {};

      const result = await controller.createImageVariation(mockMulterFile, dto);

      expect(result).toEqual(mockImageResponse);
      expect(createImageVariationSpy).toHaveBeenCalledWith(mockMulterFile, dto);
    });

    it('should create multiple variations', async () => {
      mockImagesService.createImageVariation.mockResolvedValue(
        mockMultipleImagesResponse,
      );

      const dto: ImageVariationDto = {
        n: 2,
        size: '1024x1024',
      };

      const result = await controller.createImageVariation(mockMulterFile, dto);

      expect(result).toEqual(mockMultipleImagesResponse);
      expect(createImageVariationSpy).toHaveBeenCalledWith(mockMulterFile, dto);
    });

    it('should create variation with all parameters', async () => {
      mockImagesService.createImageVariation.mockResolvedValue(
        mockImageResponse,
      );

      const dto: ImageVariationDto = {
        model: 'dall-e-2',
        n: 1,
        size: '512x512',
        response_format: 'b64_json',
        user: 'user-789',
      };

      const result = await controller.createImageVariation(mockMulterFile, dto);

      expect(result).toEqual(mockImageResponse);
      expect(createImageVariationSpy).toHaveBeenCalledWith(mockMulterFile, dto);
    });

    it('should handle service errors', async () => {
      const error = new Error('Image must be square');
      mockImagesService.createImageVariation.mockRejectedValue(error);

      const dto: ImageVariationDto = {};

      await expect(
        controller.createImageVariation(mockMulterFile, dto),
      ).rejects.toThrow(error);
      expect(createImageVariationSpy).toHaveBeenCalled();
    });
  });
});
