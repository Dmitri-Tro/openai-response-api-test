# Audio API Documentation

Complete documentation of the OpenAI Audio API (TTS, Transcription, Translation) implementation in this NestJS project.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Supported Models](#supported-models)
4. [REST Endpoints](#rest-endpoints)
5. [Request Parameters](#request-parameters)
6. [Response Formats](#response-formats)
7. [Voice Options](#voice-options)
8. [Audio Formats](#audio-formats)
9. [File Upload Handling](#file-upload-handling)
10. [Binary Streaming](#binary-streaming)
11. [Custom Validators](#custom-validators)
12. [SDK Integration](#sdk-integration)
13. [Streaming Events](#streaming-events)
14. [Error Handling](#error-handling)
15. [Cost Estimation](#cost-estimation)
16. [Testing Architecture](#testing-architecture)
17. [Usage Examples](#usage-examples)

---

## Overview

The Audio API provides three core operations:
- **TTS (Text-to-Speech)**: Convert text to spoken audio
- **STT (Speech-to-Text)**: Transcribe audio to text in original language
- **Translation**: Translate audio from any language to English text

### Key Features

| Feature | TTS | Transcription | Translation |
|---------|-----|---------------|-------------|
| **Direction** | Text → Audio | Audio → Text | Audio → English |
| **Models** | 3 | 4 | 1 |
| **Max Input** | 4,096 chars | 25 MB file | 25 MB file |
| **Output** | Binary audio stream | JSON/Text/Subtitles | JSON/Text/Subtitles |
| **Streaming** | Yes (binary) | No | No |

---

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Audio API Architecture                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐     ┌───────────────────────────────────────┐ │
│  │  HTTP Request    │     │           AudioController             │ │
│  │  POST /speech    │────▶│  - speech() [Binary Stream]           │ │
│  │  POST /transcribe│     │  - transcribe() [File Upload]         │ │
│  │  POST /translate │     │  - translate() [File Upload]          │ │
│  └──────────────────┘     └───────────────┬───────────────────────┘ │
│                                           │                          │
│        ┌──────────────────────────────────┼──────────────────────┐  │
│        │                                  │                      │  │
│        ▼                                  ▼                      ▼  │
│  ┌─────────────┐              ┌─────────────────────┐   ┌────────────┐
│  │ Validators  │              │ OpenAIAudioService  │   │   DTOs     │
│  │ - Format    │              │ - createSpeech()    │   │ - Speech   │
│  │ - FileSize  │              │ - createTranscribe()│   │ - Transcr. │
│  └─────────────┘              │ - createTranslation()│  │ - Transl.  │
│                               │ - extractMetadata() │   └────────────┘
│                               └─────────┬───────────┘                │
│                                         │                            │
│                    ┌────────────────────┼────────────────────┐       │
│                    │                    │                    │       │
│                    ▼                    ▼                    ▼       │
│  ┌─────────────────────┐ ┌─────────────────────┐ ┌──────────────────┐
│  │    OpenAI SDK       │ │   LoggerService     │ │  Binary Mixin    │
│  │  client.audio.*     │ │ logOpenAIInteraction│ │streamBinaryResp()│
│  └─────────────────────┘ └─────────────────────┘ └──────────────────┘
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### File Structure

```
src/openai/
├── controllers/
│   ├── audio.controller.ts               # 3 REST endpoints
│   └── audio.controller.spec.ts          # Controller tests (671 lines)
├── services/
│   ├── openai-audio.service.ts           # 3 operations + helpers
│   ├── openai-audio.service.spec.ts      # Service tests (1,157 lines)
│   └── handlers/
│       ├── audio-events.handler.ts       # Streaming event handling
│       └── audio-events.handler.spec.ts  # Handler tests (425 lines)
├── dto/
│   └── audio/
│       ├── create-speech.dto.ts          # TTS parameters
│       ├── create-transcription.dto.ts   # STT parameters
│       ├── create-translation.dto.ts     # Translation parameters
│       └── *.spec.ts                     # DTO tests (~1,200 lines)
├── interfaces/
│   └── audio/
│       ├── audio-config.interface.ts     # Constants and types
│       └── transcription-metadata.interface.ts
└── validators/
    ├── audio-format.validator.ts         # File format validation
    ├── audio-file-size.validator.ts      # File size validation
    └── *.spec.ts                         # Validator tests (~1,000 lines)

src/common/
└── mixins/
    └── binary-streaming.mixin.ts         # Binary audio streaming

test/
└── audio.e2e-spec.ts                     # E2E tests (520 lines)
```

---

## Supported Models

### TTS (Text-to-Speech) Models

| Model | Quality | Latency | Cost/1K chars | Features |
|-------|---------|---------|---------------|----------|
| `tts-1` | Standard | Low | $0.015 | Real-time optimized |
| `tts-1-hd` | High | Medium | $0.030 | Higher fidelity |
| `gpt-4o-mini-tts` | Premium | Variable | $0.020 | Instructions support |

### Transcription Models

| Model | Use Case | Pricing | Features |
|-------|----------|---------|----------|
| `whisper-1` | General purpose | $0.006/min | Duration-based |
| `gpt-4o-transcribe` | Better nuance | Token-based | Handles accents/noise |
| `gpt-4o-mini-transcribe` | Fast & efficient | Token-based | Lower cost |
| `gpt-4o-transcribe-diarize` | Speaker ID | Token-based | Up to 4 speakers |

### Translation Models

| Model | Direction | Pricing | Notes |
|-------|-----------|---------|-------|
| `whisper-1` | Any → English | $0.006/min | Only supported model |

**Important**: Translation only outputs English regardless of source language.

---

## REST Endpoints

### Endpoint Summary

| Method | Path | Content-Type | Purpose |
|--------|------|--------------|---------|
| `POST` | `/api/audio/speech` | application/json | Generate speech from text |
| `POST` | `/api/audio/transcriptions` | multipart/form-data | Transcribe audio to text |
| `POST` | `/api/audio/translations` | multipart/form-data | Translate audio to English |

### 1. Text-to-Speech (TTS)

**Endpoint**: `POST /api/audio/speech`

```http
POST /api/audio/speech
Content-Type: application/json

{
  "model": "tts-1-hd",
  "voice": "shimmer",
  "input": "The quick brown fox jumps over the lazy dog.",
  "response_format": "mp3",
  "speed": 1.0,
  "instructions": "Speak in a cheerful, energetic tone"
}
```

**Response**: Binary audio stream

```
HTTP/1.1 200 OK
Content-Type: audio/mpeg
Content-Disposition: attachment; filename="speech.mp3"

[Binary audio data]
```

### 2. Transcription (STT)

**Endpoint**: `POST /api/audio/transcriptions`

```http
POST /api/audio/transcriptions
Content-Type: multipart/form-data

------boundary
Content-Disposition: form-data; name="file"; filename="meeting.mp3"
Content-Type: audio/mpeg
[Binary audio data]
------boundary
Content-Disposition: form-data; name="model"
gpt-4o-transcribe
------boundary
Content-Disposition: form-data; name="response_format"
verbose_json
------boundary
Content-Disposition: form-data; name="language"
en
------boundary
Content-Disposition: form-data; name="timestamp_granularities"
word
------boundary
Content-Disposition: form-data; name="timestamp_granularities"
segment
------boundary--
```

**Response** (verbose_json):
```json
{
  "text": "This is the full transcription of the audio file...",
  "language": "en",
  "duration": 245.5,
  "segments": [
    {
      "id": 0,
      "seek": 0,
      "start": 0.0,
      "end": 4.5,
      "text": "This is the full transcription of the audio file.",
      "temperature": 0.0,
      "avg_logprob": -0.2845,
      "compression_ratio": 1.8,
      "no_speech_prob": 0.001,
      "words": [
        { "word": "This", "start": 0.0, "end": 0.5 },
        { "word": "is", "start": 0.5, "end": 0.7 }
      ]
    }
  ]
}
```

### 3. Translation

**Endpoint**: `POST /api/audio/translations`

```http
POST /api/audio/translations
Content-Type: multipart/form-data

------boundary
Content-Disposition: form-data; name="file"; filename="spanish_audio.mp3"
Content-Type: audio/mpeg
[Binary audio data]
------boundary
Content-Disposition: form-data; name="model"
whisper-1
------boundary
Content-Disposition: form-data; name="response_format"
verbose_json
------boundary--
```

**Response**:
```json
{
  "text": "This is the English translation of the Spanish audio file.",
  "language": "es",
  "duration": 128.5,
  "segments": [...]
}
```

---

## Request Parameters

### CreateSpeechDto (TTS)

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `model` | enum | No | `tts-1` | `tts-1`, `tts-1-hd`, `gpt-4o-mini-tts` |
| `voice` | enum | Yes | - | 13 voice options (see Voice Options) |
| `input` | string | Yes | - | Text to synthesize (max 4,096 chars) |
| `response_format` | enum | No | `mp3` | `mp3`, `opus`, `aac`, `flac`, `wav`, `pcm` |
| `speed` | number | No | `1.0` | 0.25 (slowest) to 4.0 (fastest) |
| `instructions` | string | No | - | Tone/style guidance (gpt-4o-mini-tts only) |

### CreateTranscriptionDto (STT)

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `model` | enum | No | `whisper-1` | 4 transcription models |
| `language` | string | No | - | ISO-639-1 code (e.g., `en`, `es`) |
| `prompt` | string | No | - | Context hint for vocabulary/style |
| `response_format` | enum | No | `json` | 6 output formats |
| `temperature` | number | No | `0` | 0.0 to 1.0 (randomness) |
| `timestamp_granularities` | array | No | - | `['word']`, `['segment']`, or both |

### CreateTranslationDto

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `model` | enum | No | `whisper-1` | Only `whisper-1` supported |
| `prompt` | string | No | - | Context hint for translation |
| `response_format` | enum | No | `json` | 5 formats (no `diarized_json`) |
| `temperature` | number | No | `0` | 0.0 to 1.0 (randomness) |

---

## Response Formats

### Transcription Response Formats

| Format | Type | Description | Use Case |
|--------|------|-------------|----------|
| `json` | Object | `{ text: string }` | Simple text extraction |
| `text` | String | Plain text only | Direct use |
| `srt` | String | SubRip subtitles | Video subtitles |
| `vtt` | String | WebVTT subtitles | Web video |
| `verbose_json` | Object | Full metadata | Analysis, timestamps |
| `diarized_json` | Object | Speaker identification | Meeting transcripts |

### Verbose JSON Structure

```typescript
interface TranscriptionVerbose {
  text: string;                 // Full transcription
  language: string;             // Detected language (ISO-639-1)
  duration: number;             // Audio duration in seconds
  segments: Array<{
    id: number;
    seek: number;
    start: number;              // Segment start time
    end: number;                // Segment end time
    text: string;               // Segment text
    tokens: number[];
    temperature: number;
    avg_logprob: number;        // Confidence (-1.0 to 0.0)
    compression_ratio: number;
    no_speech_prob: number;
  }>;
  words?: Array<{               // When timestamp_granularities includes 'word'
    word: string;
    start: number;
    end: number;
  }>;
}
```

### Diarized JSON Structure (Speaker Identification)

```typescript
interface TranscriptionDiarized {
  text: string;
  language: string;
  duration: number;
  segments: Array<{
    id: string;
    speaker: string;            // 'A', 'B', 'C', 'D' (up to 4)
    start: number;
    end: number;
    text: string;
    type: 'transcript.text.segment';
  }>;
}
```

---

## Voice Options

### Available Voices (13 Total)

| Voice | Characteristic | Gender | Notes |
|-------|---------------|--------|-------|
| `alloy` | Neutral, versatile | Neutral | Good all-purpose voice |
| `echo` | Balanced | Masculine | Clear articulation |
| `fable` | Warm, narrative | Masculine | Good for storytelling |
| `nova` | Friendly, conversational | Feminine | Natural tone |
| `onyx` | Deep, authoritative | Masculine | Professional |
| `shimmer` | Soft, pleasant | Feminine | Gentle delivery |
| `ash` | New (2025) | - | Latest addition |
| `ballad` | New (2025) | - | Latest addition |
| `coral` | New (2025) | - | Latest addition |
| `sage` | New (2025) | - | Latest addition |
| `verse` | New (2025) | - | Latest addition |
| `marin` | New (2025) | - | Latest addition |
| `cedar` | New (2025) | - | Latest addition |

---

## Audio Formats

### TTS Output Formats

| Format | MIME Type | Compression | Use Case |
|--------|-----------|-------------|----------|
| `mp3` | audio/mpeg | Lossy | Default, widely compatible |
| `opus` | audio/opus | Lossy | Internet streaming, low latency |
| `aac` | audio/aac | Lossy | YouTube, iOS/Android |
| `flac` | audio/flac | Lossless | Audiophile quality, archiving |
| `wav` | audio/wav | Uncompressed | Low latency apps |
| `pcm` | audio/pcm | Raw (24kHz) | Lowest latency, no headers |

### Transcription/Translation Input Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| FLAC | .flac | Lossless |
| MP3 | .mp3 | Most common |
| MP4 | .mp4 | Container with audio |
| MPEG | .mpeg | Audio stream |
| MPGA | .mpga | MPEG audio |
| M4A | .m4a | AAC in MPEG-4 |
| OGG | .ogg | Ogg Vorbis |
| WAV | .wav | Uncompressed |
| WebM | .webm | Web media |

**NOT Supported**: `opus` (only in open-source Whisper, not via API)

**File Size Limit**: 25 MB maximum

---

## File Upload Handling

### Multer Configuration

```typescript
@Post('transcriptions')
@UseInterceptors(FileInterceptor('file'))  // Field name: 'file'
async transcribe(
  @UploadedFile() file: Express.Multer.File,
  @Body() dto: CreateTranscriptionDto,
): Promise<Audio.Transcription | Audio.TranscriptionVerbose | string>
```

### Multer File Object

```typescript
interface Express.Multer.File {
  fieldname: string;        // 'file'
  originalname: string;     // 'meeting.mp3'
  encoding: string;         // '7bit'
  mimetype: string;         // 'audio/mpeg'
  buffer: Buffer;           // Binary data (in-memory)
  size: number;             // File size in bytes
}
```

### File Conversion for SDK

```typescript
import { toFile } from 'openai';

// Convert Multer buffer to OpenAI SDK File
const audioFile = await toFile(
  file.buffer,           // Buffer data
  file.originalname,     // Filename
  { type: file.mimetype }  // MIME type
);

const response = await this.client.audio.transcriptions.create({
  file: audioFile,
  model: dto.model,
  // ... other params
});
```

---

## Binary Streaming

### streamBinaryResponse Mixin

**Location**: `src/common/mixins/binary-streaming.mixin.ts`

```typescript
export async function streamBinaryResponse(
  response: Response,           // OpenAI SDK Response
  expressRes: ExpressResponse,  // Express Response
  contentType: string,          // MIME type
  filename: string,             // Download filename
): Promise<void> {
  // Set headers
  expressRes.setHeader('Content-Type', contentType);
  expressRes.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"`,
  );

  // Stream binary data
  if (response.body) {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      expressRes.write(value);  // Write chunk
    }
  }
  expressRes.end();
}
```

### TTS Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                        TTS Data Flow                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Client Request (JSON)                                           │
│     ↓                                                            │
│  AudioController.speech()                                        │
│     ├─ @Body() dto: CreateSpeechDto                             │
│     ├─ Validates: model, voice, input, format, speed            │
│     ↓                                                            │
│  OpenAIAudioService.createSpeech()                              │
│     ├─ Builds SDK parameters                                     │
│     ├─ Calls client.audio.speech.create(params)                 │
│     ├─ Returns Response object with binary stream               │
│     ↓                                                            │
│  streamBinaryResponse() Mixin                                    │
│     ├─ Extracts Content-Type from headers                       │
│     ├─ Sets Content-Disposition header                          │
│     ├─ Reads chunks from response.body.getReader()              │
│     ├─ Writes chunks to expressRes.write()                      │
│     └─ Calls expressRes.end()                                   │
│     ↓                                                            │
│  Client Receives                                                 │
│     ├─ Content-Type: audio/mpeg                                 │
│     ├─ Content-Disposition: attachment; filename="speech.mp3"   │
│     └─ Binary audio stream                                       │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Custom Validators

### Audio Format Validator

**Location**: `src/openai/validators/audio-format.validator.ts`

```typescript
@ValidatorConstraint({ async: false })
export class IsAudioFormatValidConstraint implements ValidatorConstraintInterface {
  private readonly SUPPORTED_FORMATS = [
    'flac', 'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'ogg', 'wav', 'webm'
  ];

  validate(file: unknown): boolean {
    if (!file || typeof file !== 'object') return false;
    const { originalname } = file as { originalname?: string };
    if (!originalname) return false;

    const extension = originalname.split('.').pop()?.toLowerCase();
    return this.SUPPORTED_FORMATS.includes(extension);
  }

  defaultMessage(): string {
    return `Audio format not supported. Supported: ${this.SUPPORTED_FORMATS.join(', ')}. Note: opus NOT supported via API.`;
  }
}

// Decorator
export function IsAudioFormatValid(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: IsAudioFormatValidConstraint,
    });
  };
}
```

### Audio File Size Validator

**Location**: `src/openai/validators/audio-file-size.validator.ts`

```typescript
export const AUDIO_MAX_SIZE_MB = 25;
export const AUDIO_MAX_SIZE_BYTES = 25 * 1024 * 1024; // 26,214,400 bytes

@ValidatorConstraint({ async: false })
export class IsAudioFileSizeValidConstraint implements ValidatorConstraintInterface {
  validate(file: unknown): boolean {
    if (!file || typeof file !== 'object') return false;
    const { size } = file as { size?: number };

    return (
      typeof size === 'number' &&
      size > 0 &&
      size <= AUDIO_MAX_SIZE_BYTES
    );
  }

  defaultMessage(args: ValidationArguments): string {
    const file = args.value as { size?: number };
    const sizeMB = file?.size ? (file.size / (1024 * 1024)).toFixed(2) : 'unknown';
    return `Audio file exceeds ${AUDIO_MAX_SIZE_MB} MB limit. File size: ${sizeMB} MB`;
  }
}
```

### Helper Functions

```typescript
// Standalone validation
export function validateAudioFormat(filename: string): boolean;
export function validateAudioFileSize(fileSizeBytes: number): boolean;

// Error message generation
export function getAudioFormatErrorMessage(filename: string): string;
export function getAudioFileSizeErrorMessage(fileSizeBytes: number): string;
```

---

## SDK Integration

### OpenAI SDK Types

```typescript
import type { Audio } from 'openai/resources/audio';

// Response Types
Audio.Transcription              // Simple: { text: string }
Audio.TranscriptionVerbose       // Extended with segments/words
Audio.Translation                // Simple: { text: string }
Audio.TranslationVerbose         // Extended with metadata

// Parameter Types
Audio.SpeechCreateParams
Audio.TranscriptionCreateParams
Audio.TranslationCreateParams

// Model Types
Audio.AudioModel = 'whisper-1' | 'gpt-4o-transcribe' | ...
Audio.AudioResponseFormat = 'json' | 'text' | 'srt' | 'vtt' | 'verbose_json' | ...
```

### Service Implementation

```typescript
@Injectable()
export class OpenAIAudioService {
  constructor(
    @Inject(OPENAI_CLIENT) private readonly client: OpenAI,
    private readonly loggerService: LoggerService,
  ) {}

  async createSpeech(dto: CreateSpeechDto): Promise<Response> {
    const params = {
      model: dto.model,
      voice: dto.voice,
      input: dto.input,
      ...(dto.response_format && { response_format: dto.response_format }),
      ...(dto.speed && { speed: dto.speed }),
      ...(dto.instructions && { instructions: dto.instructions }),
    };

    const response = await this.client.audio.speech.create(params);

    // Log with cost estimate
    const costEstimate = calculateSpeechCost(dto.model, dto.input.length);
    this.loggerService.logOpenAIInteraction({
      api: 'audio',
      endpoint: '/v1/audio/speech',
      request: params,
      metadata: {
        latency_ms: Date.now() - startTime,
        model: dto.model,
        voice: dto.voice,
        character_count: dto.input.length,
        cost_estimate: costEstimate,
      },
    });

    return response;
  }

  async createTranscription(
    file: Express.Multer.File,
    dto: CreateTranscriptionDto,
  ): Promise<Audio.Transcription | Audio.TranscriptionVerbose | string> {
    // Convert Multer file to SDK File
    const audioFile = await toFile(file.buffer, file.originalname, {
      type: file.mimetype,
    });

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

    const response = await this.client.audio.transcriptions.create(params);

    // Extract metadata and log
    const metadata = this.extractTranscriptionMetadata(response);
    this.loggerService.logOpenAIInteraction({
      api: 'audio',
      endpoint: '/v1/audio/transcriptions',
      request: { model: dto.model, file_size_mb: file.size / (1024 * 1024) },
      metadata: { ...metadata, cost_estimate: this.estimateTranscriptionCost(response, dto.model) },
    });

    return response;
  }

  async createTranslation(
    file: Express.Multer.File,
    dto: CreateTranslationDto,
  ): Promise<Audio.Translation | Audio.TranslationVerbose | string> {
    const audioFile = await toFile(file.buffer, file.originalname, {
      type: file.mimetype,
    });

    const params = {
      file: audioFile,
      model: dto.model,
      ...(dto.prompt && { prompt: dto.prompt }),
      ...(dto.response_format && { response_format: dto.response_format }),
      ...(dto.temperature !== undefined && { temperature: dto.temperature }),
    };

    return await this.client.audio.translations.create(params);
  }
}
```

---

## Streaming Events

### Audio Events Handler (Responses API)

When using audio modality with the Responses API, these streaming events are handled:

**Location**: `src/openai/services/handlers/audio-events.handler.ts`

```typescript
@Injectable()
export class AudioEventsHandler {
  // response.output_audio.delta - Incremental audio chunks
  *handleAudioDelta(event, state, sequence): Iterable<SSEEvent> {
    const { delta } = event.data;
    state.audio += delta;  // Accumulate base64 audio
    yield {
      event: 'audio_delta',
      data: JSON.stringify({ delta, sequence }),
      sequence,
    };
  }

  // response.output_audio.done - Complete audio
  *handleAudioDone(event, state, sequence): Iterable<SSEEvent> {
    yield {
      event: 'audio_done',
      data: JSON.stringify({ audio: state.audio, sequence }),
      sequence,
    };
  }

  // response.output_audio.transcript.delta - Incremental transcript
  *handleAudioTranscriptDelta(event, state, sequence): Iterable<SSEEvent> {
    const { delta } = event.data;
    state.audioTranscript += delta;
    yield {
      event: 'audio_transcript_delta',
      data: JSON.stringify({ delta, sequence }),
      sequence,
    };
  }

  // response.output_audio.transcript.done - Complete transcript
  *handleAudioTranscriptDone(event, state, sequence): Iterable<SSEEvent> {
    yield {
      event: 'audio_transcript_done',
      data: JSON.stringify({ transcript: state.audioTranscript, sequence }),
      sequence,
    };
  }
}
```

### StreamState Properties

```typescript
interface StreamState {
  audio: string;              // Accumulated base64 audio
  audioTranscript: string;    // Accumulated transcript text
  // ... other properties
}
```

---

## Error Handling

### Audio Error Codes

| Error Code | HTTP | Description | Hint |
|------------|------|-------------|------|
| `invalid_tts_input_length` | 400 | Input exceeds 4,096 chars | Shorten text or split |
| `invalid_voice_option` | 400 | Unknown voice | Use valid voice name |
| `invalid_speed_value` | 400 | Speed out of range | Use 0.25 to 4.0 |
| `audio_file_too_large` | 413 | File exceeds 25 MB | Compress or split |
| `unsupported_audio_format` | 400 | Invalid format | Use supported format |
| `invalid_language_code` | 400 | Invalid language | Use ISO-639-1 code |
| `transcription_failed` | 500 | Transcription error | Retry or check file |
| `translation_failed` | 500 | Translation error | Retry or check file |
| `translation_model_unsupported` | 400 | Wrong model | Use whisper-1 only |

### Error Response Structure

```typescript
interface EnhancedErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string;
  error_code?: AudioErrorCode;
  hint?: string;
  request_id?: string;
  openai_error?: {
    type: string;
    code?: string;
    message: string;
  };
}
```

---

## Cost Estimation

### TTS Pricing

```typescript
function calculateSpeechCost(model: string, characters: number): number {
  const pricePer1k = model === 'tts-1-hd' ? 0.03 : 0.015;
  return (characters / 1000) * pricePer1k;
}
```

| Model | Price/1K chars | 1,000 chars | 4,096 chars |
|-------|---------------|-------------|-------------|
| `tts-1` | $0.015 | $0.015 | $0.061 |
| `tts-1-hd` | $0.030 | $0.030 | $0.123 |
| `gpt-4o-mini-tts` | ~$0.020 | $0.020 | $0.082 |

### Transcription/Translation Pricing

```typescript
function calculateTranscriptionCost(
  model: string,
  durationSeconds: number,
  usage?: { input_tokens: number; output_tokens: number }
): number {
  if (model === 'whisper-1') {
    return (durationSeconds / 60) * 0.006;  // $0.006/min
  }
  if (usage) {
    return usage.input_tokens * 0.00001 + usage.output_tokens * 0.00003;
  }
  return 0;
}
```

| Model | Pricing Type | Rate |
|-------|-------------|------|
| `whisper-1` | Duration | $0.006/min |
| `gpt-4o-transcribe` | Tokens | $0.01/1K input + $0.03/1K output |
| `gpt-4o-mini-transcribe` | Tokens | Lower than gpt-4o |

### Transcription Metadata

```typescript
interface TranscriptionMetadata {
  duration_seconds?: number;      // Audio duration
  detected_language?: string;     // ISO-639-1 code
  text_length: number;            // Transcribed text length
  segment_count?: number;         // Number of segments
  word_count?: number;            // Words with timestamps
  average_confidence?: number;    // Avg log probability (-1.0 to 0.0)
}
```

---

## Testing Architecture

### Test Coverage Summary

| Component | File | Tests | Key Areas |
|-----------|------|-------|-----------|
| Service | `openai-audio.service.spec.ts` | 41 | TTS, STT, Translation |
| Controller | `audio.controller.spec.ts` | 25 | Endpoints, streaming |
| CreateSpeechDto | `create-speech.dto.spec.ts` | 58 | 6 parameters |
| CreateTranscriptionDto | `create-transcription.dto.spec.ts` | 52 | 6 parameters |
| CreateTranslationDto | `create-translation.dto.spec.ts` | 45 | 4 parameters |
| FormatValidator | `audio-format.validator.spec.ts` | 131 | 9 formats |
| SizeValidator | `audio-file-size.validator.spec.ts` | 130 | Boundary tests |
| EventHandler | `audio-events.handler.spec.ts` | 27 | 4 event types |
| E2E | `audio.e2e-spec.ts` | 22 | Full integration |
| **Total** | | **~800+** | |

### Mock Patterns

**Service Mock**:
```typescript
const mockOpenAIClient = {
  audio: {
    speech: { create: jest.fn() },
    transcriptions: { create: jest.fn() },
    translations: { create: jest.fn() },
  },
};
```

**Multer File Mock**:
```typescript
const mockMulterFile: Express.Multer.File = {
  fieldname: 'file',
  originalname: 'test-audio.mp3',
  encoding: '7bit',
  mimetype: 'audio/mpeg',
  buffer: Buffer.from('mock audio data'),
  size: 1024 * 1024,  // 1 MB
  stream: null as any,
  destination: '',
  filename: '',
  path: '',
};
```

### E2E Auto-Skip Pattern

```typescript
const hasApiKey = !!process.env.OPENAI_API_KEY;
const testIf = (condition: boolean) => (condition ? it : it.skip);

testIf(hasApiKey)('should generate speech', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/audio/speech')
    .send({
      model: 'tts-1',
      voice: 'alloy',
      input: 'Hello, world!',
    })
    .expect(200);

  expect(response.headers['content-type']).toBe('audio/mpeg');
}, 30000);
```

---

## Usage Examples

### Text-to-Speech (cURL)

```bash
# Generate MP3 speech
curl -X POST http://localhost:3000/api/audio/speech \
  -H "Content-Type: application/json" \
  -d '{
    "model": "tts-1-hd",
    "voice": "shimmer",
    "input": "Hello, this is a test of the text-to-speech API.",
    "response_format": "mp3",
    "speed": 1.0
  }' \
  --output speech.mp3

# Generate with instructions (gpt-4o-mini-tts)
curl -X POST http://localhost:3000/api/audio/speech \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini-tts",
    "voice": "coral",
    "input": "Welcome to our service!",
    "instructions": "Speak in a warm, friendly tone with enthusiasm"
  }' \
  --output welcome.mp3
```

### Transcription (cURL)

```bash
# Simple transcription
curl -X POST http://localhost:3000/api/audio/transcriptions \
  -F "file=@meeting.mp3" \
  -F "model=whisper-1" \
  -F "response_format=json"

# Verbose with timestamps
curl -X POST http://localhost:3000/api/audio/transcriptions \
  -F "file=@podcast.mp3" \
  -F "model=gpt-4o-transcribe" \
  -F "response_format=verbose_json" \
  -F "language=en" \
  -F "timestamp_granularities=word" \
  -F "timestamp_granularities=segment"

# Speaker diarization
curl -X POST http://localhost:3000/api/audio/transcriptions \
  -F "file=@interview.mp3" \
  -F "model=gpt-4o-transcribe-diarize" \
  -F "response_format=diarized_json"
```

### Translation (cURL)

```bash
# Translate Spanish to English
curl -X POST http://localhost:3000/api/audio/translations \
  -F "file=@spanish_audio.mp3" \
  -F "model=whisper-1" \
  -F "response_format=verbose_json"
```

### TypeScript Client Example

```typescript
import axios from 'axios';
import * as fs from 'fs';
import FormData from 'form-data';

const API_BASE = 'http://localhost:3000/api';

// Text-to-Speech
async function generateSpeech(text: string, voice: string = 'shimmer'): Promise<void> {
  const response = await axios.post(
    `${API_BASE}/audio/speech`,
    {
      model: 'tts-1-hd',
      voice,
      input: text,
      response_format: 'mp3',
      speed: 1.0,
    },
    { responseType: 'arraybuffer' }
  );

  fs.writeFileSync('output.mp3', Buffer.from(response.data));
  console.log('Speech saved to output.mp3');
}

// Transcription
async function transcribeAudio(filePath: string): Promise<string> {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('model', 'gpt-4o-transcribe');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities', 'word');
  form.append('timestamp_granularities', 'segment');

  const response = await axios.post(
    `${API_BASE}/audio/transcriptions`,
    form,
    { headers: form.getHeaders() }
  );

  console.log('Language:', response.data.language);
  console.log('Duration:', response.data.duration, 'seconds');
  console.log('Segments:', response.data.segments.length);

  return response.data.text;
}

// Translation
async function translateAudio(filePath: string): Promise<string> {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');

  const response = await axios.post(
    `${API_BASE}/audio/translations`,
    form,
    { headers: form.getHeaders() }
  );

  console.log('Source language:', response.data.language);
  console.log('English translation:', response.data.text);

  return response.data.text;
}

// Usage
generateSpeech('Hello, world!', 'nova');
transcribeAudio('./meeting.mp3');
translateAudio('./spanish_audio.mp3');
```

---

## Key Implementation Details

### Important Constraints

1. **TTS Input Limit**: 4,096 characters maximum
2. **Audio File Size**: 25 MB maximum
3. **Translation Model**: Only `whisper-1` supported
4. **Opus Format**: NOT supported via API (only in open-source Whisper)
5. **Diarization**: Only with `gpt-4o-transcribe-diarize` model (up to 4 speakers)
6. **Instructions**: Only with `gpt-4o-mini-tts` model

### Configuration Constants

```typescript
export const AUDIO_CONFIG = {
  maxFileSizeBytes: 25 * 1024 * 1024,      // 25 MB
  maxFileSizeMB: 25,
  maxTTSCharacters: 4096,
  speedRange: { min: 0.25, max: 4.0 },
  temperatureRange: { min: 0, max: 1 },
  supportedTranscriptionFormats: [
    'flac', 'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'ogg', 'wav', 'webm'
  ],
  supportedSpeechFormats: ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'],
  voices: [
    'alloy', 'ash', 'ballad', 'coral', 'echo', 'fable',
    'nova', 'onyx', 'sage', 'shimmer', 'verse', 'marin', 'cedar'
  ],
};
```

### Module Registration

```typescript
// openai.module.ts
@Module({
  controllers: [AudioController],
  providers: [OpenAIAudioService, AudioEventsHandler],
  exports: [OpenAIAudioService],
})
export class OpenAIModule {}
```

---

## References

- [OpenAI Audio API Documentation](https://platform.openai.com/docs/api-reference/audio)
- [OpenAI TTS Guide](https://platform.openai.com/docs/guides/text-to-speech)
- [OpenAI Whisper Guide](https://platform.openai.com/docs/guides/speech-to-text)
- [NestJS File Upload Documentation](https://docs.nestjs.com/techniques/file-upload)
- [Project README](../README.md)
- [Streaming Documentation](./STREAMING.md)
- [Responses API Documentation](./RESPONSES_API.md)
