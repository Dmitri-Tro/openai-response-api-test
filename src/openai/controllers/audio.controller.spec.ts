import { Test, TestingModule } from '@nestjs/testing';
import { AudioController } from './audio.controller';
import { OpenAIAudioService } from '../services/openai-audio.service';
import { LoggerService } from '../../common/services/logger.service';
import { PricingService } from '../../common/services/pricing.service';
import type { CreateSpeechDto } from '../dto/audio/create-speech.dto';
import type { CreateTranscriptionDto } from '../dto/audio/create-transcription.dto';
import type { CreateTranslationDto } from '../dto/audio/create-translation.dto';
import type { Audio } from 'openai/resources/audio';
import type { Response as ExpressResponse } from 'express';
import type { Readable } from 'stream';

describe('AudioController', () => {
  let controller: AudioController;
  let createSpeechSpy: jest.Mock;
  let createTranscriptionSpy: jest.Mock;
  let createTranslationSpy: jest.Mock;

  // Mock Multer file for transcription/translation uploads
  const mockMulterFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'test-audio.mp3',
    encoding: '7bit',
    mimetype: 'audio/mpeg',
    buffer: Buffer.from('mock audio data'),
    size: 1024 * 1024, // 1 MB
    stream: null as unknown as Readable,
    destination: '',
    filename: '',
    path: '',
  };

  // Mock TTS (Speech) response - binary audio
  const mockSpeechResponse = {
    headers: new Map([['content-type', 'audio/mpeg']]),
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
  } as unknown as Response;

  // Mock Transcription response (json format)
  const mockTranscriptionJson: Audio.Transcription = {
    text: 'This is a test transcription.',
  };

  // Mock Transcription response (verbose_json format)
  const mockTranscriptionVerbose: Audio.TranscriptionVerbose = {
    language: 'en',
    duration: 5.5,
    text: 'This is a test transcription with metadata.',
    words: [
      {
        word: 'This',
        start: 0.0,
        end: 0.3,
      },
      {
        word: 'is',
        start: 0.3,
        end: 0.5,
      },
    ],
    segments: [
      {
        id: 0,
        seek: 0,
        start: 0.0,
        end: 5.5,
        text: 'This is a test transcription with metadata.',
        tokens: [1, 2, 3],
        temperature: 0.0,
        avg_logprob: -0.5,
        compression_ratio: 1.2,
        no_speech_prob: 0.01,
      },
    ],
  };

  // Mock Translation response (json format)
  const mockTranslationJson: Audio.Translation = {
    text: 'This is a test translation to English.',
  };

  // Mock Translation response (verbose_json format)
  const mockTranslationVerbose: Audio.TranslationVerbose = {
    language: 'es',
    duration: 6.2,
    text: 'This is a test translation to English.',
    segments: [
      {
        id: 0,
        seek: 0,
        start: 0.0,
        end: 6.2,
        text: 'This is a test translation to English.',
        tokens: [1, 2, 3, 4],
        temperature: 0.0,
        avg_logprob: -0.6,
        compression_ratio: 1.3,
        no_speech_prob: 0.02,
      },
    ],
  };

  let mockResponse: ExpressResponse;
  let mockAudioService: jest.Mocked<OpenAIAudioService>;
  let setHeaderSpy: jest.Mock;
  let endSpy: jest.Mock;

  beforeEach(async () => {
    createSpeechSpy = jest.fn();
    createTranscriptionSpy = jest.fn();
    createTranslationSpy = jest.fn();
    setHeaderSpy = jest.fn();
    endSpy = jest.fn();

    mockAudioService = {
      createSpeech: createSpeechSpy,
      createTranscription: createTranscriptionSpy,
      createTranslation: createTranslationSpy,
    } as unknown as jest.Mocked<OpenAIAudioService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AudioController],
      providers: [
        {
          provide: OpenAIAudioService,
          useValue: mockAudioService,
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

    controller = module.get<AudioController>(AudioController);

    mockResponse = {
      setHeader: setHeaderSpy,
      send: jest.fn(),
      write: jest.fn(),
      end: endSpy,
    } as unknown as ExpressResponse;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('speech (TTS)', () => {
    it('should generate speech with minimal parameters (tts-1, mp3)', async () => {
      mockAudioService.createSpeech.mockResolvedValue(mockSpeechResponse);

      const dto: CreateSpeechDto = {
        model: 'tts-1',
        voice: 'alloy',
        input: 'Hello, world!',
      };

      await controller.speech(dto, mockResponse);

      expect(createSpeechSpy).toHaveBeenCalledWith(dto);
      expect(createSpeechSpy).toHaveBeenCalledTimes(1);
      expect(setHeaderSpy).toHaveBeenCalledWith('Content-Type', 'audio/mpeg');
      expect(setHeaderSpy).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="speech.mp3"',
      );
      expect(endSpy).toHaveBeenCalled();
    });

    it('should generate speech with tts-1-hd model', async () => {
      mockAudioService.createSpeech.mockResolvedValue(mockSpeechResponse);

      const dto: CreateSpeechDto = {
        model: 'tts-1-hd',
        voice: 'shimmer',
        input: 'High quality audio test.',
        response_format: 'mp3',
        speed: 1.0,
      };

      await controller.speech(dto, mockResponse);

      expect(createSpeechSpy).toHaveBeenCalledWith(dto);
    });

    it('should generate speech with gpt-4o-mini-tts and instructions', async () => {
      mockAudioService.createSpeech.mockResolvedValue(mockSpeechResponse);

      const dto: CreateSpeechDto = {
        model: 'gpt-4o-mini-tts',
        voice: 'nova',
        input: 'Testing instructions support.',
        response_format: 'mp3',
        speed: 1.0,
        instructions: 'Speak in a cheerful, energetic tone',
      };

      await controller.speech(dto, mockResponse);

      expect(createSpeechSpy).toHaveBeenCalledWith(dto);
      expect(dto.instructions).toBe('Speak in a cheerful, energetic tone');
    });

    it('should generate speech with opus format', async () => {
      const opusResponse = {
        headers: new Map([['content-type', 'audio/opus']]),
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
      } as unknown as Response;
      mockAudioService.createSpeech.mockResolvedValue(opusResponse);

      const dto: CreateSpeechDto = {
        model: 'tts-1',
        voice: 'echo',
        input: 'Testing opus format.',
        response_format: 'opus',
      };

      await controller.speech(dto, mockResponse);

      expect(createSpeechSpy).toHaveBeenCalledWith(dto);
      expect(setHeaderSpy).toHaveBeenCalledWith('Content-Type', 'audio/opus');
      expect(setHeaderSpy).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="speech.opus"',
      );
    });

    it('should generate speech with flac format', async () => {
      const flacResponse = {
        headers: new Map([['content-type', 'audio/flac']]),
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(2048)),
      } as unknown as Response;
      mockAudioService.createSpeech.mockResolvedValue(flacResponse);

      const dto: CreateSpeechDto = {
        model: 'tts-1-hd',
        voice: 'onyx',
        input: 'Testing flac format.',
        response_format: 'flac',
      };

      await controller.speech(dto, mockResponse);

      expect(createSpeechSpy).toHaveBeenCalledWith(dto);
      expect(setHeaderSpy).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="speech.flac"',
      );
    });

    it('should generate speech with custom speed (0.5)', async () => {
      mockAudioService.createSpeech.mockResolvedValue(mockSpeechResponse);

      const dto: CreateSpeechDto = {
        model: 'tts-1',
        voice: 'fable',
        input: 'Slow speech test.',
        speed: 0.5,
      };

      await controller.speech(dto, mockResponse);

      expect(createSpeechSpy).toHaveBeenCalledWith(dto);
      expect(dto.speed).toBe(0.5);
    });

    it('should generate speech with custom speed (2.0)', async () => {
      mockAudioService.createSpeech.mockResolvedValue(mockSpeechResponse);

      const dto: CreateSpeechDto = {
        model: 'tts-1',
        voice: 'fable',
        input: 'Fast speech test.',
        speed: 2.0,
      };

      await controller.speech(dto, mockResponse);

      expect(createSpeechSpy).toHaveBeenCalledWith(dto);
      expect(dto.speed).toBe(2.0);
    });

    it('should generate speech with all 13 voices (test alloy)', async () => {
      mockAudioService.createSpeech.mockResolvedValue(mockSpeechResponse);

      const dto: CreateSpeechDto = {
        model: 'tts-1',
        voice: 'alloy',
        input: 'Voice test.',
      };

      await controller.speech(dto, mockResponse);

      expect(createSpeechSpy).toHaveBeenCalledWith(dto);
    });

    it('should generate speech with pcm format (raw audio)', async () => {
      const pcmResponse = {
        headers: new Map([['content-type', 'audio/pcm']]),
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(4096)),
      } as unknown as Response;
      mockAudioService.createSpeech.mockResolvedValue(pcmResponse);

      const dto: CreateSpeechDto = {
        model: 'tts-1',
        voice: 'sage',
        input: 'Testing PCM format.',
        response_format: 'pcm',
      };

      await controller.speech(dto, mockResponse);

      expect(createSpeechSpy).toHaveBeenCalledWith(dto);
      expect(setHeaderSpy).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="speech.pcm"',
      );
    });

    it('should handle fallback content type when not in response headers', async () => {
      const noHeaderResponse = {
        headers: new Map(),
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
      } as unknown as Response;
      mockAudioService.createSpeech.mockResolvedValue(noHeaderResponse);

      const dto: CreateSpeechDto = {
        model: 'tts-1',
        voice: 'alloy',
        input: 'Test.',
      };

      await controller.speech(dto, mockResponse);

      // Should default to audio/mpeg
      expect(setHeaderSpy).toHaveBeenCalledWith('Content-Type', 'audio/mpeg');
    });
  });

  describe('transcribe (Speech-to-Text)', () => {
    it('should transcribe audio with minimal parameters (whisper-1, json)', async () => {
      mockAudioService.createTranscription.mockResolvedValue(
        mockTranscriptionJson,
      );

      const dto: CreateTranscriptionDto = {
        model: 'whisper-1',
      };

      const result = await controller.transcribe(mockMulterFile, dto);

      expect(createTranscriptionSpy).toHaveBeenCalledWith(mockMulterFile, dto);
      expect(createTranscriptionSpy).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockTranscriptionJson);
    });

    it('should transcribe audio with verbose_json format', async () => {
      mockAudioService.createTranscription.mockResolvedValue(
        mockTranscriptionVerbose,
      );

      const dto: CreateTranscriptionDto = {
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['word', 'segment'],
      };

      const result = await controller.transcribe(mockMulterFile, dto);

      expect(createTranscriptionSpy).toHaveBeenCalledWith(mockMulterFile, dto);
      expect(result).toEqual(mockTranscriptionVerbose);
    });

    it('should transcribe audio with gpt-4o-transcribe model', async () => {
      mockAudioService.createTranscription.mockResolvedValue(
        mockTranscriptionJson,
      );

      const dto: CreateTranscriptionDto = {
        model: 'gpt-4o-transcribe',
        language: 'en',
        response_format: 'json',
      };

      await controller.transcribe(mockMulterFile, dto);

      expect(createTranscriptionSpy).toHaveBeenCalledWith(mockMulterFile, dto);
      expect(dto.model).toBe('gpt-4o-transcribe');
    });

    it('should transcribe audio with gpt-4o-mini-transcribe model', async () => {
      mockAudioService.createTranscription.mockResolvedValue(
        mockTranscriptionJson,
      );

      const dto: CreateTranscriptionDto = {
        model: 'gpt-4o-mini-transcribe',
        language: 'es',
        response_format: 'json',
      };

      await controller.transcribe(mockMulterFile, dto);

      expect(createTranscriptionSpy).toHaveBeenCalledWith(mockMulterFile, dto);
      expect(dto.model).toBe('gpt-4o-mini-transcribe');
    });

    it('should transcribe audio with gpt-4o-transcribe-diarize model', async () => {
      mockAudioService.createTranscription.mockResolvedValue(
        mockTranscriptionVerbose,
      );

      const dto: CreateTranscriptionDto = {
        model: 'gpt-4o-transcribe-diarize',
        response_format: 'diarized_json',
      };

      await controller.transcribe(mockMulterFile, dto);

      expect(createTranscriptionSpy).toHaveBeenCalledWith(mockMulterFile, dto);
      expect(dto.response_format).toBe('diarized_json');
    });

    it('should transcribe audio with language hint', async () => {
      mockAudioService.createTranscription.mockResolvedValue(
        mockTranscriptionJson,
      );

      const dto: CreateTranscriptionDto = {
        model: 'whisper-1',
        language: 'fr',
        response_format: 'json',
      };

      await controller.transcribe(mockMulterFile, dto);

      expect(createTranscriptionSpy).toHaveBeenCalledWith(mockMulterFile, dto);
      expect(dto.language).toBe('fr');
    });

    it('should transcribe audio with prompt for context', async () => {
      mockAudioService.createTranscription.mockResolvedValue(
        mockTranscriptionJson,
      );

      const dto: CreateTranscriptionDto = {
        model: 'whisper-1',
        prompt: 'This is a technical discussion about AI.',
        response_format: 'json',
      };

      await controller.transcribe(mockMulterFile, dto);

      expect(createTranscriptionSpy).toHaveBeenCalledWith(mockMulterFile, dto);
      expect(dto.prompt).toBe('This is a technical discussion about AI.');
    });

    it('should transcribe audio with text format (plain string)', async () => {
      mockAudioService.createTranscription.mockResolvedValue(
        'This is plain text transcription.',
      );

      const dto: CreateTranscriptionDto = {
        model: 'whisper-1',
        response_format: 'text',
      };

      const result = await controller.transcribe(mockMulterFile, dto);

      expect(createTranscriptionSpy).toHaveBeenCalledWith(mockMulterFile, dto);
      expect(result).toBe('This is plain text transcription.');
    });

    it('should transcribe audio with srt format (subtitles)', async () => {
      const srtOutput = `1
00:00:00,000 --> 00:00:05,000
This is a test transcription.`;
      mockAudioService.createTranscription.mockResolvedValue(srtOutput);

      const dto: CreateTranscriptionDto = {
        model: 'whisper-1',
        response_format: 'srt',
      };

      const result = await controller.transcribe(mockMulterFile, dto);

      expect(createTranscriptionSpy).toHaveBeenCalledWith(mockMulterFile, dto);
      expect(result).toBe(srtOutput);
    });

    it('should transcribe audio with vtt format (WebVTT subtitles)', async () => {
      const vttOutput = `WEBVTT

00:00:00.000 --> 00:00:05.000
This is a test transcription.`;
      mockAudioService.createTranscription.mockResolvedValue(vttOutput);

      const dto: CreateTranscriptionDto = {
        model: 'whisper-1',
        response_format: 'vtt',
      };

      const result = await controller.transcribe(mockMulterFile, dto);

      expect(createTranscriptionSpy).toHaveBeenCalledWith(mockMulterFile, dto);
      expect(result).toBe(vttOutput);
    });

    it('should transcribe audio with custom temperature', async () => {
      mockAudioService.createTranscription.mockResolvedValue(
        mockTranscriptionJson,
      );

      const dto: CreateTranscriptionDto = {
        model: 'whisper-1',
        temperature: 0.5,
        response_format: 'json',
      };

      await controller.transcribe(mockMulterFile, dto);

      expect(createTranscriptionSpy).toHaveBeenCalledWith(mockMulterFile, dto);
      expect(dto.temperature).toBe(0.5);
    });

    it('should transcribe audio with timestamp granularities (word only)', async () => {
      mockAudioService.createTranscription.mockResolvedValue(
        mockTranscriptionVerbose,
      );

      const dto: CreateTranscriptionDto = {
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['word'],
      };

      await controller.transcribe(mockMulterFile, dto);

      expect(createTranscriptionSpy).toHaveBeenCalledWith(mockMulterFile, dto);
      expect(dto.timestamp_granularities).toEqual(['word']);
    });
  });

  describe('translate (Audio Translation to English)', () => {
    it('should translate audio with minimal parameters (whisper-1, json)', async () => {
      mockAudioService.createTranslation.mockResolvedValue(mockTranslationJson);

      const dto: CreateTranslationDto = {
        model: 'whisper-1',
      };

      const result = await controller.translate(mockMulterFile, dto);

      expect(createTranslationSpy).toHaveBeenCalledWith(mockMulterFile, dto);
      expect(createTranslationSpy).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockTranslationJson);
    });

    it('should translate audio with verbose_json format', async () => {
      mockAudioService.createTranslation.mockResolvedValue(
        mockTranslationVerbose,
      );

      const dto: CreateTranslationDto = {
        model: 'whisper-1',
        response_format: 'verbose_json',
      };

      const result = await controller.translate(mockMulterFile, dto);

      expect(createTranslationSpy).toHaveBeenCalledWith(mockMulterFile, dto);
      expect(result).toEqual(mockTranslationVerbose);
    });

    it('should translate audio with text format (plain string)', async () => {
      mockAudioService.createTranslation.mockResolvedValue(
        'This is plain text translation to English.',
      );

      const dto: CreateTranslationDto = {
        model: 'whisper-1',
        response_format: 'text',
      };

      const result = await controller.translate(mockMulterFile, dto);

      expect(createTranslationSpy).toHaveBeenCalledWith(mockMulterFile, dto);
      expect(result).toBe('This is plain text translation to English.');
    });

    it('should translate audio with srt format (subtitles)', async () => {
      const srtOutput = `1
00:00:00,000 --> 00:00:06,000
This is a test translation to English.`;
      mockAudioService.createTranslation.mockResolvedValue(srtOutput);

      const dto: CreateTranslationDto = {
        model: 'whisper-1',
        response_format: 'srt',
      };

      const result = await controller.translate(mockMulterFile, dto);

      expect(createTranslationSpy).toHaveBeenCalledWith(mockMulterFile, dto);
      expect(result).toBe(srtOutput);
    });

    it('should translate audio with vtt format (WebVTT subtitles)', async () => {
      const vttOutput = `WEBVTT

00:00:00.000 --> 00:00:06.000
This is a test translation to English.`;
      mockAudioService.createTranslation.mockResolvedValue(vttOutput);

      const dto: CreateTranslationDto = {
        model: 'whisper-1',
        response_format: 'vtt',
      };

      const result = await controller.translate(mockMulterFile, dto);

      expect(createTranslationSpy).toHaveBeenCalledWith(mockMulterFile, dto);
      expect(result).toBe(vttOutput);
    });

    it('should translate audio with prompt for context', async () => {
      mockAudioService.createTranslation.mockResolvedValue(mockTranslationJson);

      const dto: CreateTranslationDto = {
        model: 'whisper-1',
        prompt: 'This is a medical conference discussion about cardiology.',
        response_format: 'json',
      };

      await controller.translate(mockMulterFile, dto);

      expect(createTranslationSpy).toHaveBeenCalledWith(mockMulterFile, dto);
      expect(dto.prompt).toBe(
        'This is a medical conference discussion about cardiology.',
      );
    });

    it('should translate audio with custom temperature', async () => {
      mockAudioService.createTranslation.mockResolvedValue(mockTranslationJson);

      const dto: CreateTranslationDto = {
        model: 'whisper-1',
        temperature: 0.7,
        response_format: 'json',
      };

      await controller.translate(mockMulterFile, dto);

      expect(createTranslationSpy).toHaveBeenCalledWith(mockMulterFile, dto);
      expect(dto.temperature).toBe(0.7);
    });
  });
});
