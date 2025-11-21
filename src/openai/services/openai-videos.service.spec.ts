import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OpenAIVideosService } from './openai-videos.service';
import { LoggerService } from '../../common/services/logger.service';
import type { Videos } from 'openai/resources/videos';

// Mock OpenAI client
const mockOpenAIClient = {
  videos: {
    create: jest.fn(),
    retrieve: jest.fn(),
    list: jest.fn(),
    delete: jest.fn(),
    downloadContent: jest.fn(),
    remix: jest.fn(),
  },
};

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => mockOpenAIClient);
});

describe('OpenAIVideosService', () => {
  let service: OpenAIVideosService;
  let configService: ConfigService;
  let loggerService: LoggerService;

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

  const mockFailedVideo: Videos.Video = {
    ...mockVideo,
    status: 'failed',
    progress: 50,
    error: {
      code: 'video_generation_failed',
      message: 'Generation failed due to content policy',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenAIVideosService,
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

    service = module.get<OpenAIVideosService>(OpenAIVideosService);
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
        new OpenAIVideosService(configService, loggerService);
      }).toThrow('OpenAI API key is not configured');
    });

    it('should initialize OpenAI client with correct config', () => {
      // Create a spy before service instantiation
      const getSpy = jest.spyOn(configService, 'get');

      // Create new instance to capture config calls
      new OpenAIVideosService(configService, loggerService);

      // Verify config was accessed
      expect(getSpy).toHaveBeenCalledWith('openai.apiKey');
      expect(getSpy).toHaveBeenCalledWith('openai.baseUrl');
      expect(getSpy).toHaveBeenCalledWith('openai.timeout');
      expect(getSpy).toHaveBeenCalledWith('openai.maxRetries');
    });
  });

  describe('createVideo', () => {
    it('should create video with all parameters', async () => {
      mockOpenAIClient.videos.create.mockResolvedValue(mockVideo);

      const dto = {
        prompt: 'A serene lakeside at sunset',
        model: 'sora-2' as Videos.VideoModel,
        seconds: '4' as Videos.VideoSeconds,
        size: '720x1280' as Videos.VideoSize,
      };

      const result = await service.createVideo(dto);

      expect(mockOpenAIClient.videos.create).toHaveBeenCalledWith({
        prompt: 'A serene lakeside at sunset',
        model: 'sora-2',
        seconds: '4',
        size: '720x1280',
      });
      expect(result).toEqual(mockVideo);
      expect(loggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'videos',
          endpoint: '/v1/videos',
          request: expect.objectContaining({ prompt: dto.prompt }),
          response: mockVideo,
        }),
      );
    });

    it('should create video with only required prompt', async () => {
      mockOpenAIClient.videos.create.mockResolvedValue(mockVideo);

      const dto = {
        prompt: 'A serene lakeside at sunset',
      };

      const result = await service.createVideo(dto);

      expect(mockOpenAIClient.videos.create).toHaveBeenCalledWith({
        prompt: 'A serene lakeside at sunset',
      });
      expect(result).toEqual(mockVideo);
    });

    it('should create video with model specified', async () => {
      mockOpenAIClient.videos.create.mockResolvedValue(mockVideo);

      const dto = {
        prompt: 'Test prompt',
        model: 'sora-2-pro' as Videos.VideoModel,
      };

      await service.createVideo(dto);

      expect(mockOpenAIClient.videos.create).toHaveBeenCalledWith({
        prompt: 'Test prompt',
        model: 'sora-2-pro',
      });
    });

    it('should create video with custom seconds', async () => {
      mockOpenAIClient.videos.create.mockResolvedValue(mockVideo);

      const dto = {
        prompt: 'Test prompt',
        seconds: '8' as Videos.VideoSeconds,
      };

      await service.createVideo(dto);

      expect(mockOpenAIClient.videos.create).toHaveBeenCalledWith({
        prompt: 'Test prompt',
        seconds: '8',
      });
    });

    it('should create video with custom size', async () => {
      mockOpenAIClient.videos.create.mockResolvedValue(mockVideo);

      const dto = {
        prompt: 'Test prompt',
        size: '1280x720' as Videos.VideoSize,
      };

      await service.createVideo(dto);

      expect(mockOpenAIClient.videos.create).toHaveBeenCalledWith({
        prompt: 'Test prompt',
        size: '1280x720',
      });
    });

    it('should log interaction metadata', async () => {
      mockOpenAIClient.videos.create.mockResolvedValue(mockVideo);

      await service.createVideo({ prompt: 'Test' });

      expect(loggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            latency_ms: expect.any(Number),
            video_id: 'vid_abc123',
            model: 'sora-2',
            status: 'queued',
          }),
        }),
      );
    });

    it('should throw error on OpenAI API failure', async () => {
      const error = new Error('API Error');
      mockOpenAIClient.videos.create.mockRejectedValue(error);

      await expect(service.createVideo({ prompt: 'Test' })).rejects.toThrow(
        'API Error',
      );
    });
  });

  describe('getVideoStatus', () => {
    it('should retrieve video status', async () => {
      mockOpenAIClient.videos.retrieve.mockResolvedValue(mockVideo);

      const result = await service.getVideoStatus('vid_abc123');

      expect(mockOpenAIClient.videos.retrieve).toHaveBeenCalledWith(
        'vid_abc123',
      );
      expect(result).toEqual(mockVideo);
    });

    it('should retrieve completed video', async () => {
      mockOpenAIClient.videos.retrieve.mockResolvedValue(mockCompletedVideo);

      const result = await service.getVideoStatus('vid_abc123');

      expect(result.status).toBe('completed');
      expect(result.progress).toBe(100);
      expect(result.completed_at).toBe(1234567990);
    });

    it('should retrieve failed video', async () => {
      mockOpenAIClient.videos.retrieve.mockResolvedValue(mockFailedVideo);

      const result = await service.getVideoStatus('vid_abc123');

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });

    it('should throw error for invalid video ID', async () => {
      const error = new Error('Video not found');
      mockOpenAIClient.videos.retrieve.mockRejectedValue(error);

      await expect(service.getVideoStatus('invalid_id')).rejects.toThrow(
        'Video not found',
      );
    });
  });

  describe('pollUntilComplete', () => {
    it('should return completed video immediately', async () => {
      mockOpenAIClient.videos.retrieve.mockResolvedValue(mockCompletedVideo);

      const result = await service.pollUntilComplete('vid_abc123');

      expect(result.status).toBe('completed');
      expect(mockOpenAIClient.videos.retrieve).toHaveBeenCalledTimes(1);
    });

    it('should return failed video immediately', async () => {
      mockOpenAIClient.videos.retrieve.mockResolvedValue(mockFailedVideo);

      const result = await service.pollUntilComplete('vid_abc123');

      expect(result.status).toBe('failed');
      expect(mockOpenAIClient.videos.retrieve).toHaveBeenCalledTimes(1);
    });

    it('should poll until video completes', async () => {
      const inProgressVideo = {
        ...mockVideo,
        status: 'in_progress',
        progress: 50,
      };

      mockOpenAIClient.videos.retrieve
        .mockResolvedValueOnce({ ...mockVideo, status: 'queued' })
        .mockResolvedValueOnce(inProgressVideo)
        .mockResolvedValueOnce(mockCompletedVideo);

      const result = await service.pollUntilComplete('vid_abc123', 30000);

      expect(result.status).toBe('completed');
      expect(mockOpenAIClient.videos.retrieve).toHaveBeenCalledTimes(3);
    }, 30000);

    it('should throw error on timeout', async () => {
      mockOpenAIClient.videos.retrieve.mockResolvedValue({
        ...mockVideo,
        status: 'in_progress',
      });

      await expect(
        service.pollUntilComplete('vid_abc123', 100),
      ).rejects.toThrow(/timeout/i);
    }, 10000);

    it('should use exponential backoff', async () => {
      jest.useFakeTimers();

      const inProgressVideo = { ...mockVideo, status: 'in_progress' };
      mockOpenAIClient.videos.retrieve.mockResolvedValue(inProgressVideo);

      const pollPromise = service.pollUntilComplete('vid_abc123', 30000);

      // First call is immediate
      await Promise.resolve();
      expect(mockOpenAIClient.videos.retrieve).toHaveBeenCalledTimes(1);

      // Wait 5 seconds for second poll
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      // Wait 10 seconds for third poll
      jest.advanceTimersByTime(10000);
      await Promise.resolve();

      jest.useRealTimers();
    });

    it('should respect custom maxWaitMs', async () => {
      mockOpenAIClient.videos.retrieve.mockResolvedValue({
        ...mockVideo,
        status: 'in_progress',
      });

      const customTimeout = 5000;

      await expect(
        service.pollUntilComplete('vid_abc123', customTimeout),
      ).rejects.toThrow(`timeout: exceeded ${customTimeout}ms`);
    }, 10000);
  });

  describe('downloadVideo', () => {
    const mockResponse = {
      body: {
        getReader: jest.fn(),
      },
    } as unknown as Response;

    it('should download video with default variant', async () => {
      mockOpenAIClient.videos.downloadContent.mockResolvedValue(mockResponse);

      const result = await service.downloadVideo('vid_abc123');

      expect(mockOpenAIClient.videos.downloadContent).toHaveBeenCalledWith(
        'vid_abc123',
        { variant: 'video' },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should download video variant', async () => {
      mockOpenAIClient.videos.downloadContent.mockResolvedValue(mockResponse);

      await service.downloadVideo('vid_abc123', 'video');

      expect(mockOpenAIClient.videos.downloadContent).toHaveBeenCalledWith(
        'vid_abc123',
        { variant: 'video' },
      );
    });

    it('should download thumbnail variant', async () => {
      mockOpenAIClient.videos.downloadContent.mockResolvedValue(mockResponse);

      await service.downloadVideo('vid_abc123', 'thumbnail');

      expect(mockOpenAIClient.videos.downloadContent).toHaveBeenCalledWith(
        'vid_abc123',
        { variant: 'thumbnail' },
      );
    });

    it('should download spritesheet variant', async () => {
      mockOpenAIClient.videos.downloadContent.mockResolvedValue(mockResponse);

      await service.downloadVideo('vid_abc123', 'spritesheet');

      expect(mockOpenAIClient.videos.downloadContent).toHaveBeenCalledWith(
        'vid_abc123',
        { variant: 'spritesheet' },
      );
    });

    it('should throw error for expired video', async () => {
      const error = new Error('Video expired');
      mockOpenAIClient.videos.downloadContent.mockRejectedValue(error);

      await expect(service.downloadVideo('vid_abc123')).rejects.toThrow(
        'Video expired',
      );
    });

    it('should throw error for video not ready', async () => {
      const error = new Error('Video not ready');
      mockOpenAIClient.videos.downloadContent.mockRejectedValue(error);

      await expect(service.downloadVideo('vid_abc123')).rejects.toThrow(
        'Video not ready',
      );
    });
  });

  describe('listVideos', () => {
    const mockVideoList = {
      data: [mockVideo, mockCompletedVideo],
      has_more: false,
    };

    it('should list videos with default parameters', async () => {
      mockOpenAIClient.videos.list.mockResolvedValue(mockVideoList);

      const result = await service.listVideos();

      expect(mockOpenAIClient.videos.list).toHaveBeenCalledWith({
        limit: 10,
        order: 'desc',
      });
      expect(result).toEqual([mockVideo, mockCompletedVideo]);
    });

    it('should list videos with custom limit', async () => {
      mockOpenAIClient.videos.list.mockResolvedValue(mockVideoList);

      await service.listVideos(20);

      expect(mockOpenAIClient.videos.list).toHaveBeenCalledWith({
        limit: 20,
        order: 'desc',
      });
    });

    it('should list videos in ascending order', async () => {
      mockOpenAIClient.videos.list.mockResolvedValue(mockVideoList);

      await service.listVideos(10, 'asc');

      expect(mockOpenAIClient.videos.list).toHaveBeenCalledWith({
        limit: 10,
        order: 'asc',
      });
    });

    it('should list videos in descending order', async () => {
      mockOpenAIClient.videos.list.mockResolvedValue(mockVideoList);

      await service.listVideos(10, 'desc');

      expect(mockOpenAIClient.videos.list).toHaveBeenCalledWith({
        limit: 10,
        order: 'desc',
      });
    });

    it('should return empty array when no videos', async () => {
      mockOpenAIClient.videos.list.mockResolvedValue({
        data: [],
        has_more: false,
      });

      const result = await service.listVideos();

      expect(result).toEqual([]);
    });

    it('should handle pagination', async () => {
      const page1 = { data: [mockVideo], has_more: true };
      mockOpenAIClient.videos.list.mockResolvedValue(page1);

      const result = await service.listVideos(1);

      expect(result).toEqual([mockVideo]);
    });
  });

  describe('deleteVideo', () => {
    const mockDeleteResponse: Videos.VideoDeleteResponse = {
      id: 'vid_abc123',
      object: 'video',
      deleted: true,
    };

    it('should delete video successfully', async () => {
      mockOpenAIClient.videos.delete.mockResolvedValue(mockDeleteResponse);

      const result = await service.deleteVideo('vid_abc123');

      expect(mockOpenAIClient.videos.delete).toHaveBeenCalledWith('vid_abc123');
      expect(result).toEqual(mockDeleteResponse);
      expect(result.deleted).toBe(true);
    });

    it('should throw error for invalid video ID', async () => {
      const error = new Error('Video not found');
      mockOpenAIClient.videos.delete.mockRejectedValue(error);

      await expect(service.deleteVideo('invalid_id')).rejects.toThrow(
        'Video not found',
      );
    });

    it('should handle already deleted video', async () => {
      const error = new Error('Video already deleted');
      mockOpenAIClient.videos.delete.mockRejectedValue(error);

      await expect(service.deleteVideo('vid_abc123')).rejects.toThrow(
        'Video already deleted',
      );
    });
  });

  describe('remixVideo', () => {
    const mockRemixVideo: Videos.Video = {
      ...mockVideo,
      id: 'vid_remix456',
      prompt: 'A serene lakeside at sunrise',
      remixed_from_video_id: 'vid_abc123',
    };

    it('should create remix with new prompt', async () => {
      mockOpenAIClient.videos.remix.mockResolvedValue(mockRemixVideo);

      const result = await service.remixVideo(
        'vid_abc123',
        'A serene lakeside at sunrise',
      );

      expect(mockOpenAIClient.videos.remix).toHaveBeenCalledWith('vid_abc123', {
        prompt: 'A serene lakeside at sunrise',
      });
      expect(result).toEqual(mockRemixVideo);
      expect(result.remixed_from_video_id).toBe('vid_abc123');
    });

    it('should throw error for invalid source video', async () => {
      const error = new Error('Source video not found');
      mockOpenAIClient.videos.remix.mockRejectedValue(error);

      await expect(
        service.remixVideo('invalid_id', 'New prompt'),
      ).rejects.toThrow('Source video not found');
    });

    it('should handle empty prompt error', async () => {
      const error = new Error('Prompt cannot be empty');
      mockOpenAIClient.videos.remix.mockRejectedValue(error);

      await expect(service.remixVideo('vid_abc123', '')).rejects.toThrow(
        'Prompt cannot be empty',
      );
    });
  });

  describe('extractVideoMetadata', () => {
    it('should extract all metadata fields', () => {
      const metadata = service.extractVideoMetadata(mockVideo);

      expect(metadata).toEqual({
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
      });
    });

    it('should extract completed video metadata', () => {
      const metadata = service.extractVideoMetadata(mockCompletedVideo);

      expect(metadata.status).toBe('completed');
      expect(metadata.progress).toBe(100);
      expect(metadata.completed_at).toBe(1234567990);
      expect(metadata.expires_at).toBe(1234657990);
    });

    it('should extract failed video metadata with error', () => {
      const metadata = service.extractVideoMetadata(mockFailedVideo);

      expect(metadata.status).toBe('failed');
      expect(metadata.error).toEqual({
        code: 'video_generation_failed',
        message: 'Generation failed due to content policy',
      });
    });

    it('should extract remix metadata', () => {
      const remixVideo = {
        ...mockVideo,
        id: 'vid_remix456',
        remixed_from_video_id: 'vid_abc123',
      };

      const metadata = service.extractVideoMetadata(remixVideo);

      expect(metadata.remixed_from_video_id).toBe('vid_abc123');
    });

    it('should handle null prompt', () => {
      const videoWithoutPrompt = { ...mockVideo, prompt: null };
      const metadata = service.extractVideoMetadata(videoWithoutPrompt);

      expect(metadata.prompt).toBeNull();
    });
  });
});
