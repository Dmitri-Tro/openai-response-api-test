import { Injectable, Inject } from '@nestjs/common';
import OpenAI, { toFile } from 'openai';
import { OPENAI_CLIENT } from '../providers/openai-client.provider';
import type { Audio } from 'openai/resources/audio';
import { LoggerService } from '../../common/services/logger.service';
import {
  CreateSpeechDto,
  CreateTranscriptionDto,
  CreateTranslationDto,
} from '../dto/audio';
import type { TranscriptionMetadata } from '../interfaces/audio';
import {
  calculateSpeechCost,
  calculateTranscriptionCost,
} from '../../common/utils/cost-estimation.utils';

/**
 * Service for interacting with OpenAI Audio API
 *
 * **Purpose**: Standalone Audio API for speech generation, transcription, and translation.
 * This is separate from Responses API audio modality (Phase 2).
 *
 * **Supported Operations**:
 * - Text-to-Speech (TTS): Convert text to spoken audio
 * - Speech-to-Text (Transcription): Convert audio to text in original language
 * - Audio Translation: Convert audio from any language to English text
 *
 * **API Distinction**:
 * - **Audio API** (Phase 6): Direct operations via `/v1/audio/*` endpoints
 * - **Responses API** (Phase 2): Conversational audio via `/v1/responses` with audio modality
 *
 * @see {@link https://platform.openai.com/docs/api-reference/audio}
 */
@Injectable()
export class OpenAIAudioService {
  constructor(
    @Inject(OPENAI_CLIENT) private readonly client: OpenAI,
    private readonly loggerService: LoggerService,
  ) {}

  /**
   * Generate spoken audio from text using TTS (Text-to-Speech)
   *
   * **Model Capabilities**:
   * - **tts-1**: Optimized for real-time, lower latency
   * - **tts-1-hd**: Higher quality, optimized for fidelity
   * - **gpt-4o-mini-tts**: Latest model with advanced features and instructions support
   *
   * **Voice Options** (13 total):
   * - alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer, verse, marin, cedar
   *
   * **Audio Formats**:
   * - mp3: Default, widely compatible
   * - opus: Internet streaming, low latency
   * - aac: YouTube, mobile (iOS/Android)
   * - flac: Audiophile quality, lossless
   * - wav: Low latency applications
   * - pcm: Raw audio (24kHz, no headers)
   *
   * @param dto - Speech generation parameters
   * @returns Binary Response object for streaming to client
   *
   * @example
   * ```typescript
   * // High-quality speech with custom voice
   * const response = await service.createSpeech({
   *   model: 'tts-1-hd',
   *   voice: 'shimmer',
   *   input: 'The quick brown fox jumps over the lazy dog.',
   *   response_format: 'mp3',
   *   speed: 1.0
   * });
   *
   * // GPT-4o with instructions
   * const response = await service.createSpeech({
   *   model: 'gpt-4o-mini-tts',
   *   voice: 'alloy',
   *   input: 'Hello world!',
   *   instructions: 'Speak in a cheerful, energetic tone'
   * });
   * ```
   */
  async createSpeech(dto: CreateSpeechDto): Promise<Response> {
    const startTime = Date.now();

    try {
      // Build SDK parameters from DTO
      const params = {
        model: dto.model,
        voice: dto.voice,
        input: dto.input,
        ...(dto.response_format && { response_format: dto.response_format }),
        ...(dto.speed && { speed: dto.speed }),
        ...(dto.instructions && { instructions: dto.instructions }),
      };

      // Call OpenAI SDK
      const response: Response = await this.client.audio.speech.create(params);

      // Calculate cost estimate
      const costEstimate = calculateSpeechCost(dto.model, dto.input.length);

      // Log successful interaction
      this.loggerService.logOpenAIInteraction({
        timestamp: new Date().toISOString(),
        api: 'audio',
        endpoint: '/v1/audio/speech',
        request: params,
        response: {
          status: 'success',
          format: dto.response_format || 'mp3',
        },
        metadata: {
          latency_ms: Date.now() - startTime,
          model: dto.model,
          voice: dto.voice,
          character_count: dto.input.length,
          response_format: dto.response_format || 'mp3',
          speed: dto.speed || 1.0,
          cost_estimate: costEstimate,
        },
      });

      return response;
    } catch (error: unknown) {
      const latency = Date.now() - startTime;

      // Log error
      this.loggerService.logOpenAIInteraction({
        timestamp: new Date().toISOString(),
        api: 'audio',
        endpoint: '/v1/audio/speech',
        request: {
          model: dto.model,
          voice: dto.voice,
          character_count: dto.input.length,
        },
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          original_error: error,
        },
        metadata: {
          latency_ms: latency,
        },
      });

      // Rethrow error for exception filter to handle
      throw error;
    }
  }

  /**
   * Transcribe audio to text in the original language
   *
   * **Model Capabilities**:
   * - **whisper-1**: Powered by Whisper V2, general purpose
   * - **gpt-4o-transcribe**: Better nuance, reduced errors, handles accents/noise
   * - **gpt-4o-mini-transcribe**: Faster, more efficient transcription
   * - **gpt-4o-transcribe-diarize**: Speaker identification (up to 4 speakers)
   *
   * **Response Formats**:
   * - json: Simple { text: string } response
   * - text: Plain string output
   * - srt: SubRip subtitle format
   * - vtt: WebVTT subtitle format
   * - verbose_json: Extended metadata with segments and words
   * - diarized_json: Speaker identification with timestamps
   *
   * **Timestamp Granularities** (verbose_json only):
   * - segment: Sentence-level timestamps (default)
   * - word: Word-level timestamps (adds latency)
   * - ['segment', 'word']: Both granularities
   *
   * **Supported Audio Formats**:
   * flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm (max 25 MB)
   *
   * @param file - Audio file (Multer file, max 25 MB)
   * @param dto - Transcription parameters
   * @returns Transcription response (format depends on response_format)
   *
   * @example
   * ```typescript
   * // Basic transcription
   * const response = await service.createTranscription(audioFile, {
   *   model: 'whisper-1',
   *   language: 'en'
   * });
   *
   * // Verbose with word timestamps
   * const response = await service.createTranscription(audioFile, {
   *   model: 'gpt-4o-transcribe',
   *   response_format: 'verbose_json',
   *   timestamp_granularities: ['word', 'segment']
   * });
   *
   * // Speaker diarization
   * const response = await service.createTranscription(audioFile, {
   *   model: 'gpt-4o-transcribe-diarize',
   *   response_format: 'diarized_json'
   * });
   * ```
   */
  async createTranscription(
    file: Express.Multer.File,
    dto: CreateTranscriptionDto,
  ): Promise<Audio.Transcription | Audio.TranscriptionVerbose | string> {
    const startTime = Date.now();

    try {
      // Convert Multer file buffer to File using OpenAI SDK helper
      const audioFile = await toFile(file.buffer, file.originalname, {
        type: file.mimetype,
      });

      // Build SDK parameters
      const params = {
        file: audioFile,
        model: dto.model,
        ...(dto.language && { language: dto.language }),
        ...(dto.prompt && { prompt: dto.prompt }),
        ...(dto.response_format && { response_format: dto.response_format }),
        ...(dto.temperature !== undefined && { temperature: dto.temperature }),
        ...(dto.timestamp_granularities && {
          timestamp_granularities: dto.timestamp_granularities,
        }),
      };

      // Call OpenAI SDK
      // Note: SDK types show Audio.Transcription but API returns string for text/srt/vtt formats
      const response = await this.client.audio.transcriptions.create(params);

      // Prepare log response (consolidates type checking and metadata extraction)
      const logData = this.prepareTranscriptionLogResponse(response);

      // Calculate cost estimate
      const costEstimate = this.estimateTranscriptionCost(response, dto.model);

      // Log successful interaction
      this.loggerService.logOpenAIInteraction({
        timestamp: new Date().toISOString(),
        api: 'audio',
        endpoint: '/v1/audio/transcriptions',
        request: {
          model: dto.model,
          language: dto.language,
          response_format: dto.response_format,
          file_size_bytes: file.size,
          filename: file.originalname,
        },
        response: logData.logResponse,
        metadata: {
          latency_ms: Date.now() - startTime,
          model: dto.model,
          file_size_mb: (file.size / 1024 / 1024).toFixed(2),
          text_length: logData.textLength,
          duration_seconds: logData.durationSeconds,
          detected_language: logData.detectedLanguage,
          segment_count: logData.segmentCount,
          word_count: logData.wordCount,
          average_confidence: logData.averageConfidence,
          cost_estimate: costEstimate,
        },
      });

      return response;
    } catch (error: unknown) {
      const latency = Date.now() - startTime;

      // Log error
      this.loggerService.logOpenAIInteraction({
        timestamp: new Date().toISOString(),
        api: 'audio',
        endpoint: '/v1/audio/transcriptions',
        request: {
          model: dto.model,
          file_size_bytes: file.size,
          filename: file.originalname,
        },
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          original_error: error,
        },
        metadata: {
          latency_ms: latency,
        },
      });

      throw error;
    }
  }

  /**
   * Translate audio from any language to English text
   *
   * **Model Support**:
   * - **whisper-1**: Powered by Whisper V2, general purpose
   * - Note: whisper-turbo NOT recommended (returns original language)
   *
   * **Translation Direction**:
   * - Supported: Any language → English
   * - NOT supported: English → Other languages, Language A → Language B
   *
   * **Response Formats**:
   * - json: Simple { text: string } response (default)
   * - text: Plain string output
   * - srt: SubRip subtitle format
   * - vtt: WebVTT subtitle format
   * - verbose_json: Extended metadata with segments
   *
   * **Supported Audio Formats**:
   * mp3, mp4, mpeg, mpga, m4a, wav, webm (max 25 MB)
   *
   * @param file - Audio file (Multer file, max 25 MB)
   * @param dto - Translation parameters
   * @returns Translation response in English (format depends on response_format)
   *
   * @example
   * ```typescript
   * // Basic translation (Spanish → English)
   * const response = await service.createTranslation(spanishAudioFile, {
   *   model: 'whisper-1'
   * });
   *
   * // Verbose translation with metadata
   * const response = await service.createTranslation(frenchAudioFile, {
   *   model: 'whisper-1',
   *   response_format: 'verbose_json'
   * });
   * ```
   */
  async createTranslation(
    file: Express.Multer.File,
    dto: CreateTranslationDto,
  ): Promise<Audio.Translation | Audio.TranslationVerbose | string> {
    const startTime = Date.now();

    try {
      // Convert Multer file buffer to File using OpenAI SDK helper
      const audioFile = await toFile(file.buffer, file.originalname, {
        type: file.mimetype,
      });

      // Build SDK parameters
      const params = {
        file: audioFile,
        model: dto.model,
        ...(dto.prompt && { prompt: dto.prompt }),
        ...(dto.response_format && { response_format: dto.response_format }),
        ...(dto.temperature !== undefined && { temperature: dto.temperature }),
      };

      // Call OpenAI SDK
      // Note: SDK types show Audio.Translation but API returns string for text/srt/vtt formats
      const response = await this.client.audio.translations.create(params);

      // Prepare log response (consolidates type checking and metadata extraction)
      const logData = this.prepareTranslationLogResponse(response);

      // Calculate cost estimate (duration-based for whisper-1)
      const costEstimate = this.estimateTranscriptionCost(response, dto.model);

      // Log successful interaction
      this.loggerService.logOpenAIInteraction({
        timestamp: new Date().toISOString(),
        api: 'audio',
        endpoint: '/v1/audio/translations',
        request: {
          model: dto.model,
          response_format: dto.response_format,
          file_size_bytes: file.size,
          filename: file.originalname,
        },
        response: logData.logResponse,
        metadata: {
          latency_ms: Date.now() - startTime,
          model: dto.model,
          file_size_mb: (file.size / 1024 / 1024).toFixed(2),
          text_length: logData.textLength,
          detected_language: logData.detectedLanguage,
          duration_seconds: logData.durationSeconds,
          cost_estimate: costEstimate,
        },
      });

      return response;
    } catch (error: unknown) {
      const latency = Date.now() - startTime;

      // Log error
      this.loggerService.logOpenAIInteraction({
        timestamp: new Date().toISOString(),
        api: 'audio',
        endpoint: '/v1/audio/translations',
        request: {
          model: dto.model,
          file_size_bytes: file.size,
          filename: file.originalname,
        },
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          original_error: error,
        },
        metadata: {
          latency_ms: latency,
        },
      });

      throw error;
    }
  }

  /**
   * Estimate cost of transcription or translation
   *
   * **Pricing Models**:
   * - **whisper-1**: Duration-based ($0.006 per minute)
   * - **gpt-4o models**: Token-based pricing (varies by model)
   *
   * **Fallback**: If duration is unavailable, estimates based on file size
   * (approximate: 1 MB ≈ 1 minute for typical audio)
   *
   * @param response - Transcription/translation response
   * @param model - Model used for transcription/translation
   * @returns Estimated cost in USD
   *
   * @example
   * ```typescript
   * const cost = service.estimateTranscriptionCost(response, 'whisper-1');
   * // Returns cost based on audio duration
   * ```
   */
  private estimateTranscriptionCost(
    response:
      | Audio.Transcription
      | Audio.TranscriptionVerbose
      | Audio.Translation
      | Audio.TranslationVerbose
      | string,
    model: string,
  ): number {
    let duration = 0;
    let usage: { input_tokens?: number; output_tokens?: number } | undefined;

    if (typeof response === 'object' && response !== null) {
      if ('duration' in response) {
        duration = response.duration;
      }
      if ('usage' in response) {
        usage = response.usage as {
          input_tokens?: number;
          output_tokens?: number;
        };
      }
    }

    // Fallback duration if not present (approx 1 min)
    if (duration === 0 && model === 'whisper-1') {
      duration = 60;
    }

    return calculateTranscriptionCost(model, duration, usage);
  }

  /**
   * Prepare transcription response for logging
   *
   * Handles both object and string responses, extracting metadata for logging purposes.
   * Reduces complexity by consolidating type checking and metadata extraction.
   *
   * @param response - Transcription response (object or string)
   * @returns Prepared logging data with extracted metadata
   */
  private prepareTranscriptionLogResponse(
    response: Audio.Transcription | Audio.TranscriptionVerbose | string,
  ): {
    textLength: number;
    logResponse: unknown;
    durationSeconds?: number;
    detectedLanguage?: string;
    segmentCount?: number;
    wordCount?: number;
    averageConfidence?: number;
  } {
    const isObjectResponse =
      typeof response === 'object' && response !== null && 'text' in response;

    if (isObjectResponse) {
      const metadata = this.extractTranscriptionMetadata(response);
      return {
        textLength: metadata.text_length,
        durationSeconds: metadata.duration_seconds,
        detectedLanguage: metadata.detected_language,
        segmentCount: metadata.segment_count,
        wordCount: metadata.word_count,
        averageConfidence: metadata.average_confidence,
        logResponse: response,
      };
    } else {
      // String response (text/srt/vtt formats)
      const stringResponse = String(response);
      return {
        textLength: stringResponse.length,
        logResponse: { text: stringResponse.substring(0, 200) },
      };
    }
  }

  /**
   * Prepare translation response for logging
   *
   * Handles verbose_json, simple json, and string responses, extracting metadata for logging.
   * Consolidates type checking logic for cleaner service methods.
   *
   * @param response - Translation response (object or string)
   * @returns Prepared logging data with extracted metadata
   */
  private prepareTranslationLogResponse(
    response: Audio.Translation | Audio.TranslationVerbose | string,
  ): {
    textLength: number;
    logResponse: unknown;
    detectedLanguage?: string;
    durationSeconds?: number;
  } {
    const isVerboseObject =
      typeof response === 'object' &&
      response !== null &&
      'language' in response &&
      'duration' in response;
    const isSimpleObject =
      typeof response === 'object' && response !== null && 'text' in response;

    if (isVerboseObject) {
      const verboseResponse = response;
      return {
        textLength: verboseResponse.text.length,
        detectedLanguage: verboseResponse.language,
        durationSeconds: verboseResponse.duration,
        logResponse: response,
      };
    } else if (isSimpleObject) {
      const simpleResponse = response;
      return {
        textLength: simpleResponse.text.length,
        logResponse: response,
      };
    } else {
      // String response (text/srt/vtt formats)
      const stringResponse = String(response);
      return {
        textLength: stringResponse.length,
        logResponse: { text: stringResponse.substring(0, 200) },
      };
    }
  }

  /**
   * Extract structured metadata from transcription response
   *
   * **Extracted Fields**:
   * - duration_seconds: Audio duration
   * - detected_language: ISO-639-1 language code
   * - text_length: Length of transcribed text
   * - segment_count: Number of segments (verbose_json only)
   * - word_count: Number of words with timestamps (verbose_json only)
   * - average_confidence: Average log probability (verbose_json only)
   *
   * @param response - Transcription response
   * @returns Structured metadata object
   *
   * @example
   * ```typescript
   * const metadata = service.extractTranscriptionMetadata(response);
   * // { duration_seconds: 125.5, detected_language: 'en', text_length: 543, ... }
   * ```
   */
  private extractTranscriptionMetadata(
    response: Audio.Transcription | Audio.TranscriptionVerbose,
  ): TranscriptionMetadata {
    const baseMetadata: TranscriptionMetadata = {
      text_length: response.text.length,
    };

    // Extract verbose metadata if available
    if ('duration' in response) {
      baseMetadata.duration_seconds = response.duration;
    }

    if ('language' in response) {
      baseMetadata.detected_language = response.language;
    }

    if ('segments' in response && response.segments) {
      baseMetadata.segment_count = response.segments.length;

      // Calculate average confidence from segments
      const totalLogProb = response.segments.reduce(
        (sum, segment) => sum + (segment.avg_logprob || 0),
        0,
      );
      baseMetadata.average_confidence = totalLogProb / response.segments.length;
    }

    if ('words' in response && response.words) {
      baseMetadata.word_count = response.words.length;
    }

    return baseMetadata;
  }
}
