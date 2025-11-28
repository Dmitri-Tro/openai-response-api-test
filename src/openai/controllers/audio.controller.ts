import {
  Body,
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { Audio } from 'openai/resources/audio';
import { OpenAIAudioService } from '../services/openai-audio.service';
import { CreateSpeechDto } from '../dto/audio/create-speech.dto';
import { CreateTranscriptionDto } from '../dto/audio/create-transcription.dto';
import { CreateTranslationDto } from '../dto/audio/create-translation.dto';
import { streamBinaryResponse } from '../../common/mixins/binary-streaming.mixin';

/**
 * Controller for OpenAI Audio API
 * Handles Text-to-Speech (TTS), Speech-to-Text (STT), and Translation operations
 *
 * Endpoints:
 * - POST /api/audio/speech - Generate speech from text (TTS)
 * - POST /api/audio/transcriptions - Transcribe audio to text (STT)
 * - POST /api/audio/translations - Translate audio to English text
 */
@ApiTags('Audio API')
@Controller('api/audio')
export class AudioController {
  constructor(private readonly audioService: OpenAIAudioService) {}

  /**
   * Generate speech from text (Text-to-Speech)
   * POST /api/audio/speech
   *
   * Converts text input to spoken audio in various formats and voices.
   * Returns binary audio stream directly.
   *
   * Models:
   * - tts-1: Fast, standard quality ($0.015 per 1K chars)
   * - tts-1-hd: High-definition quality ($0.030 per 1K chars)
   * - gpt-4o-mini-tts: Advanced with instructions ($0.020 per 1K chars)
   *
   * Voices (13 total):
   * - Original 6: alloy, echo, fable, nova, onyx, shimmer
   * - New 7: ash, ballad, coral, sage, verse, marin, cedar
   *
   * Formats: mp3, opus, aac, flac, wav, pcm
   * Speed range: 0.25 (slowest) to 4.0 (fastest)
   */
  @Post('speech')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('application/json')
  @ApiOperation({
    summary: 'Generate speech from text (TTS)',
    description:
      'Convert text to spoken audio using OpenAI Text-to-Speech models. ' +
      'Returns binary audio stream in selected format (mp3, opus, aac, flac, wav, pcm). ' +
      'Maximum input: 4096 characters. ' +
      'Speed control: 0.25-4.0 (1.0 is normal speed). ' +
      '13 voices available: alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer, verse, marin, cedar.',
  })
  @ApiBody({
    type: CreateSpeechDto,
    description: 'TTS generation parameters',
  })
  @ApiResponse({
    status: 200,
    description:
      'Binary audio stream (Content-Type varies by format: audio/mpeg, audio/opus, audio/aac, audio/flac, audio/wav, audio/pcm)',
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid parameters (text too long, invalid voice, invalid speed, etc.)',
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing API key' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 500, description: 'TTS generation failed' })
  async speech(
    @Body() dto: CreateSpeechDto,
    @Res() res: Response,
  ): Promise<void> {
    // Call service to generate speech
    const response = await this.audioService.createSpeech(dto);

    // Extract content type from OpenAI response
    const contentType = response.headers.get('content-type') || 'audio/mpeg';

    // Determine file extension based on response_format
    const formatExtensions: Record<string, string> = {
      mp3: 'mp3',
      opus: 'opus',
      aac: 'aac',
      flac: 'flac',
      wav: 'wav',
      pcm: 'pcm',
    };
    const extension = formatExtensions[dto.response_format || 'mp3'] || 'mp3';

    // Stream binary audio to client using shared mixin
    await streamBinaryResponse(
      response,
      res,
      contentType,
      `speech.${extension}`,
    );
  }

  /**
   * Transcribe audio to text (Speech-to-Text)
   * POST /api/audio/transcriptions
   *
   * Converts audio files to text in the original language.
   * Supports multiple models, formats, and advanced features.
   *
   * Models:
   * - whisper-1: General transcription ($0.006/min)
   * - gpt-4o-transcribe: Better with accents/noise (token-based)
   * - gpt-4o-mini-transcribe: Faster transcription (token-based)
   * - gpt-4o-transcribe-diarize: Speaker identification up to 4 speakers
   *
   * Response formats: json, text, srt, vtt, verbose_json, diarized_json
   * Timestamp granularities: segment (sentence), word, or both
   *
   * Supported audio formats (max 25 MB):
   * flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm
   * Note: opus is NOT supported via API
   */
  @Post('transcriptions')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Transcribe audio to text (STT)',
    description:
      'Transcribe audio files to text in their original language. ' +
      'Maximum file size: 25 MB. ' +
      'Supported formats: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm (opus NOT supported). ' +
      '4 models available: whisper-1 (duration-based pricing), gpt-4o-transcribe, gpt-4o-mini-transcribe, gpt-4o-transcribe-diarize (speaker identification). ' +
      'Response formats: json, text, srt, vtt, verbose_json, diarized_json. ' +
      'Optional features: timestamp granularities (word/segment), language specification, temperature control.',
  })
  @ApiBody({
    description: 'Audio file with transcription parameters',
    schema: {
      type: 'object',
      required: ['file', 'model'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            'Audio file to transcribe (max 25 MB). Formats: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm',
        },
        model: {
          type: 'string',
          enum: [
            'whisper-1',
            'gpt-4o-transcribe',
            'gpt-4o-mini-transcribe',
            'gpt-4o-transcribe-diarize',
          ],
          description: 'Transcription model',
          example: 'whisper-1',
        },
        language: {
          type: 'string',
          description:
            'Optional ISO-639-1 language code (e.g., en, es, fr, de). Improves accuracy.',
          example: 'en',
        },
        prompt: {
          type: 'string',
          description:
            'Optional context hint for vocabulary/style (e.g., "Technical discussion about machine learning")',
          example: 'Technical meeting transcript',
        },
        response_format: {
          type: 'string',
          enum: ['json', 'text', 'srt', 'vtt', 'verbose_json', 'diarized_json'],
          description: 'Output format',
          default: 'json',
          example: 'json',
        },
        temperature: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Sampling temperature (0=focused, 1=random). Default: 0',
          default: 0,
          example: 0.2,
        },
        timestamp_granularities: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['word', 'segment'],
          },
          description:
            'Timestamp detail level (verbose_json only). Options: ["segment"], ["word"], or ["segment", "word"]',
          example: ['segment'],
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description:
      'Transcription result (format varies by response_format parameter)',
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid request (file too large, unsupported format, invalid parameters)',
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing API key' })
  @ApiResponse({ status: 413, description: 'File size exceeds 25 MB limit' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 500, description: 'Transcription failed' })
  async transcribe(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateTranscriptionDto,
  ): Promise<Audio.Transcription | Audio.TranscriptionVerbose | string> {
    return this.audioService.createTranscription(file, dto);
  }

  /**
   * Translate audio to English text
   * POST /api/audio/translations
   *
   * Translates audio from any language to English text.
   * Uses Whisper model for translation (source language auto-detected).
   *
   * Model: whisper-1 only ($0.006/min)
   * Other models (gpt-4o-transcribe, etc.) are NOT supported for translation.
   *
   * Response formats: json, text, srt, vtt, verbose_json
   * Timestamp granularities: NOT supported (transcription only)
   *
   * Supported audio formats (max 25 MB):
   * flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm
   * Note: opus is NOT supported via API
   */
  @Post('translations')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Translate audio to English text',
    description:
      'Translate audio from any language to English text. ' +
      'Maximum file size: 25 MB. ' +
      'Supported formats: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm (opus NOT supported). ' +
      'Only whisper-1 model supported for translation (other models work for transcription only). ' +
      'Source language is auto-detected. Output is always English. ' +
      'Response formats: json, text, srt, vtt, verbose_json. ' +
      'Pricing: $0.006 per minute of audio.',
  })
  @ApiBody({
    description: 'Audio file with translation parameters',
    schema: {
      type: 'object',
      required: ['file', 'model'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            'Audio file to translate (max 25 MB). Formats: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm',
        },
        model: {
          type: 'string',
          enum: ['whisper-1'],
          description:
            'Translation model (only whisper-1 supported for translation)',
          example: 'whisper-1',
        },
        prompt: {
          type: 'string',
          description:
            'Optional context hint for translation style (e.g., "Restaurant menu discussion")',
          example: 'Technical discussion',
        },
        response_format: {
          type: 'string',
          enum: ['json', 'text', 'srt', 'vtt', 'verbose_json'],
          description: 'Output format',
          default: 'json',
          example: 'json',
        },
        temperature: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description:
            'Sampling temperature for translation style (0=consistent, 1=creative). Default: 0',
          default: 0,
          example: 0.3,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description:
      'Translation result in English (format varies by response_format parameter)',
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid request (file too large, unsupported format, invalid model, invalid parameters)',
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing API key' })
  @ApiResponse({ status: 413, description: 'File size exceeds 25 MB limit' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 500, description: 'Translation failed' })
  async translate(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateTranslationDto,
  ): Promise<Audio.Translation | Audio.TranslationVerbose | string> {
    return this.audioService.createTranslation(file, dto);
  }
}
