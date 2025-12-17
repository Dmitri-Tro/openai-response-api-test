# Architecture Documentation

> Comprehensive technical architecture for the OpenAI API Testing & Reference Implementation project.

## Table of Contents

- [Overview](#overview)
- [Module Architecture](#module-architecture)
- [Request Lifecycle](#request-lifecycle)
- [OpenAI Module](#openai-module)
- [Common Module](#common-module)
- [Streaming Architecture](#streaming-architecture)
- [API Endpoints](#api-endpoints)
- [Data Flow Patterns](#data-flow-patterns)
- [Type System](#type-system)
- [Testing Architecture](#testing-architecture)
- [Configuration](#configuration)

---

## Overview

This is a production-ready NestJS application demonstrating best practices for integrating OpenAI APIs. The architecture emphasizes:

- **100% Type Safety** - Strict TypeScript, no `any` types, OpenAI SDK types throughout
- **Modular Design** - Clear separation of concerns via NestJS modules
- **Comprehensive Logging** - All API interactions logged with cost estimation
- **Robust Error Handling** - 50+ error codes with actionable hints
- **Streaming Support** - 63+ event types with 10 specialized handlers

### Tech Stack

| Category | Technology |
|----------|------------|
| Framework | NestJS 11 |
| Language | TypeScript 5 (strict mode) |
| OpenAI SDK | openai v6.9.1 |
| Validation | Zod (env), class-validator (DTOs) |
| Documentation | Swagger/OpenAPI |
| Testing | Jest 30, Supertest 7 |

### Project Statistics

- **Total TypeScript Files**: 178
- **Total Tests**: 2,605 (passing)
- **API Endpoints**: 45
- **Streaming Event Types**: 63+
- **Event Handlers**: 10

---

## Module Architecture

### Module Hierarchy

```
AppModule (root)
├── ConfigModule (global)
│   ├── configuration.ts      - Environment loading
│   └── env.validation.ts     - Zod schema validation
│
├── CommonModule (@Global)
│   ├── LoggerService         - Structured JSON logging
│   ├── PricingService        - Multi-model cost estimation
│   ├── RetryInterceptor      - Automatic retry with backoff
│   ├── LoggingInterceptor    - Request/response tracking
│   └── OpenAIExceptionFilter - Error transformation
│
└── OpenAIModule
    ├── OpenAIClientProvider  - Singleton SDK client
    ├── 6 Services            - API implementations
    ├── 6 Controllers         - HTTP endpoints
    └── 10 Event Handlers     - Streaming orchestration
```

### Module Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                        AppModule                            │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ConfigModule │  │ CommonModule │  │  OpenAIModule   │   │
│  │  (global)   │  │  (@Global)   │  │                 │   │
│  │             │  │              │  │                 │   │
│  │ • Zod       │  │ • Logger     │→→│ • Responses     │   │
│  │ • Config    │  │ • Pricing    │  │ • Videos        │   │
│  │   Factory   │  │ • Retry      │  │ • Images        │   │
│  │             │  │ • Logging    │  │ • Audio         │   │
│  │             │  │ • Exception  │  │ • Files         │   │
│  │             │  │   Filter     │  │ • Vector Stores │   │
│  └─────────────┘  └──────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Request Lifecycle

### Complete Request Flow

```
HTTP Request
    │
    ▼
┌─────────────────────────────────────┐
│        RetryInterceptor             │
│  • Catches transient failures       │
│  • Exponential backoff (5s→20s)     │
│  • Max 3 retries                    │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│       LoggingInterceptor            │
│  • Record start time                │
│  • Detect API type from URL         │
│  • Detect streaming mode            │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│         ValidationPipe              │
│  • DTO validation (class-validator) │
│  • Custom validators                │
│  • Type transformation              │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│           Controller                │
│  • Route matching                   │
│  • Parameter extraction             │
│  • Service invocation               │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│            Service                  │
│  • Build SDK params                 │
│  • Call OpenAI API                  │
│  • Handle response/streaming        │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│     LoggingInterceptor (exit)       │
│  • Calculate latency                │
│  • Extract token usage              │
│  • Estimate cost                    │
│  • Write to logs/YYYY-MM-DD/        │
└─────────────────────────────────────┘
    │
    ▼
HTTP Response (or SSE stream)

On Error:
    │
    ▼
┌─────────────────────────────────────┐
│      OpenAIExceptionFilter          │
│  • Detect error type (instanceof)   │
│  • Extract error codes              │
│  • Build EnhancedErrorResponse      │
│  • Add actionable hints             │
└─────────────────────────────────────┘
```

---

## OpenAI Module

The core module providing OpenAI API integration.

### Directory Structure

```
src/openai/
├── openai.module.ts              # Module definition
├── providers/
│   └── openai-client.provider.ts # Singleton SDK client
├── controllers/                  # HTTP endpoints (6)
│   ├── responses.controller.ts
│   ├── videos.controller.ts
│   ├── images.controller.ts
│   ├── audio.controller.ts
│   ├── files.controller.ts
│   └── vector-stores.controller.ts
├── services/                     # Business logic (7)
│   ├── openai-responses.service.ts
│   ├── openai-videos.service.ts
│   ├── openai-images.service.ts
│   ├── openai-audio.service.ts
│   ├── openai-files.service.ts
│   ├── openai-vector-stores.service.ts
│   ├── code-security.service.ts
│   └── handlers/                 # Streaming handlers (10)
│       ├── lifecycle-events.handler.ts
│       ├── text-events.handler.ts
│       ├── reasoning-events.handler.ts
│       ├── tool-calling-events.handler.ts
│       ├── image-events.handler.ts
│       ├── audio-events.handler.ts
│       ├── mcp-events.handler.ts
│       ├── refusal-events.handler.ts
│       ├── structural-events.handler.ts
│       └── computer-use-events.handler.ts
├── dto/                          # Request validation (35+)
├── validators/                   # Custom validators (33)
└── interfaces/                   # Type definitions (22)
```

### Services Overview

| Service | Purpose | Methods | Key Pattern |
|---------|---------|---------|-------------|
| **OpenAIResponsesService** | Text/image generation | 13 | Orchestrator for streaming |
| **OpenAIVideosService** | Video generation | 7 | Async polling |
| **OpenAIImagesService** | DALL-E/gpt-image-1 | 3 | Direct SDK calls |
| **OpenAIAudioService** | TTS/STT | 7 | Binary streaming |
| **OpenAIFilesService** | File management | 7 | Multipart upload |
| **OpenAIVectorStoresService** | RAG/search | 20 | Batch operations |

### OpenAI Client Provider

**Pattern**: Factory Provider (Singleton)

```typescript
// src/openai/providers/openai-client.provider.ts
{
  provide: 'OPENAI_CLIENT',
  useFactory: (configService: ConfigService) => {
    return new OpenAI({
      apiKey: configService.get('openai.apiKey'),
      baseURL: configService.get('openai.baseUrl'),
      timeout: configService.get('openai.timeout'),
      maxRetries: configService.get('openai.maxRetries'),
    });
  },
  inject: [ConfigService],
}
```

**Benefits**:
- Single connection pool across all services
- Centralized configuration
- Easy mocking for tests

---

## Common Module

Cross-cutting concerns shared across the application.

### Directory Structure

```
src/common/
├── common.module.ts              # @Global module
├── services/
│   ├── logger.service.ts         # Structured logging
│   └── pricing.service.ts        # Cost estimation
├── interceptors/
│   ├── logging.interceptor.ts    # Request/response logging
│   └── retry.interceptor.ts      # Automatic retries
├── filters/
│   └── openai-exception.filter.ts # Error handling
├── validators/
│   └── shared-validator.utils.ts  # Reusable validators
├── testing/
│   └── test.factories.ts          # Mock factories
└── utils/
    └── cost-estimation.utils.ts   # Cost helpers
```

### LoggerService

**Purpose**: Centralized structured logging for all OpenAI API interactions.

**Log Structure**:
```
logs/
├── 2025-01-17/
│   ├── responses.log    # Text generation
│   ├── images.log       # Image generation
│   ├── videos.log       # Video generation
│   ├── audio.log        # TTS/STT
│   ├── files.log        # File operations
│   └── vector_stores.log # Vector store operations
```

**Log Entry Format** (JSON):
```json
{
  "timestamp": "2025-01-17T10:30:00.000Z",
  "api": "responses",
  "endpoint": "/api/responses/text",
  "request": { "model": "gpt-4o", "input": "..." },
  "response": { "id": "resp_...", "output_text": "..." },
  "metadata": {
    "latency_ms": 1250,
    "tokens_used": 130,
    "cached_tokens": 0,
    "reasoning_tokens": 0,
    "cost_estimate": 0.0013125
  }
}
```

### PricingService

**Purpose**: Multi-model cost estimation.

**Supported Models**:
- gpt-4o, gpt-4o-mini
- o1, o3-mini (with reasoning tokens)
- gpt-5
- gpt-image-1, dall-e-2, dall-e-3
- tts-1, tts-1-hd
- whisper-1

### OpenAIExceptionFilter

**Purpose**: Transform all errors to user-friendly responses.

**Error Categories**:

| Category | Error Types | HTTP Status |
|----------|------------|-------------|
| Authentication | AuthenticationError | 401 |
| Permission | PermissionDeniedError | 403 |
| Not Found | NotFoundError | 404 |
| Rate Limit | RateLimitError | 429 |
| Bad Request | BadRequestError | 400 |
| Server Error | InternalServerError | 500+ |
| Network | ECONNRESET, ETIMEDOUT | 503 |

**Enhanced Error Response**:
```typescript
interface EnhancedErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string;
  request_id?: string;
  error_code?: string;
  parameter?: string;
  retry_after_seconds?: number;
  rate_limit_info?: RateLimitInfo;
  hint?: string;
  openai_error?: {
    type: string;
    code?: string;
    message: string;
    full_error: unknown;
  };
}
```

---

## Streaming Architecture

### Orchestrator Pattern

The streaming implementation uses a **handler orchestration pattern** where the main service delegates event processing to specialized handlers.

```
OpenAI SDK Stream
       │
       ▼
┌─────────────────────────────────────────────┐
│     OpenAIResponsesService (Orchestrator)   │
│                                             │
│  for await (event of stream) {              │
│    route to handler based on event.type     │
│  }                                          │
└─────────────────────────────────────────────┘
       │
       ├──▶ LifecycleEventsHandler (7 events)
       ├──▶ TextEventsHandler (3 events)
       ├──▶ ReasoningEventsHandler (6 events)
       ├──▶ ToolCallingEventsHandler (21 events)
       ├──▶ ImageEventsHandler (4 events)
       ├──▶ AudioEventsHandler (4 events)
       ├──▶ MCPEventsHandler (8 events)
       ├──▶ RefusalEventsHandler (2 events)
       ├──▶ StructuralEventsHandler (3 events)
       └──▶ ComputerUseEventsHandler (5 events)
```

### StreamState

Shared mutable state across event handlers:

```typescript
interface StreamState {
  // Text accumulation
  fullText: string;
  reasoning: string;
  reasoningSummary: string;
  refusal: string;

  // Tool calls (by call_id)
  toolCalls: Map<string, {
    type: string;
    input: string;
    code?: string;
    status: string;
    result?: unknown;
  }>;

  // Audio output
  audio: string;
  audioTranscript: string;

  // Metadata
  responseId?: string;
  model?: string;
  startTime: number;
  finalResponse?: Responses.Response;
}
```

### Event Handler Pattern

Each handler implements generator methods:

```typescript
@Injectable()
export class TextEventsHandler {
  *handleTextDelta(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const { delta } = event as { delta?: string };

    // Update state
    state.fullText += delta || '';

    // Log event
    this.loggerService.logStreamingEvent({...});

    // Yield SSE event
    yield {
      event: 'text_delta',
      data: JSON.stringify({ delta, sequence }),
      sequence,
    };
  }
}
```

### SSE Output Format

```
event: response.created
data: {"id":"resp_abc123","status":"created","sequence":0}

event: response.output_text.delta
data: {"delta":"Hello","sequence":1}

event: response.output_text.delta
data: {"delta":" world","sequence":2}

event: response.completed
data: {"status":"completed","sequence":3}

event: done
data: {"response":{...},"sequence":4}
```

### Event Types by Handler

| Handler | Events | Purpose |
|---------|--------|---------|
| **Lifecycle** | 7 | Response lifecycle (created, completed, failed) |
| **Text** | 3 | Text output (delta, done, annotation) |
| **Reasoning** | 6 | o-series reasoning (delta, summary) |
| **Tool Calling** | 21 | Function calls, code interpreter, file search, web search |
| **Image** | 4 | Image generation progress (gpt-image-1) |
| **Audio** | 4 | TTS/voice output |
| **MCP** | 8 | Model Context Protocol |
| **Refusal** | 2 | Refusal messages |
| **Structural** | 3 | Output structure, unknown events |
| **Computer Use** | 5 | Computer automation (mouse, keyboard, screenshots) |

---

## API Endpoints

### Summary (45 Total)

| API | Endpoints | Pattern |
|-----|-----------|---------|
| Responses | 9 | Streaming + Non-streaming + Storage |
| Videos | 7 | Async polling |
| Images (DALL-E) | 3 | Direct generation |
| Audio | 3 | Binary streaming |
| Files | 5 | Multipart upload |
| Vector Stores | 18 | Batch operations + Search |

### Responses API

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/responses/text` | Non-streaming text |
| POST | `/api/responses/text/stream` | Streaming text (SSE) |
| POST | `/api/responses/images` | Image generation |
| POST | `/api/responses/images/stream` | Progressive image rendering |
| GET | `/api/responses/:id` | Retrieve stored response |
| DELETE | `/api/responses/:id` | Delete response |
| POST | `/api/responses/:id/cancel` | Cancel background response |
| POST | `/api/responses/code-interpreter` | Code execution with files |

### Videos API

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/videos` | Create video job |
| GET | `/api/videos/:id` | Get status |
| GET | `/api/videos/:id/poll` | Poll until complete |
| GET | `/api/videos/:id/download` | Download MP4 |
| GET | `/api/videos` | List videos |
| DELETE | `/api/videos/:id` | Delete video |
| POST | `/api/videos/:id/remix` | Create variation |

### Audio API

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/audio/speech` | Text-to-Speech (binary) |
| POST | `/api/audio/transcriptions` | Speech-to-Text |
| POST | `/api/audio/translations` | Audio translation |

### Files API

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/files` | Upload file (multipart) |
| GET | `/api/files` | List files |
| GET | `/api/files/:id` | Get metadata |
| GET | `/api/files/:id/content` | Download content |
| DELETE | `/api/files/:id` | Delete file |

### Vector Stores API (18 endpoints)

**Store Management**: create, retrieve, update, list, delete, search

**File Operations**: add, list, get, update, remove, getContent

**Batch Operations**: createBatch, getBatch, cancelBatch, listBatchFiles

**Polling**: pollStore, pollFile

---

## Data Flow Patterns

### Pattern 1: Non-Streaming (JSON Response)

```
Client → Controller → Service → OpenAI SDK → OpenAI API
                                    │
Client ← Controller ← Service ← Response (JSON)
```

**Used by**: Text generation, image generation, video creation, file operations

### Pattern 2: Streaming (SSE)

```
Client → Controller → Service → OpenAI SDK (stream: true)
                          │
                          ▼
              ┌──────────────────────┐
              │   Event Generator    │
              │   for await (event)  │
              │      yield SSE       │
              └──────────────────────┘
                          │
Client ◄───────── SSE Events ─────────
```

**Used by**: Text streaming, image progressive rendering

### Pattern 3: Async Polling

```
Client → Create Job → Service → OpenAI API
              │
              ▼
        Response: { id, status: "queued" }
              │
              ▼
Client → Poll → Service → OpenAI API
              │
              ▼
        Response: { id, status: "in_progress" }
              │
              ▼ (repeat with exponential backoff)
              │
        Response: { id, status: "completed" }
```

**Used by**: Videos, Vector Stores

### Pattern 4: Binary Streaming

```
Client → Controller → Service → OpenAI SDK
                          │
                          ▼
              ┌──────────────────────┐
              │ streamBinaryResponse │
              │  - Set Content-Type  │
              │  - Stream chunks     │
              └──────────────────────┘
                          │
Client ◄──────── Binary Data ─────────
```

**Used by**: Audio speech, file downloads, video downloads

### Pattern 5: Multipart Upload

```
Client (multipart/form-data)
        │
        ▼
┌──────────────────────┐
│   FileInterceptor    │
│  Parse multipart     │
│  Extract to buffer   │
└──────────────────────┘
        │
        ▼
Express.Multer.File → Service → OpenAI SDK
```

**Used by**: File uploads, audio transcription, image edits

---

## Type System

### Core Principles

1. **No `any` Types** - Use `unknown` with type guards
2. **OpenAI SDK Types** - Import directly from SDK
3. **Strict Mode** - TypeScript strict mode enabled
4. **Type Guards** - Safe narrowing patterns

### Type Import Pattern

```typescript
import type { Responses } from 'openai/resources/responses';
import type { Videos } from 'openai/resources/videos';
import type { Files } from 'openai/resources/files';
import type { VectorStores } from 'openai/resources/vector-stores';
```

### Service Return Types

```typescript
// Services return native SDK types
async createTextResponse(dto): Promise<Responses.Response>
async createVideo(dto): Promise<Videos.Video>
async uploadFile(...): Promise<Files.FileObject>
async createVectorStore(dto): Promise<VectorStores.VectorStore>
```

### Custom Validators (33)

| Category | Validators |
|----------|------------|
| Tools | IsCodeInterpreterToolValid, IsFileSearchToolValid |
| Vector Stores | IsChunkingStrategyValid, IsExpiresAfterValid, IsSearchFiltersValid |
| Files | IsFileSizeValid, IsFileTypeValid, IsFilePurposeValid |
| Images | IsImageModelSizeValid, IsImageFileValid |
| Audio | IsAudioFileSizeValid, IsAudioFormatValid |

### Error Code Types

```typescript
type ImageErrorCode = 'invalid_image_size' | 'invalid_image_format' | ...;
type FileErrorCode = 'file_too_large' | 'upload_failed' | ...;
type VectorStoreErrorCode = 'vector_store_not_found' | ...;
type AudioErrorCode = 'audio_file_too_large' | ...;
type CodeInterpreterErrorCode = 'code_syntax_error' | ...;
```

---

## Testing Architecture

### Four-Layer Strategy

```
┌─────────────────────────────────────────────┐
│           Unit Tests (~2,500)               │
│  • All dependencies mocked                  │
│  • Fast execution (<1s each)                │
│  • src/**/*.spec.ts                         │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│       Integration Tests (~200)              │
│  • Real implementations, mock SDK           │
│  • test/integration/*.integration-spec.ts   │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│           E2E Tests (~45)                   │
│  • Real OpenAI API calls                    │
│  • Conditional: testIf(hasApiKey)           │
│  • test/*.e2e-spec.ts                       │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│           Load Tests (~5)                   │
│  • Concurrent request handling              │
│  • test/load/*.load.spec.ts                 │
└─────────────────────────────────────────────┘
```

### Mock Factory Pattern

**File**: `src/common/testing/test.factories.ts`

```typescript
// Core factories
createMockLoggerService()      // Logging mock
createMockOpenAIClient()       // SDK client mock
createMockConfigService()      // Configuration mock
createMockOpenAIResponse()     // Response objects
createMockStreamState()        // Streaming state
createMockExecutionContext()   // NestJS context
createMockArgumentsHost()      // Exception filter context
createOpenAIError()            // SDK error creation
```

### Test Commands

```bash
npm run test              # Unit tests
npm run test:watch        # Watch mode
npm run test:cov          # Coverage report
npm run test:integration  # Integration tests
npm run test:e2e          # E2E tests (needs OPENAI_API_KEY)
```

### Coverage by Component

| Component | Tests | Coverage |
|-----------|-------|----------|
| Services | ~800 | High |
| Controllers | ~90 | High |
| Event Handlers | ~500 | High |
| Validators | ~700 | High |
| Filters | ~380 | High |
| DTOs | ~400 | High |

---

## Configuration

### Environment Variables

**Required**:
```env
OPENAI_API_KEY=sk-...    # Must start with "sk-"
```

**Optional** (with defaults):
```env
PORT=3000
NODE_ENV=development
OPENAI_API_BASE_URL=https://api.openai.com/v1
OPENAI_DEFAULT_MODEL=gpt-4o
OPENAI_TIMEOUT=60000
OPENAI_MAX_RETRIES=3
OPENAI_RETRY_DELAY=1000
LOG_LEVEL=debug
LOG_DIR=./logs
VIDEO_GENERATION_TIMEOUT=600000
```

### Zod Validation Schema

```typescript
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().positive().default(3000),
  OPENAI_API_KEY: z.string().min(1).startsWith('sk-'),
  OPENAI_API_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  OPENAI_TIMEOUT: z.coerce.number().positive().default(60000),
  OPENAI_MAX_RETRIES: z.coerce.number().min(0).max(10).default(3),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'verbose']).default('debug'),
});
```

### Bootstrap Process

```typescript
async function bootstrap() {
  // 1. Create application
  const app = await NestFactory.create(AppModule);

  // 2. Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // 3. Enable CORS
  app.enableCors();

  // 4. Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('OpenAI API Testing Project')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('api-docs', app, document);

  // 5. Start server
  await app.listen(process.env.PORT ?? 3000);
}
```

---

## Design Patterns Summary

| Pattern | Usage | Location |
|---------|-------|----------|
| **Dependency Injection** | All services, providers | NestJS IoC |
| **Module Pattern** | Feature encapsulation | `*.module.ts` |
| **Singleton** | OpenAI client, services | Provider factory |
| **Orchestrator** | Streaming event dispatch | ResponsesService |
| **Generator** | Event handlers | `*Events.handler.ts` |
| **Factory** | Test mocks | `test.factories.ts` |
| **Interceptor** | Cross-cutting (logging, retry) | CommonModule |
| **Exception Filter** | Error transformation | CommonModule |
| **Strategy** | Error handlers by type | ExceptionFilter |
| **Type Guard** | Safe type narrowing | Throughout |

---

## Quick Reference

### Key Files

| Purpose | File |
|---------|------|
| App entry | `src/main.ts` |
| Root module | `src/app.module.ts` |
| Config validation | `src/config/env.validation.ts` |
| Logger | `src/common/services/logger.service.ts` |
| Error handling | `src/common/filters/openai-exception.filter.ts` |
| Responses service | `src/openai/services/openai-responses.service.ts` |
| Test factories | `src/common/testing/test.factories.ts` |
| Error codes | `src/openai/interfaces/error-codes.interface.ts` |

### Run Commands

```bash
npm run build         # Build
npm run start:dev     # Development
npm run lint          # Lint
npm run test          # Test
npm run test:e2e      # E2E test
```

### API Documentation

Available at `http://localhost:3000/api-docs` when running.
