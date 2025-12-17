# Data Flow Architecture

Complete documentation of data flow patterns, transformations, and communication in the OpenAI Responses API project.

## Table of Contents

1. [Overview](#overview)
2. [Request Lifecycle](#request-lifecycle)
3. [Validation Pipeline](#validation-pipeline)
4. [Service Layer Transformations](#service-layer-transformations)
5. [Response Processing](#response-processing)
6. [Streaming Data Flow](#streaming-data-flow)
7. [Async Polling Patterns](#async-polling-patterns)
8. [Error Handling Flow](#error-handling-flow)
9. [Logging Data Flow](#logging-data-flow)
10. [Cost Calculation](#cost-calculation)

---

## Overview

### Data Flow Patterns

| Pattern | Use Case | APIs |
|---------|----------|------|
| **Synchronous** | Single request/response | Text, Images, Files |
| **Streaming** | Real-time incremental output | Text, Audio, Reasoning |
| **Async Polling** | Long-running jobs | Videos, Vector Stores |
| **Binary** | File downloads | Audio TTS, Video download |

### Key Principles

1. **Type Safety**: Zero `any` types throughout the codebase
2. **Minimal Transformation**: Return OpenAI responses as-is when possible
3. **Selective Extraction**: Extract only required fields for logging/monitoring
4. **Conditional Addition**: Optional parameters added only when provided
5. **Centralized Logic**: Single source of truth for pricing, logging, validation

---

## Request Lifecycle

### Complete Request Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HTTP REQUEST ENTRY                                 │
│                    POST /api/responses/text                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          NestJS Routing Layer                                │
│   • Route matching via @Controller('api/responses')                         │
│   • Method matching via @Post('text')                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Global Interceptors                                 │
│   1. RetryInterceptor (transient failure handling)                          │
│   2. LoggingInterceptor (start timing, capture request)                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ValidationPipe                                      │
│   • whitelist: true (remove unknown fields)                                 │
│   • forbidNonWhitelisted: true (reject unknown)                             │
│   • transform: true (convert to DTO class)                                  │
│   • class-validator decorators execute                                      │
│   • Custom validators (@IsImageModelSizeValid, etc.)                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                            ┌─────────┴─────────┐
                            │                   │
                     Validation OK         Validation Failed
                            │                   │
                            ▼                   ▼
                    ┌───────────────┐   ┌───────────────────┐
                    │  Controller   │   │ OpenAIException   │
                    │   Handler     │   │     Filter        │
                    └───────────────┘   └───────────────────┘
                            │                   │
                            ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Service Layer                                       │
│   1. Transform DTO → OpenAI SDK parameters                                  │
│   2. Conditionally add optional parameters (28 for text)                    │
│   3. Call client.responses.create(params)                                   │
│   4. Extract usage, metadata from response                                  │
│   5. Calculate cost via PricingService                                      │
│   6. Log transaction via LoggerService                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          OpenAI API Call                                     │
│   • HTTP POST to https://api.openai.com/v1/responses                        │
│   • SDK handles authentication, retries, timeouts                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                            ┌─────────┴─────────┐
                            │                   │
                      API Success          API Error
                            │                   │
                            ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Response Processing                                      │
│                                                                              │
│   Success Path:                    Error Path:                              │
│   • Extract usage data            • OpenAIExceptionFilter catches           │
│   • Extract metadata              • Transform to EnhancedErrorResponse      │
│   • Calculate cost                • Extract error code, parameter           │
│   • Log success                   • Add hint, rate limit info               │
│   • Return response               • Log error, return error response        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     LoggingInterceptor (Response)                            │
│   • Calculate latency (Date.now() - startTime)                              │
│   • Extract tokens_used, cost_estimate                                      │
│   • Write to logs/YYYY-MM-DD/{api}.log                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          HTTP RESPONSE                                       │
│                    JSON body to client                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data at Each Stage

| Stage | Input | Output | Transformation |
|-------|-------|--------|----------------|
| HTTP Entry | Raw JSON body | Request object | Parse JSON |
| Validation | Request body | Validated DTO | Type checking, constraints |
| Service Entry | DTO | SDK params | Conditional field mapping |
| SDK Call | Params object | HTTP request | Serialize to JSON |
| API Response | JSON response | Response object | Parse, type SDK response |
| Logging | Response | Log entry | Extract metadata, calculate cost |
| HTTP Exit | Response object | JSON string | Serialize response |

---

## Validation Pipeline

### DTO Structure (28 Parameters for Text)

```typescript
export class CreateTextResponseDto {
  // Required
  @IsString()
  input!: string;

  // Model selection
  @IsString()
  @IsOptional()
  model?: string = 'gpt-5';

  // Configuration
  @IsNumber()
  @Min(0)
  @Max(2)
  @IsOptional()
  temperature?: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  top_p?: number;

  // Tools with custom validators
  @IsArray()
  @IsOptional()
  @IsCodeInterpreterToolValid()
  @IsFileSearchToolValid()
  tools?: Responses.ResponseCreateParamsNonStreaming['tools'];

  // Streaming
  @IsBoolean()
  @IsOptional()
  stream?: boolean = false;

  // ... 20+ more parameters
}
```

### Custom Validators

| Validator | Purpose | Cross-Field |
|-----------|---------|-------------|
| `@IsImageModelSizeValid()` | Size compatibility with model | Yes |
| `@IsFileSearchToolValid()` | Vector store IDs, ranking options | No |
| `@IsCodeInterpreterToolValid()` | Container config, file IDs | No |
| `@IsPromptValid()` | Reusable prompt templates | No |
| `@IsFileTypeValid()` | MIME type by purpose | Yes |
| `@IsAudioFileSizeValid()` | 25MB limit check | No |

### Cross-Field Validation Example

```typescript
@ValidatorConstraint({ async: false })
export class IsImageModelSizeValidConstraint implements ValidatorConstraintInterface {
  validate(size: unknown, args: ValidationArguments): boolean {
    const object = args.object as Record<string, unknown>;
    const model = (object.model as string) || 'dall-e-2';

    if (model === 'gpt-image-1') {
      return ['1024x1024', '1024x1536', '1536x1024', 'auto'].includes(size as string);
    }
    if (model === 'dall-e-3') {
      return ['1024x1024', '1792x1024', '1024x1792'].includes(size as string);
    }
    if (model === 'dall-e-2') {
      return ['256x256', '512x512', '1024x1024'].includes(size as string);
    }
    return true;
  }
}
```

### Validation Error Flow

```
Validation Fails
      │
      ▼
BadRequestException with constraint violations
      │
      ▼
OpenAIExceptionFilter catches
      │
      ▼
Transform to EnhancedErrorResponse:
{
  "statusCode": 400,
  "timestamp": "2025-01-12T10:30:00.000Z",
  "path": "/api/images/generate",
  "message": "Size '512x512' is not supported for DALL-E 3",
  "error_code": "invalid_image_size",
  "parameter": "size",
  "hint": "Valid sizes for DALL-E 3: 1024x1024, 1792x1024, 1024x1792",
  "validation_errors": [...]
}
```

---

## Service Layer Transformations

### DTO to SDK Parameters

```typescript
async createTextResponse(dto: CreateTextResponseDto): Promise<Responses.Response> {
  // Build required parameters
  const params: ExtendedResponseCreateParamsNonStreaming = {
    model: dto.model || this.defaultModel,
    input: dto.input,
    stream: false,
  };

  // Conditionally add optional parameters
  if (dto.instructions) params.instructions = dto.instructions;
  if (dto.modalities) params.modalities = dto.modalities;
  if (dto.tools) params.tools = dto.tools;
  if (dto.temperature !== undefined) params.temperature = dto.temperature;
  if (dto.top_p !== undefined) params.top_p = dto.top_p;
  if (dto.max_output_tokens !== undefined) params.max_output_tokens = dto.max_output_tokens;
  if (dto.conversation !== undefined) params.conversation = dto.conversation;
  if (dto.store !== undefined) params.store = dto.store;
  if (dto.previous_response_id) params.previous_response_id = dto.previous_response_id;
  // ... 18 more optional parameters

  return await this.client.responses.create(params);
}
```

### Alternative Pattern: Spread Operator

```typescript
const params: Responses.ResponseCreateParamsNonStreaming = {
  prompt: dto.prompt,
  ...(dto.model && { model: dto.model }),
  ...(dto.n && { n: dto.n }),
  ...(dto.size && { size: dto.size }),
  ...(dto.quality && { quality: dto.quality }),
};
```

### File Upload Transformation

```typescript
async uploadFile(
  fileBuffer: Buffer,
  filename: string,
  purpose: Files.FilePurpose,
): Promise<Files.FileObject> {
  // Transform Buffer to SDK File object
  const params: Files.FileCreateParams = {
    file: await toFile(fileBuffer, filename),  // Key transformation
    purpose,
  };

  return await this.client.files.create(params);
}
```

---

## Response Processing

### Token Usage Extraction

```typescript
private extractUsage(response: Responses.Response): TokenUsage | null {
  if (!response.usage) return null;

  const usage: TokenUsage = {
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    total_tokens: response.usage.total_tokens,
  };

  // Extract cached tokens (50% discount)
  if (response.usage.input_tokens_details?.cached_tokens) {
    usage.input_tokens_details = {
      cached_tokens: response.usage.input_tokens_details.cached_tokens,
    };
  }

  // Extract reasoning tokens (o-series models)
  if (response.usage.output_tokens_details?.reasoning_tokens) {
    usage.output_tokens_details = {
      reasoning_tokens: response.usage.output_tokens_details.reasoning_tokens,
    };
  }

  return usage;
}
```

### Response Metadata Extraction

```typescript
private extractResponseMetadata(response: Responses.Response): ResponseMetadata {
  return {
    status: response.status,                    // 'completed', 'failed', 'incomplete'
    error: response.error,                      // Error details if failed
    incomplete_details: response.incomplete_details,  // Why stopped early
    conversation: response.conversation,        // Multi-turn conversation ID
    background: response.background,            // Background mode flag
    max_output_tokens: response.max_output_tokens,
    previous_response_id: response.previous_response_id,
    prompt_cache_key: response.prompt_cache_key,
    service_tier: response.service_tier,        // auto/default/flex/scale
    truncation: response.truncation,            // Context overflow handling
    safety_identifier: response.safety_identifier,
    metadata: response.metadata,                // Custom key-value pairs
  };
}
```

### Audio Response Handling (Polymorphic)

```typescript
private prepareTranscriptionLogResponse(
  response: Audio.Transcription | Audio.TranscriptionVerbose | string,
): TranscriptionLogData {
  const isObjectResponse = typeof response === 'object' && 'text' in response;

  if (isObjectResponse) {
    return {
      textLength: response.text.length,
      durationSeconds: response.duration,
      detectedLanguage: response.language,
      segmentCount: response.segments?.length,
      wordCount: response.words?.length,
      logResponse: response,
    };
  } else {
    // String response (text/srt/vtt formats)
    return {
      textLength: String(response).length,
      logResponse: { text: String(response).substring(0, 200) },
    };
  }
}
```

---

## Streaming Data Flow

### Streaming Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     POST /api/responses/text/stream                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Controller                                          │
│   res.setHeader('Content-Type', 'text/event-stream')                        │
│   res.setHeader('Cache-Control', 'no-cache')                                │
│   res.setHeader('Connection', 'keep-alive')                                 │
│   res.setHeader('X-Accel-Buffering', 'no')                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Service: Async Generator                                 │
│   async *createTextResponseStream(dto): AsyncIterable<SSEEvent>             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     OpenAI SDK Streaming                                     │
│   const stream = await this.client.responses.create({ stream: true })       │
│   for await (const event of stream) { ... }                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Orchestrator (switch/case)                               │
│   Routes 63 event types to 10 specialized handlers                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
          ▼                           ▼                           ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   Lifecycle     │       │      Text       │       │   Tool Calling  │
│    Handler      │       │    Handler      │       │     Handler     │
│   (7 events)    │       │   (3 events)    │       │   (15 events)   │
└─────────────────┘       └─────────────────┘       └─────────────────┘
          │                           │                           │
          └───────────────────────────┼───────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     StreamState Accumulation                                 │
│   fullText += delta    reasoning += delta    toolCalls.set(call_id, ...)   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SSE Event Yield                                          │
│   yield { event: 'text_delta', data: JSON.stringify({...}), sequence }      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Controller: Write to Response                            │
│   res.write(`event: ${event}\ndata: ${data}\n\n`)                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Client Receives SSE                                      │
│   event: text_delta                                                          │
│   data: {"delta":"Hello","sequence":1}                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### StreamState Interface

```typescript
interface StreamState {
  // Text accumulation
  fullText: string;              // Accumulated text deltas
  reasoning: string;             // Accumulated reasoning (o-series)
  reasoningSummary: string;      // Reasoning summary
  refusal: string;               // Refusal message if applicable

  // Audio accumulation
  audio: string;                 // Base64-encoded audio chunks
  audioTranscript: string;       // Audio transcript

  // Tool execution tracking
  toolCalls: Map<string, {
    type: 'function' | 'code_interpreter' | 'file_search' | 'web_search';
    input: string;
    code?: string;
    status: 'in_progress' | 'completed';
    result?: unknown;
  }>;

  // Metadata
  responseId?: string;           // Set by response.created
  model?: string;                // Model name
  startTime: number;             // For latency calculation
  finalResponse?: Responses.Response;
}
```

### Handler Data Transformation

```typescript
*handleTextDelta(
  event: unknown,
  state: StreamState,
  sequence: number,
): Iterable<SSEEvent> {
  // 1. Extract typed data
  const eventData = (event as { delta?: string; logprobs?: unknown }) || {};
  const delta = eventData.delta || '';

  // 2. Accumulate in state
  state.fullText += delta;

  // 3. Log event
  this.loggerService.logStreamingEvent({
    timestamp: new Date().toISOString(),
    api: 'responses',
    endpoint: '/v1/responses (stream)',
    event_type: 'text_delta',
    sequence,
    delta,
  });

  // 4. Build SSE payload
  const sseData: Record<string, unknown> = { delta, sequence };
  if (eventData.logprobs) sseData.logprobs = eventData.logprobs;

  // 5. Yield SSE event
  yield {
    event: 'text_delta',
    data: JSON.stringify(sseData),
    sequence,
  };
}
```

### Event Categories (63 Total)

| Category | Count | Examples |
|----------|-------|----------|
| Lifecycle | 7 | created, completed, failed, incomplete |
| Text | 3 | delta, done, annotation |
| Reasoning | 6 | delta, done, summary_delta, summary_done |
| Function Calls | 2 | arguments_delta, arguments_done |
| Code Interpreter | 5 | in_progress, code_delta, completed |
| File Search | 3 | in_progress, searching, completed |
| Web Search | 3 | in_progress, searching, completed |
| Computer Use | 6 | action_delta, screenshot, completed |
| Image | 4 | in_progress, partial_image, completed |
| Audio | 4 | delta, done, transcript_delta |
| MCP | 8 | call events, list_tools events |
| Refusal | 2 | delta, done |
| Structural | 4 | output_item, content_part |

---

## Async Polling Patterns

### Videos API Polling

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     POST /api/videos (Create Job)                            │
│   Returns: { id: "vid_xxx", status: "queued", progress: 0 }                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     GET /api/videos/:id/poll?maxWaitMs=600000               │
│                     (Server-Side Polling Loop)                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Exponential Backoff                                      │
│   Initial: 5s → 10s → 15s → 20s (max)                                       │
│                                                                              │
│   while (elapsed < maxWaitMs) {                                             │
│     status = await getVideoStatus(id);                                      │
│     if (status === 'completed' || status === 'failed') return;             │
│     await sleep(waitTime);                                                  │
│     waitTime = Math.min(waitTime + 5000, 20000);                           │
│   }                                                                          │
│   throw GatewayTimeoutException;                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                            ┌─────────┴─────────┐
                            │                   │
                      Completed              Failed
                            │                   │
                            ▼                   ▼
                    ┌───────────────┐   ┌───────────────┐
                    │ { status:     │   │ { status:     │
                    │   "completed",│   │   "failed",   │
                    │   progress:   │   │   error: {    │
                    │   100 }       │   │     code,     │
                    │               │   │     message } │
                    └───────────────┘   └───────────────┘
```

### Vector Stores: Multi-Level Polling

```
Level 1: Vector Store Indexing
┌────────────────────────────────────────────────────┐
│  POST /api/vector-stores/:vs_id/poll               │
│  Terminal: 'completed' | 'expired'                 │
└────────────────────────────────────────────────────┘

Level 2: Individual File Indexing
┌────────────────────────────────────────────────────┐
│  POST /api/vector-stores/:vs_id/files/:file_id/poll│
│  Terminal: 'completed' | 'failed' | 'cancelled'    │
└────────────────────────────────────────────────────┘

Level 3: Batch Processing
┌────────────────────────────────────────────────────┐
│  POST /api/vector-stores/:vs_id/batches/:batch/poll│
│  Terminal: 'completed' | 'cancelled'               │
│  Tracks: file_counts { completed, failed, total }  │
└────────────────────────────────────────────────────┘
```

### Polling vs Streaming Comparison

| Aspect | Polling (Videos) | Streaming (Responses) |
|--------|------------------|----------------------|
| Pattern | Client polls status | Server pushes events |
| Latency | Seconds between updates | Real-time (ms) |
| Connection | Multiple short requests | Single long connection |
| State | Server-side job state | Client accumulates |
| Use Case | Long batch jobs | Incremental generation |
| Protocol | REST | SSE |

---

## Error Handling Flow

### Error Propagation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Error Source                                        │
│   • Validation (DTO constraints)                                            │
│   • OpenAI SDK (API errors)                                                 │
│   • Network (timeouts, connection)                                          │
│   • Service logic (business rules)                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     OpenAIExceptionFilter (@Catch())                         │
│   Global filter catches ALL exceptions                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
           ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
           │ OpenAI SDK    │  │  Network      │  │  NestJS       │
           │ Errors        │  │  Errors       │  │ HttpException │
           │ (instanceof)  │  │ (code prop)   │  │ (instanceof)  │
           └───────────────┘  └───────────────┘  └───────────────┘
                    │                 │                 │
                    └─────────────────┼─────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Error Code Extraction (3 Levels)                         │
│   1. Top-level: exception.code                                              │
│   2. Nested: exception.error.code                                           │
│   3. JSON parse: exception.message → extract JSON → parse code              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Error Mapping                                            │
│   • IMAGE_ERROR_CODE_MAPPINGS (15 codes)                                    │
│   • VIDEO_ERROR_CODE_MAPPINGS (20 codes)                                    │
│   • FILE_ERROR_CODE_MAPPINGS (14 codes)                                     │
│   • VECTOR_STORE_ERROR_CODE_MAPPINGS (23 codes)                             │
│   • AUDIO_ERROR_CODE_MAPPINGS (11 codes)                                    │
│   • CODE_INTERPRETER_ERROR_CODE_MAPPINGS (11 codes)                         │
│   • NETWORK_ERROR_CODE_MAPPINGS (5 codes)                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     EnhancedErrorResponse                                    │
│   {                                                                          │
│     statusCode, timestamp, path, message,                                   │
│     request_id, error_code, parameter, hint,                                │
│     rate_limit_info, retry_after_seconds,                                   │
│     openai_error: { type, code, param, message, full_error }                │
│   }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     LoggerService.logOpenAIInteraction()                     │
│   Logs error with full context to logs/YYYY-MM-DD/{api}.log                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Error Types by HTTP Status

| Status | Error Type | Example |
|--------|------------|---------|
| 400 | BadRequestError | Invalid parameters, model constraints |
| 401 | AuthenticationError | Invalid API key |
| 403 | PermissionDeniedError | API key lacks access |
| 404 | NotFoundError | Resource not found |
| 429 | RateLimitError | Rate/token limit exceeded |
| 500+ | InternalServerError | OpenAI service error |
| 503 | Network | ECONNREFUSED, ENOTFOUND |
| 504 | Timeout | ETIMEDOUT, APIConnectionTimeoutError |

### Rate Limit Handling

```typescript
// Extract rate limit headers
const rateLimitInfo = {
  limit_requests: headers.get('x-ratelimit-limit-requests'),
  remaining_requests: headers.get('x-ratelimit-remaining-requests'),
  reset_requests: headers.get('x-ratelimit-reset-requests'),
  limit_tokens: headers.get('x-ratelimit-limit-tokens'),
  remaining_tokens: headers.get('x-ratelimit-remaining-tokens'),
  reset_tokens: headers.get('x-ratelimit-reset-tokens'),
};

// Set Retry-After header
const retryAfter = headers.get('retry-after') || 60;
response.setHeader('Retry-After', retryAfter.toString());

// Return with full rate limit info
return {
  statusCode: 429,
  message: 'Rate limit exceeded',
  retry_after_seconds: retryAfter,
  rate_limit_info: rateLimitInfo,
  hint: 'Please wait before making another request.',
};
```

---

## Logging Data Flow

### Dual Logging Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Non-Streaming Endpoints                                  │
│   LoggingInterceptor handles complete request/response logging              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│   logOpenAIInteraction({                                                     │
│     timestamp, api, endpoint,                                               │
│     request: { model, input, ... },                                         │
│     response: { id, output_text, usage, ... },                              │
│     metadata: { latency_ms, tokens_used, cost_estimate }                    │
│   })                                                                         │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                     Streaming Endpoints                                      │
│   Event handlers log individual events (interceptor skips)                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│   logStreamingEvent({                                                        │
│     timestamp, api, endpoint,                                               │
│     event_type: 'text_delta',                                               │
│     sequence: 5,                                                             │
│     delta: 'Hello world',                                                   │
│   })                                                                         │
│   // One entry per event (51+ event types)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Log File Organization

```
logs/
├── 2025-01-12/
│   ├── responses.log    # Text generation
│   ├── images.log       # Image generation
│   ├── videos.log       # Video generation
│   ├── files.log        # File operations
│   ├── vector_stores.log # Vector store operations
│   └── audio.log        # Audio operations
├── 2025-01-13/
│   └── ...
```

### Log Entry Format

```json
{
  "timestamp": "2025-01-12T10:30:00.000Z",
  "api": "responses",
  "endpoint": "/api/responses/text",
  "request": {
    "model": "gpt-5",
    "input": "Explain quantum computing",
    "max_output_tokens": 1000,
    "temperature": 0.7
  },
  "response": {
    "id": "resp_abc123def456",
    "output_text": "Quantum computing uses...",
    "usage": {
      "input_tokens": 5,
      "output_tokens": 125,
      "total_tokens": 130,
      "input_tokens_details": { "cached_tokens": 0 },
      "output_tokens_details": { "reasoning_tokens": 0 }
    }
  },
  "metadata": {
    "latency_ms": 1250,
    "tokens_used": 130,
    "cost_estimate": 0.00131,
    "cached_tokens": 0,
    "reasoning_tokens": 0
  }
}
────────────────────────────────────────────────────────────────────────────────
```

### Metadata Fields

| Field | Type | Description |
|-------|------|-------------|
| `latency_ms` | number | Request duration |
| `tokens_used` | number | Total tokens |
| `cached_tokens` | number | Cached input tokens |
| `reasoning_tokens` | number | o-series reasoning |
| `cost_estimate` | number | USD cost |
| `response_status` | string | completed/failed/incomplete |
| `video_id` | string | Video job ID |
| `file_id` | string | File ID |
| `vector_store_id` | string | Vector store ID |
| `images_generated` | number | Image count |
| `voice` | string | TTS voice |
| `duration_seconds` | number | Audio duration |

---

## Cost Calculation

### Pricing Service

```typescript
private readonly MODEL_PRICING: Record<string, ModelPricing> = {
  'gpt-4o': {
    input: 0.0025,           // $2.50 per 1M input tokens
    output: 0.01,            // $10.00 per 1M output tokens
    cached: 0.00125,         // $1.25 per 1M cached (50% discount)
  },
  'gpt-4o-mini': {
    input: 0.00015,
    output: 0.0006,
    cached: 0.000075,
  },
  'o1': {
    input: 0.015,
    output: 0.06,
    reasoning: 0.06,         // Reasoning tokens
    cached: 0.0075,
  },
  'o3-mini': {
    input: 0.0011,
    output: 0.0044,
    reasoning: 0.0044,
    cached: 0.00055,
  },
  'gpt-5': {
    input: 0.00125,
    output: 0.01,
    reasoning: 0.01,
    cached: 0.000625,
  },
  'gpt-image-1': {
    input: 0.0025,
    output: 0.01,
    image: 0.04,             // $0.04 per image
  },
};
```

### Cost Calculation Algorithm

```typescript
calculateCost(model: string, usage?: TokenUsage | null): number {
  const pricing = this.getModelPricing(model);
  if (!pricing || !usage) return 0;

  let cost = 0;

  // Input tokens (regular)
  if (usage.input_tokens !== undefined) {
    cost += (usage.input_tokens / 1_000_000) * pricing.input;
  }

  // Cached input tokens (discounted)
  if (usage.input_tokens_details?.cached_tokens && pricing.cached) {
    cost += (usage.input_tokens_details.cached_tokens / 1_000_000) * pricing.cached;
  }

  // Output tokens
  if (usage.output_tokens !== undefined) {
    cost += (usage.output_tokens / 1_000_000) * pricing.output;
  }

  // Reasoning tokens (o-series)
  if (usage.output_tokens_details?.reasoning_tokens && pricing.reasoning) {
    cost += (usage.output_tokens_details.reasoning_tokens / 1_000_000) * pricing.reasoning;
  }

  return cost;
}
```

### Additional Cost Utilities

```typescript
// Image generation cost
calculateImageCost(model: string, size: string, quality: string, n: number): number

// Video generation cost
calculateVideoCost(model: string, durationSeconds: number): number

// Speech synthesis cost
calculateSpeechCost(model: string, characters: number): number

// Transcription cost
calculateTranscriptionCost(model: string, durationSeconds: number): number
```

---

## Data Flow Summary

### Flow Types

| Flow | Entry | Processing | Exit |
|------|-------|------------|------|
| **Sync** | HTTP POST | Validate → Service → SDK | JSON Response |
| **Stream** | HTTP POST | Validate → Generator → Handlers | SSE Events |
| **Poll** | HTTP GET | Loop → Status Check → Backoff | JSON Response |
| **Binary** | HTTP GET | SDK → Buffer → Stream | Binary File |
| **Error** | Any | Exception → Filter → Transform | Error JSON |

### Key Transformation Points

1. **Request Entry**: Raw JSON → Validated DTO
2. **Service Layer**: DTO → OpenAI SDK Params
3. **SDK Response**: JSON → Typed Response Object
4. **Streaming**: Raw Event → Handler → SSE Event
5. **Logging**: Response → Extracted Metadata → Log Entry
6. **Error**: Exception → Enhanced Error Response

### Type Safety Throughout

- All transformations use TypeScript strict mode
- Zero `any` types in the codebase
- OpenAI SDK types used directly
- Type guards for safe property access
- Conditional types for polymorphic responses

---

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Overall system architecture
- [STREAMING.md](./STREAMING.md) - Streaming architecture details
- [README.md](../README.md) - Project overview and API documentation
- [CLAUDE.md](../CLAUDE.md) - Development guidelines
