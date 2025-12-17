# Streaming Architecture

Complete documentation of the OpenAI Responses API streaming implementation.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Event Categories](#event-categories)
4. [Streaming Handlers](#streaming-handlers)
5. [State Management](#state-management)
6. [SSE Protocol](#sse-protocol)
7. [REST Endpoints](#rest-endpoints)
8. [Error Handling](#error-handling)
9. [Testing Architecture](#testing-architecture)
10. [Client Integration](#client-integration)

---

## Overview

### Statistics

| Metric | Value |
|--------|-------|
| Total Event Types | 63 |
| Handler Services | 10 |
| Event Categories | 9 |
| Streaming Endpoints | 4 |
| Test Coverage | 2,605+ tests |

### Technology Stack

- **OpenAI SDK**: v6.9.1 Responses API streaming
- **Protocol**: Server-Sent Events (SSE)
- **Pattern**: Orchestrator with async generators
- **Transport**: HTTP/1.1 chunked transfer encoding

### Key Design Principles

1. **Separation of Concerns**: 10 specialized handlers, one per event category
2. **Type Safety**: Zero `any` types, strict TypeScript mode
3. **Generator Functions**: `function*` yielding SSE events for memory efficiency
4. **Stateful Processing**: Shared `StreamState` for cross-event data accumulation
5. **Forward Compatibility**: Unknown event handler for future API versions

---

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client Request                                  │
│                    POST /api/responses/text/stream                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ResponsesController                                 │
│   • Sets SSE headers (Content-Type, Cache-Control, Connection)             │
│   • Calls service.createTextResponseStream(dto)                            │
│   • Consumes async generator with for-await loop                           │
│   • Writes SSE events to response: `event: name\ndata: json\n\n`           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       OpenAIResponsesService                                 │
│   • Initializes StreamState with empty accumulators                        │
│   • Calls client.responses.create(params) with stream: true                │
│   • Orchestrates event routing via switch/case                             │
│   • Delegates to handlers with yield* (generator delegation)               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
        ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
        │   Lifecycle   │  │     Text      │  │   Reasoning   │
        │    Handler    │  │    Handler    │  │    Handler    │
        │   (7 events)  │  │   (3 events)  │  │   (6 events)  │
        └───────────────┘  └───────────────┘  └───────────────┘
                    │                 │                 │
                    ▼                 ▼                 ▼
        ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
        │ Tool Calling  │  │    Image      │  │    Audio      │
        │    Handler    │  │    Handler    │  │    Handler    │
        │  (15 events)  │  │   (4 events)  │  │   (4 events)  │
        └───────────────┘  └───────────────┘  └───────────────┘
                    │                 │                 │
                    ▼                 ▼                 ▼
        ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
        │ Computer Use  │  │      MCP      │  │   Refusal     │
        │    Handler    │  │    Handler    │  │    Handler    │
        │   (6 events)  │  │   (8 events)  │  │   (2 events)  │
        └───────────────┘  └───────────────┘  └───────────────┘
                                      │
                                      ▼
                           ┌───────────────┐
                           │  Structural   │
                           │    Handler    │
                           │  (4 events)   │
                           │  + unknown    │
                           └───────────────┘
```

### Orchestrator Pattern

The service uses a comprehensive switch/case pattern for event routing:

```typescript
async *createTextResponseStream(dto): AsyncIterable<SSEEvent> {
  const state: StreamState = { fullText: '', reasoning: '', toolCalls: new Map(), ... };
  const stream = await this.client.responses.create(params);

  for await (const event of stream) {
    const sequence = event.sequence_number || 0;

    switch (event.type) {
      case 'response.created':
        yield* this.lifecycleHandler.handleResponseCreated(event, state, sequence);
        break;
      case 'response.output_text.delta':
        yield* this.textHandler.handleTextDelta(event, state, sequence);
        break;
      // ... 60+ more cases
      default:
        yield* this.structuralHandler.handleUnknownEvent(event, state, sequence);
        break;
    }
  }
}
```

### Generator Delegation

All handlers use ES6 generator functions with `yield*` delegation:

```typescript
// Handler method
*handleTextDelta(event: unknown, state: StreamState, sequence: number): Iterable<SSEEvent> {
  const delta = (event as { delta?: string }).delta || '';
  state.fullText += delta;  // Accumulate state

  this.loggerService.logStreamingEvent({...});  // Log event

  yield {  // Emit SSE event
    event: 'text_delta',
    data: JSON.stringify({ delta, sequence }),
    sequence,
  };
}
```

**Benefits**:
- Lazy evaluation of events
- Memory efficient for large streams
- Composable event processing
- Clean separation of concerns

---

## Event Categories

### Complete Event Catalog (63 Events)

#### 1. Lifecycle Events (7)

| Event Type | SSE Event | Description |
|------------|-----------|-------------|
| `response.created` | `response_created` | Response initialized with ID and model |
| `response.queued` | `response_queued` | Waiting for processing resources |
| `response.in_progress` | `response_in_progress` | Generation started |
| `response.completed` | `response_completed` | Successfully finished with usage stats |
| `response.incomplete` | `response_incomplete` | Stopped before completion (max_tokens hit) |
| `response.failed` | `response_failed` | Generation failed with error details |
| `error` | `error` | Generic stream error |

#### 2. Text Output Events (3)

| Event Type | SSE Event | Description |
|------------|-----------|-------------|
| `response.output_text.delta` | `text_delta` | Incremental text chunk with optional logprobs |
| `response.output_text.done` | `text_done` | Text generation complete |
| `response.output_text.annotation.added` | `text_annotation` | Citations, warnings, file references |

#### 3. Reasoning Events (6) - o-series Models

| Event Type | SSE Event | Description |
|------------|-----------|-------------|
| `response.reasoning_text.delta` | `reasoning_delta` | Streaming reasoning tokens |
| `response.reasoning_text.done` | `reasoning_done` | Complete reasoning trace |
| `response.reasoning_summary_text.delta` | `reasoning_summary_delta` | Condensed reasoning summary |
| `response.reasoning_summary_text.done` | `reasoning_summary_done` | Complete summary |
| `response.reasoning_summary_part.added` | `reasoning_summary_part.added` | Structured reasoning section |
| `response.reasoning_summary_part.done` | `reasoning_summary_part.done` | Section completed |

#### 4. Function Call Events (2)

| Event Type | SSE Event | Description |
|------------|-----------|-------------|
| `response.function_call_arguments.delta` | `function_call_delta` | Streaming JSON argument chunks |
| `response.function_call_arguments.done` | `function_call_done` | Complete arguments ready for execution |

#### 5. Code Interpreter Events (5)

| Event Type | SSE Event | Description |
|------------|-----------|-------------|
| `response.code_interpreter_call.in_progress` | `code_interpreter.in_progress` | Tool activated |
| `response.code_interpreter_call.interpreting` | `code_interpreter.interpreting` | Code executing |
| `response.code_interpreter_call_code.delta` | `code_interpreter_code_delta` | Streaming Python code |
| `response.code_interpreter_call_code.done` | `code_interpreter_code_done` | Complete Python code |
| `response.code_interpreter_call.completed` | `code_interpreter_completed` | Execution results (logs, images, files) |

**Output Types**:
- `CodeInterpreterLogsOutput`: stdout/stderr
- `CodeInterpreterImageOutput`: generated plots (base64)
- `CodeInterpreterFileOutput`: generated files with file_id
- `CodeInterpreterErrorOutput`: syntax, runtime, timeout errors

#### 6. File Search Events (3)

| Event Type | SSE Event | Description |
|------------|-----------|-------------|
| `response.file_search_call.in_progress` | `file_search.in_progress` | Search started |
| `response.file_search_call.searching` | `file_search.searching` | Actively searching |
| `response.file_search_call.completed` | `file_search_completed` | Results with document citations |

#### 7. Web Search Events (3)

| Event Type | SSE Event | Description |
|------------|-----------|-------------|
| `response.web_search_call.in_progress` | `web_search.in_progress` | Search started |
| `response.web_search_call.searching` | `web_search.searching` | Searching internet |
| `response.web_search_call.completed` | `web_search_completed` | Results with URLs and snippets |

#### 8. Custom Tool Events (2)

| Event Type | SSE Event | Description |
|------------|-----------|-------------|
| `response.custom_tool_call_input.delta` | `custom_tool_delta` | Streaming custom tool input |
| `response.custom_tool_call_input.done` | `custom_tool_done` | Complete input ready |

#### 9. Computer Use Events (6)

| Event Type | SSE Event | Description |
|------------|-----------|-------------|
| `response.computer_use_call.in_progress` | `computer_use.in_progress` | Tool activated |
| `response.computer_use_call.action.delta` | `computer_use_action_delta` | Streaming action data |
| `response.computer_use_call.action.done` | `computer_use_action_done` | Action complete |
| `response.computer_use_call_output_item.added` | `computer_use_output_item_added` | Screenshot started |
| `response.computer_use_call_output_item.done` | `computer_use_output_item_done` | Screenshot complete (base64) |
| `response.computer_use_call.completed` | `computer_use_completed` | All actions finished |

**Action Types**: `mouse_move`, `click`, `type`, `key`, `screenshot`

#### 10. Image Generation Events (4)

| Event Type | SSE Event | Description |
|------------|-----------|-------------|
| `response.image_generation_call.in_progress` | `image_generation_call.in_progress` | Generation started |
| `response.image_generation_call.generating` | `image_generation_call.generating` | In progress |
| `response.image_generation_call.partial_image` | `image_gen_partial` | Progressive partial image (base64) |
| `response.image_generation_call.completed` | `image_gen_completed` | Final image (base64) |

**Formats**: png, jpeg, webp | **Quality**: low, high, ultra

#### 11. Audio Events (4)

| Event Type | SSE Event | Description |
|------------|-----------|-------------|
| `response.audio.delta` | `audio_delta` | Streaming audio chunks (base64) |
| `response.audio.done` | `audio_done` | Complete audio |
| `response.audio.transcript.delta` | `audio_transcript_delta` | Streaming transcript |
| `response.audio.transcript.done` | `audio_transcript_done` | Complete transcript |

**Formats**: pcm16, mp3, opus | **Voices**: alloy, echo, fable, onyx, nova, shimmer

#### 12. MCP Events (8)

| Event Type | SSE Event | Description |
|------------|-----------|-------------|
| `response.mcp_call.in_progress` | `mcp_call_in_progress` | MCP tool invocation started |
| `response.mcp_call_arguments.delta` | `mcp_call_delta` | Streaming argument construction |
| `response.mcp_call_arguments.done` | `mcp_call_done` | Arguments complete |
| `response.mcp_call.completed` | `mcp_call_completed` | Tool execution succeeded |
| `response.mcp_call.failed` | `mcp_call_failed` | Tool execution failed |
| `response.mcp_list_tools.in_progress` | `mcp_list_tools.in_progress` | Tool discovery started |
| `response.mcp_list_tools.completed` | `mcp_list_tools.completed` | Available tools listed |
| `response.mcp_list_tools.failed` | `mcp_list_tools.failed` | Tool discovery failed |

#### 13. Refusal Events (2)

| Event Type | SSE Event | Description |
|------------|-----------|-------------|
| `response.output_refusal.delta` | `refusal_delta` | Streaming refusal message |
| `response.output_refusal.done` | `refusal_done` | Complete refusal explanation |

**Triggers**: Harmful content, illegal activities, privacy violations, impersonation, NSFW

#### 14. Structural Events (4)

| Event Type | SSE Event | Description |
|------------|-----------|-------------|
| `response.output_item.added` | `output_item.added` | New output item (text, image, audio) |
| `response.output_item.done` | `output_item.done` | Output item completed |
| `response.content_part.added` | `content_part.added` | New content part (paragraph, section) |
| `response.content_part.done` | `content_part.done` | Content part completed |

---

## Streaming Handlers

### Handler Files

```
src/openai/services/handlers/
├── lifecycle-events.handler.ts      # Response lifecycle (7 events)
├── text-events.handler.ts           # Text output (3 events)
├── reasoning-events.handler.ts      # o-series reasoning (6 events)
├── tool-calling-events.handler.ts   # All tools (15 events)
├── computer-use-events.handler.ts   # UI automation (6 events)
├── image-events.handler.ts          # Image generation (4 events)
├── audio-events.handler.ts          # TTS/transcript (4 events)
├── mcp-events.handler.ts            # Model Context Protocol (8 events)
├── refusal-events.handler.ts        # Content policy (2 events)
└── structural-events.handler.ts     # Boundaries + unknown (4+ events)
```

### Handler Method Pattern

All handlers follow a consistent pattern:

```typescript
@Injectable()
export class TextEventsHandler {
  constructor(private readonly loggerService: LoggerService) {}

  *handleTextDelta(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    // 1. Extract typed data with fallbacks
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

    // 4. Build SSE payload with conditional fields
    const sseData: Record<string, unknown> = { delta, sequence };
    if (eventData.logprobs) sseData.logprobs = eventData.logprobs;

    // 5. Yield SSE event
    yield {
      event: 'text_delta',
      data: JSON.stringify(sseData),
      sequence,
    };
  }
}
```

### Lifecycle Events Handler

**Key Responsibilities**:
- Extract response ID and model on creation
- Store final response with usage statistics
- Calculate latency and estimate cost
- Handle completion, failure, and incomplete states

```typescript
*handleResponseCompleted(
  event: unknown,
  state: StreamState,
  sequence: number,
  extractUsage: (response: Responses.Response) => UsageInfo,
  extractResponseMetadata: () => ResponseMetadata,
  estimateCost: (usage: UsageInfo, model: string) => number,
): Iterable<SSEEvent> {
  const response = (event as { response: Responses.Response }).response;
  state.finalResponse = response;

  const usage = extractUsage(response);
  const latency = Date.now() - state.startTime;
  const cost = estimateCost(usage, response.model);

  yield {
    event: 'response_completed',
    data: JSON.stringify({
      response_id: response.id,
      output_text: state.fullText,
      usage,
      status: response.status,
      latency_ms: latency,
      cost_estimate: cost,
      sequence,
    }),
    sequence,
  };
}
```

### Tool Calling Events Handler

**State Management for Concurrent Tools**:

```typescript
// Tool call tracking in StreamState
state.toolCalls: Map<string, {
  type: 'function' | 'code_interpreter' | 'file_search' | 'web_search' | 'custom_tool' | 'computer_use',
  input: string,      // Accumulated arguments/input
  code?: string,      // For code_interpreter
  status: 'in_progress' | 'completed',
  result?: unknown,   // Execution result
}>

// Delta accumulation
*handleFunctionCallDelta(event, state, sequence) {
  const { call_id, delta } = event;
  const existing = state.toolCalls.get(call_id) || { type: 'function', input: '', status: 'in_progress' };
  existing.input += delta;
  state.toolCalls.set(call_id, existing);
  yield { event: 'function_call_delta', data: JSON.stringify({ call_id, delta, sequence }), sequence };
}
```

---

## State Management

### StreamState Interface

```typescript
interface StreamState {
  // Text accumulation
  fullText: string;              // Accumulated text deltas
  reasoning: string;             // Accumulated reasoning tokens (o-series)
  reasoningSummary: string;      // Reasoning summary
  refusal: string;               // Refusal message if applicable

  // Audio accumulation
  audio: string;                 // Base64-encoded audio chunks
  audioTranscript: string;       // Audio transcript text

  // Tool execution tracking
  toolCalls: Map<string, {
    type: string;
    input: string;
    code?: string;
    status: 'in_progress' | 'completed';
    result?: unknown;
  }>;

  // Metadata
  responseId?: string;           // Response ID from lifecycle events
  model?: string;                // Model name from response.created
  startTime: number;             // Timestamp for latency calculation
  finalResponse?: Responses.Response;  // Complete response at stream end
}
```

### State Lifecycle

```
1. Initialization (Service)
   └── Empty strings, new Map(), Date.now()

2. response.created Event
   └── Set responseId, model

3. Delta Events (text, reasoning, audio, tools)
   └── Accumulate: state.fullText += delta

4. Done Events (text_done, audio_done)
   └── State contains complete accumulated data

5. response.completed Event
   └── Set finalResponse, calculate latency, estimate cost

6. Stream End
   └── State garbage collected (function-scoped)
```

### State Mutation Examples

| Event Category | State Property | Mutation |
|----------------|----------------|----------|
| `text_delta` | `fullText` | String concatenation |
| `reasoning_delta` | `reasoning` | String concatenation |
| `audio_delta` | `audio` | Base64 chunk concatenation |
| `function_call_delta` | `toolCalls[call_id].input` | Map entry update |
| `response.created` | `responseId`, `model` | Direct assignment |
| `response.completed` | `finalResponse` | Full response object |

---

## SSE Protocol

### HTTP Headers

```http
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

**Header Purposes**:
- `Content-Type: text/event-stream`: Identifies SSE protocol
- `Cache-Control: no-cache`: Prevents caching of stream
- `Connection: keep-alive`: Maintains persistent connection
- `X-Accel-Buffering: no`: Disables nginx proxy buffering

### SSE Event Format

```typescript
interface SSEEvent {
  event: string;      // Event name (e.g., 'text_delta')
  data: string;       // JSON stringified payload
  sequence: number;   // Ordering number
}
```

**Wire Format**:
```
event: text_delta
data: {"delta":"Hello ","sequence":0}

event: text_delta
data: {"delta":"world","sequence":1}

event: text_done
data: {"output_text":"Hello world","latency_ms":1234,"sequence":2}

event: response_completed
data: {"response_id":"resp_123","usage":{"input_tokens":10,"output_tokens":2},"sequence":3}
```

### Controller Implementation

```typescript
async createTextResponseStream(
  @Body() dto: CreateTextResponseDto,
  @Res() res: Response,
) {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    // Consume async generator
    const stream = this.responsesService.createTextResponseStream(dto);

    for await (const eventData of stream) {
      // Format and write SSE message
      const sseMessage = `event: ${eventData.event}\ndata: ${eventData.data}\n\n`;
      res.write(sseMessage);
    }

    res.end();
  } catch (error) {
    // Send error event before closing
    res.write(`event: error\ndata: ${JSON.stringify({ error: errorMessage })}\n\n`);
    res.end();
  }
}
```

---

## REST Endpoints

### Streaming Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/responses/text/stream` | Text generation with SSE streaming |
| `POST` | `/api/responses/images/stream` | Image generation with progressive rendering |
| `GET` | `/api/responses/:id/stream` | Resume stored response stream |

### DTO Configuration

**Streaming-Specific Parameters**:

```typescript
class CreateTextResponseDto {
  // ... common parameters ...

  @IsBoolean()
  @IsOptional()
  stream?: boolean = false;  // Enable streaming mode

  @IsObject()
  @IsOptional()
  stream_options?: {
    include_obfuscation?: boolean;  // Include obfuscation in stream
  } | null;
}

class CreateImageResponseDto {
  // ... common parameters ...

  @IsInt()
  @Min(0)
  @Max(3)
  @IsOptional()
  partial_images?: number;  // Progressive rendering levels (0-3)
}
```

### Binary Streaming (Audio/Videos)

For non-SSE binary streams:

```typescript
export async function streamBinaryResponse(
  response: Response,
  expressRes: ExpressResponse,
  contentType: string,
  filename: string,
): Promise<void> {
  expressRes.setHeader('Content-Type', contentType);
  expressRes.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  if (response.body) {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      expressRes.write(value);
    }
  }
  expressRes.end();
}
```

---

## Error Handling

### Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 Layer 1: Stream Service                         │
│   • Wraps stream loop in try-catch                             │
│   • Logs error with latency metrics                            │
│   • Yields error SSE event                                     │
│   • Re-throws for global handling                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Layer 2: Controller                             │
│   • Catches errors from service generator                      │
│   • Sends error SSE event if connection open                   │
│   • Gracefully closes response                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Layer 3: Global Exception Filter               │
│   • Catches all unhandled exceptions                           │
│   • Transforms to EnhancedErrorResponse                        │
│   • Extracts OpenAI error codes and hints                      │
│   • Sets Retry-After header for rate limits                    │
└─────────────────────────────────────────────────────────────────┘
```

### Error Types Handled

| Error Type | Source | Handling |
|------------|--------|----------|
| `RateLimitError` | OpenAI SDK | Retry-After header, rate limit info |
| `AuthenticationError` | OpenAI SDK | 401 with hint |
| `BadRequestError` | OpenAI SDK | 400 with validation details |
| `InternalServerError` | OpenAI SDK | 500 with request_id |
| `TimeoutError` | OpenAI SDK / Network | 504 with retry hint |
| `ECONNRESET` | Network | 503 with reconnect hint |
| `ETIMEDOUT` | Network | 504 with timeout details |
| `ValidationError` | DTO / Validation | 400 with field errors |
| `UnknownError` | Any | 500 with stack trace (dev only) |

### Enhanced Error Response

```json
{
  "statusCode": 429,
  "timestamp": "2025-01-12T10:30:00.000Z",
  "path": "/api/responses/text/stream",
  "message": "Rate limit exceeded",
  "request_id": "req_abc123",
  "error_code": "rate_limit_error",
  "retry_after_seconds": 60,
  "rate_limit_info": {
    "limit_requests": 10000,
    "remaining_requests": 0,
    "reset_requests": "60s",
    "limit_tokens": 2000000,
    "remaining_tokens": 150000,
    "reset_tokens": "1s"
  },
  "hint": "Please wait before making another request.",
  "openai_error": {
    "type": "rate_limit_error",
    "message": "Rate limit exceeded for requests"
  }
}
```

### Stream Error Event

```typescript
// In service layer
} catch (error) {
  const latency = Date.now() - startTime;
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  this.loggerService.logStreamingEvent({
    timestamp: new Date().toISOString(),
    api: 'responses',
    endpoint: '/v1/responses (stream)',
    event_type: 'stream_error',
    error: { message: errorMessage, original_error: error },
    metadata: { latency_ms: latency },
  });

  yield { event: 'error', data: JSON.stringify({ error: errorMessage }), sequence: 0 };
  throw error;  // Propagate to global filter
}
```

---

## Testing Architecture

### Test Structure

```
src/openai/services/handlers/
├── lifecycle-events.handler.spec.ts      (949 lines)
├── text-events.handler.spec.ts           (1004 lines)
├── tool-calling-events.handler.spec.ts   (1112 lines)
├── reasoning-events.handler.spec.ts      (950 lines)
├── image-events.handler.spec.ts          (200+ lines)
├── audio-events.handler.spec.ts          (150+ lines)
├── mcp-events.handler.spec.ts
├── refusal-events.handler.spec.ts
├── structural-events.handler.spec.ts
└── computer-use-events.handler.spec.ts

src/openai/controllers/
└── responses.controller.spec.ts          (1840 lines)

src/common/testing/
└── test.factories.ts                     (306 lines)
```

### Test Factories

```typescript
// Core Factory Functions
createMockLoggerService()          // Mock LoggerService with all methods
createMockOpenAIClient()           // Mock OpenAI client (responses, files)
createMockStreamState()            // Fresh StreamState with defaults
createMockConfigService()          // Config values (API key, env)
createMockOpenAIResponse()         // Full Response object with overrides
createMockStreamingEvent()         // Event generator helper
createMockExecutionContext()       // NestJS ExecutionContext
createMockCallHandler()            // NestJS CallHandler for interceptors
createMockArgumentsHost()          // NestJS ArgumentsHost for filters
createOpenAIError()                // Typed OpenAI error creation
createRateLimitHeaders()           // Rate limit header simulation
```

### Mock Generator Pattern

```typescript
// Pattern 1: Async Generator
const mockGenerator = async function* () {
  yield await Promise.resolve({
    event: 'text_delta',
    data: '{"delta":"Hello"}',
    sequence: 1,
  });
  yield await Promise.resolve({
    event: 'text_done',
    data: '{"text":"Hello"}',
    sequence: 2,
  });
};

service.createTextResponseStream.mockReturnValue(mockGenerator());

// Pattern 2: Factory Helper
const events = [
  { type: 'text_delta', data: { delta: 'Hello' } },
  { type: 'text_done', data: { text: 'Hello' } },
];
const mockGenerator = createMockEventGenerator(events);
```

### Test Coverage Categories

| Category | Test Focus |
|----------|------------|
| **Event Transformation** | OpenAI event → SSE event mapping |
| **State Accumulation** | `state.fullText`, `state.toolCalls`, etc. |
| **Logging Verification** | `logStreamingEvent` called with correct data |
| **Edge Cases** | Null, undefined, empty, large inputs |
| **Concurrent Operations** | Multiple tool calls simultaneously |
| **Error Handling** | Stream errors, connection failures |
| **Unicode/Special Chars** | Emoji, control characters, JSON escaping |
| **Sequence Numbers** | Ordering, negative values, MAX_SAFE_INTEGER |

### Edge Cases Tested

- Null/undefined events
- Missing required properties
- Empty inputs
- Very large inputs (10k+ characters)
- Multiple concurrent tool calls (3+)
- Unicode and emoji handling
- Special characters (newlines, tabs)
- Invalid sequence numbers
- JSON serialization safety
- Connection interruptions

---

## Client Integration

### EventSource API (Browser)

```javascript
const eventSource = new EventSource('/api/responses/text/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ input: 'Tell me a story', model: 'gpt-4o' })
});

eventSource.addEventListener('text_delta', (event) => {
  const data = JSON.parse(event.data);
  console.log('Delta:', data.delta);
  document.getElementById('output').textContent += data.delta;
});

eventSource.addEventListener('text_done', (event) => {
  const data = JSON.parse(event.data);
  console.log('Complete:', data.output_text);
  console.log('Latency:', data.latency_ms, 'ms');
});

eventSource.addEventListener('response_completed', (event) => {
  const data = JSON.parse(event.data);
  console.log('Usage:', data.usage);
  eventSource.close();
});

eventSource.addEventListener('error', (event) => {
  console.error('Stream error:', JSON.parse(event.data));
  eventSource.close();
});
```

### Fetch with ReadableStream

```javascript
const response = await fetch('/api/responses/text/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ input: 'Hello', model: 'gpt-4o' })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n\n');
  buffer = lines.pop() || '';  // Keep incomplete event

  for (const chunk of lines) {
    if (!chunk.trim()) continue;

    const eventMatch = chunk.match(/^event: (.+)$/m);
    const dataMatch = chunk.match(/^data: (.+)$/m);

    if (eventMatch && dataMatch) {
      const eventType = eventMatch[1];
      const data = JSON.parse(dataMatch[1]);
      handleEvent(eventType, data);
    }
  }
}
```

### Node.js Client

```typescript
import { createParser } from 'eventsource-parser';

const response = await fetch('http://localhost:3000/api/responses/text/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ input: 'Hello', model: 'gpt-4o' }),
});

const parser = createParser((event) => {
  if (event.type === 'event') {
    const data = JSON.parse(event.data);
    console.log(`${event.event}:`, data);
  }
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  parser.feed(decoder.decode(value));
}
```

### Stream Resumption

```typescript
// Resume a stored response stream
async function resumeStream(responseId: string, lastSequence: number) {
  const response = await fetch(`/api/responses/${responseId}/stream`);

  for await (const event of parseSSE(response.body)) {
    if (event.sequence <= lastSequence) continue;  // Skip already-received events
    handleEvent(event);
  }
}
```

### React Integration

```tsx
function StreamingResponse({ prompt }: { prompt: string }) {
  const [text, setText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    if (!prompt) return;

    setIsStreaming(true);
    const controller = new AbortController();

    (async () => {
      const response = await fetch('/api/responses/text/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: prompt, model: 'gpt-4o' }),
        signal: controller.signal,
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Parse SSE and extract text deltas
        const chunk = decoder.decode(value);
        const deltaMatch = chunk.match(/event: text_delta\ndata: (.+)/);
        if (deltaMatch) {
          const { delta } = JSON.parse(deltaMatch[1]);
          setText(prev => prev + delta);
        }
      }

      setIsStreaming(false);
    })();

    return () => controller.abort();
  }, [prompt]);

  return (
    <div>
      <p>{text}</p>
      {isStreaming && <span className="cursor" />}
    </div>
  );
}
```

---

## Performance Considerations

### Current Implementation

| Aspect | Status | Notes |
|--------|--------|-------|
| **Memory Efficiency** | Excellent | Generator functions, per-event processing |
| **Backpressure** | Limited | No explicit `res.write()` return checking |
| **Parallelism** | Single stream | One stream per request |
| **Timeout** | 30-60s | OpenAI SDK limit |
| **Retry** | Manual | Requires explicit stream resumption |

### Potential Improvements

1. **Backpressure Handling**: Check `res.write()` return value and pause stream if `false`
2. **Client-Side Backoff**: Implement exponential backoff for rate limits
3. **Stream Multiplexing**: Support multiple concurrent streams per connection
4. **Automatic Retry**: Auto-reconnect on network failures with sequence tracking
5. **Memory Monitoring**: Track `state.toolCalls` Map size for large tool outputs

### Logging Strategy

- **Non-Streaming**: Full request/response logged by `LoggingInterceptor`
- **Streaming**: Per-event logging by handlers (interceptor skips streaming endpoints)
- **Output**: `logs/YYYY-MM-DD/{api}.log` (JSON format, one event per line)

---

## Appendix: Event Type Constants

```typescript
export const STREAMING_EVENT_TYPES = {
  // Lifecycle
  RESPONSE_CREATED: 'response.created',
  RESPONSE_QUEUED: 'response.queued',
  RESPONSE_IN_PROGRESS: 'response.in_progress',
  RESPONSE_COMPLETED: 'response.completed',
  RESPONSE_INCOMPLETE: 'response.incomplete',
  RESPONSE_FAILED: 'response.failed',
  ERROR: 'error',

  // Text
  TEXT_DELTA: 'response.output_text.delta',
  TEXT_DONE: 'response.output_text.done',
  TEXT_ANNOTATION_ADDED: 'response.output_text.annotation.added',

  // Reasoning
  REASONING_TEXT_DELTA: 'response.reasoning_text.delta',
  REASONING_TEXT_DONE: 'response.reasoning_text.done',
  REASONING_SUMMARY_TEXT_DELTA: 'response.reasoning_summary_text.delta',
  REASONING_SUMMARY_TEXT_DONE: 'response.reasoning_summary_text.done',
  REASONING_SUMMARY_PART_ADDED: 'response.reasoning_summary_part.added',
  REASONING_SUMMARY_PART_DONE: 'response.reasoning_summary_part.done',

  // Function Calls
  FUNCTION_CALL_ARGUMENTS_DELTA: 'response.function_call_arguments.delta',
  FUNCTION_CALL_ARGUMENTS_DONE: 'response.function_call_arguments.done',

  // Code Interpreter
  CODE_INTERPRETER_IN_PROGRESS: 'response.code_interpreter_call.in_progress',
  CODE_INTERPRETER_INTERPRETING: 'response.code_interpreter_call.interpreting',
  CODE_INTERPRETER_CODE_DELTA: 'response.code_interpreter_call_code.delta',
  CODE_INTERPRETER_CODE_DONE: 'response.code_interpreter_call_code.done',
  CODE_INTERPRETER_COMPLETED: 'response.code_interpreter_call.completed',

  // File Search
  FILE_SEARCH_IN_PROGRESS: 'response.file_search_call.in_progress',
  FILE_SEARCH_SEARCHING: 'response.file_search_call.searching',
  FILE_SEARCH_COMPLETED: 'response.file_search_call.completed',

  // Web Search
  WEB_SEARCH_IN_PROGRESS: 'response.web_search_call.in_progress',
  WEB_SEARCH_SEARCHING: 'response.web_search_call.searching',
  WEB_SEARCH_COMPLETED: 'response.web_search_call.completed',

  // Custom Tools
  CUSTOM_TOOL_INPUT_DELTA: 'response.custom_tool_call_input.delta',
  CUSTOM_TOOL_INPUT_DONE: 'response.custom_tool_call_input.done',

  // Computer Use
  COMPUTER_USE_IN_PROGRESS: 'response.computer_use_call.in_progress',
  COMPUTER_USE_ACTION_DELTA: 'response.computer_use_call.action.delta',
  COMPUTER_USE_ACTION_DONE: 'response.computer_use_call.action.done',
  COMPUTER_USE_OUTPUT_ITEM_ADDED: 'response.computer_use_call_output_item.added',
  COMPUTER_USE_OUTPUT_ITEM_DONE: 'response.computer_use_call_output_item.done',
  COMPUTER_USE_COMPLETED: 'response.computer_use_call.completed',

  // Image Generation
  IMAGE_GEN_IN_PROGRESS: 'response.image_generation_call.in_progress',
  IMAGE_GEN_GENERATING: 'response.image_generation_call.generating',
  IMAGE_GEN_PARTIAL: 'response.image_generation_call.partial_image',
  IMAGE_GEN_COMPLETED: 'response.image_generation_call.completed',

  // Audio
  AUDIO_DELTA: 'response.audio.delta',
  AUDIO_DONE: 'response.audio.done',
  AUDIO_TRANSCRIPT_DELTA: 'response.audio.transcript.delta',
  AUDIO_TRANSCRIPT_DONE: 'response.audio.transcript.done',

  // MCP
  MCP_CALL_IN_PROGRESS: 'response.mcp_call.in_progress',
  MCP_CALL_ARGUMENTS_DELTA: 'response.mcp_call_arguments.delta',
  MCP_CALL_ARGUMENTS_DONE: 'response.mcp_call_arguments.done',
  MCP_CALL_COMPLETED: 'response.mcp_call.completed',
  MCP_CALL_FAILED: 'response.mcp_call.failed',
  MCP_LIST_TOOLS_IN_PROGRESS: 'response.mcp_list_tools.in_progress',
  MCP_LIST_TOOLS_COMPLETED: 'response.mcp_list_tools.completed',
  MCP_LIST_TOOLS_FAILED: 'response.mcp_list_tools.failed',

  // Refusal
  REFUSAL_DELTA: 'response.output_refusal.delta',
  REFUSAL_DONE: 'response.output_refusal.done',

  // Structural
  OUTPUT_ITEM_ADDED: 'response.output_item.added',
  OUTPUT_ITEM_DONE: 'response.output_item.done',
  CONTENT_PART_ADDED: 'response.content_part.added',
  CONTENT_PART_DONE: 'response.content_part.done',
} as const;
```

---

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Overall system architecture
- [README.md](../README.md) - Project overview and API documentation
- [CLAUDE.md](../CLAUDE.md) - Development guidelines
