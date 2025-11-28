import { Test, TestingModule } from '@nestjs/testing';
import { VideosController } from './videos.controller';
import { OpenAIVideosService } from '../services/openai-videos.service';
import { CreateVideoDto } from '../dto/create-video.dto';
import { LoggerService } from '../../common/services/logger.service';
import { PricingService } from '../../common/services/pricing.service';
import type { Videos } from 'openai/resources/videos';
import type { Response as ExpressResponse } from 'express';

describe('VideosController', () => {
  let controller: VideosController;
  let createVideoSpy: jest.Mock;
  let getVideoStatusSpy: jest.Mock;
  let pollUntilCompleteSpy: jest.Mock;
  let downloadVideoSpy: jest.Mock;
  let listVideosSpy: jest.Mock;
  let deleteVideoSpy: jest.Mock;
  let remixVideoSpy: jest.Mock;

  const mockVideo: Videos.Video = {
    id: 'vid_abc123',
    object: 'video',
    status: 'queued',
    progress: 0,
    model: 'sora-2',
    seconds: '4',
    size: '720x1280',
    prompt: 'A serene lakeside at sunset',
    created_at: 1234567890,
    completed_at: null,
    expires_at: null,
    remixed_from_video_id: null,
    error: null,
  };

  const mockCompletedVideo: Videos.Video = {
    ...mockVideo,
    status: 'completed',
    progress: 100,
    completed_at: 1234567990,
    expires_at: 1234657990,
  };

  const mockDeleteResponse: Videos.VideoDeleteResponse = {
    id: 'vid_abc123',
    object: 'video.deleted',
    deleted: true,
  };

  let mockVideoService: jest.Mocked<OpenAIVideosService>;

  beforeEach(async () => {
    createVideoSpy = jest.fn();
    getVideoStatusSpy = jest.fn();
    pollUntilCompleteSpy = jest.fn();
    downloadVideoSpy = jest.fn();
    listVideosSpy = jest.fn();
    deleteVideoSpy = jest.fn();
    remixVideoSpy = jest.fn();

    mockVideoService = {
      createVideo: createVideoSpy,
      getVideoStatus: getVideoStatusSpy,
      pollUntilComplete: pollUntilCompleteSpy,
      downloadVideo: downloadVideoSpy,
      listVideos: listVideosSpy,
      deleteVideo: deleteVideoSpy,
      remixVideo: remixVideoSpy,
    } as unknown as jest.Mocked<OpenAIVideosService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VideosController],
      providers: [
        {
          provide: OpenAIVideosService,
          useValue: mockVideoService,
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

    controller = module.get<VideosController>(VideosController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createVideo', () => {
    it('should create video with all parameters', async () => {
      mockVideoService.createVideo.mockResolvedValue(mockVideo);

      const dto: CreateVideoDto = {
        prompt: 'A serene lakeside at sunset',
        model: 'sora-2',
        seconds: '4',
        size: '720x1280',
      };

      const result = await controller.createVideo(dto);

      expect(createVideoSpy).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockVideo);
    });

    it('should create video with only prompt', async () => {
      mockVideoService.createVideo.mockResolvedValue(mockVideo);

      const dto: CreateVideoDto = {
        prompt: 'Test prompt',
      };

      const result = await controller.createVideo(dto);

      expect(createVideoSpy).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockVideo);
    });

    it('should return video with queued status', async () => {
      mockVideoService.createVideo.mockResolvedValue(mockVideo);

      const result = await controller.createVideo({ prompt: 'Test' });

      expect(result.status).toBe('queued');
      expect(result.progress).toBe(0);
    });

    it('should throw error on invalid parameters', async () => {
      const error = new Error('Invalid parameters');
      mockVideoService.createVideo.mockRejectedValue(error);

      await expect(controller.createVideo({ prompt: 'Test' })).rejects.toThrow(
        'Invalid parameters',
      );
    });

    it('should throw error on API failure', async () => {
      const error = new Error('API Error');
      mockVideoService.createVideo.mockRejectedValue(error);

      await expect(controller.createVideo({ prompt: 'Test' })).rejects.toThrow(
        'API Error',
      );
    });
  });

  describe('getVideoStatus', () => {
    it('should get video status successfully', async () => {
      mockVideoService.getVideoStatus.mockResolvedValue(mockVideo);

      const result = await controller.getVideoStatus('vid_abc123');

      expect(getVideoStatusSpy).toHaveBeenCalledWith('vid_abc123');
      expect(result).toEqual(mockVideo);
    });

    it('should get completed video status', async () => {
      mockVideoService.getVideoStatus.mockResolvedValue(mockCompletedVideo);

      const result = await controller.getVideoStatus('vid_abc123');

      expect(result.status).toBe('completed');
      expect(result.progress).toBe(100);
    });

    it('should throw error for invalid video ID', async () => {
      const error = new Error('Video not found');
      mockVideoService.getVideoStatus.mockRejectedValue(error);

      await expect(controller.getVideoStatus('invalid_id')).rejects.toThrow(
        'Video not found',
      );
    });

    it('should handle in_progress status', async () => {
      const inProgressVideo: Videos.Video = {
        ...mockVideo,
        status: 'in_progress',
        progress: 50,
      };
      mockVideoService.getVideoStatus.mockResolvedValue(inProgressVideo);

      const result = await controller.getVideoStatus('vid_abc123');

      expect(result.status).toBe('in_progress');
      expect(result.progress).toBe(50);
    });
  });

  describe('pollUntilComplete', () => {
    it('should poll with default maxWaitMs', async () => {
      mockVideoService.pollUntilComplete.mockResolvedValue(mockCompletedVideo);

      const result = await controller.pollUntilComplete(
        'vid_abc123',
        undefined,
      );

      expect(pollUntilCompleteSpy).toHaveBeenCalledWith(
        'vid_abc123',
        undefined,
      );
      expect(result).toEqual(mockCompletedVideo);
    });

    it('should poll with custom maxWaitMs', async () => {
      mockVideoService.pollUntilComplete.mockResolvedValue(mockCompletedVideo);

      const result = await controller.pollUntilComplete('vid_abc123', 300000);

      expect(pollUntilCompleteSpy).toHaveBeenCalledWith('vid_abc123', 300000);
      expect(result).toEqual(mockCompletedVideo);
    });

    it('should return completed video', async () => {
      mockVideoService.pollUntilComplete.mockResolvedValue(mockCompletedVideo);

      const result = await controller.pollUntilComplete('vid_abc123');

      expect(result.status).toBe('completed');
      expect(result.progress).toBe(100);
    });

    it('should return failed video', async () => {
      const failedVideo: Videos.Video = {
        ...mockVideo,
        status: 'failed',
        error: { code: 'error', message: 'Failed' },
      };
      mockVideoService.pollUntilComplete.mockResolvedValue(failedVideo);

      const result = await controller.pollUntilComplete('vid_abc123');

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });

    it('should throw error on timeout', async () => {
      const error = new Error('Timeout exceeded');
      mockVideoService.pollUntilComplete.mockRejectedValue(error);

      await expect(
        controller.pollUntilComplete('vid_abc123', 1000),
      ).rejects.toThrow('Timeout exceeded');
    });
  });

  describe('downloadVideo', () => {
    let mockResponse: Partial<ExpressResponse>;
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

    it('should download video with default variant', async () => {
      mockVideoService.downloadVideo.mockResolvedValue(mockOpenAIResponse);

      await controller.downloadVideo(
        'vid_abc123',
        'video',
        mockResponse as unknown as ExpressResponse,
      );

      expect(downloadVideoSpy).toHaveBeenCalledWith('vid_abc123', 'video');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'video/mp4',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="vid_abc123.mp4"',
      );
      expect(mockResponse.write).toHaveBeenCalled();
      expect(mockResponse.end).toHaveBeenCalled();
    });

    it('should download thumbnail variant', async () => {
      mockVideoService.downloadVideo.mockResolvedValue(mockOpenAIResponse);

      await controller.downloadVideo(
        'vid_abc123',
        'thumbnail',
        mockResponse as unknown as ExpressResponse,
      );

      expect(downloadVideoSpy).toHaveBeenCalledWith('vid_abc123', 'thumbnail');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'image/jpeg',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="vid_abc123.jpg"',
      );
    });

    it('should download spritesheet variant', async () => {
      mockVideoService.downloadVideo.mockResolvedValue(mockOpenAIResponse);

      await controller.downloadVideo(
        'vid_abc123',
        'spritesheet',
        mockResponse as unknown as ExpressResponse,
      );

      expect(downloadVideoSpy).toHaveBeenCalledWith(
        'vid_abc123',
        'spritesheet',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'image/jpeg',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="vid_abc123.jpg"',
      );
    });

    it('should handle response without body', async () => {
      const emptyResponse = { body: null } as unknown as Response;
      mockVideoService.downloadVideo.mockResolvedValue(emptyResponse);

      await controller.downloadVideo(
        'vid_abc123',
        'video',
        mockResponse as unknown as ExpressResponse,
      );

      expect(mockResponse.end).toHaveBeenCalled();
    });

    it('should throw error for video not ready', async () => {
      const error = new Error('Video not ready');
      mockVideoService.downloadVideo.mockRejectedValue(error);

      await expect(
        controller.downloadVideo(
          'vid_abc123',
          'video',
          mockResponse as unknown as ExpressResponse,
        ),
      ).rejects.toThrow('Video not ready');
    });

    it('should throw error for expired video', async () => {
      const error = new Error('Video expired');
      mockVideoService.downloadVideo.mockRejectedValue(error);

      await expect(
        controller.downloadVideo(
          'vid_abc123',
          'video',
          mockResponse as unknown as ExpressResponse,
        ),
      ).rejects.toThrow('Video expired');
    });
  });

  describe('listVideos', () => {
    it('should list videos with default parameters', async () => {
      mockVideoService.listVideos.mockResolvedValue([
        mockVideo,
        mockCompletedVideo,
      ]);

      const result = await controller.listVideos(undefined, undefined);

      expect(listVideosSpy).toHaveBeenCalledWith(undefined, undefined);
      expect(result).toEqual([mockVideo, mockCompletedVideo]);
      expect(result).toHaveLength(2);
    });

    it('should list videos with custom limit', async () => {
      mockVideoService.listVideos.mockResolvedValue([mockVideo]);

      const result = await controller.listVideos(1, undefined);

      expect(listVideosSpy).toHaveBeenCalledWith(1, undefined);
      expect(result).toHaveLength(1);
    });

    it('should list videos in ascending order', async () => {
      mockVideoService.listVideos.mockResolvedValue([
        mockVideo,
        mockCompletedVideo,
      ]);

      const result = await controller.listVideos(10, 'asc');

      expect(listVideosSpy).toHaveBeenCalledWith(10, 'asc');
      expect(result).toEqual([mockVideo, mockCompletedVideo]);
    });

    it('should list videos in descending order', async () => {
      mockVideoService.listVideos.mockResolvedValue([
        mockCompletedVideo,
        mockVideo,
      ]);

      const result = await controller.listVideos(10, 'desc');

      expect(listVideosSpy).toHaveBeenCalledWith(10, 'desc');
      expect(result).toEqual([mockCompletedVideo, mockVideo]);
    });

    it('should return empty array when no videos', async () => {
      mockVideoService.listVideos.mockResolvedValue([]);

      const result = await controller.listVideos();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle large limit', async () => {
      const videos = Array(100).fill(mockVideo);
      mockVideoService.listVideos.mockResolvedValue(videos);

      const result = await controller.listVideos(100);

      expect(result).toHaveLength(100);
    });
  });

  describe('deleteVideo', () => {
    it('should delete video successfully', async () => {
      mockVideoService.deleteVideo.mockResolvedValue(mockDeleteResponse);

      const result = await controller.deleteVideo('vid_abc123');

      expect(deleteVideoSpy).toHaveBeenCalledWith('vid_abc123');
      expect(result).toEqual(mockDeleteResponse);
      expect(result.deleted).toBe(true);
    });

    it('should throw error for invalid video ID', async () => {
      const error = new Error('Video not found');
      mockVideoService.deleteVideo.mockRejectedValue(error);

      await expect(controller.deleteVideo('invalid_id')).rejects.toThrow(
        'Video not found',
      );
    });

    it('should handle already deleted video', async () => {
      const error = new Error('Video already deleted');
      mockVideoService.deleteVideo.mockRejectedValue(error);

      await expect(controller.deleteVideo('vid_abc123')).rejects.toThrow(
        'Video already deleted',
      );
    });

    it('should return deletion confirmation', async () => {
      mockVideoService.deleteVideo.mockResolvedValue(mockDeleteResponse);

      const result = await controller.deleteVideo('vid_abc123');

      expect(result.id).toBe('vid_abc123');
      expect(result.object).toBe('video.deleted');
      expect(result.deleted).toBe(true);
    });
  });

  describe('remixVideo', () => {
    const mockRemixVideo: Videos.Video = {
      ...mockVideo,
      id: 'vid_remix456',
      prompt: 'A serene lakeside at sunrise',
      remixed_from_video_id: 'vid_abc123',
    };

    it('should create remix successfully', async () => {
      mockVideoService.remixVideo.mockResolvedValue(mockRemixVideo);

      const result = await controller.remixVideo('vid_abc123', {
        prompt: 'A serene lakeside at sunrise',
      });

      expect(remixVideoSpy).toHaveBeenCalledWith(
        'vid_abc123',
        'A serene lakeside at sunrise',
      );
      expect(result).toEqual(mockRemixVideo);
      expect(result.remixed_from_video_id).toBe('vid_abc123');
    });

    it('should return new video ID for remix', async () => {
      mockVideoService.remixVideo.mockResolvedValue(mockRemixVideo);

      const result = await controller.remixVideo('vid_abc123', {
        prompt: 'New prompt',
      });

      expect(result.id).not.toBe('vid_abc123');
      expect(result.id).toBe('vid_remix456');
    });

    it('should throw error for invalid source video', async () => {
      const error = new Error('Source video not found');
      mockVideoService.remixVideo.mockRejectedValue(error);

      await expect(
        controller.remixVideo('invalid_id', { prompt: 'New prompt' }),
      ).rejects.toThrow('Source video not found');
    });

    it('should throw error for empty prompt', async () => {
      const error = new Error('Prompt cannot be empty');
      mockVideoService.remixVideo.mockRejectedValue(error);

      await expect(
        controller.remixVideo('vid_abc123', { prompt: '' }),
      ).rejects.toThrow('Prompt cannot be empty');
    });

    it('should preserve remix metadata', async () => {
      mockVideoService.remixVideo.mockResolvedValue(mockRemixVideo);

      const result = await controller.remixVideo('vid_abc123', {
        prompt: 'Test',
      });

      expect(result.remixed_from_video_id).toBe('vid_abc123');
      expect(result.prompt).toBe('A serene lakeside at sunrise');
    });
  });
});
