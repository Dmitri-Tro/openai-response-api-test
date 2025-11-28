import { Test, TestingModule } from '@nestjs/testing';
import { OpenAIAudioService } from './openai-audio.service';
import { OPENAI_CLIENT } from '../providers/openai-client.provider';
import { LoggerService } from '../../common/services/logger.service';
import type { Audio } from 'openai/resources/audio';
import type {
  CreateSpeechDto,
  CreateTranscriptionDto,
  CreateTranslationDto,
} from '../dto/audio';

// Mock toFile function
jest.mock('openai', () => {
  return {
    __esModule: true,
    toFile: jest.fn(
      (
        buffer: Buffer,
        filename: string,
        options?: { type?: string },
      ): Promise<{ name: string; type: string; size: number }> =>
        Promise.resolve({
          name: filename,
          type: options?.type || 'application/octet-stream',
          size: buffer.length,
        }),
    ),
  };
});

describe('OpenAIAudioService', () => {
  let service: OpenAIAudioService;
  let loggerService: LoggerService;

  // Mock OpenAI client (singleton provider pattern)
  const mockOpenAIClient = {
    audio: {
      speech: {
        create: jest.fn(),
      },
      transcriptions: {
        create: jest.fn(),
      },
      translations: {
        create: jest.fn(),
      },
    },
  };

  // Mock audio file for transcription/translation tests
  const mockAudioFile = {
    fieldname: 'file',
    originalname: 'test-audio.mp3',
    encoding: '7bit',
    mimetype: 'audio/mpeg',
    buffer: Buffer.from('mock audio data'),
    size: 1024 * 1024, // 1 MB
  } as Express.Multer.File;

  // Mock responses
  const mockSpeechResponse = {
    status: 200,
    ok: true,
    headers: new Headers({
      'content-type': 'audio/mpeg',
    }),
  } as Response;

  const mockTranscriptionResponse: Audio.Transcription = {
    text: 'This is a test transcription.',
  };

  const mockTranscriptionVerboseResponse: Audio.TranscriptionVerbose = {
    text: 'This is a test transcription with verbose metadata.',
    language: 'en',
    duration: 125.5,
    segments: [
      {
        id: 0,
        start: 0.0,
        end: 5.5,
        text: 'This is a test transcription',
        tokens: [1, 2, 3, 4, 5],
        avg_logprob: -0.15,
        compression_ratio: 1.2,
        no_speech_prob: 0.01,
        temperature: 0.0,
        seek: 0,
      },
      {
        id: 1,
        start: 5.5,
        end: 10.0,
        text: ' with verbose metadata.',
        tokens: [6, 7, 8],
        avg_logprob: -0.12,
        compression_ratio: 1.1,
        no_speech_prob: 0.02,
        temperature: 0.0,
        seek: 0,
      },
    ],
    words: [
      { word: 'This', start: 0.0, end: 0.5 },
      { word: 'is', start: 0.5, end: 0.8 },
      { word: 'a', start: 0.8, end: 1.0 },
      { word: 'test', start: 1.0, end: 1.5 },
    ],
  };

  const mockTranslationResponse: Audio.Translation = {
    text: 'This is a translated text in English.',
  };

  const mockTranslationVerboseResponse: Audio.TranslationVerbose = {
    text: 'This is a translated text in English with verbose metadata.',
    language: 'es', // Detected source language
    duration: 98.3,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenAIAudioService,
        {
          provide: OPENAI_CLIENT,
          useValue: mockOpenAIClient,
        },
        {
          provide: LoggerService,
          useValue: {
            logOpenAIInteraction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OpenAIAudioService>(OpenAIAudioService);
    loggerService = module.get<LoggerService>(LoggerService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSpeech', () => {
    it('should generate speech with tts-1 model', async () => {
      mockOpenAIClient.audio.speech.create.mockResolvedValue(
        mockSpeechResponse,
      );

      const dto: CreateSpeechDto = {
        model: 'tts-1',
        voice: 'alloy',
        input: 'The quick brown fox jumps over the lazy dog.',
      };

      const result = await service.createSpeech(dto);

      expect(result).toEqual(mockSpeechResponse);
      expect(mockOpenAIClient.audio.speech.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'tts-1',
          voice: 'alloy',
          input: 'The quick brown fox jumps over the lazy dog.',
        }),
      );
      expect(loggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'audio',
          endpoint: '/v1/audio/speech',
          metadata: expect.objectContaining({
            model: 'tts-1',
            voice: 'alloy',
            character_count: 44,
            cost_estimate: expect.any(Number) as number,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should generate speech with tts-1-hd model', async () => {
      mockOpenAIClient.audio.speech.create.mockResolvedValue(
        mockSpeechResponse,
      );

      const dto: CreateSpeechDto = {
        model: 'tts-1-hd',
        voice: 'shimmer',
        input: 'Hello world!',
      };

      const result = await service.createSpeech(dto);

      expect(result).toEqual(mockSpeechResponse);
      expect(mockOpenAIClient.audio.speech.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'tts-1-hd',
          voice: 'shimmer',
        }),
      );
      expect(loggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            model: 'tts-1-hd',
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should generate speech with gpt-4o-mini-tts model', async () => {
      mockOpenAIClient.audio.speech.create.mockResolvedValue(
        mockSpeechResponse,
      );

      const dto: CreateSpeechDto = {
        model: 'gpt-4o-mini-tts',
        voice: 'echo',
        input: 'Testing GPT-4o TTS',
      };

      const result = await service.createSpeech(dto);

      expect(result).toEqual(mockSpeechResponse);
      expect(mockOpenAIClient.audio.speech.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini-tts',
        }),
      );
    });

    it('should generate speech with all voice options', async () => {
      mockOpenAIClient.audio.speech.create.mockResolvedValue(
        mockSpeechResponse,
      );

      const voices = [
        'alloy',
        'ash',
        'ballad',
        'coral',
        'echo',
        'fable',
        'nova',
        'onyx',
        'sage',
        'shimmer',
        'verse',
        'marin',
        'cedar',
      ] as const;

      for (const voice of voices) {
        const dto: CreateSpeechDto = {
          model: 'tts-1',
          voice,
          input: 'Test',
        };

        await service.createSpeech(dto);

        expect(mockOpenAIClient.audio.speech.create).toHaveBeenCalledWith(
          expect.objectContaining({
            voice,
          }),
        );
      }

      expect(mockOpenAIClient.audio.speech.create).toHaveBeenCalledTimes(13);
    });

    it('should generate speech with mp3 format', async () => {
      mockOpenAIClient.audio.speech.create.mockResolvedValue(
        mockSpeechResponse,
      );

      const dto: CreateSpeechDto = {
        model: 'tts-1',
        voice: 'alloy',
        input: 'Test',
        response_format: 'mp3',
      };

      await service.createSpeech(dto);

      expect(mockOpenAIClient.audio.speech.create).toHaveBeenCalledWith(
        expect.objectContaining({
          response_format: 'mp3',
        }),
      );
    });

    it('should generate speech with opus format', async () => {
      mockOpenAIClient.audio.speech.create.mockResolvedValue(
        mockSpeechResponse,
      );

      const dto: CreateSpeechDto = {
        model: 'tts-1',
        voice: 'alloy',
        input: 'Test',
        response_format: 'opus',
      };

      await service.createSpeech(dto);

      expect(mockOpenAIClient.audio.speech.create).toHaveBeenCalledWith(
        expect.objectContaining({
          response_format: 'opus',
        }),
      );
    });

    it('should generate speech with all audio formats', async () => {
      mockOpenAIClient.audio.speech.create.mockResolvedValue(
        mockSpeechResponse,
      );

      const formats = ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'] as const;

      for (const format of formats) {
        const dto: CreateSpeechDto = {
          model: 'tts-1',
          voice: 'alloy',
          input: 'Test',
          response_format: format,
        };

        await service.createSpeech(dto);

        expect(mockOpenAIClient.audio.speech.create).toHaveBeenCalledWith(
          expect.objectContaining({
            response_format: format,
          }),
        );
      }

      expect(mockOpenAIClient.audio.speech.create).toHaveBeenCalledTimes(6);
    });

    it('should generate speech with custom speed', async () => {
      mockOpenAIClient.audio.speech.create.mockResolvedValue(
        mockSpeechResponse,
      );

      const dto: CreateSpeechDto = {
        model: 'tts-1',
        voice: 'alloy',
        input: 'Test',
        speed: 1.5,
      };

      await service.createSpeech(dto);

      expect(mockOpenAIClient.audio.speech.create).toHaveBeenCalledWith(
        expect.objectContaining({
          speed: 1.5,
        }),
      );
    });

    it('should generate speech with minimum speed (0.25)', async () => {
      mockOpenAIClient.audio.speech.create.mockResolvedValue(
        mockSpeechResponse,
      );

      const dto: CreateSpeechDto = {
        model: 'tts-1',
        voice: 'alloy',
        input: 'Test',
        speed: 0.25,
      };

      await service.createSpeech(dto);

      expect(mockOpenAIClient.audio.speech.create).toHaveBeenCalledWith(
        expect.objectContaining({
          speed: 0.25,
        }),
      );
    });

    it('should generate speech with maximum speed (4.0)', async () => {
      mockOpenAIClient.audio.speech.create.mockResolvedValue(
        mockSpeechResponse,
      );

      const dto: CreateSpeechDto = {
        model: 'tts-1',
        voice: 'alloy',
        input: 'Test',
        speed: 4.0,
      };

      await service.createSpeech(dto);

      expect(mockOpenAIClient.audio.speech.create).toHaveBeenCalledWith(
        expect.objectContaining({
          speed: 4.0,
        }),
      );
    });

    it('should generate speech with instructions (gpt-4o-mini-tts)', async () => {
      mockOpenAIClient.audio.speech.create.mockResolvedValue(
        mockSpeechResponse,
      );

      const dto: CreateSpeechDto = {
        model: 'gpt-4o-mini-tts',
        voice: 'alloy',
        input: 'Hello!',
        instructions: 'Speak in a cheerful, energetic tone',
      };

      await service.createSpeech(dto);

      expect(mockOpenAIClient.audio.speech.create).toHaveBeenCalledWith(
        expect.objectContaining({
          instructions: 'Speak in a cheerful, energetic tone',
        }),
      );
    });

    it('should log error when speech generation fails', async () => {
      const error = new Error('Rate limit exceeded');
      mockOpenAIClient.audio.speech.create.mockRejectedValue(error);

      const dto: CreateSpeechDto = {
        model: 'tts-1',
        voice: 'alloy',
        input: 'Test',
      };

      await expect(service.createSpeech(dto)).rejects.toThrow(
        'Rate limit exceeded',
      );

      expect(loggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'audio',
          endpoint: '/v1/audio/speech',
          error: expect.objectContaining({
            message: 'Rate limit exceeded',
          }) as Record<string, unknown>,
        }),
      );
    });
  });

  describe('createTranscription', () => {
    it('should transcribe audio with whisper-1 model', async () => {
      mockOpenAIClient.audio.transcriptions.create.mockResolvedValue(
        mockTranscriptionResponse,
      );

      const dto: CreateTranscriptionDto = {
        model: 'whisper-1',
      };

      const result = await service.createTranscription(mockAudioFile, dto);

      expect(result).toEqual(mockTranscriptionResponse);
      expect(mockOpenAIClient.audio.transcriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'whisper-1',
        }),
      );
      expect(loggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'audio',
          endpoint: '/v1/audio/transcriptions',
          metadata: expect.objectContaining({
            model: 'whisper-1',
            file_size_mb: '1.00',
            text_length: 29,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should transcribe audio with gpt-4o-transcribe model', async () => {
      mockOpenAIClient.audio.transcriptions.create.mockResolvedValue(
        mockTranscriptionResponse,
      );

      const dto: CreateTranscriptionDto = {
        model: 'gpt-4o-transcribe',
      };

      await service.createTranscription(mockAudioFile, dto);

      expect(mockOpenAIClient.audio.transcriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-transcribe',
        }),
      );
    });

    it('should transcribe audio with gpt-4o-mini-transcribe model', async () => {
      mockOpenAIClient.audio.transcriptions.create.mockResolvedValue(
        mockTranscriptionResponse,
      );

      const dto: CreateTranscriptionDto = {
        model: 'gpt-4o-mini-transcribe',
      };

      await service.createTranscription(mockAudioFile, dto);

      expect(mockOpenAIClient.audio.transcriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini-transcribe',
        }),
      );
    });

    it('should transcribe audio with gpt-4o-transcribe-diarize model', async () => {
      mockOpenAIClient.audio.transcriptions.create.mockResolvedValue(
        mockTranscriptionResponse,
      );

      const dto: CreateTranscriptionDto = {
        model: 'gpt-4o-transcribe-diarize',
      };

      await service.createTranscription(mockAudioFile, dto);

      expect(mockOpenAIClient.audio.transcriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-transcribe-diarize',
        }),
      );
    });

    it('should transcribe audio with language parameter', async () => {
      mockOpenAIClient.audio.transcriptions.create.mockResolvedValue(
        mockTranscriptionResponse,
      );

      const dto: CreateTranscriptionDto = {
        model: 'whisper-1',
        language: 'en',
      };

      await service.createTranscription(mockAudioFile, dto);

      expect(mockOpenAIClient.audio.transcriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'en',
        }),
      );
    });

    it('should transcribe audio with prompt parameter', async () => {
      mockOpenAIClient.audio.transcriptions.create.mockResolvedValue(
        mockTranscriptionResponse,
      );

      const dto: CreateTranscriptionDto = {
        model: 'whisper-1',
        prompt: 'This meeting is about AI and ML',
      };

      await service.createTranscription(mockAudioFile, dto);

      expect(mockOpenAIClient.audio.transcriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'This meeting is about AI and ML',
        }),
      );
    });

    it('should transcribe audio with json response format', async () => {
      mockOpenAIClient.audio.transcriptions.create.mockResolvedValue(
        mockTranscriptionResponse,
      );

      const dto: CreateTranscriptionDto = {
        model: 'whisper-1',
        response_format: 'json',
      };

      await service.createTranscription(mockAudioFile, dto);

      expect(mockOpenAIClient.audio.transcriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          response_format: 'json',
        }),
      );
    });

    it('should transcribe audio with text response format', async () => {
      mockOpenAIClient.audio.transcriptions.create.mockResolvedValue(
        'This is plain text transcription',
      );

      const dto: CreateTranscriptionDto = {
        model: 'whisper-1',
        response_format: 'text',
      };

      const result = await service.createTranscription(mockAudioFile, dto);

      expect(typeof result).toBe('string');
      expect(result).toBe('This is plain text transcription');
    });

    it('should transcribe audio with srt response format', async () => {
      mockOpenAIClient.audio.transcriptions.create.mockResolvedValue(`1
00:00:00,000 --> 00:00:05,000
This is SRT subtitle format`);

      const dto: CreateTranscriptionDto = {
        model: 'whisper-1',
        response_format: 'srt',
      };

      const result = await service.createTranscription(mockAudioFile, dto);

      expect(typeof result).toBe('string');
      expect(result).toContain('00:00:00,000');
    });

    it('should transcribe audio with vtt response format', async () => {
      mockOpenAIClient.audio.transcriptions.create.mockResolvedValue(`WEBVTT

00:00:00.000 --> 00:00:05.000
This is WebVTT subtitle format`);

      const dto: CreateTranscriptionDto = {
        model: 'whisper-1',
        response_format: 'vtt',
      };

      const result = await service.createTranscription(mockAudioFile, dto);

      expect(typeof result).toBe('string');
      expect(result).toContain('WEBVTT');
    });

    it('should transcribe audio with verbose_json response format', async () => {
      mockOpenAIClient.audio.transcriptions.create.mockResolvedValue(
        mockTranscriptionVerboseResponse,
      );

      const dto: CreateTranscriptionDto = {
        model: 'whisper-1',
        response_format: 'verbose_json',
      };

      const result = await service.createTranscription(mockAudioFile, dto);

      expect(result).toEqual(mockTranscriptionVerboseResponse);
      expect(mockOpenAIClient.audio.transcriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          response_format: 'verbose_json',
        }),
      );
    });

    it('should transcribe audio with verbose_json and extract metadata', async () => {
      mockOpenAIClient.audio.transcriptions.create.mockResolvedValue(
        mockTranscriptionVerboseResponse,
      );

      const dto: CreateTranscriptionDto = {
        model: 'whisper-1',
        response_format: 'verbose_json',
      };

      await service.createTranscription(mockAudioFile, dto);

      expect(loggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            duration_seconds: 125.5,
            detected_language: 'en',
            segment_count: 2,
            word_count: 4,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should transcribe audio with timestamp_granularities (segment only)', async () => {
      mockOpenAIClient.audio.transcriptions.create.mockResolvedValue(
        mockTranscriptionVerboseResponse,
      );

      const dto: CreateTranscriptionDto = {
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
      };

      await service.createTranscription(mockAudioFile, dto);

      expect(mockOpenAIClient.audio.transcriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp_granularities: ['segment'],
        }),
      );
    });

    it('should transcribe audio with timestamp_granularities (word only)', async () => {
      mockOpenAIClient.audio.transcriptions.create.mockResolvedValue(
        mockTranscriptionVerboseResponse,
      );

      const dto: CreateTranscriptionDto = {
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['word'],
      };

      await service.createTranscription(mockAudioFile, dto);

      expect(mockOpenAIClient.audio.transcriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp_granularities: ['word'],
        }),
      );
    });

    it('should transcribe audio with timestamp_granularities (both)', async () => {
      mockOpenAIClient.audio.transcriptions.create.mockResolvedValue(
        mockTranscriptionVerboseResponse,
      );

      const dto: CreateTranscriptionDto = {
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['word', 'segment'],
      };

      await service.createTranscription(mockAudioFile, dto);

      expect(mockOpenAIClient.audio.transcriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp_granularities: ['word', 'segment'],
        }),
      );
    });

    it('should transcribe audio with temperature parameter', async () => {
      mockOpenAIClient.audio.transcriptions.create.mockResolvedValue(
        mockTranscriptionResponse,
      );

      const dto: CreateTranscriptionDto = {
        model: 'whisper-1',
        temperature: 0.5,
      };

      await service.createTranscription(mockAudioFile, dto);

      expect(mockOpenAIClient.audio.transcriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.5,
        }),
      );
    });

    it('should log error when transcription fails', async () => {
      const error = new Error('Unsupported file format');
      mockOpenAIClient.audio.transcriptions.create.mockRejectedValue(error);

      const dto: CreateTranscriptionDto = {
        model: 'whisper-1',
      };

      await expect(
        service.createTranscription(mockAudioFile, dto),
      ).rejects.toThrow('Unsupported file format');

      expect(loggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'audio',
          endpoint: '/v1/audio/transcriptions',
          error: expect.objectContaining({
            message: 'Unsupported file format',
          }) as Record<string, unknown>,
        }),
      );
    });
  });

  describe('createTranslation', () => {
    it('should translate audio with whisper-1 model', async () => {
      mockOpenAIClient.audio.translations.create.mockResolvedValue(
        mockTranslationResponse,
      );

      const dto: CreateTranslationDto = {
        model: 'whisper-1',
      };

      const result = await service.createTranslation(mockAudioFile, dto);

      expect(result).toEqual(mockTranslationResponse);
      expect(mockOpenAIClient.audio.translations.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'whisper-1',
        }),
      );
      expect(loggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'audio',
          endpoint: '/v1/audio/translations',
          metadata: expect.objectContaining({
            model: 'whisper-1',
            file_size_mb: '1.00',
            text_length: 37,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should translate audio with prompt parameter', async () => {
      mockOpenAIClient.audio.translations.create.mockResolvedValue(
        mockTranslationResponse,
      );

      const dto: CreateTranslationDto = {
        model: 'whisper-1',
        prompt: 'This is a medical conference discussion',
      };

      await service.createTranslation(mockAudioFile, dto);

      expect(mockOpenAIClient.audio.translations.create).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'This is a medical conference discussion',
        }),
      );
    });

    it('should translate audio with json response format', async () => {
      mockOpenAIClient.audio.translations.create.mockResolvedValue(
        mockTranslationResponse,
      );

      const dto: CreateTranslationDto = {
        model: 'whisper-1',
        response_format: 'json',
      };

      await service.createTranslation(mockAudioFile, dto);

      expect(mockOpenAIClient.audio.translations.create).toHaveBeenCalledWith(
        expect.objectContaining({
          response_format: 'json',
        }),
      );
    });

    it('should translate audio with text response format', async () => {
      mockOpenAIClient.audio.translations.create.mockResolvedValue(
        'This is plain text translation in English',
      );

      const dto: CreateTranslationDto = {
        model: 'whisper-1',
        response_format: 'text',
      };

      const result = await service.createTranslation(mockAudioFile, dto);

      expect(typeof result).toBe('string');
      expect(result).toBe('This is plain text translation in English');
    });

    it('should translate audio with srt response format', async () => {
      mockOpenAIClient.audio.translations.create.mockResolvedValue(`1
00:00:00,000 --> 00:00:05,000
Translated subtitle in English`);

      const dto: CreateTranslationDto = {
        model: 'whisper-1',
        response_format: 'srt',
      };

      const result = await service.createTranslation(mockAudioFile, dto);

      expect(typeof result).toBe('string');
      expect(result).toContain('Translated subtitle in English');
    });

    it('should translate audio with vtt response format', async () => {
      mockOpenAIClient.audio.translations.create.mockResolvedValue(`WEBVTT

00:00:00.000 --> 00:00:05.000
Translated WebVTT in English`);

      const dto: CreateTranslationDto = {
        model: 'whisper-1',
        response_format: 'vtt',
      };

      const result = await service.createTranslation(mockAudioFile, dto);

      expect(typeof result).toBe('string');
      expect(result).toContain('Translated WebVTT in English');
    });

    it('should translate audio with verbose_json response format', async () => {
      mockOpenAIClient.audio.translations.create.mockResolvedValue(
        mockTranslationVerboseResponse,
      );

      const dto: CreateTranslationDto = {
        model: 'whisper-1',
        response_format: 'verbose_json',
      };

      const result = await service.createTranslation(mockAudioFile, dto);

      expect(result).toEqual(mockTranslationVerboseResponse);
      expect(mockOpenAIClient.audio.translations.create).toHaveBeenCalledWith(
        expect.objectContaining({
          response_format: 'verbose_json',
        }),
      );
    });

    it('should translate audio with verbose_json and extract metadata', async () => {
      mockOpenAIClient.audio.translations.create.mockResolvedValue(
        mockTranslationVerboseResponse,
      );

      const dto: CreateTranslationDto = {
        model: 'whisper-1',
        response_format: 'verbose_json',
      };

      await service.createTranslation(mockAudioFile, dto);

      expect(loggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            detected_language: 'es',
            duration_seconds: 98.3,
            text_length: 59,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should translate audio with temperature parameter', async () => {
      mockOpenAIClient.audio.translations.create.mockResolvedValue(
        mockTranslationResponse,
      );

      const dto: CreateTranslationDto = {
        model: 'whisper-1',
        temperature: 0.3,
      };

      await service.createTranslation(mockAudioFile, dto);

      expect(mockOpenAIClient.audio.translations.create).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
        }),
      );
    });

    it('should log error when translation fails', async () => {
      const error = new Error('File too large');
      mockOpenAIClient.audio.translations.create.mockRejectedValue(error);

      const dto: CreateTranslationDto = {
        model: 'whisper-1',
      };

      await expect(
        service.createTranslation(mockAudioFile, dto),
      ).rejects.toThrow('File too large');

      expect(loggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'audio',
          endpoint: '/v1/audio/translations',
          error: expect.objectContaining({
            message: 'File too large',
          }) as Record<string, unknown>,
        }),
      );
    });
  });

  describe('Helper Methods', () => {
    describe('estimateTranscriptionCost', () => {
      it('should estimate cost for whisper-1 with duration', () => {
        const response: Audio.TranscriptionVerbose = {
          text: 'Test',
          language: 'en',
          duration: 60, // 1 minute
        };
        const cost = service['estimateTranscriptionCost'](
          response,
          'whisper-1',
        );
        expect(cost).toBeCloseTo(0.006, 3); // $0.006 per minute
      });

      it('should estimate cost for whisper-1 without duration (fallback)', () => {
        const response: Audio.Transcription = {
          text: 'Test',
        };
        const cost = service['estimateTranscriptionCost'](
          response,
          'whisper-1',
        );
        expect(cost).toBe(0.006); // Fallback: 1 minute estimate
      });

      it('should estimate cost for gpt-4o-transcribe with usage tokens', () => {
        const response = {
          text: 'Test',
          usage: {
            input_tokens: 1000,
            output_tokens: 500,
          },
        } as Audio.Transcription;
        const cost = service['estimateTranscriptionCost'](
          response,
          'gpt-4o-transcribe',
        );
        expect(cost).toBeGreaterThan(0);
        expect(cost).toBeLessThan(1);
      });

      it('should use default estimate for gpt-4o models without usage', () => {
        const response: Audio.Transcription = {
          text: 'Test',
        };
        const cost = service['estimateTranscriptionCost'](
          response,
          'gpt-4o-transcribe',
        );
        expect(cost).toBe(0.01); // Default estimate
      });
    });

    describe('extractTranscriptionMetadata', () => {
      it('should extract metadata from basic transcription', () => {
        const metadata = service['extractTranscriptionMetadata'](
          mockTranscriptionResponse,
        );
        expect(metadata.text_length).toBe(29);
        expect(metadata.duration_seconds).toBeUndefined();
        expect(metadata.detected_language).toBeUndefined();
      });

      it('should extract metadata from verbose transcription', () => {
        const metadata = service['extractTranscriptionMetadata'](
          mockTranscriptionVerboseResponse,
        );
        expect(metadata.text_length).toBe(51);
        expect(metadata.duration_seconds).toBe(125.5);
        expect(metadata.detected_language).toBe('en');
        expect(metadata.segment_count).toBe(2);
        expect(metadata.word_count).toBe(4);
        expect(metadata.average_confidence).toBeCloseTo(-0.135, 3);
      });

      it('should handle verbose transcription without words', () => {
        const response: Audio.TranscriptionVerbose = {
          ...mockTranscriptionVerboseResponse,
          words: undefined,
        };
        const metadata = service['extractTranscriptionMetadata'](response);
        expect(metadata.word_count).toBeUndefined();
      });

      it('should handle verbose transcription without segments', () => {
        const response: Audio.TranscriptionVerbose = {
          text: 'Test',
          language: 'en',
          duration: 10,
        };
        const metadata = service['extractTranscriptionMetadata'](response);
        expect(metadata.segment_count).toBeUndefined();
        expect(metadata.average_confidence).toBeUndefined();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors in createSpeech', async () => {
      const error = new Error('Network timeout');
      mockOpenAIClient.audio.speech.create.mockRejectedValue(error);

      const dto: CreateSpeechDto = {
        model: 'tts-1',
        voice: 'alloy',
        input: 'Test',
      };

      await expect(service.createSpeech(dto)).rejects.toThrow(
        'Network timeout',
      );
    });

    it('should handle authentication errors in createTranscription', async () => {
      const error = new Error('Invalid API key');
      mockOpenAIClient.audio.transcriptions.create.mockRejectedValue(error);

      const dto: CreateTranscriptionDto = {
        model: 'whisper-1',
      };

      await expect(
        service.createTranscription(mockAudioFile, dto),
      ).rejects.toThrow('Invalid API key');
    });

    it('should handle rate limit errors in createTranslation', async () => {
      const error = new Error('Rate limit exceeded');
      mockOpenAIClient.audio.translations.create.mockRejectedValue(error);

      const dto: CreateTranslationDto = {
        model: 'whisper-1',
      };

      await expect(
        service.createTranslation(mockAudioFile, dto),
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle unknown errors gracefully', async () => {
      const error = 'Unknown error'; // String error
      mockOpenAIClient.audio.speech.create.mockRejectedValue(error);

      const dto: CreateSpeechDto = {
        model: 'tts-1',
        voice: 'alloy',
        input: 'Test',
      };

      await expect(service.createSpeech(dto)).rejects.toBe('Unknown error');

      expect(loggerService.logOpenAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Unknown error',
          }) as Record<string, unknown>,
        }),
      );
    });
  });
});
