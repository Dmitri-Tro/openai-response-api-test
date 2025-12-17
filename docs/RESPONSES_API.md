# OpenAI Responses API Implementation

Complete documentation of the OpenAI Responses API integration, including streaming and non-streaming patterns.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [REST Endpoints](#rest-endpoints)
4. [Request Parameters](#request-parameters)
5. [Response Structure](#response-structure)
6. [Streaming Implementation](#streaming-implementation)
7. [Tool Calling](#tool-calling)
8. [SDK Integration](#sdk-integration)
9. [Error Handling](#error-handling)
10. [Testing](#testing)

---

## Overview

### What is the Responses API?

The Responses API (OpenAI SDK 6.2+) is OpenAI's modern API for text generation, replacing the older Chat Completions API. Key differences:

| Feature | Responses API | Chat Completions API |
|---------|---------------|----------------------|
| Method | `client.responses.create()` | `client.chat.completions.create()` |
| Input | `input` (string) | `messages` (array) |
| System Message | `instructions` | `messages[0]` with role=system |
| Response Text | `response.output_text` | `choices[0].message.content` |
| Tool Support | Full (6 types, 57+ events) | Limited |
| Background Mode | Yes (`background: true`) | No |
| Conversation API | Yes (`conversation` param) | No |
| Response Storage | Yes (`store: true`, 30 days) | No |

### Implementation Statistics

| Metric | Value |
|--------|-------|
| Request Parameters | 28 (text) + 9 (image) |
| Streaming Event Types | 57+ |
| Event Handlers | 10 specialized services |
| Tool Types | 6 |
| Custom Validators | 4 |
| REST Endpoints | 9 |
| Test Coverage | 5,500+ lines |

### Supported Models

- **GPT-5** (default), GPT-5-pro
- **GPT-4o**, GPT-4o-mini
- **o1**, o3, o3-mini (reasoning models)
- **gpt-image-1**, gpt-image-1-mini (image generation)

---

## Architecture

### Service Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ResponsesController                                 │
│   • 9 REST endpoints (text, images, CRUD, streaming)                        │
│   • SSE header management for streaming                                     │
│   • DTO validation with class-validator                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       OpenAIResponsesService                                 │
│   • Orchestrator for all Responses API operations                           │
│   • Parameter building from DTOs                                            │
│   • Streaming event routing (switch/case)                                   │
│   • Usage extraction and cost estimation                                    │
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
          ▼                           ▼                           ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   Reasoning     │       │     Image       │       │     Audio       │
│    Handler      │       │    Handler      │       │    Handler      │
│   (6 events)    │       │   (4 events)    │       │   (4 events)    │
└─────────────────┘       └─────────────────┘       └─────────────────┘
          │                           │                           │
          ▼                           ▼                           ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ Computer Use    │       │      MCP        │       │   Refusal +     │
│    Handler      │       │    Handler      │       │   Structural    │
│   (6 events)    │       │   (8 events)    │       │   (6 events)    │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

### Dependency Injection

```typescript
@Injectable()
export class OpenAIResponsesService {
  constructor(
    @Inject(OPENAI_CLIENT) private readonly client: OpenAI,
    private readonly configService: ConfigService,
    private readonly loggerService: LoggerService,
    private readonly pricingService: PricingService,
    // 10 specialized event handlers
    private readonly lifecycleHandler: LifecycleEventsHandler,
    private readonly textHandler: TextEventsHandler,
    private readonly reasoningHandler: ReasoningEventsHandler,
    private readonly toolCallingHandler: ToolCallingEventsHandler,
    private readonly imageHandler: ImageEventsHandler,
    private readonly audioHandler: AudioEventsHandler,
    private readonly mcpHandler: MCPEventsHandler,
    private readonly refusalHandler: RefusalEventsHandler,
    private readonly structuralHandler: StructuralEventsHandler,
    private readonly computerUseHandler: ComputerUseEventsHandler,
  ) {}
}
```

---

## REST Endpoints

### Endpoint Summary

| Method | Endpoint | Purpose | Streaming |
|--------|----------|---------|-----------|
| POST | `/api/responses/text` | Generate text | No |
| POST | `/api/responses/text/stream` | Stream text generation | Yes (SSE) |
| POST | `/api/responses/images` | Generate image | No |
| POST | `/api/responses/images/stream` | Stream image generation | Yes (SSE) |
| POST | `/api/responses/code-interpreter` | Execute code with files | No |
| GET | `/api/responses/:id` | Retrieve stored response | No |
| GET | `/api/responses/:id/stream` | Resume streaming | Yes (SSE) |
| DELETE | `/api/responses/:id` | Delete stored response | No |
| POST | `/api/responses/:id/cancel` | Cancel background response | No |

### Text Generation

#### Non-Streaming

```http
POST /api/responses/text
Content-Type: application/json

{
  "model": "gpt-5",
  "input": "Explain quantum computing in simple terms",
  "instructions": "You are a helpful science teacher",
  "temperature": 0.7,
  "max_output_tokens": 1000
}
```

**Response:**
```json
{
  "id": "resp_abc123",
  "object": "response",
  "model": "gpt-5",
  "status": "completed",
  "output_text": "Quantum computing is a type of computation...",
  "usage": {
    "input_tokens": 25,
    "output_tokens": 150,
    "total_tokens": 175,
    "input_tokens_details": { "cached_tokens": 0 },
    "output_tokens_details": { "reasoning_tokens": 0 }
  }
}
```

#### Streaming

```http
POST /api/responses/text/stream
Content-Type: application/json

{
  "model": "gpt-5",
  "input": "Write a short poem about coding",
  "stream": true
}
```

**SSE Response:**
```
event: response_created
data: {"response_id":"resp_abc123","model":"gpt-5","sequence":0}

event: text_delta
data: {"delta":"In lines of code,","sequence":1}

event: text_delta
data: {"delta":" we weave our dreams,","sequence":2}

event: text_done
data: {"output_text":"In lines of code, we weave our dreams,...","sequence":10}

event: response_completed
data: {"response_id":"resp_abc123","usage":{"input_tokens":15,"output_tokens":50},"sequence":11}
```

### Image Generation

```http
POST /api/responses/images
Content-Type: application/json

{
  "model": "gpt-5",
  "input": "A futuristic city skyline at sunset",
  "image_model": "gpt-image-1",
  "image_size": "1024x1024",
  "image_quality": "high",
  "image_format": "png"
}
```

**Response:**
```json
{
  "id": "resp_img123",
  "object": "response",
  "output_text": "data:image/png;base64,iVBORw0KGgoAAAANSU...",
  "usage": {
    "input_tokens": 20,
    "output_tokens": 0,
    "total_tokens": 20
  }
}
```

### Code Interpreter

```http
POST /api/responses/code-interpreter
Content-Type: multipart/form-data

files: [data.csv]
model: gpt-4o
input: Analyze this CSV file and create a visualization
memory_limit: 4g
```

**Response:**
```json
{
  "id": "resp_code123",
  "output_text": "I've analyzed your data. Here are the findings...",
  "output_tool_call": {
    "type": "code_interpreter",
    "call_id": "call_xyz789",
    "container_id": "container_def456",
    "code": "import pandas as pd\nimport matplotlib.pyplot as plt\n...",
    "output": [
      { "type": "logs", "logs": "Data loaded: 1000 rows, 5 columns\n" },
      { "type": "image", "image": "data:image/png;base64,..." }
    ]
  }
}
```

### Response Management

#### Retrieve

```http
GET /api/responses/resp_abc123
```

#### Delete

```http
DELETE /api/responses/resp_abc123
```

**Response:** `{ "id": "resp_abc123", "deleted": true, "object": "response" }`

#### Cancel Background

```http
POST /api/responses/resp_abc123/cancel
```

---

## Request Parameters

### Core Parameters (28 Total)

#### Required

| Parameter | Type | Description |
|-----------|------|-------------|
| `input` | string | User message or prompt text |

#### Model & Output

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model` | string | `'gpt-5'` | Model to use |
| `instructions` | string | - | System instructions |
| `modalities` | `['text'\|'audio']` | `['text']` | Output types |
| `max_output_tokens` | number | - | Token limit |
| `text` | object | - | Response format config |

#### Sampling

| Parameter | Type | Range | Description |
|-----------|------|-------|-------------|
| `temperature` | number | 0-2 | Randomness (higher = more creative) |
| `top_p` | number | 0-1 | Nucleus sampling |

#### Tools

| Parameter | Type | Description |
|-----------|------|-------------|
| `tools` | array | Tool configurations (6 types) |
| `tool_choice` | string/object | `'auto'`, `'none'`, `'required'`, or specific |
| `parallel_tool_calls` | boolean | Allow parallel execution (default: true) |

#### Conversation

| Parameter | Type | Description |
|-----------|------|-------------|
| `conversation` | string/object | Conversation ID for multi-turn |
| `previous_response_id` | string | Link to previous response |
| `store` | boolean | Store for 30-day retrieval |

#### Optimization

| Parameter | Type | Description |
|-----------|------|-------------|
| `prompt_cache_key` | string | Cache key for similar requests |
| `service_tier` | string | `'auto'`, `'default'`, `'flex'`, `'scale'`, `'priority'` |
| `background` | boolean | Run in background for long operations |
| `truncation` | string | `'auto'` (truncate) or `'disabled'` (fail) |

#### Safety & Metadata

| Parameter | Type | Description |
|-----------|------|-------------|
| `safety_identifier` | string | User hash for abuse detection |
| `metadata` | object | Custom key-value pairs (max 16) |

#### Advanced

| Parameter | Type | Description |
|-----------|------|-------------|
| `prompt` | object | Reusable prompt template with variables |
| `include` | array | Additional output (code outputs, logprobs) |
| `reasoning` | object | Config for o-series (effort, summary) |
| `stream` | boolean | Enable streaming |
| `stream_options` | object | Streaming config (obfuscation) |

### Image-Specific Parameters (9 Additional)

| Parameter | Type | Options | Default |
|-----------|------|---------|---------|
| `image_model` | string | `'gpt-image-1'`, `'gpt-image-1-mini'` | `'gpt-image-1'` |
| `image_quality` | string | `'low'`, `'medium'`, `'high'`, `'auto'` | `'auto'` |
| `image_format` | string | `'png'`, `'webp'`, `'jpeg'` | `'png'` |
| `image_size` | string | `'1024x1024'`, `'1024x1536'`, `'1536x1024'`, `'auto'` | `'auto'` |
| `image_moderation` | string | `'auto'`, `'low'` | `'auto'` |
| `image_background` | string | `'transparent'`, `'opaque'`, `'auto'` | `'auto'` |
| `input_fidelity` | string | `'high'`, `'low'` | - |
| `output_compression` | number | 0-100 | 100 |
| `partial_images` | number | 0-3 | 0 |

### Code Interpreter Parameters (2 Additional)

| Parameter | Type | Options | Description |
|-----------|------|---------|-------------|
| `memory_limit` | string | `'1g'`, `'4g'`, `'16g'`, `'64g'` | Container RAM |
| `container_id` | string | - | Reuse container (saves $0.03) |

---

## Response Structure

### Non-Streaming Response

```typescript
interface Response {
  id: string;                          // "resp_abc123"
  object: string;                      // "response"
  created_at: number;                  // Unix timestamp
  model: string;                       // "gpt-5"
  status: string;                      // "completed", "failed", "cancelled"
  output_text: string;                 // Generated text or base64 image

  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    input_tokens_details?: {
      cached_tokens?: number;          // Cached input tokens (50% discount)
    };
    output_tokens_details?: {
      reasoning_tokens?: number;       // o-series reasoning tokens
    };
  };

  output_tool_call?: {                 // If tools were used
    type: string;
    call_id: string;
    // Tool-specific fields
  };

  conversation?: string;               // Conversation ID
  error?: object;                      // Error details if failed
  incomplete_details?: object;         // Why response was truncated
}
```

### SSE Event Structure

```typescript
interface SSEEvent {
  event: string;      // Event type name
  data: string;       // JSON-stringified payload
  sequence: number;   // Event ordering number
}
```

### Usage Extraction

```typescript
private extractUsage(response: Responses.Response) {
  return {
    input_tokens: response.usage?.input_tokens,
    output_tokens: response.usage?.output_tokens,
    total_tokens: response.usage?.total_tokens,
    input_tokens_details: {
      cached_tokens: response.usage?.input_tokens_details?.cached_tokens,
    },
    output_tokens_details: {
      reasoning_tokens: response.usage?.output_tokens_details?.reasoning_tokens,
    },
  };
}
```

---

## Streaming Implementation

### SSE Headers

```typescript
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');
res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
```

### Generator Pattern

```typescript
async *createTextResponseStream(dto: CreateTextResponseDto): AsyncIterable<SSEEvent> {
  const state: StreamState = {
    fullText: '',
    reasoning: '',
    toolCalls: new Map(),
    startTime: Date.now(),
  };

  const params = this.buildParams(dto, { stream: true });
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
      // ... 55+ more event types
      default:
        yield* this.structuralHandler.handleUnknown(event, state, sequence);
    }
  }
}
```

### Event Categories (57+ Events)

| Category | Count | Events |
|----------|-------|--------|
| Lifecycle | 7 | created, queued, in_progress, completed, incomplete, failed, error |
| Text | 3 | delta, done, annotation |
| Reasoning | 6 | delta, done, summary_delta, summary_done, part_added, part_done |
| Function | 2 | arguments_delta, arguments_done |
| Code Interpreter | 5 | in_progress, interpreting, code_delta, code_done, completed |
| File Search | 3 | in_progress, searching, completed |
| Web Search | 3 | in_progress, searching, completed |
| Custom Tool | 2 | input_delta, input_done |
| Computer Use | 6 | in_progress, action_delta, action_done, output_added, output_done, completed |
| Image | 4 | in_progress, generating, partial_image, completed |
| Audio | 4 | delta, done, transcript_delta, transcript_done |
| MCP | 8 | call events, list_tools events |
| Refusal | 2 | delta, done |
| Structural | 4 | output_item, content_part |

### StreamState Interface

```typescript
interface StreamState {
  fullText: string;              // Accumulated text
  reasoning: string;             // Reasoning tokens (o-series)
  reasoningSummary: string;      // Reasoning summary
  refusal: string;               // Refusal message
  audio: string;                 // Base64 audio
  audioTranscript: string;       // Audio transcript
  responseId?: string;           // Set by response.created
  model?: string;                // Model name
  startTime: number;             // For latency calculation
  finalResponse?: Response;      // Complete response

  toolCalls: Map<string, {
    type: string;
    input: string;
    code?: string;
    status: 'in_progress' | 'completed';
    result?: unknown;
  }>;
}
```

### Handler Example

```typescript
*handleTextDelta(
  event: unknown,
  state: StreamState,
  sequence: number,
): Iterable<SSEEvent> {
  const { delta, logprobs } = event as { delta?: string; logprobs?: unknown };

  state.fullText += delta || '';

  this.loggerService.logStreamingEvent({
    timestamp: new Date().toISOString(),
    api: 'responses',
    event_type: 'text_delta',
    sequence,
    delta,
  });

  yield {
    event: 'text_delta',
    data: JSON.stringify({ delta, logprobs, sequence }),
    sequence,
  };
}
```

---

## Tool Calling

### Supported Tools (6 Types)

#### 1. Function (Custom)

User-defined functions for custom operations.

```json
{
  "type": "function",
  "function": {
    "name": "get_weather",
    "description": "Get current weather",
    "parameters": {
      "type": "object",
      "properties": {
        "location": { "type": "string" }
      }
    }
  }
}
```

**Events:** `function_call_arguments.delta`, `function_call_arguments.done`

#### 2. Code Interpreter

Execute Python in sandboxed environment.

```json
{
  "type": "code_interpreter",
  "container": {
    "type": "auto",
    "file_ids": ["file-abc123"]
  }
}
```

**Pricing:** $0.03/container + tokens
**Session:** 1 hour, 20-min idle timeout
**Events:** 5 streaming events

#### 3. File Search

Semantic search through vector stores.

```json
{
  "type": "file_search",
  "vector_store_ids": ["vs_abc123"],
  "max_num_results": 10,
  "ranking_options": {
    "ranker": "auto",
    "score_threshold": 0.7
  }
}
```

**Events:** `in_progress`, `searching`, `completed`

#### 4. Web Search

Real-time internet search.

```json
{
  "type": "web_search"
}
```

**Events:** `in_progress`, `searching`, `completed`

#### 5. Custom Tools

Extensible user-defined tools.

```json
{
  "type": "custom_tool",
  "name": "my_tool",
  "schema": { /* JSON Schema */ }
}
```

**Events:** `custom_tool_call_input.delta`, `custom_tool_call_input.done`

#### 6. Computer Use

UI automation with screenshots.

**Actions:** `mouse_move`, `click`, `type`, `key`, `screenshot`
**Events:** 6 streaming events

### Custom Validators

#### @IsCodeInterpreterToolValid

Validates code_interpreter tool configuration:
- Container type must be `'auto'`
- File IDs must start with `"file-"`
- Container ID can be string or object

#### @IsFileSearchToolValid

Validates file_search tool configuration:
- `vector_store_ids` required, must start with `"vs_"`
- `max_num_results` must be 1-50
- `score_threshold` must be 0-1

---

## SDK Integration

### Client Provider

```typescript
export const OpenAIClientProvider: Provider = {
  provide: OPENAI_CLIENT,
  useFactory: (configService: ConfigService): OpenAI => {
    return new OpenAI({
      apiKey: configService.get<string>('openai.apiKey'),
      baseURL: configService.get<string>('openai.baseURL'),
      timeout: configService.get<number>('openai.timeout'),
      maxRetries: configService.get<number>('openai.maxRetries'),
    });
  },
  inject: [ConfigService],
};
```

### Type Imports

```typescript
import type { Responses } from 'openai/resources/responses';
import type * as Shared from 'openai/resources/shared';

// Parameter types
Responses.ResponseCreateParamsNonStreaming
Responses.ResponseCreateParamsStreaming

// Response types
Responses.Response
Responses.Tool
Responses.ResponsePrompt

// Shared types
Shared.Reasoning
```

### Extended Interfaces

```typescript
interface ExtendedResponseCreateParamsNonStreaming
  extends Responses.ResponseCreateParamsNonStreaming {
  modalities?: Array<'text' | 'audio'>;
}

interface ExtendedResponseCreateParamsStreaming
  extends Responses.ResponseCreateParamsStreaming {
  modalities?: Array<'text' | 'audio'>;
  stream_options?: { include_obfuscation?: boolean };
}
```

### API Calls

```typescript
// Non-streaming
const response: Responses.Response =
  await this.client.responses.create(params);

// Streaming
const stream = await this.client.responses.create({ ...params, stream: true });
for await (const event of stream) {
  // Process events
}

// Retrieve
const response = await this.client.responses.retrieve(id);

// Delete
const result = await this.client.responses.delete(id);

// Cancel
const response = await this.client.responses.cancel(id);
```

---

## Error Handling

### Error Types

| Error Class | Status | Description |
|-------------|--------|-------------|
| `RateLimitError` | 429 | Rate limit exceeded |
| `AuthenticationError` | 401 | Invalid API key |
| `PermissionDeniedError` | 403 | Insufficient permissions |
| `NotFoundError` | 404 | Resource not found |
| `BadRequestError` | 400 | Invalid parameters |
| `InternalServerError` | 500+ | OpenAI server error |
| `APIConnectionTimeoutError` | 504 | Request timeout |

### Enhanced Error Response

```typescript
interface EnhancedErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string;
  request_id?: string;
  error_code?: string;
  parameter?: string;
  hint?: string;
  retry_after_seconds?: number;
  rate_limit_info?: {
    limit_requests?: number;
    remaining_requests?: number;
    reset_requests?: string;
    limit_tokens?: number;
    remaining_tokens?: number;
    reset_tokens?: string;
  };
  openai_error?: {
    type: string;
    code?: string;
    param?: string;
    message: string;
  };
}
```

### Error Example

```json
{
  "statusCode": 429,
  "timestamp": "2025-01-12T10:30:00.000Z",
  "path": "/api/responses/text",
  "message": "Rate limit exceeded",
  "request_id": "req_abc123",
  "error_code": "rate_limit_error",
  "retry_after_seconds": 60,
  "rate_limit_info": {
    "limit_requests": 10000,
    "remaining_requests": 0,
    "reset_requests": "60s"
  },
  "hint": "Please wait before making another request."
}
```

### Type Guards

```typescript
private hasErrorType(error: unknown): error is { type: string } {
  return typeof error === 'object' && error !== null && 'type' in error;
}

private hasErrorCode(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}
```

---

## Testing

### Test Structure

```
src/openai/services/
├── openai-responses.service.spec.ts     (5,544 lines)
└── handlers/*.spec.ts                    (4,000+ lines)

src/openai/controllers/
└── responses.controller.spec.ts          (1,840 lines)

src/openai/dto/
├── create-text-response.dto.spec.ts      (1,619 lines)
└── create-image-response.dto.spec.ts     (856 lines)

test/
├── openai-responses.e2e-spec.ts          (500+ lines)
└── openai-streaming.e2e-spec.ts          (200+ lines)
```

### Test Factories

```typescript
// Core factories
createMockOpenAIClient()      // Mock OpenAI client
createMockOpenAIResponse()    // Mock Response object
createMockStreamState()       // Mock StreamState
createMockLoggerService()     // Mock LoggerService
createMockConfigService()     // Mock ConfigService

// Streaming helpers
createMockEventGenerator()    // Test event generator
createMockStreamingEvent()    // Individual event

// Error helpers
createOpenAIError()           // Typed OpenAI error
createRateLimitHeaders()      // Rate limit headers
```

### Unit Test Pattern

```typescript
describe('createTextResponse', () => {
  it('should generate text response with correct parameters', async () => {
    const mockResponse = createMockOpenAIResponse({
      output_text: 'Test response',
    });
    mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);

    const result = await service.createTextResponse({
      input: 'Test input',
      model: 'gpt-5',
    });

    expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith({
      model: 'gpt-5',
      input: 'Test input',
      stream: false,
    });
    expect(result.output_text).toBe('Test response');
  });
});
```

### Streaming Test Pattern

```typescript
describe('createTextResponseStream', () => {
  it('should yield SSE events', async () => {
    const mockGenerator = async function* () {
      yield { type: 'response.created', sequence_number: 0 };
      yield { type: 'response.output_text.delta', delta: 'Hello', sequence_number: 1 };
      yield { type: 'response.completed', sequence_number: 2 };
    };
    mockOpenAIClient.responses.create.mockReturnValue(mockGenerator());

    const events: SSEEvent[] = [];
    for await (const event of service.createTextResponseStream(dto)) {
      events.push(event);
    }

    expect(events).toHaveLength(3);
    expect(events[0].event).toBe('response_created');
  });
});
```

### E2E Test Pattern

```typescript
testIf(hasApiKey)('should generate text response', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/responses/text')
    .send({
      model: 'gpt-4o-mini',
      input: 'Say hello',
      max_output_tokens: 20,
    })
    .expect(201);

  expect(response.body).toHaveProperty('id');
  expect(response.body).toHaveProperty('output_text');
  expect(response.body.usage.input_tokens).toBeGreaterThan(0);
});
```

### Coverage Areas

- **28 request parameters** individually tested
- **57+ streaming events** with handler tests
- **6 tool types** with validator tests
- **Error scenarios** (validation, API, network)
- **SSE format** verification
- **Token usage** extraction
- **Cost calculation** accuracy

---

## Usage Examples

### Basic Text Generation

```typescript
const response = await fetch('/api/responses/text', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'gpt-5',
    input: 'Explain quantum computing',
    temperature: 0.7,
  }),
});

const data = await response.json();
console.log(data.output_text);
```

### Streaming with EventSource

```typescript
const eventSource = new EventSource('/api/responses/text/stream');

eventSource.addEventListener('text_delta', (e) => {
  const data = JSON.parse(e.data);
  process.stdout.write(data.delta);
});

eventSource.addEventListener('response_completed', (e) => {
  const data = JSON.parse(e.data);
  console.log('\nTokens used:', data.usage.total_tokens);
  eventSource.close();
});
```

### Tool Calling

```typescript
const response = await fetch('/api/responses/text', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'gpt-5',
    input: 'Search the web for latest AI news',
    tools: [{ type: 'web_search' }],
    tool_choice: 'required',
  }),
});
```

### Multi-turn Conversation

```typescript
// First message
const response1 = await fetch('/api/responses/text', {
  method: 'POST',
  body: JSON.stringify({
    input: 'My name is Alice',
    store: true,
  }),
});

const { id } = await response1.json();

// Follow-up message
const response2 = await fetch('/api/responses/text', {
  method: 'POST',
  body: JSON.stringify({
    input: 'What is my name?',
    previous_response_id: id,
  }),
});
```

---

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Overall system architecture
- [STREAMING.md](./STREAMING.md) - Streaming architecture details
- [DATA_FLOW.md](./DATA_FLOW.md) - Data flow patterns
- [README.md](../README.md) - Project overview
- [CLAUDE.md](../CLAUDE.md) - Development guidelines
