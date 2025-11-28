/**
 * Audio API configuration constants and types
 *
 * **Purpose**: Define constants for audio processing limits and supported formats
 *
 * **Use Cases**:
 * - File validation (size, format)
 * - Model validation
 * - Voice validation
 *
 * @example
 * ```typescript
 * if (file.size > AUDIO_CONFIG.maxFileSizeBytes) {
 *   throw new Error(`File exceeds ${AUDIO_CONFIG.maxFileSizeMB} MB limit`);
 * }
 * ```
 */

/**
 * Audio API configuration constants
 */
export const AUDIO_CONFIG = {
  /**
   * Maximum file size in bytes (25 MB)
   */
  maxFileSizeBytes: 25 * 1024 * 1024,

  /**
   * Maximum file size in megabytes
   */
  maxFileSizeMB: 25,

  /**
   * Supported audio formats for transcription and translation
   * Note: opus is NOT supported via API (only in open-source Whisper)
   */
  supportedTranscriptionFormats: [
    'flac',
    'mp3',
    'mp4',
    'mpeg',
    'mpga',
    'm4a',
    'ogg',
    'wav',
    'webm',
  ],

  /**
   * Supported audio formats for TTS output
   */
  supportedSpeechFormats: ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'],

  /**
   * Text-to-Speech models
   */
  ttsModels: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts'],

  /**
   * Transcription models
   */
  transcriptionModels: [
    'whisper-1',
    'gpt-4o-transcribe',
    'gpt-4o-mini-transcribe',
    'gpt-4o-transcribe-diarize',
  ],

  /**
   * Translation models (whisper-1 only)
   */
  translationModels: ['whisper-1'],

  /**
   * Available TTS voices (13 total)
   */
  voices: [
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
  ],

  /**
   * Maximum characters for TTS input
   */
  maxTTSCharacters: 4096,

  /**
   * Speed range for TTS (0.25 to 4.0)
   */
  speedRange: {
    min: 0.25,
    max: 4.0,
  },

  /**
   * Temperature range for transcription/translation (0 to 1)
   */
  temperatureRange: {
    min: 0,
    max: 1,
  },
} as const;

/**
 * Type-safe audio model types
 */
export type TTSModel = 'tts-1' | 'tts-1-hd' | 'gpt-4o-mini-tts';

export type TranscriptionModel =
  | 'whisper-1'
  | 'gpt-4o-transcribe'
  | 'gpt-4o-mini-transcribe'
  | 'gpt-4o-transcribe-diarize';

export type TranslationModel = 'whisper-1';

export type AudioModel = TTSModel | TranscriptionModel | TranslationModel;

/**
 * Type-safe voice types (13 voices)
 */
export type Voice =
  | 'alloy'
  | 'ash'
  | 'ballad'
  | 'coral'
  | 'echo'
  | 'fable'
  | 'nova'
  | 'onyx'
  | 'sage'
  | 'shimmer'
  | 'verse'
  | 'marin'
  | 'cedar';

/**
 * Type-safe audio format types
 */
export type SpeechFormat = 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';

export type TranscriptionFormat =
  | 'json'
  | 'text'
  | 'srt'
  | 'vtt'
  | 'verbose_json'
  | 'diarized_json';

export type TranslationFormat =
  | 'json'
  | 'text'
  | 'srt'
  | 'vtt'
  | 'verbose_json';

/**
 * Timestamp granularity types
 */
export type TimestampGranularity = 'word' | 'segment';
