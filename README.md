# OpenAI API Testing & Reference Implementation

> **A production-ready NestJS application demonstrating best practices for integrating OpenAI APIs with comprehensive error handling, streaming support, and structured logging.**

This project serves as a **source of truth** for implementing OpenAI API capabilities in NestJS applications, showcasing:
- **Responses API** (streaming & non-streaming text, image generation via gpt-image-1)
- **Videos API** (async job management with polling)
- **Files API** (file upload, listing, retrieval, download, deletion)
- **Images API** - *Planned*

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [API Documentation](#api-documentation)
- [Core Components](#core-components)
- [Error Handling](#error-handling)
- [Testing](#testing)
- [Development](#development)
- [Resources](#resources)

## Features

### OpenAI API Support

- ✅ **Responses API** (OpenAI SDK 6.2+)
  - Text generation (streaming & non-streaming)
  - Image generation with gpt-image-1 model
  - Progressive rendering with partial images (0-3)
  - 51 streaming event types with specialized handlers
  - Response lifecycle management (retrieve, delete, cancel)
  - Conversation management & context persistence

- ✅ **Videos API**
  - Async job management with polling (not streaming)
  - Video generation with multiple model options
  - Status tracking with progress percentage (0-100%)
  - Video download (MP4) and assets (thumbnail, spritesheet)
  - Video remixing for variations
  - Video lifecycle management (list, delete)
  - Exponential backoff polling (5s → 20s max)

- ✅ **Files API**
  - File upload with multipart/form-data (up to 512 MB)
  - Multiple purposes (assistants, batch, fine-tune, user_data, evals)
  - File expiration support (1 hour - 30 days)
  - Binary file download with proper content types
  - Pagination and filtering (purpose, order, limit)
  - Processing status tracking (uploaded, processed, error)
  - Automatic content-type detection from file extensions

- ⏳ **Images API** - Direct image generation *[Planned]*

### Production Features

- ✅ **Comprehensive Error Handling**
  - 15 image-specific error codes with actionable hints
  - 12 file-specific error codes (upload, processing, download, purpose)
  - OpenAI SDK `instanceof` checks for reliable error detection
  - Request ID tracking for support inquiries
  - Rate limit extraction and retry guidance
  - Parameter-level error context

- ✅ **Advanced Streaming Architecture**
  - 9 specialized handler services for 51 event types
  - Orchestrator pattern for maintainable code (~860 lines, down from 2,149)
  - Shared state management across handlers
  - Real-time Server-Sent Events (SSE)

- ✅ **Structured Logging**
  - JSON logs organized by date (`logs/YYYY-MM-DD/`)
  - Request/response tracking with metadata
  - Token usage, caching, reasoning tokens
  - Cost estimation based on token consumption

- ✅ **Type Safety**
  - 100% TypeScript strict mode
  - Official OpenAI SDK types throughout
  - No `any` types in codebase
  - Zod-based environment validation

- ✅ **Reliability**
  - Automatic retry with exponential backoff
  - Configurable timeout and retry limits
  - Network error handling
  - Graceful failure modes

## Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | NestJS 11 |
| **Language** | TypeScript 5 (strict mode) |
| **OpenAI SDK** | openai v6.8.1 (Responses API support) |
| **Validation** | Zod 4.1.12 (env), class-validator 0.14.2 (DTOs) |
| **Documentation** | Swagger/OpenAPI 11.2.1 |
| **Testing** | Jest 30, Supertest 7 |
| **HTTP Client** | Axios 1.13.2 via @nestjs/axios |

## Quick Start

### Prerequisites

- Node.js >= 18.x
- npm >= 9.x
- OpenAI API Key ([Get one here](https://platform.openai.com/api-keys))

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY=sk-...

# 3. Build the project
npm run build

# 4. Start the application
npm run start:dev
```

The application will start at `http://localhost:3000` with Swagger documentation at `http://localhost:3000/api-docs`.

### Configuration

Required environment variables:

```env
OPENAI_API_KEY=sk-your-actual-api-key-here  # Required, must start with "sk-"
```

Optional configuration with defaults:

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
```

## Architecture Overview

### Module Organization

```
AppModule (root)
├── ConfigModule (global) - Type-safe configuration with Zod validation
├── CommonModule (global) - Shared services, interceptors, filters
│   ├── LoggerService - Structured JSON logging
│   ├── LoggingInterceptor - Request/response tracking
│   └── OpenAIExceptionFilter - Production-grade error handling
└── OpenAIModule - OpenAI API integration
    ├── OpenAIResponsesService (orchestrator)
    ├── ResponsesController
    └── 9 Streaming Event Handlers
```

### Request Flow

```
1. Client Request
   ↓
2. Controller (validation via DTO with class-validator)
   ↓
3. RetryInterceptor (automatic retry with exponential backoff)
   ↓
4. LoggingInterceptor (start time capture)
   ↓
5. OpenAIResponsesService (orchestrates OpenAI SDK calls)
   ↓
6. OpenAI SDK (official API client)
   ↓
7. Streaming Handlers (9 specialized services for 51 event types)
   ↓
8. LoggingInterceptor (logs full request/response to logs/YYYY-MM-DD/)
   ↓
9. OpenAIExceptionFilter (transforms errors to user-friendly responses)
   ↓
10. Client Response
```

### Streaming Architecture

The application implements a **handler delegation pattern** where streaming events are routed to specialized handlers:

```
OpenAIResponsesService (Orchestrator)
├── LifecycleEventsHandler (7 events: created, queued, in_progress, completed, incomplete, failed, error)
├── TextEventsHandler (3 events: text delta, done, annotation)
├── ReasoningEventsHandler (6 events: reasoning for o-series models like o1, o3, gpt-5)
├── ToolCallingEventsHandler (15 events: functions, code interpreter, file/web search, custom tools)
├── ImageEventsHandler (4 events: image generation with progressive rendering)
├── AudioEventsHandler (4 events: TTS/voice with audio and transcript)
├── McpEventsHandler (8 events: Model Context Protocol)
├── RefusalEventsHandler (2 events: content policy refusals)
└── StructuralEventsHandler (3 events: output items, content parts, unknown events)
```

**Key Benefits:**
- **Maintainability**: Each handler focuses on one concern (~100-200 lines each)
- **Extensibility**: Add new event types without modifying existing handlers
- **Testability**: 450+ unit tests with isolated handler testing
- **Type Safety**: 100% type-safe event processing with no `any` types

## API Documentation

### Interactive Documentation

Access Swagger UI at: **http://localhost:3000/api-docs**

### Endpoints Overview

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/api/responses/text` | Generate text (non-streaming) | ✅ |
| POST | `/api/responses/text/stream` | Generate text (streaming SSE) | ✅ |
| POST | `/api/responses/images` | Generate image with gpt-image-1 | ✅ |
| POST | `/api/responses/images/stream` | Generate image with progressive rendering | ✅ |
| GET | `/api/responses/:id` | Retrieve stored response | ✅ |
| DELETE | `/api/responses/:id` | Delete stored response | ✅ |
| POST | `/api/responses/:id/cancel` | Cancel background response | ✅ |
| GET | `/api/responses/:id/stream` | Resume interrupted streaming | ✅ |
| POST | `/api/videos` | Create video generation job | ✅ |
| GET | `/api/videos/:id` | Get current video status | ✅ |
| GET | `/api/videos/:id/poll` | Poll until video completes | ✅ |
| GET | `/api/videos/:id/download` | Download video or assets | ✅ |
| GET | `/api/videos` | List all videos with pagination | ✅ |
| DELETE | `/api/videos/:id` | Delete video from storage | ✅ |
| POST | `/api/videos/:id/remix` | Create video remix with new prompt | ✅ |
| POST | `/api/files` | Upload file with purpose | ✅ |
| GET | `/api/files` | List files with filtering | ✅ |
| GET | `/api/files/:id` | Get file metadata | ✅ |
| GET | `/api/files/:id/download` | Download file content | ✅ |
| DELETE | `/api/files/:id` | Delete file | ✅ |
| POST | `/api/images/generate` | Generate images with DALL-E 2/3/gpt-image-1 | ✅ |
| POST | `/api/images/edit` | Edit images with mask (DALL-E 2 only) | ✅ |
| POST | `/api/images/variations` | Create image variations (DALL-E 2 only) | ✅ |
| POST | `/api/vector-stores` | Create vector store for file search | ✅ |
| GET | `/api/vector-stores/:id` | Retrieve vector store details | ✅ |
| PATCH | `/api/vector-stores/:id` | Update vector store metadata | ✅ |
| DELETE | `/api/vector-stores/:id` | Delete vector store | ✅ |
| GET | `/api/vector-stores` | List all vector stores | ✅ |
| POST | `/api/vector-stores/:id/search` | Search vector store content | ✅ |
| POST | `/api/vector-stores/:id/files` | Attach file to vector store | ✅ |
| GET | `/api/vector-stores/:id/files` | List files in vector store | ✅ |

### Text Generation (Non-Streaming)

**Endpoint:** `POST /api/responses/text`

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/responses/text \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "input": "Explain quantum computing in simple terms",
    "instructions": "You are a helpful assistant",
    "temperature": 0.7,
    "max_output_tokens": 1000
  }'
```

**Example Response:**

```json
{
  "id": "resp_abc123",
  "object": "response",
  "created_at": 1234567890,
  "model": "gpt-4o",
  "output_text": "Quantum computing is...",
  "status": "completed",
  "usage": {
    "input_tokens": 15,
    "output_tokens": 150,
    "total_tokens": 165,
    "input_tokens_details": { "cached_tokens": 5 },
    "output_tokens_details": { "reasoning_tokens": 20 }
  }
}
```

**Supported Parameters (28 total):**

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `model` | string | Model to use | `gpt-4o` |
| `input` | string | Prompt text | *required* |
| `instructions` | string | System instructions | - |
| `modalities` | array | Output modalities (text, audio) | `['text']` |
| `temperature` | number (0-2) | Randomness control | 1.0 |
| `top_p` | number (0-1) | Nucleus sampling | 1.0 |
| `max_output_tokens` | number | Max tokens to generate | - |
| `tools` | array | Function calling tools | - |
| `tool_choice` | string/object | Tool selection strategy | `auto` |
| `parallel_tool_calls` | boolean | Allow parallel tool execution | `true` |
| `conversation` | string/object | Conversation ID for context | - |
| `previous_response_id` | string | Chain responses together | - |
| `store` | boolean | Store for 30-day retrieval | `false` |
| `text` | object | Format & verbosity config | - |
| `prompt_cache_key` | string | Cache optimization key | - |
| `service_tier` | enum | Latency tier (flex/priority) | `auto` |
| `background` | boolean | Background processing | `false` |
| `truncation` | enum | Input truncation (auto/disabled) | `auto` |
| `safety_identifier` | string | User ID for policy tracking | - |
| `metadata` | object | Custom key-value pairs (max 16) | - |
| `stream_options` | object | Streaming security options | - |
| `prompt` | object | Reusable prompt templates | - |
| `include` | array | Additional output data | - |
| `reasoning` | object | Reasoning effort & summary | - |

For full parameter descriptions, see [CreateTextResponseDto](src/openai/dto/create-text-response.dto.ts).

### Text Generation (Streaming)

**Endpoint:** `POST /api/responses/text/stream`

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/responses/text/stream \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -N \
  -d '{
    "model": "gpt-4o",
    "input": "Tell me a short story",
    "temperature": 0.8,
    "stream_options": { "include_obfuscation": true }
  }'
```

**Example Response (SSE):**

```
event: response.created
data: {"response_id":"resp_abc123","model":"gpt-4o","sequence":1}

event: response.output_text.delta
data: {"delta":"Once","sequence":2}

event: response.output_text.delta
data: {"delta":" upon","sequence":3}

event: response.completed
data: {"usage":{"input_tokens":15,"output_tokens":150},"sequence":4}
```

**Supported Event Types (51 total):**

<details>
<summary><b>View all 51 streaming event types</b></summary>

**Lifecycle Events (7):**
- `response.created` - Response initialized
- `response.queued` - Queued for processing
- `response.in_progress` - Generation started
- `response.completed` - Finished with usage stats
- `response.incomplete` - Stopped early (max_tokens/content_filter)
- `response.failed` - Generation failed
- `error` - Generic error

**Text Output (3):**
- `response.output_text.delta` - Incremental text chunks
- `response.output_text.done` - Text complete
- `response.output_text.annotation.added` - Text annotation (citations)

**Reasoning (6) - for o-series models:**
- `response.reasoning_text.delta` - Reasoning tokens streaming
- `response.reasoning_text.done` - Reasoning complete
- `response.reasoning_summary_part.added` - Summary part added
- `response.reasoning_summary_part.done` - Summary part complete
- `response.reasoning_summary_text.delta` - Summary streaming
- `response.reasoning_summary_text.done` - Summary complete

**Tool Calling (15):**
- `response.function_call_arguments.delta/done` - Function arguments
- `response.code_interpreter_call.*` (5 events) - Code execution
- `response.file_search_call.*` (3 events) - Vector store search
- `response.web_search_call.*` (3 events) - Web search
- `response.custom_tool_call_input.delta/done` - Custom tools

**Image Generation (4):**
- `response.image_generation_call.in_progress` - Started
- `response.image_generation_call.generating` - In progress
- `response.image_generation_call.partial_image` - Partial image (0-3)
- `response.image_generation_call.completed` - Final image

**Audio (4) - TTS/Voice:**
- `response.audio.delta/done` - Audio chunks
- `response.audio.transcript.delta/done` - Transcript

**MCP (8) - Model Context Protocol:**
- `response.mcp_call.*` (5 events) - MCP call lifecycle
- `response.mcp_list_tools.*` (3 events) - Tool discovery

**Refusal (2):**
- `response.refusal.delta/done` - Content policy refusals

**Structural (2):**
- `response.output_item.added/done` - Output boundaries
- `response.content_part.added/done` - Content boundaries

</details>

### Audio Output with Modalities

**Purpose:** Generate audio responses using the `modalities` parameter to control output types (text, audio, or both).

**Endpoint:** `POST /api/responses/text` (with `modalities` parameter)

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/responses/text \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "input": "Tell me a bedtime story",
    "modalities": ["text", "audio"],
    "instructions": "Speak in a calm, soothing voice"
  }'
```

**Modalities Parameter:**

| Value | Description | Output Format |
|-------|-------------|---------------|
| `["text"]` | Text-only output (default) | Standard `output_text` field |
| `["audio"]` | Audio-only output | Base64-encoded audio in streaming events |
| `["text", "audio"]` | Both text and audio | Both text and audio data |

**Audio Streaming Events:**

When audio modality is enabled, streaming responses include:
- `response.audio.delta` - Incremental base64-encoded audio chunks
- `response.audio.done` - Complete audio output
- `response.audio.transcript.delta` - Incremental transcript text
- `response.audio.transcript.done` - Complete transcript

**Audio Output Formats:**

Supported audio formats:
- **pcm16** - Uncompressed PCM audio (16-bit, 24kHz)
- **mp3** - MP3-encoded audio
- **opus** - Opus-encoded audio

**Voice Options:**

Available voice options (when audio-capable models are used):
- **alloy**, **ash**, **ballad**, **coral**, **echo**, **fable**, **onyx**, **nova**, **sage**, **shimmer**, **verse**

**Example Response (Streaming):**

```
event: response.audio.delta
data: {"delta":"UklGRiQAAABXQVZFZm10...", "call_id":"audio_001"}

event: response.audio.transcript.delta
data: {"delta":"Once upon a time...", "call_id":"audio_001"}

event: response.audio.done
data: {"audio":"UklGRiQAAABXQVZFZm10...","call_id":"audio_001"}
```

**Notes:**
- Audio generation requires audio-capable models (check model capabilities)
- Audio output incurs additional costs beyond text tokens
- The `modalities` array cannot be empty
- Base64-encoded audio can be decoded and played directly in browsers
- Transcript provides text version of spoken audio for accessibility

---

### Image Generation

**Endpoint:** `POST /api/responses/images`

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/responses/images \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "input": "A futuristic city at sunset with flying cars",
    "image_model": "gpt-image-1",
    "image_quality": "high",
    "image_format": "webp",
    "image_size": "1536x1024",
    "output_compression": 95
  }'
```

**Image-Specific Parameters (9):**

| Parameter | Type | Options | Description |
|-----------|------|---------|-------------|
| `image_model` | enum | `gpt-image-1`, `gpt-image-1-mini` | Model selection |
| `image_quality` | enum | `low`, `medium`, `high`, `auto` | Quality level |
| `image_format` | enum | `png`, `webp`, `jpeg` | Output format |
| `image_size` | enum | `1024x1024`, `1024x1536`, `1536x1024`, `auto` | Dimensions |
| `image_moderation` | enum | `auto`, `low` | Content filtering |
| `image_background` | enum | `transparent`, `opaque`, `auto` | Background style |
| `input_fidelity` | enum | `high`, `low` | Prompt adherence |
| `output_compression` | number | 0-100 | Compression quality |
| `partial_images` | number | 0-3 | Progressive rendering count |

**Example Response:**

```json
{
  "id": "resp_img123",
  "output_text": "data:image/webp;base64,iVBORw0KGgo...",
  "usage": {
    "input_tokens": 20,
    "output_tokens": 0,
    "total_tokens": 20
  }
}
```

The `output_text` field contains the base64-encoded image data.

### Code Interpreter Tool Configuration

**Purpose:** Execute Python code in a secure sandboxed environment for data analysis, calculations, file processing, and visualizations within Responses API.

**Key Features:**
- Secure Python 3 code execution in isolated containers
- Auto-managed container lifecycle (1-hour session, 20-min idle timeout)
- File upload support for data processing
- Output handling: logs, generated images (plots/charts), data files, and errors
- 5 streaming events for real-time code generation and execution feedback

**Current Status:**
- ✅ Tool configuration and validation implemented
- ✅ Code interpreter event handlers ready (5 events: `in_progress`, `generating`, `code.delta`, `code.done`, `completed`)
- ✅ Full type safety with strict TypeScript interfaces
- ✅ Comprehensive test coverage (61 validator tests + 30 DTO tests + 8 controller tests + 13 E2E tests)
- ✅ Support for streaming code generation
- ⚠️ Container costs: $0.03 per container creation

#### Configuration Structure

**Option 1: Basic (Auto-managed container)**
```typescript
{
  type: 'code_interpreter'
  // OpenAI automatically manages container lifecycle
}
```

**Option 2: Auto-container with file access**
```typescript
{
  type: 'code_interpreter',
  container: {
    type: 'auto',                                  // Auto-create or reuse container
    file_ids: ['file-abc123...']                   // Optional - Files to load in container
  }
}
```

**Option 3: Reuse existing container**
```typescript
{
  type: 'code_interpreter',
  container: 'container_abc123xyz789'              // String - Reuse specific container ID
}
```

#### Example: Basic Code Execution

```bash
curl -X POST http://localhost:3000/api/responses/text \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "input": "Calculate the factorial of 10 using Python",
    "tools": [{
      "type": "code_interpreter"
    }]
  }'
```

**Response:**
```json
{
  "id": "resp_code123",
  "output_text": "The factorial of 10 is 3,628,800. Here's how I calculated it:\n\n```python\nimport math\nresult = math.factorial(10)\nprint(result)\n```\n\nThe result is 3,628,800.",
  "output_tool_call": {
    "type": "code_interpreter",
    "call_id": "call_abc123",
    "container_id": "container_def456",
    "code": "import math\nresult = math.factorial(10)\nprint(result)",
    "output": [
      {
        "type": "logs",
        "logs": "3628800\n"
      }
    ]
  },
  "usage": {
    "input_tokens": 20,
    "output_tokens": 95
  }
}
```

#### Example: Data Analysis with File Upload

```bash
curl -X POST http://localhost:3000/api/responses/text \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "input": "Calculate the mean, median, and standard deviation of the data in the uploaded CSV file",
    "tools": [{
      "type": "code_interpreter",
      "container": {
        "type": "auto",
        "file_ids": ["file-abc123xyz789012345678901"]
      }
    }],
    "include": ["code_interpreter_call.outputs"]
  }'
```

**Response with Detailed Outputs:**
```json
{
  "id": "resp_analysis456",
  "output_text": "Based on the data analysis:\n- Mean: 42.5\n- Median: 40\n- Standard Deviation: 15.2",
  "output_tool_call": {
    "type": "code_interpreter",
    "call_id": "call_stats789",
    "container_id": "container_data123",
    "code": "import pandas as pd\nimport numpy as np\n\ndf = pd.read_csv('data.csv')\nmean = df['values'].mean()\nmedian = df['values'].median()\nstd = df['values'].std()\n\nprint(f'Mean: {mean}')\nprint(f'Median: {median}')\nprint(f'Std Dev: {std}')",
    "output": [
      {
        "type": "logs",
        "logs": "Mean: 42.5\nMedian: 40.0\nStd Dev: 15.2\n"
      }
    ]
  }
}
```

#### Example: Generating Visualizations

```bash
curl -X POST http://localhost:3000/api/responses/text \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "input": "Create a bar chart showing sales data: Q1: 100, Q2: 150, Q3: 120, Q4: 180",
    "tools": [{
      "type": "code_interpreter",
      "container": {
        "type": "auto"
      }
    }],
    "include": ["code_interpreter_call.outputs"]
  }'
```

**Response with Image Output:**
```json
{
  "id": "resp_chart789",
  "output_text": "I've created a bar chart showing the quarterly sales data.",
  "output_tool_call": {
    "type": "code_interpreter",
    "call_id": "call_chart012",
    "container_id": "container_viz345",
    "code": "import matplotlib.pyplot as plt\n\nquarters = ['Q1', 'Q2', 'Q3', 'Q4']\nsales = [100, 150, 120, 180]\n\nplt.bar(quarters, sales)\nplt.title('Quarterly Sales')\nplt.ylabel('Sales')\nplt.savefig('sales_chart.png')\nplt.show()",
    "output": [
      {
        "type": "image",
        "image": "data:image/png;base64,iVBORw0KGgo...",
        "filename": "sales_chart.png",
        "file_id": "file-chart123..."
      }
    ]
  }
}
```

#### Example: Streaming Code Generation

```bash
curl -X POST http://localhost:3000/api/responses/text/stream \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "input": "Write Python code to generate the first 20 Fibonacci numbers",
    "tools": [{
      "type": "code_interpreter"
    }]
  }'
```

**Streaming Events Sequence:**
```
event: code_interpreter_call.in_progress
data: {"call_id":"call_abc123","sequence":1}

event: code_interpreter_call.generating
data: {"call_id":"call_abc123","container_id":"container_def456","sequence":2}

event: code_interpreter_code.delta
data: {"call_id":"call_abc123","delta":"def fib","sequence":3}

event: code_interpreter_code.delta
data: {"call_id":"call_abc123","delta":"onacci(n):\n","sequence":4}

event: code_interpreter_code.done
data: {"call_id":"call_abc123","code":"def fibonacci(n):\n    fib = [0, 1]\n    for i in range(2, n):\n        fib.append(fib[-1] + fib[-2])\n    return fib\n\nresult = fibonacci(20)\nprint(result)","sequence":5}

event: code_interpreter_call.interpreting
data: {"call_id":"call_abc123","container_id":"container_def456","sequence":6}

event: code_interpreter_call.completed
data: {"call_id":"call_abc123","output":[{"type":"logs","logs":"[0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181]\n"}],"sequence":7}

event: response.completed
data: {"response_id":"resp_fib789","sequence":8}
```

#### Combining with Other Tools

Code interpreter works seamlessly with other tools:

```bash
curl -X POST http://localhost:3000/api/responses/text \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "input": "Search our product docs for pricing, then calculate the total cost for 100 units with a 15% discount",
    "tools": [
      {
        "type": "file_search",
        "vector_store_ids": ["vs_products"]
      },
      {
        "type": "code_interpreter",
        "container": {
          "type": "auto"
        }
      },
      {
        "type": "function",
        "function": {
          "name": "apply_discount",
          "description": "Apply discount code",
          "parameters": {
            "type": "object",
            "properties": {
              "total": {"type": "number"},
              "discount_code": {"type": "string"}
            }
          }
        }
      }
    ]
  }'
```

#### Container Lifecycle

**Session Duration:** 1 hour maximum
**Idle Timeout:** 20 minutes of inactivity
**Reuse:** Can reuse container ID across multiple requests within session
**Cost Optimization:** Reusing containers avoids repeated $0.03 charges

```bash
# First request creates container
curl -X POST http://localhost:3000/api/responses/text \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "input": "Calculate 2^10",
    "tools": [{"type": "code_interpreter"}]
  }'
# Response includes: "container_id": "container_abc123"

# Second request reuses same container (no additional charge)
curl -X POST http://localhost:3000/api/responses/text \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "input": "Now calculate 3^10",
    "tools": [{
      "type": "code_interpreter",
      "container": "container_abc123"  # Reuse from first request
    }]
  }'
```

#### Parameters Reference

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | Yes | Must be `'code_interpreter'` |
| `container` | string \| object | No | Container configuration (auto-managed if omitted) |
| `container` (string) | string | No | Container ID to reuse (format: `container_*`) |
| `container.type` | enum | Yes* | Must be `'auto'` (*required if container is object) |
| `container.file_ids` | string[] | No | Array of file IDs to load (must start with `file-`, non-empty) |

**Include Options:**
- `code_interpreter_call.outputs` - Include detailed execution outputs (logs, images, files, errors)

#### Output Types

Code interpreter can produce four types of outputs:

**1. Logs (stdout/stderr)**
```json
{
  "type": "logs",
  "logs": "Result: 1024\nCalculation complete\n"
}
```

**2. Images (plots, charts, visualizations)**
```json
{
  "type": "image",
  "image": "data:image/png;base64,iVBORw0KGgo...",
  "filename": "plot.png",
  "file_id": "file-img123..."
}
```

**3. Files (CSV, JSON, text, etc.)**
```json
{
  "type": "file",
  "file_id": "file-abc123...",
  "filename": "results.csv",
  "size": 2048,
  "mime_type": "text/csv"
}
```

**4. Errors (syntax, runtime, timeout)**
```json
{
  "type": "error",
  "error_type": "runtime",
  "message": "ZeroDivisionError: division by zero",
  "line": 3,
  "traceback": "Traceback (most recent call last):\n  File \"<string>\", line 3..."
}
```

#### Pricing

- **Container Creation:** $0.03 per new container
- **Container Reuse:** Free (within 1-hour session, 20-min idle timeout)
- **Token Usage:** Standard input/output token rates apply
- **File Storage:** Temporary (deleted after container session ends)

**Cost Optimization Tips:**
1. Reuse containers within the same session to avoid repeated $0.03 charges
2. Keep idle time under 20 minutes to maintain active sessions
3. Batch multiple calculations in a single request when possible

For current pricing, see [OpenAI Pricing](https://openai.com/pricing).

#### Error Handling

**Invalid Container Type:**
```json
{
  "statusCode": 400,
  "message": "Invalid code_interpreter tool configuration. Requirements:\n  - container (object).type: must be \"auto\" (required if container is object)",
  "parameter": "tools[0].container.type"
}
```

**Empty file_ids Array:**
```json
{
  "statusCode": 400,
  "message": "Invalid code_interpreter tool configuration",
  "parameter": "tools[0].container.file_ids",
  "hint": "file_ids array cannot be empty - omit the field if no files needed"
}
```

**Invalid File ID Format:**
```json
{
  "statusCode": 400,
  "message": "Invalid code_interpreter tool configuration",
  "parameter": "tools[0].container.file_ids[0]",
  "hint": "File IDs must start with \"file-\" prefix"
}
```

**Empty String Container:**
```json
{
  "statusCode": 400,
  "message": "Invalid code_interpreter tool configuration",
  "parameter": "tools[0].container",
  "hint": "Container ID cannot be empty string"
}
```

**Code Execution Timeout:**
```json
{
  "statusCode": 500,
  "message": "Code execution timeout",
  "error_type": "timeout",
  "request_id": "req_timeout123",
  "hint": "Optimize code or split into smaller operations"
}
```

**Python Syntax Error:**
```json
{
  "statusCode": 200,
  "output_tool_call": {
    "type": "code_interpreter",
    "output": [{
      "type": "error",
      "error_type": "syntax",
      "message": "SyntaxError: invalid syntax (line 3)",
      "line": 3
    }]
  }
}
```

**Python Runtime Error:**
```json
{
  "statusCode": 200,
  "output_tool_call": {
    "type": "code_interpreter",
    "output": [{
      "type": "error",
      "error_type": "runtime",
      "message": "NameError: name 'undefined_var' is not defined",
      "traceback": "Traceback (most recent call last):\n  ..."
    }]
  }
}
```

#### Streaming Events

Code interpreter emits 5 distinct streaming events during execution:

| Event | Description | Data Fields |
|-------|-------------|-------------|
| `code_interpreter_call.in_progress` | Tool activated | `call_id`, `container_id?` |
| `code_interpreter_call.generating` | Code generation started | `call_id`, `container_id?` |
| `code_interpreter_code.delta` | Incremental code chunk | `call_id`, `delta`, `snapshot?`, `index?` |
| `code_interpreter_code.done` | Complete code ready | `call_id`, `code`, `container_id?` |
| `code_interpreter_call.interpreting` | Execution started | `call_id`, `container_id`, `code?` |
| `code_interpreter_call.completed` | Execution finished | `call_id`, `container_id`, `code`, `output`, `duration_ms?`, `success?` |

**Event Sequence Example:**
```
in_progress → generating → code.delta (×N) → code.done → interpreting → completed
```

#### Best Practices

1. **Container Reuse:** Save and reuse `container_id` from responses to avoid $0.03 charges per request
2. **File Management:** Upload files once, reference by `file_id` in multiple requests
3. **Error Handling:** Check `output.type === 'error'` to detect execution failures
4. **Streaming:** Use streaming for long-running calculations to provide real-time feedback
5. **Include Parameter:** Add `include: ['code_interpreter_call.outputs']` to get detailed execution results
6. **Timeout Awareness:** Large datasets or complex calculations may timeout - consider breaking into smaller operations
7. **Cost Monitoring:** Track container creation vs reuse to optimize costs

#### See Also

- [Files API Documentation](#) (Phase 4 - Planned for file upload support)
- [Streaming Events Documentation](#streaming-events)
- [Tool Calling Events](#tool-calling-15)
- [Code Interpreter TypeScript Interfaces](src/openai/interfaces/code-interpreter-tool.interface.ts)
- [Code Interpreter Validation](src/openai/validators/code-interpreter-tool.validator.ts)
- [Code Interpreter E2E Tests](test/code-interpreter.e2e-spec.ts)

---

### File Search Tool Configuration

**Purpose:** Search through uploaded files using semantic vector search within Responses API.

**Prerequisites:**
- Files must be uploaded via Files API (Phase 4 - Planned)
- Vector stores must be created via Vector Stores API (Phase 5 - Planned)

**Current Status:**
- ✅ Tool configuration and validation implemented
- ✅ File search event handlers ready (3 events: `in_progress`, `searching`, `completed`)
- ✅ Full type safety with TypeScript interfaces
- ⏳ Requires Phases 4 & 5 for end-to-end functionality

#### Configuration Structure

```typescript
{
  type: 'file_search',
  vector_store_ids: ['vs_abc123', 'vs_def456'],  // Required - Array of vector store IDs
  max_num_results: 10,                           // Optional (1-50, default: 20)
  ranking_options: {                             // Optional
    ranker: 'auto',                              // 'auto' | 'default-2024-11-15'
    score_threshold: 0.7                         // 0-1 (relevance threshold)
  }
}
```

#### Example: Basic File Search

```bash
curl -X POST http://localhost:3000/api/responses/text \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "input": "What does our privacy policy say about data retention?",
    "tools": [{
      "type": "file_search",
      "vector_store_ids": ["vs_abc123"]
    }],
    "include": ["file_search_call.results"]
  }'
```

#### Example: Advanced Configuration

```bash
curl -X POST http://localhost:3000/api/responses/text \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "input": "Find relevant product specifications",
    "tools": [{
      "type": "file_search",
      "vector_store_ids": ["vs_products", "vs_specs"],
      "max_num_results": 5,
      "ranking_options": {
        "ranker": "auto",
        "score_threshold": 0.8
      }
    }],
    "include": ["file_search_call.results"]
  }'
```

#### Example Response

```json
{
  "id": "resp_search123",
  "output_text": "According to your privacy policy...",
  "output_tool_call": {
    "type": "file_search",
    "call_id": "call_search456",
    "results": [
      {
        "file_id": "file_abc123",
        "filename": "privacy-policy.pdf",
        "score": 0.89,
        "content": "Data retention period is 90 days..."
      }
    ]
  },
  "usage": {
    "input_tokens": 25,
    "output_tokens": 150
  }
}
```

#### Combining with Other Tools

File search can be combined with other tools like function calling and web search:

```bash
curl -X POST http://localhost:3000/api/responses/text \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "input": "Compare our docs with latest industry standards",
    "tools": [
      {
        "type": "file_search",
        "vector_store_ids": ["vs_internal_docs"]
      },
      {
        "type": "web_search"
      },
      {
        "type": "function",
        "function": {
          "name": "get_compliance_data",
          "description": "Get current compliance requirements"
        }
      }
    ]
  }'
```

#### Parameters Reference

| Parameter | Type | Required | Range | Description |
|-----------|------|----------|-------|-------------|
| `type` | string | Yes | `'file_search'` | Tool type identifier |
| `vector_store_ids` | string[] | Yes | - | Array of vector store IDs (must start with "vs_") |
| `max_num_results` | number | No | 1-50 | Maximum search results to use (default: 20) |
| `ranking_options.ranker` | enum | No | `'auto'` \| `'default-2024-11-15'` | Ranking algorithm |
| `ranking_options.score_threshold` | number | No | 0-1 | Minimum relevance score |

#### Pricing

- **File Search Calls:** $2.50 per 1,000 calls
- **Vector Storage:** $0.10 per GB per day (first 1GB free)

For current pricing, see [OpenAI Pricing](https://openai.com/pricing).

#### Error Handling

**Invalid Vector Store ID:**
```json
{
  "statusCode": 400,
  "message": "Invalid vector store ID format",
  "parameter": "tools[0].vector_store_ids[0]",
  "hint": "Vector store IDs must start with 'vs_'"
}
```

**Vector Store Not Found:**
```json
{
  "statusCode": 404,
  "message": "Vector store not found",
  "request_id": "req_abc123",
  "parameter": "tools[0].vector_store_ids[0]",
  "hint": "Create vector store via Vector Stores API first (Phase 5)"
}
```

**Max Results Out of Range:**
```json
{
  "statusCode": 400,
  "message": "Invalid max_num_results value",
  "parameter": "tools[0].max_num_results",
  "hint": "max_num_results must be between 1 and 50"
}
```

#### See Also

- [Files API Documentation](#) (Phase 4 - Planned)
- [Vector Stores API Documentation](#) (Phase 5 - Planned)
- [Tool Calling Events](#tool-calling-15)

### Advanced Parameters

**Purpose:** Fine-tune responses with advanced configuration options for optimization, context management, and specialized model behaviors.

#### Prompt Templates

Custom instruction formats for consistent prompt engineering:

```json
{
  "prompt": {
    "type": "text",
    "text": "You are a helpful assistant specialized in technical documentation."
  },
  "input": "Explain Kubernetes pods"
}
```

#### Inclusion Array

Request additional metadata in API responses (8 options available):

```json
{
  "include": [
    "file_search_call.results",
    "code_interpreter_call.outputs",
    "function_call.arguments"
  ]
}
```

**Available Options:**
- `file_search_call.results` - Vector search results
- `code_interpreter_call.outputs` - Code execution outputs (code, images, files, errors)
- `function_call.arguments` - Function call parameters
- `web_search_call.results` - Web search snippets
- `computer_tool_call.outputs` - Computer use outputs
- `mcp_call.outputs` - MCP tool outputs
- `reasoning_summary.parts` - Reasoning breakdown (o-series models)
- `response.usage.cached_tokens` - Prompt cache statistics

#### Reasoning Configuration

For o1/o3/gpt-5 models with extended thinking capabilities:

```json
{
  "model": "o1-preview",
  "input": "Design a distributed caching system",
  "reasoning": {
    "effort": "high"
  }
}
```

**Effort Levels:**
- `low` - Quick reasoning (faster, less detailed)
- `medium` - Balanced reasoning (default)
- `high` - Deep reasoning (slower, more thorough)

### Response Lifecycle Management

**Retrieve:** `GET /api/responses/:id` - Get stored response (30-day retention)
**Delete:** `DELETE /api/responses/:id` - Permanently delete response
**Cancel:** `POST /api/responses/:id/cancel` - Cancel background response
**Resume:** `GET /api/responses/:id/stream` - Resume interrupted streaming

#### Resumable Streaming

**Purpose:** Resume interrupted SSE connections or replay streaming responses from stored state.

**Requirements:**
- Original response must be created with `store: true`
- Response ID must be valid (30-day retention)

**Example:**

```bash
# 1. Create response with storage enabled
curl -X POST http://localhost:3000/api/responses/text \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Write a long story",
    "store": true
  }'

# Response includes: "id": "resp_abc123"

# 2. Resume streaming later (or after connection drop)
curl -N http://localhost:3000/api/responses/resp_abc123/stream
```

**Supported Events:** All 51 streaming event types (text, reasoning, tools, images, audio, MCP, refusal)

---

### Images API

The Images API provides three image generation models (gpt-image-1, DALL-E 3, DALL-E 2) with different capabilities and pricing. This is a **standalone API** separate from the Responses API image generation feature.

#### Model Comparison

| Model | Resolution | Images/Request | Response Format | Quality Options | Unique Features |
|-------|-----------|----------------|-----------------|-----------------|-----------------|
| **gpt-image-1** | Up to 4096×4096 | 1 only | b64_json only | N/A | Auto size, portrait/landscape |
| **DALL-E 3** | 1024×1024 to 1792×1024 | 1 only | url, b64_json | standard, hd | Revised prompts, style control |
| **DALL-E 2** | 256×256 to 1024×1024 | 1-10 | url, b64_json | standard only | Edits, variations, multiple images |

**Key Differences:**
- **gpt-image-1**: Latest GPT-4o-powered model, highest resolution (up to 4096×4096), only b64_json format, unique "auto" size option
- **DALL-E 3**: Higher quality with automatic prompt rewriting, HD quality option, style control (vivid/natural)
- **DALL-E 2**: Budget-friendly, supports multiple images per request, image editing with masks, and variations

#### Generate Images

**Endpoint:** `POST /api/images/generate`

##### Example 1: gpt-image-1 with Auto Size

```bash
curl -X POST http://localhost:3000/api/images/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-1",
    "prompt": "A serene mountain landscape at sunset",
    "size": "auto",
    "response_format": "b64_json"
  }'
```

**Response:**

```json
{
  "created": 1234567890,
  "data": [
    {
      "b64_json": "iVBORw0KGgoAAAANSUhEUgAAAAUA..."
    }
  ]
}
```

**Note:** gpt-image-1 always returns `b64_json` (no URL format) and generates exactly 1 image per request.

##### Example 2: gpt-image-1 Portrait (1024×1536)

```bash
curl -X POST http://localhost:3000/api/images/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-1",
    "prompt": "A tall lighthouse tower on a cliff",
    "size": "1024x1536",
    "response_format": "b64_json"
  }'
```

##### Example 3: gpt-image-1 Landscape (1536×1024)

```bash
curl -X POST http://localhost:3000/api/images/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-1",
    "prompt": "A wide panoramic view of a valley",
    "size": "1536x1024",
    "response_format": "b64_json"
  }'
```

##### Example 4: DALL-E 3 with HD Quality

```bash
curl -X POST http://localhost:3000/api/images/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "dall-e-3",
    "prompt": "A futuristic cityscape at night",
    "size": "1792x1024",
    "quality": "hd",
    "style": "vivid",
    "response_format": "url"
  }'
```

**Response:**

```json
{
  "created": 1234567890,
  "data": [
    {
      "url": "https://oaidalleapiprodscus.blob.core.windows.net/...",
      "revised_prompt": "A detailed futuristic cityscape illuminated by neon lights at night..."
    }
  ]
}
```

**Note:** DALL-E 3 automatically rewrites prompts for safety and quality. The `revised_prompt` field shows the actual prompt used.

##### Example 5: DALL-E 2 with Multiple Images

```bash
curl -X POST http://localhost:3000/api/images/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "dall-e-2",
    "prompt": "A cute baby sea otter",
    "n": 3,
    "size": "512x512",
    "response_format": "url"
  }'
```

**Response:**

```json
{
  "created": 1234567890,
  "data": [
    {
      "url": "https://oaidalleapiprodscus.blob.core.windows.net/image1.png"
    },
    {
      "url": "https://oaidalleapiprodscus.blob.core.windows.net/image2.png"
    },
    {
      "url": "https://oaidalleapiprodscus.blob.core.windows.net/image3.png"
    }
  ]
}
```

**Note:** Only DALL-E 2 supports generating multiple images (n=1-10) in a single request.

##### Supported Parameters

| Parameter | Type | Models | Options | Default | Description |
|-----------|------|--------|---------|---------|-------------|
| `prompt` | string | All | 1-4000 chars | *required* | Image description |
| `model` | enum | All | `dall-e-2`, `dall-e-3`, `gpt-image-1` | `dall-e-2` | Model selection |
| `n` | number | DALL-E 2 only | 1-10 | 1 | Number of images (gpt-image-1/DALL-E 3: always 1) |
| `size` | enum | Model-specific | See table below | `1024x1024` | Image dimensions |
| `quality` | enum | DALL-E 3 only | `standard`, `hd` | `standard` | Quality level |
| `style` | enum | DALL-E 3 only | `vivid`, `natural` | `vivid` | Visual style |
| `response_format` | enum | All | `url`, `b64_json` | `url` | Output format (gpt-image-1: b64_json only) |
| `user` | string | All | Any string | - | User tracking ID |

**Size Options by Model:**

| Model | Supported Sizes |
|-------|----------------|
| **gpt-image-1** | `1024x1024`, `1024x1536` (portrait), `1536x1024` (landscape), `auto` |
| **DALL-E 3** | `1024x1024`, `1792x1024` (landscape), `1024x1792` (portrait) |
| **DALL-E 2** | `256x256`, `512x512`, `1024x1024` |

#### Edit Images (DALL-E 2 Only)

**Endpoint:** `POST /api/images/edit`

**Note:** Image editing is only supported for DALL-E 2. Images must be square and less than 4MB.

##### Example: Edit Image with Mask

```bash
curl -X POST http://localhost:3000/api/images/edit \
  -H "Content-Type: multipart/form-data" \
  -F "image=@original.png" \
  -F "mask=@mask.png" \
  -F "prompt=Add a red door to the house" \
  -F "model=dall-e-2" \
  -F "n=2" \
  -F "size=512x512" \
  -F "response_format=url"
```

**Response:**

```json
{
  "created": 1234567890,
  "data": [
    {
      "url": "https://oaidalleapiprodscus.blob.core.windows.net/edited1.png"
    },
    {
      "url": "https://oaidalleapiprodscus.blob.core.windows.net/edited2.png"
    }
  ]
}
```

**Requirements:**
- Image and mask must be square PNG files (< 4MB)
- Mask: transparent areas (alpha=0) indicate where to edit
- Prompt describes what to add/change in transparent areas
- Model must be `dall-e-2` (only model supporting edits)

##### Supported Parameters

| Parameter | Type | Required | Options | Description |
|-----------|------|----------|---------|-------------|
| `image` | file | ✅ | PNG < 4MB | Original image to edit |
| `mask` | file | No | PNG < 4MB | Mask indicating edit areas (transparent = edit) |
| `prompt` | string | ✅ | 1-1000 chars | Description of edits |
| `model` | enum | No | `dall-e-2` | Model (only DALL-E 2 supported) |
| `n` | number | No | 1-10 | Number of variations |
| `size` | enum | No | `256x256`, `512x512`, `1024x1024` | Output size |
| `response_format` | enum | No | `url`, `b64_json` | Output format |
| `user` | string | No | Any string | User tracking ID |

#### Create Image Variations (DALL-E 2 Only)

**Endpoint:** `POST /api/images/variations`

**Note:** Variations are only supported for DALL-E 2. The input image must be square and less than 4MB.

##### Example: Create Variations

```bash
curl -X POST http://localhost:3000/api/images/variations \
  -H "Content-Type: multipart/form-data" \
  -F "image=@original.png" \
  -F "model=dall-e-2" \
  -F "n=3" \
  -F "size=1024x1024" \
  -F "response_format=url"
```

**Response:**

```json
{
  "created": 1234567890,
  "data": [
    {
      "url": "https://oaidalleapiprodscus.blob.core.windows.net/var1.png"
    },
    {
      "url": "https://oaidalleapiprodscus.blob.core.windows.net/var2.png"
    },
    {
      "url": "https://oaidalleapiprodscus.blob.core.windows.net/var3.png"
    }
  ]
}
```

**Requirements:**
- Image must be square PNG file (< 4MB)
- Model must be `dall-e-2` (only model supporting variations)
- Generates variations inspired by the input image (no prompt needed)

##### Supported Parameters

| Parameter | Type | Required | Options | Description |
|-----------|------|----------|---------|-------------|
| `image` | file | ✅ | PNG < 4MB | Source image for variations |
| `model` | enum | No | `dall-e-2` | Model (only DALL-E 2 supported) |
| `n` | number | No | 1-10 | Number of variations |
| `size` | enum | No | `256x256`, `512x512`, `1024x1024` | Output size |
| `response_format` | enum | No | `url`, `b64_json` | Output format |
| `user` | string | No | Any string | User tracking ID |

#### Pricing Comparison

**Generation Costs:**

| Model | Size | Quality | Price per Image |
|-------|------|---------|----------------|
| **gpt-image-1** | 1024×1024 | standard | $0.020 |
| **gpt-image-1** | 1024×1536 | standard | $0.020 |
| **gpt-image-1** | 1536×1024 | standard | $0.020 |
| **gpt-image-1** | auto | standard | $0.020 |
| **DALL-E 3** | 1024×1024 | standard | $0.040 |
| **DALL-E 3** | 1024×1024 | hd | $0.080 |
| **DALL-E 3** | 1792×1024 or 1024×1792 | standard | $0.080 |
| **DALL-E 3** | 1792×1024 or 1024×1792 | hd | $0.120 |
| **DALL-E 2** | 256×256 | standard | $0.016 |
| **DALL-E 2** | 512×512 | standard | $0.018 |
| **DALL-E 2** | 1024×1024 | standard | $0.020 |

**Edit & Variation Costs (DALL-E 2 only):**

Same as generation costs based on output size:
- 256×256: $0.016 per image
- 512×512: $0.018 per image
- 1024×1024: $0.020 per image

**Cost Optimization Tips:**
- Use gpt-image-1 for high-resolution needs (up to 4096×4096 at same $0.020 cost)
- Use DALL-E 2 for budget-friendly generation, edits, or multiple images
- Use DALL-E 3 standard quality before HD to save 50-66%
- Request multiple DALL-E 2 images in one call (n=3-10) to batch workflows

#### Model-Specific Limitations

**gpt-image-1:**
- ❌ No `quality` parameter (always standard quality)
- ❌ No `style` parameter (auto-determined)
- ❌ No `url` response format (always returns `b64_json`)
- ❌ No image editing or variations endpoints
- ❌ Only 1 image per request (n=1 always)
- ✅ Supports "auto" size (automatically determines optimal dimensions)
- ✅ Highest resolution (up to 4096×4096)
- ✅ Portrait and landscape sizes (1024×1536, 1536×1024)

**DALL-E 3:**
- ❌ No image editing or variations endpoints
- ❌ Only 1 image per request (n=1 always)
- ❌ No small sizes (256×256, 512×512)
- ✅ Automatic prompt revision with `revised_prompt` in response
- ✅ HD quality option
- ✅ Style control (vivid/natural)
- ✅ Both url and b64_json response formats

**DALL-E 2:**
- ❌ Lower maximum resolution (1024×1024)
- ❌ No HD quality option
- ❌ No style control
- ❌ No automatic prompt revision
- ✅ Multiple images per request (n=1-10)
- ✅ Image editing with masks
- ✅ Image variations
- ✅ Small sizes available (256×256, 512×512)
- ✅ Both url and b64_json response formats

---

### Videos API

The Videos API uses an **async job management pattern** (polling, not streaming) for video generation.

#### Video Generation Workflow

```
1. Create Job → 2. Poll Status → 3. Download Video
   (queued)        (in_progress)      (completed)
```

#### Create Video

**Endpoint:** `POST /api/videos`

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/videos \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A serene lakeside at sunset with calm waters",
    "model": "sora-2",
    "seconds": "4",
    "size": "720x1280"
  }'
```

**Example Response:**

```json
{
  "id": "vid_abc123",
  "object": "video",
  "status": "queued",
  "progress": 0,
  "model": "sora-2",
  "seconds": "4",
  "size": "720x1280",
  "prompt": "A serene lakeside at sunset with calm waters",
  "created_at": 1234567890,
  "completed_at": null,
  "expires_at": null,
  "remixed_from_video_id": null,
  "error": null
}
```

**Parameters:**

| Parameter | Type | Description | Options | Default |
|-----------|------|-------------|---------|---------|
| `prompt` | string | Text description of video (1-500 chars) | - | *required* |
| `model` | string | Model to use | `sora-2`, `sora-2-pro` | `sora-2` |
| `seconds` | string | Video duration | `"4"`, `"8"`, `"12"` | `"4"` |
| `size` | string | Video resolution | `720x1280`, `1280x720`, `1024x1792`, `1792x1024` | `720x1280` |

#### Get Video Status

**Endpoint:** `GET /api/videos/:id`

**Example Request:**

```bash
curl http://localhost:3000/api/videos/vid_abc123
```

**Example Response:**

```json
{
  "id": "vid_abc123",
  "status": "in_progress",
  "progress": 50,
  "model": "sora-2",
  "seconds": "4",
  "size": "720x1280",
  "created_at": 1234567890,
  "completed_at": null,
  "expires_at": null
}
```

**Status Values:**
- `queued` - Job submitted, waiting to start
- `in_progress` - Video generation in progress (progress: 0-100%)
- `completed` - Video ready for download (check `expires_at`)
- `failed` - Generation failed (see `error` field)

#### Poll Until Complete

**Endpoint:** `GET /api/videos/:id/poll?maxWaitMs=600000`

**Purpose:** Wait for video generation to complete (polling with exponential backoff: 5s → 10s → 15s → 20s max)

**Example Request:**

```bash
# Wait up to 10 minutes (default)
curl http://localhost:3000/api/videos/vid_abc123/poll

# Wait up to 5 minutes
curl http://localhost:3000/api/videos/vid_abc123/poll?maxWaitMs=300000
```

**Example Response (completed):**

```json
{
  "id": "vid_abc123",
  "status": "completed",
  "progress": 100,
  "model": "sora-2",
  "seconds": "4",
  "size": "720x1280",
  "created_at": 1234567890,
  "completed_at": 1234567990,
  "expires_at": 1234657990
}
```

**Example Response (failed):**

```json
{
  "id": "vid_abc123",
  "status": "failed",
  "progress": 50,
  "error": {
    "code": "video_generation_failed",
    "message": "Content policy violation detected"
  }
}
```

#### Download Video

**Endpoint:** `GET /api/videos/:id/download?variant=video`

**Purpose:** Download generated video file (MP4) or assets (JPEG)

**Example Requests:**

```bash
# Download video (MP4)
curl http://localhost:3000/api/videos/vid_abc123/download \
  --output video.mp4

# Download thumbnail (JPEG)
curl http://localhost:3000/api/videos/vid_abc123/download?variant=thumbnail \
  --output thumbnail.jpg

# Download spritesheet (JPEG)
curl http://localhost:3000/api/videos/vid_abc123/download?variant=spritesheet \
  --output spritesheet.jpg
```

**Variants:**

| Variant | Type | Size | Description |
|---------|------|------|-------------|
| `video` | MP4 | ~2-20MB | Full video file |
| `thumbnail` | JPEG | ~100KB | Single frame preview |
| `spritesheet` | JPEG | ~500KB | Grid of frames for preview |

**Important:** Videos expire after a period (check `expires_at` timestamp). Download within expiration window.

#### List Videos

**Endpoint:** `GET /api/videos?limit=10&order=desc`

**Example Request:**

```bash
# List 10 most recent videos
curl http://localhost:3000/api/videos

# List 20 oldest videos
curl "http://localhost:3000/api/videos?limit=20&order=asc"
```

**Example Response:**

```json
[
  {
    "id": "vid_abc123",
    "status": "completed",
    "progress": 100,
    "model": "sora-2",
    "seconds": "4",
    "created_at": 1234567890,
    "completed_at": 1234567990
  },
  {
    "id": "vid_xyz789",
    "status": "in_progress",
    "progress": 75,
    "model": "sora-2-pro",
    "seconds": "8",
    "created_at": 1234567800
  }
]
```

#### Delete Video

**Endpoint:** `DELETE /api/videos/:id`

**Example Request:**

```bash
curl -X DELETE http://localhost:3000/api/videos/vid_abc123
```

**Example Response:**

```json
{
  "id": "vid_abc123",
  "object": "video",
  "deleted": true
}
```

#### Remix Video

**Endpoint:** `POST /api/videos/:id/remix`

**Purpose:** Create video variation with new prompt (preserves original video's style/composition)

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/videos/vid_abc123/remix \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A serene lakeside at sunrise with misty waters"
  }'
```

**Example Response:**

```json
{
  "id": "vid_remix456",
  "object": "video",
  "status": "queued",
  "progress": 0,
  "model": "sora-2",
  "seconds": "4",
  "size": "720x1280",
  "prompt": "A serene lakeside at sunrise with misty waters",
  "remixed_from_video_id": "vid_abc123",
  "created_at": 1234568000,
  "completed_at": null
}
```

**Notes:**
- Remix creates a **new video** (different `id`) with `remixed_from_video_id` reference
- Follow same workflow: create → poll → download
- Source video must exist (not deleted or expired)

#### Pricing

Videos API is priced per second of generated video:

| Model | Price per Second | 4-sec Video | 8-sec Video | 12-sec Video |
|-------|------------------|-------------|-------------|--------------|
| `sora-2` | $0.125/sec | $0.50 | $1.00 | $1.50 |
| `sora-2-pro` | $0.40/sec | $1.60 | $3.20 | $4.80 |

**Cost Optimization:**
- Start with 4-second videos for testing
- Use `sora-2` (standard quality) unless high-fidelity required
- Delete videos after download to free storage
- Remix existing videos instead of regenerating from scratch

#### Error Handling

Videos API errors are returned as-is from OpenAI. Common error scenarios:

**Video Not Ready (409 Conflict):**
```json
{
  "error": {
    "message": "Video is not ready for download",
    "type": "invalid_request_error",
    "code": "video_not_ready"
  }
}
```

**Video Expired (410 Gone):**
```json
{
  "error": {
    "message": "Video assets have expired",
    "type": "invalid_request_error",
    "code": "video_expired"
  }
}
```

**Video Not Found (404):**
```json
{
  "error": {
    "message": "No video found with id vid_invalid123",
    "type": "invalid_request_error",
    "code": "video_not_found"
  }
}
```

**Generation Failed:**
```json
{
  "id": "vid_abc123",
  "status": "failed",
  "error": {
    "code": "video_generation_failed",
    "message": "Content policy violation: prompt contains prohibited content"
  }
}
```

#### Best Practices

1. **Always poll after creation** - Videos take 2-10 minutes to generate
2. **Check expiration** - Download videos before `expires_at` timestamp
3. **Handle timeouts** - Set appropriate `maxWaitMs` for polling (default: 10 min)
4. **Clean up** - Delete videos after download to manage storage
5. **Use remixes** - Remix existing videos for variations (faster, cheaper)
6. **Monitor costs** - Track `seconds` × price per model
7. **Test with 4-second videos** - Minimize cost during development

### Files API

The Files API provides file management for OpenAI services with purpose-based access control and automatic expiration support.

#### Upload File

**Endpoint:** `POST /api/files`

**Content-Type:** `multipart/form-data`

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/files \
  -F "file=@document.pdf" \
  -F "purpose=assistants"
```

**With Expiration:**

```bash
curl -X POST http://localhost:3000/api/files \
  -F "file=@training-data.jsonl" \
  -F "purpose=fine-tune" \
  -F "expires_after[anchor]=created_at" \
  -F "expires_after[seconds]=86400"
```

**Example Response:**

```json
{
  "id": "file-abc123xyz789",
  "object": "file",
  "bytes": 1024567,
  "created_at": 1234567890,
  "filename": "document.pdf",
  "purpose": "assistants",
  "status": "processed",
  "status_details": null,
  "expires_at": null
}
```

**Parameters:**

| Parameter | Type | Description | Required | Options |
|-----------|------|-------------|----------|---------|
| `file` | File | File to upload (max 512 MB) | Yes | Binary data |
| `purpose` | string | File purpose for access control | Yes | `assistants`, `batch`, `fine-tune`, `user_data`, `evals` |
| `expires_after` | object | Expiration configuration | No | See below |
| `expires_after.anchor` | string | Expiration start point | Yes (if expires_after) | `created_at` |
| `expires_after.seconds` | number | Time until expiration (seconds) | Yes (if expires_after) | 3600-2592000 (1h-30d) |

**File Purposes:**

- `assistants` - Files for Assistant API (not downloadable via API)
- `batch` - Batch API input files (downloadable)
- `fine-tune` - Training data for fine-tuning (downloadable)
- `user_data` - User-uploaded data (downloadable)
- `evals` - Evaluation datasets (downloadable)

**File Status:**

- `uploaded` - File received, processing pending
- `processed` - File ready for use
- `error` - Processing failed (see `status_details`)

#### Supported File Formats

The Files API accepts a wide range of file formats for different purposes. Files can be used directly with Assistants API or analyzed with Code Interpreter.

**Data Files** (Analysis, Processing)

| Format | Extensions | Purpose | Max Size | Notes |
|--------|-----------|---------|----------|-------|
| CSV | `.csv` | batch, user_data, evals | 512 MB | Best for tabular data analysis |
| JSON | `.json` | batch, user_data, evals | 512 MB | Structured data, API responses |
| JSONL | `.jsonl` | batch, fine-tune, evals | 512 MB | Line-delimited JSON (required for batch/fine-tune) |
| Excel | `.xlsx`, `.xls` | user_data, evals | 512 MB | Spreadsheet data (analyzed via Code Interpreter) |
| Parquet | `.parquet` | user_data | 512 MB | Columnar data format |

**Documents** (Text Extraction, RAG)

| Format | Extensions | Purpose | Max Size | Notes |
|--------|-----------|---------|----------|-------|
| PDF | `.pdf` | assistants, user_data | 512 MB | Text extraction, document analysis |
| Plain Text | `.txt` | assistants, user_data | 512 MB | Raw text content |
| Markdown | `.md` | assistants, user_data | 512 MB | Formatted documentation |
| Word | `.docx` | assistants, user_data | 512 MB | Microsoft Word documents |

**Images** (Vision, OCR, Analysis)

| Format | Extensions | Purpose | Max Size | Notes |
|--------|-----------|---------|----------|-------|
| PNG | `.png` | user_data | 512 MB | Lossless images, screenshots |
| JPEG | `.jpg`, `.jpeg` | user_data | 512 MB | Compressed photos |
| GIF | `.gif` | user_data | 512 MB | Animated or static images |
| WebP | `.webp` | user_data | 512 MB | Modern image format |

**Audio/Video** (Transcription, Analysis)

| Format | Extensions | Purpose | Max Size | Notes |
|--------|-----------|---------|----------|-------|
| MP3 | `.mp3` | user_data | 512 MB | Audio transcription with Code Interpreter |
| WAV | `.wav` | user_data | 512 MB | Uncompressed audio |
| M4A | `.m4a` | user_data | 512 MB | AAC audio format |
| MP4 | `.mp4` | user_data | 512 MB | Video files (audio extraction) |

**Code Files** (Analysis, Documentation)

| Format | Extensions | Purpose | Max Size | Notes |
|--------|-----------|---------|----------|-------|
| Python | `.py` | user_data | 512 MB | Source code analysis |
| JavaScript | `.js`, `.ts` | user_data | 512 MB | JS/TS code analysis |
| Java | `.java` | user_data | 512 MB | Java source code |
| C/C++ | `.c`, `.cpp`, `.h` | user_data | 512 MB | C/C++ code |
| Other | `.go`, `.rs`, `.rb`, etc. | user_data | 512 MB | Most programming languages |

**Purpose-Specific Recommendations:**

- `assistants` - PDF, TXT, DOCX, MD (for RAG/knowledge retrieval)
- `batch` - JSONL only (structured batch requests)
- `fine-tune` - JSONL only (training data format)
- `user_data` - Any format (analyzed with Code Interpreter)
- `evals` - CSV, JSON, JSONL (evaluation datasets)

**Processing Notes:**

1. **Automatic Format Detection** - OpenAI detects format from file extension
2. **Binary Files** - Supported but may have limited text extraction
3. **Compressed Files** - ZIP/RAR not directly supported (extract first)
4. **Large Files** - Files > 512 MB require [Uploads API](https://platform.openai.com/docs/api-reference/uploads) (up to 8 GB)
5. **Special Characters** - Filenames with Unicode/special chars are supported

#### List Files

**Endpoint:** `GET /api/files`

**Example Requests:**

```bash
# List all files
curl http://localhost:3000/api/files

# Filter by purpose
curl "http://localhost:3000/api/files?purpose=assistants"

# With pagination and sorting
curl "http://localhost:3000/api/files?purpose=batch&order=asc&limit=20"
```

**Example Response:**

```json
[
  {
    "id": "file-abc123",
    "object": "file",
    "bytes": 512000,
    "created_at": 1234567890,
    "filename": "data.jsonl",
    "purpose": "batch",
    "status": "processed"
  },
  {
    "id": "file-def456",
    "object": "file",
    "bytes": 1024000,
    "created_at": 1234567800,
    "filename": "document.pdf",
    "purpose": "assistants",
    "status": "processed",
    "expires_at": 1234654290
  }
]
```

**Query Parameters:**

| Parameter | Type | Description | Options | Default |
|-----------|------|-------------|---------|---------|
| `purpose` | string | Filter by file purpose | See purposes above | None (all) |
| `order` | string | Sort order by `created_at` | `asc`, `desc` | `desc` |
| `limit` | number | Maximum files to return | 1-10000 | 10000 |

#### Get File Metadata

**Endpoint:** `GET /api/files/:id`

**Example Request:**

```bash
curl http://localhost:3000/api/files/file-abc123xyz789
```

**Example Response:**

```json
{
  "id": "file-abc123xyz789",
  "object": "file",
  "bytes": 2048576,
  "created_at": 1234567890,
  "filename": "training-data.jsonl",
  "purpose": "fine-tune",
  "status": "processed",
  "status_details": null,
  "expires_at": 1234654290
}
```

#### Download File

**Endpoint:** `GET /api/files/:id/download`

**Purpose Restrictions:** Files with `purpose=assistants` cannot be downloaded per OpenAI policy.

**Example Request:**

```bash
# Download file
curl http://localhost:3000/api/files/file-abc123/download \
  -o downloaded-file.jsonl
```

**Response Headers:**

```
Content-Type: application/x-ndjson
Content-Disposition: attachment; filename="file-abc123-content"
```

**Supported Content Types:**

| Extension | Content-Type |
|-----------|--------------|
| `.json`, `.jsonl` | application/json, application/x-ndjson |
| `.txt`, `.md` | text/plain, text/markdown |
| `.pdf` | application/pdf |
| `.png`, `.jpg`, `.jpeg` | image/png, image/jpeg |
| `.mp3`, `.mp4` | audio/mpeg, video/mp4 |

#### Binary Streaming Examples

The Files API implements binary streaming for efficient downloads of large files without loading entire content into memory.

##### Pattern 1: Node.js with Fetch API (Recommended)

**Stream to File:**

```javascript
import fetch from 'node-fetch';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

async function downloadFile(fileId, outputPath) {
  const response = await fetch(
    `http://localhost:3000/api/files/${fileId}/download`
  );

  if (!response.ok) {
    throw new Error(`Download failed: ${response.statusText}`);
  }

  // Stream directly to disk (no memory buffering)
  await pipeline(
    response.body,
    createWriteStream(outputPath)
  );

  console.log(`Downloaded to ${outputPath}`);
}

// Example: Download large video file
await downloadFile('file-abc123', './output/video.mp4');
```

**Stream with Progress Tracking:**

```javascript
async function downloadWithProgress(fileId, outputPath) {
  const response = await fetch(
    `http://localhost:3000/api/files/${fileId}/download`
  );

  if (!response.ok) {
    throw new Error(`Download failed: ${response.statusText}`);
  }

  const totalBytes = parseInt(response.headers.get('content-length'), 10);
  let downloadedBytes = 0;

  // Create transform stream for progress
  const progressStream = new Transform({
    transform(chunk, encoding, callback) {
      downloadedBytes += chunk.length;
      const progress = ((downloadedBytes / totalBytes) * 100).toFixed(2);
      process.stdout.write(`\rProgress: ${progress}%`);
      callback(null, chunk);
    },
  });

  await pipeline(
    response.body,
    progressStream,
    createWriteStream(outputPath)
  );

  console.log(`\nDownload complete: ${outputPath}`);
}
```

**Stream to Memory (Small Files Only):**

```javascript
async function downloadToBuffer(fileId) {
  const response = await fetch(
    `http://localhost:3000/api/files/${fileId}/download`
  );

  if (!response.ok) {
    throw new Error(`Download failed: ${response.statusText}`);
  }

  // For small files (< 100 MB), buffering is acceptable
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer);
}

// Example: Download image for processing
const imageBuffer = await downloadToBuffer('file-img789');
```

##### Pattern 2: Python with requests Library

**Stream to File:**

```python
import requests

def download_file(file_id, output_path):
    """Download file with streaming to avoid memory issues"""
    url = f'http://localhost:3000/api/files/{file_id}/download'

    with requests.get(url, stream=True) as response:
        response.raise_for_status()

        # Stream to disk in chunks (8KB at a time)
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

    print(f'Downloaded to {output_path}')

# Example: Download large dataset
download_file('file-abc123', 'dataset.parquet')
```

**Stream with Progress Bar:**

```python
import requests
from tqdm import tqdm

def download_with_progress(file_id, output_path):
    """Download with visual progress bar"""
    url = f'http://localhost:3000/api/files/{file_id}/download'

    with requests.get(url, stream=True) as response:
        response.raise_for_status()

        total_size = int(response.headers.get('content-length', 0))

        with open(output_path, 'wb') as f:
            with tqdm(total=total_size, unit='B', unit_scale=True) as pbar:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
                    pbar.update(len(chunk))

    print(f'Download complete: {output_path}')
```

##### Pattern 3: curl for Large Files

**Basic Streaming Download:**

```bash
# Stream 500MB file without loading into memory
curl -N http://localhost:3000/api/files/file-large123/download \
  -o large-dataset.csv

# Resume interrupted download (if server supports Range headers)
curl -N -C - http://localhost:3000/api/files/file-large123/download \
  -o large-dataset.csv
```

**Download with Progress Display:**

```bash
# Show progress bar with total size
curl -N --progress-bar \
  http://localhost:3000/api/files/file-abc123/download \
  -o output.mp4

# Detailed progress (speed, ETA, percentage)
curl -N http://localhost:3000/api/files/file-abc123/download \
  -o output.mp4 \
  --progress-bar
```

##### Streaming Best Practices

**Memory Optimization:**

| File Size | Recommendation | Pattern |
|-----------|---------------|---------|
| < 10 MB | Buffer in memory | `await response.arrayBuffer()` |
| 10-100 MB | Stream to disk | `pipeline(response.body, fileStream)` |
| > 100 MB | **Always stream** | Use chunked streaming with progress |
| > 500 MB | Stream + validate | Check hash/integrity after download |

**Error Handling:**

```javascript
async function safeDownload(fileId, outputPath) {
  const tempPath = `${outputPath}.tmp`;

  try {
    const response = await fetch(
      `http://localhost:3000/api/files/${fileId}/download`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`${error.code}: ${error.hint || error.message}`);
    }

    // Stream to temporary file first
    await pipeline(
      response.body,
      createWriteStream(tempPath)
    );

    // Atomically rename on success
    await rename(tempPath, outputPath);

  } catch (error) {
    // Cleanup failed download
    await unlink(tempPath).catch(() => {});
    throw error;
  }
}
```

**Concurrent Downloads (Parallel Streaming):**

```javascript
async function downloadMultiple(fileIds, outputDir) {
  const downloads = fileIds.map((fileId, index) =>
    downloadFile(fileId, `${outputDir}/file-${index}.dat`)
  );

  // Download up to 5 files concurrently
  const results = await Promise.allSettled(downloads);

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  console.log(`Downloaded ${succeeded}/${fileIds.length} files`);
}
```

**Streaming Validation:**

```javascript
import { createHash } from 'crypto';

async function downloadAndValidate(fileId, outputPath, expectedHash) {
  const response = await fetch(
    `http://localhost:3000/api/files/${fileId}/download`
  );

  if (!response.ok) {
    throw new Error(`Download failed: ${response.statusText}`);
  }

  // Stream with SHA-256 hashing
  const hash = createHash('sha256');
  const fileStream = createWriteStream(outputPath);

  const hashStream = new Transform({
    transform(chunk, encoding, callback) {
      hash.update(chunk);
      callback(null, chunk);
    },
  });

  await pipeline(
    response.body,
    hashStream,
    fileStream
  );

  const calculatedHash = hash.digest('hex');

  if (calculatedHash !== expectedHash) {
    await unlink(outputPath);
    throw new Error('Hash mismatch - file corrupted');
  }

  console.log('✓ Download validated successfully');
}
```

#### Delete File

**Endpoint:** `DELETE /api/files/:id`

**Example Request:**

```bash
curl -X DELETE http://localhost:3000/api/files/file-abc123
```

**Example Response:**

```json
{
  "id": "file-abc123",
  "object": "file",
  "deleted": true
}
```

#### Error Responses

**File Not Found (404):**

```json
{
  "statusCode": 404,
  "message": "File not found",
  "error": "Not Found",
  "code": "file_not_found",
  "hint": "The file ID does not exist or has been deleted. Verify the file ID is correct.",
  "timestamp": "2025-01-22T12:00:00.000Z",
  "path": "/api/files/file-invalid"
}
```

**Download Forbidden (403):**

```json
{
  "statusCode": 403,
  "message": "File download not allowed",
  "error": "Forbidden",
  "code": "download_forbidden",
  "hint": "Files with purpose 'assistants' cannot be downloaded via API due to OpenAI policy restrictions.",
  "timestamp": "2025-01-22T12:00:00.000Z",
  "path": "/api/files/file-abc123/download"
}
```

**File Too Large (413):**

```json
{
  "statusCode": 413,
  "message": "File exceeds maximum size limit",
  "error": "Payload Too Large",
  "code": "file_too_large",
  "hint": "File must be under 512 MB for standard API. Use Uploads API for files up to 8 GB, or reduce file size.",
  "timestamp": "2025-01-22T12:00:00.000Z",
  "path": "/api/files"
}
```

#### Best Practices

1. **Choose correct purpose** - Purpose determines download permissions and file lifecycle
2. **Set appropriate expiration** - Use `expires_after` for temporary files (default: no expiration)
3. **Check processing status** - Verify `status=processed` before using files
4. **Handle download restrictions** - Assistants files cannot be downloaded via API
5. **Monitor storage** - Delete files after use to manage organization quota
6. **Use proper file formats** - JSONL for batch/fine-tune, PDF/TXT for assistants
7. **Validate file sizes** - Keep files under 512 MB for standard API

### Vector Stores API

The Vector Stores API provides file indexing and semantic search capabilities for Retrieval-Augmented Generation (RAG) workflows. Vector stores enable AI models to search through large document collections using natural language queries.

**Key Features:**
- Create searchable indexes from uploaded files
- Automatic text chunking with configurable strategies
- Semantic search with ranking and filtering
- Batch file operations (up to 500 files at once)
- Async polling for indexing completion
- Integration with file_search tool in Responses API

#### Create Vector Store

**Endpoint:** `POST /api/vector-stores`

**Example Requests:**

```bash
# Minimal - create empty vector store
curl -X POST http://localhost:3000/api/vector-stores \
  -H "Content-Type: application/json" \
  -d '{}'

# With name and files
curl -X POST http://localhost:3000/api/vector-stores \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Product Documentation",
    "file_ids": ["file-abc123", "file-def456"]
  }'

# With static chunking strategy
curl -X POST http://localhost:3000/api/vector-stores \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Technical Docs",
    "file_ids": ["file-abc123"],
    "chunking_strategy": {
      "type": "static",
      "static": {
        "max_chunk_size_tokens": 800,
        "chunk_overlap_tokens": 400
      }
    }
  }'

# With expiration and metadata
curl -X POST http://localhost:3000/api/vector-stores \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Temporary Knowledge Base",
    "file_ids": ["file-abc123"],
    "expires_after": {
      "anchor": "last_active_at",
      "days": 7
    },
    "metadata": {
      "project": "acme-corp",
      "environment": "production"
    }
  }'
```

**Example Response:**

```json
{
  "id": "vs_abc123",
  "object": "vector_store",
  "created_at": 1234567890,
  "name": "Product Documentation",
  "usage_bytes": 0,
  "file_counts": {
    "in_progress": 2,
    "completed": 0,
    "failed": 0,
    "cancelled": 0,
    "total": 2
  },
  "status": "in_progress",
  "expires_after": null,
  "expires_at": null,
  "last_active_at": 1234567890,
  "metadata": {}
}
```

**Parameters:**

| Parameter | Type | Description | Required | Options/Range |
|-----------|------|-------------|----------|---------------|
| `name` | string | Display name for vector store | No | Max 256 chars |
| `file_ids` | string[] | Files to attach on creation | No | Max 500 files |
| `chunking_strategy` | object | Text chunking configuration | No | See Chunking Strategies |
| `expires_after` | object | Auto-expiration config | No | See below |
| `expires_after.anchor` | string | Expiration start point | Yes (if expires_after) | `last_active_at` |
| `expires_after.days` | number | Days until expiration | Yes (if expires_after) | 1-365 |
| `metadata` | object | Custom key-value pairs | No | Max 16 keys, 64 chars each |
| `description` | string | Description of vector store | No | Max 512 chars |

**Vector Store Status:**

- `in_progress` - Files are being indexed
- `completed` - All files successfully indexed
- `expired` - Vector store has expired (see `expires_at`)

**File Counts Object:**

- `in_progress` - Files currently being indexed
- `completed` - Successfully indexed files
- `failed` - Files that failed indexing
- `cancelled` - Cancelled batch operations
- `total` - Total files in vector store

#### Chunking Strategies

Chunking strategies determine how documents are split into searchable chunks. Proper chunking improves search relevance and retrieval quality.

**Auto Chunking (Default):**

OpenAI automatically determines optimal chunk size based on document content.

```json
{
  "chunking_strategy": {
    "type": "auto"
  }
}
```

**Benefits:**
- No configuration needed
- Optimized for different file types
- Respects document structure (paragraphs, sections)

**Static Chunking:**

Manual control over chunk size and overlap for specialized use cases.

```json
{
  "chunking_strategy": {
    "type": "static",
    "static": {
      "max_chunk_size_tokens": 800,
      "chunk_overlap_tokens": 400
    }
  }
}
```

**Parameters:**

| Parameter | Type | Range | Description |
|-----------|------|-------|-------------|
| `max_chunk_size_tokens` | number | 100-4096 | Maximum tokens per chunk |
| `chunk_overlap_tokens` | number | 0 to max/2 | Overlap between chunks (improves context) |

**Validation Rules:**
- `max_chunk_size_tokens` must be between 100 and 4096
- `chunk_overlap_tokens` cannot exceed half of `max_chunk_size_tokens`
- Example: If `max_chunk_size_tokens=800`, then `chunk_overlap_tokens` max is 400

**Best Practices:**
1. Use **auto** for most use cases - optimized by OpenAI
2. Use **static** for specialized domains requiring consistent chunk sizes
3. Larger chunks (800-4096 tokens) - Better context, fewer chunks
4. Smaller chunks (100-400 tokens) - More granular search, more chunks
5. Add overlap (200-400 tokens) - Prevents context loss at chunk boundaries

#### Retrieve Vector Store

**Endpoint:** `GET /api/vector-stores/:vectorStoreId`

**Example Request:**

```bash
curl http://localhost:3000/api/vector-stores/vs_abc123
```

**Example Response:**

```json
{
  "id": "vs_abc123",
  "object": "vector_store",
  "created_at": 1234567890,
  "name": "Product Documentation",
  "usage_bytes": 2048576,
  "file_counts": {
    "in_progress": 0,
    "completed": 2,
    "failed": 0,
    "cancelled": 0,
    "total": 2
  },
  "status": "completed",
  "expires_after": {
    "anchor": "last_active_at",
    "days": 7
  },
  "expires_at": 1235172690,
  "last_active_at": 1234567890,
  "metadata": {
    "project": "acme-corp"
  }
}
```

#### Update Vector Store

**Endpoint:** `PATCH /api/vector-stores/:vectorStoreId`

**Example Request:**

```bash
curl -X PATCH http://localhost:3000/api/vector-stores/vs_abc123 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Documentation",
    "metadata": {
      "version": "2.0",
      "updated_by": "admin"
    }
  }'
```

**Updatable Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string \| null | Update name or set to null |
| `expires_after` | object \| null | Update expiration or set to null |
| `metadata` | object \| null | Replace all metadata or set to null |

#### List Vector Stores

**Endpoint:** `GET /api/vector-stores`

**Example Requests:**

```bash
# List all vector stores
curl http://localhost:3000/api/vector-stores

# With pagination and sorting
curl "http://localhost:3000/api/vector-stores?limit=20&order=desc"

# Cursor-based pagination
curl "http://localhost:3000/api/vector-stores?after=vs_abc123&limit=10"
```

**Example Response:**

```json
[
  {
    "id": "vs_abc123",
    "object": "vector_store",
    "name": "Product Documentation",
    "status": "completed",
    "file_counts": { "total": 5, "completed": 5 }
  },
  {
    "id": "vs_def456",
    "object": "vector_store",
    "name": "Customer Support KB",
    "status": "in_progress",
    "file_counts": { "total": 10, "in_progress": 3, "completed": 7 }
  }
]
```

**Query Parameters:**

| Parameter | Type | Description | Options | Default |
|-----------|------|-------------|---------|---------|
| `limit` | number | Max results to return | 1-100 | 20 |
| `order` | string | Sort order by `created_at` | `asc`, `desc` | `desc` |
| `after` | string | Cursor for next page | Vector store ID | None |
| `before` | string | Cursor for previous page | Vector store ID | None |

#### Delete Vector Store

**Endpoint:** `DELETE /api/vector-stores/:vectorStoreId`

**Example Request:**

```bash
curl -X DELETE http://localhost:3000/api/vector-stores/vs_abc123
```

**Example Response:**

```json
{
  "id": "vs_abc123",
  "object": "vector_store.deleted",
  "deleted": true
}
```

**Notes:**
- Deletes the vector store and all file associations
- Does NOT delete the original files (use Files API to delete files)
- Irreversible operation

#### Search Vector Store

**Endpoint:** `POST /api/vector-stores/:vectorStoreId/search`

**Example Requests:**

```bash
# Basic search
curl -X POST http://localhost:3000/api/vector-stores/vs_abc123/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How do I reset my password?"
  }'

# Advanced search with ranking
curl -X POST http://localhost:3000/api/vector-stores/vs_abc123/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "API authentication",
    "max_num_results": 5,
    "ranking_options": {
      "ranker": "default-2024-11-15",
      "score_threshold": 0.7
    }
  }'

# Multi-query search
curl -X POST http://localhost:3000/api/vector-stores/vs_abc123/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": ["authentication", "authorization", "OAuth"],
    "max_num_results": 10
  }'

# Search with filters
curl -X POST http://localhost:3000/api/vector-stores/vs_abc123/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "product features",
    "filters": {
      "file_id": ["file-abc123", "file-def456"]
    },
    "rewrite_query": true
  }'
```

**Example Response:**

```json
[
  {
    "id": "chunk_abc123",
    "content": "To reset your password, navigate to Settings > Security...",
    "score": 0.95,
    "file_id": "file-abc123",
    "metadata": {
      "file_name": "user-guide.pdf",
      "page": 42
    }
  },
  {
    "id": "chunk_def456",
    "content": "Password reset functionality is available in the...",
    "score": 0.87,
    "file_id": "file-def456",
    "metadata": {
      "file_name": "faq.txt"
    }
  }
]
```

**Parameters:**

| Parameter | Type | Description | Required | Default |
|-----------|------|-------------|----------|---------|
| `query` | string \| string[] | Search query (single or multiple) | Yes | - |
| `max_num_results` | number | Max results to return | No | 20 |
| `ranking_options` | object | Ranking configuration | No | - |
| `ranking_options.ranker` | string | Ranking algorithm | No | `auto` |
| `ranking_options.score_threshold` | number | Minimum score (0-1) | No | 0 |
| `filters` | object | Filter search scope | No | - |
| `filters.file_id` | string[] | Limit to specific files | No | All files |
| `rewrite_query` | boolean | Auto-optimize query | No | `false` |

**Ranking Options:**

- `ranker: "auto"` - OpenAI selects best ranker
- `ranker: "default-2024-11-15"` - Specific ranker version
- `score_threshold: 0.7` - Only return results with score ≥ 0.7

**Search Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Chunk ID |
| `content` | string | Matched text content |
| `score` | number | Relevance score (0-1) |
| `file_id` | string | Source file ID |
| `metadata` | object | File metadata (name, page, etc.) |

#### Add File to Vector Store

**Endpoint:** `POST /api/vector-stores/:vectorStoreId/files`

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/vector-stores/vs_abc123/files \
  -H "Content-Type: application/json" \
  -d '{
    "file_id": "file-abc123",
    "chunking_strategy": {
      "type": "auto"
    }
  }'
```

**Example Response:**

```json
{
  "id": "file-abc123",
  "object": "vector_store.file",
  "usage_bytes": 512000,
  "created_at": 1234567890,
  "vector_store_id": "vs_abc123",
  "status": "in_progress",
  "last_error": null,
  "chunking_strategy": {
    "type": "auto"
  }
}
```

**Parameters:**

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| `file_id` | string | File ID to attach | Yes |
| `chunking_strategy` | object | Override default chunking | No |
| `attributes` | object | Custom attributes | No |

**File Status:**

- `in_progress` - Currently indexing
- `completed` - Successfully indexed
- `failed` - Indexing failed (see `last_error`)
- `cancelled` - Operation cancelled

#### List Files in Vector Store

**Endpoint:** `GET /api/vector-stores/:vectorStoreId/files`

**Example Requests:**

```bash
# List all files
curl http://localhost:3000/api/vector-stores/vs_abc123/files

# Filter by status
curl "http://localhost:3000/api/vector-stores/vs_abc123/files?filter=completed"

# With pagination
curl "http://localhost:3000/api/vector-stores/vs_abc123/files?limit=20&order=asc"
```

**Query Parameters:**

| Parameter | Type | Options | Description |
|-----------|------|---------|-------------|
| `limit` | number | 1-100 | Max results to return |
| `order` | string | `asc`, `desc` | Sort by `created_at` |
| `after` | string | File ID | Cursor for next page |
| `before` | string | File ID | Cursor for previous page |
| `filter` | string | `in_progress`, `completed`, `failed`, `cancelled` | Filter by status |

#### Get File from Vector Store

**Endpoint:** `GET /api/vector-stores/:vectorStoreId/files/:fileId`

**Example Request:**

```bash
curl http://localhost:3000/api/vector-stores/vs_abc123/files/file-abc123
```

#### Update File Attributes

**Endpoint:** `PATCH /api/vector-stores/:vectorStoreId/files/:fileId`

**Example Request:**

```bash
curl -X PATCH http://localhost:3000/api/vector-stores/vs_abc123/files/file-abc123 \
  -H "Content-Type: application/json" \
  -d '{
    "attributes": {
      "priority": "high",
      "category": "technical"
    }
  }'
```

#### Remove File from Vector Store

**Endpoint:** `DELETE /api/vector-stores/:vectorStoreId/files/:fileId`

**Example Request:**

```bash
curl -X DELETE http://localhost:3000/api/vector-stores/vs_abc123/files/file-abc123
```

**Example Response:**

```json
{
  "id": "file-abc123",
  "object": "vector_store.file.deleted",
  "deleted": true
}
```

**Notes:**
- Removes file from vector store only
- Does NOT delete the original file (use Files API to delete file)

#### Get File Content Chunks

**Endpoint:** `GET /api/vector-stores/:vectorStoreId/files/:fileId/content`

**Example Request:**

```bash
curl http://localhost:3000/api/vector-stores/vs_abc123/files/file-abc123/content
```

**Example Response:**

```json
[
  {
    "id": "chunk_abc123",
    "content": "Introduction to API authentication...",
    "start_offset": 0,
    "end_offset": 512,
    "metadata": {
      "chunk_index": 0,
      "total_chunks": 10
    }
  },
  {
    "id": "chunk_abc124",
    "content": "OAuth 2.0 provides secure authentication...",
    "start_offset": 312,
    "end_offset": 824,
    "metadata": {
      "chunk_index": 1,
      "total_chunks": 10
    }
  }
]
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique chunk ID |
| `content` | string | Text content of chunk |
| `start_offset` | number | Character offset in original file |
| `end_offset` | number | End character offset |
| `metadata` | object | Chunk position info |

#### Create File Batch

**Endpoint:** `POST /api/vector-stores/:vectorStoreId/file_batches`

Add multiple files to a vector store in a single operation. More efficient than adding files individually.

**Example Requests:**

```bash
# Batch add existing files
curl -X POST http://localhost:3000/api/vector-stores/vs_abc123/file_batches \
  -H "Content-Type: application/json" \
  -d '{
    "file_ids": ["file-abc123", "file-def456", "file-ghi789"]
  }'

# Batch with new file specifications
curl -X POST http://localhost:3000/api/vector-stores/vs_abc123/file_batches \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {
        "file_id": "file-abc123",
        "chunking_strategy": { "type": "auto" }
      },
      {
        "file_id": "file-def456",
        "chunking_strategy": {
          "type": "static",
          "static": {
            "max_chunk_size_tokens": 800,
            "chunk_overlap_tokens": 200
          }
        },
        "attributes": { "priority": "high" }
      }
    ]
  }'
```

**Example Response:**

```json
{
  "id": "vsfb_abc123",
  "object": "vector_store.file_batch",
  "created_at": 1234567890,
  "vector_store_id": "vs_abc123",
  "status": "in_progress",
  "file_counts": {
    "in_progress": 3,
    "completed": 0,
    "failed": 0,
    "cancelled": 0,
    "total": 3
  }
}
```

**Parameters:**

| Parameter | Type | Description | Max | Mutually Exclusive With |
|-----------|------|-------------|-----|------------------------|
| `file_ids` | string[] | Simple file ID list | 500 | `files` |
| `files` | object[] | File specs with config | 500 | `file_ids` |
| `files[].file_id` | string | File ID | - | Required if using `files` |
| `files[].chunking_strategy` | object | Per-file chunking | - | Optional |
| `files[].attributes` | object | Per-file attributes | - | Optional |
| `chunking_strategy` | object | Default for all files | - | Optional |
| `attributes` | object | Default for all files | - | Optional |

**Batch Limits:**
- Max 500 files per batch
- Use `file_ids` OR `files`, not both
- Batch processing is asynchronous - use polling endpoint

#### Get File Batch

**Endpoint:** `GET /api/vector-stores/:vectorStoreId/file_batches/:batchId`

**Example Request:**

```bash
curl http://localhost:3000/api/vector-stores/vs_abc123/file_batches/vsfb_abc123
```

**Example Response:**

```json
{
  "id": "vsfb_abc123",
  "object": "vector_store.file_batch",
  "created_at": 1234567890,
  "vector_store_id": "vs_abc123",
  "status": "completed",
  "file_counts": {
    "in_progress": 0,
    "completed": 3,
    "failed": 0,
    "cancelled": 0,
    "total": 3
  }
}
```

#### Cancel File Batch

**Endpoint:** `POST /api/vector-stores/:vectorStoreId/file_batches/:batchId/cancel`

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/vector-stores/vs_abc123/file_batches/vsfb_abc123/cancel
```

**Example Response:**

```json
{
  "id": "vsfb_abc123",
  "object": "vector_store.file_batch",
  "status": "cancelling",
  "file_counts": {
    "in_progress": 0,
    "completed": 5,
    "failed": 0,
    "cancelled": 2,
    "total": 7
  }
}
```

**Notes:**
- Only in-progress batches can be cancelled
- Already completed files remain in vector store
- Status transitions: `in_progress` → `cancelling` → `cancelled`

#### List Batch Files

**Endpoint:** `GET /api/vector-stores/:vectorStoreId/file_batches/:batchId/files`

**Example Request:**

```bash
curl "http://localhost:3000/api/vector-stores/vs_abc123/file_batches/vsfb_abc123/files?filter=completed"
```

**Query Parameters:** Same as List Files in Vector Store

#### Poll Vector Store Until Complete

**Endpoint:** `GET /api/vector-stores/:vectorStoreId/poll`

Polls the vector store status until all files are indexed or timeout is reached.

**Example Request:**

```bash
# Default timeout (30 seconds)
curl http://localhost:3000/api/vector-stores/vs_abc123/poll

# Custom timeout (60 seconds)
curl "http://localhost:3000/api/vector-stores/vs_abc123/poll?max_wait_ms=60000"
```

**Query Parameters:**

| Parameter | Type | Description | Default | Max |
|-----------|------|-------------|---------|-----|
| `max_wait_ms` | number | Max wait time (milliseconds) | 30000 | 600000 |

**Polling Strategy:**
- Initial wait: 5 seconds
- Exponential backoff: 5s → 10s → 15s → 20s (max)
- Returns when `status` is `completed` or `expired`
- Throws error on timeout

**Example Response:**

```json
{
  "id": "vs_abc123",
  "object": "vector_store",
  "status": "completed",
  "file_counts": {
    "in_progress": 0,
    "completed": 5,
    "failed": 0,
    "cancelled": 0,
    "total": 5
  }
}
```

#### Poll File Until Complete

**Endpoint:** `GET /api/vector-stores/:vectorStoreId/files/:fileId/poll`

**Example Request:**

```bash
curl "http://localhost:3000/api/vector-stores/vs_abc123/files/file-abc123/poll?max_wait_ms=30000"
```

#### Poll Batch Until Complete

**Endpoint:** `GET /api/vector-stores/:vectorStoreId/file_batches/:batchId/poll`

**Example Request:**

```bash
curl "http://localhost:3000/api/vector-stores/vs_abc123/file_batches/vsfb_abc123/poll?max_wait_ms=60000"
```

#### Error Responses

**Vector Store Not Found (404):**

```json
{
  "statusCode": 404,
  "message": "Vector store not found",
  "error": "Not Found",
  "code": "vector_store_not_found",
  "hint": "The vector store ID does not exist or has been deleted. Verify the ID is correct.",
  "timestamp": "2025-01-23T12:00:00.000Z",
  "path": "/api/vector-stores/vs_invalid"
}
```

**Invalid Chunking Strategy (400):**

```json
{
  "statusCode": 400,
  "message": "Invalid chunking strategy configuration",
  "error": "Bad Request",
  "code": "invalid_chunking_strategy",
  "hint": "max_chunk_size_tokens must be between 100 and 4096. chunk_overlap_tokens cannot exceed half of max_chunk_size_tokens.",
  "timestamp": "2025-01-23T12:00:00.000Z",
  "path": "/api/vector-stores"
}
```

**Batch Too Large (400):**

```json
{
  "statusCode": 400,
  "message": "File batch exceeds maximum size",
  "error": "Bad Request",
  "code": "batch_too_large",
  "hint": "Batch operations support a maximum of 500 files. Split your request into multiple batches.",
  "timestamp": "2025-01-23T12:00:00.000Z",
  "path": "/api/vector-stores/vs_abc123/file_batches"
}
```

**Search Failed (500):**

```json
{
  "statusCode": 500,
  "message": "Vector store search operation failed",
  "error": "Internal Server Error",
  "code": "search_failed",
  "hint": "The search query could not be processed. Verify the vector store has indexed files and try again.",
  "timestamp": "2025-01-23T12:00:00.000Z",
  "path": "/api/vector-stores/vs_abc123/search"
}
```

#### Best Practices

1. **Chunking Strategy Selection**
   - Use `auto` for general use cases - OpenAI optimizes automatically
   - Use `static` only for specialized domains requiring consistent chunk sizes
   - Test different chunk sizes to find optimal retrieval quality

2. **Batch Operations**
   - Add multiple files using batch endpoint (more efficient than individual adds)
   - Monitor batch status with polling endpoint
   - Cancel long-running batches if needed

3. **Polling Strategy**
   - Use provided polling endpoints for automatic retry logic
   - Set appropriate timeouts based on file count and size
   - Exponential backoff prevents rate limiting

4. **Search Optimization**
   - Set `max_num_results` based on use case (default: 20)
   - Use `score_threshold` to filter low-quality results (recommended: 0.7-0.9)
   - Enable `rewrite_query` for natural language queries
   - Use `filters.file_id` to limit search scope

5. **Lifecycle Management**
   - Set `expires_after` for temporary vector stores
   - Delete unused vector stores to manage quota
   - Monitor `usage_bytes` for storage tracking

6. **File Management**
   - Upload files via Files API first
   - Verify file status before attaching to vector store
   - Use appropriate file formats (PDF, TXT, DOCX, MD for RAG)

7. **Integration with Responses API**
   - Use `vector_store_ids` in file_search tool configuration
   - Enable `include: ['file_search_call.results']` for result details
   - Combine with other tools (code_interpreter, web_search)

#### RAG Workflow Example

Complete workflow demonstrating file upload, vector store creation, indexing, and search integration with Responses API.

**Step 1: Upload Files**

```bash
# Upload product documentation
curl -X POST http://localhost:3000/api/files \
  -F "file=@product-guide.pdf" \
  -F "purpose=assistants"
# Response: { "id": "file-abc123", ... }

curl -X POST http://localhost:3000/api/files \
  -F "file=@faq.txt" \
  -F "purpose=assistants"
# Response: { "id": "file-def456", ... }
```

**Step 2: Create Vector Store**

```bash
curl -X POST http://localhost:3000/api/vector-stores \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Product Knowledge Base",
    "file_ids": ["file-abc123", "file-def456"],
    "chunking_strategy": { "type": "auto" }
  }'
# Response: { "id": "vs_abc123", "status": "in_progress", ... }
```

**Step 3: Poll Until Indexing Complete**

```bash
curl "http://localhost:3000/api/vector-stores/vs_abc123/poll?max_wait_ms=60000"
# Response: { "id": "vs_abc123", "status": "completed", ... }
```

**Step 4: Test Search**

```bash
curl -X POST http://localhost:3000/api/vector-stores/vs_abc123/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How do I reset my password?",
    "max_num_results": 3
  }'
# Response: [ { "content": "To reset your password...", "score": 0.95 }, ... ]
```

**Step 5: Use with Responses API**

```bash
curl -X POST http://localhost:3000/api/responses/text \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "input": "How do I reset my password?",
    "tools": [{
      "type": "file_search",
      "vector_store_ids": ["vs_abc123"]
    }],
    "include": ["file_search_call.results"]
  }'
```

**Response includes:**
- AI-generated answer based on retrieved content
- Source citations from vector store
- file_search tool call results with matched chunks

### Complete Workflow: File Upload + AI Analysis

This example demonstrates the end-to-end workflow of uploading a data file and analyzing it with AI using Code Interpreter.

#### Scenario: Analyze Sales Data CSV

**Step 1: Upload File (Files API)**

```bash
# Upload your CSV file
curl -X POST http://localhost:3000/api/files \
  -F "file=@quarterly_sales.csv" \
  -F "purpose=user_data"
```

**Response:**

```json
{
  "id": "file-abc123xyz789",
  "object": "file",
  "bytes": 45678,
  "created_at": 1234567890,
  "filename": "quarterly_sales.csv",
  "purpose": "user_data",
  "status": "processed"
}
```

**Step 2: Analyze with Code Interpreter (Responses API)**

```bash
# Analyze the uploaded file
curl -X POST http://localhost:3000/api/responses/text \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "input": "Analyze quarterly_sales.csv and provide:\n1. Total revenue by region\n2. Top 5 products by sales\n3. Month-over-month growth trend\n4. Create a bar chart showing revenue by region",
    "tools": [
      {
        "type": "code_interpreter",
        "container": {
          "type": "auto",
          "file_ids": ["file-abc123xyz789"]
        }
      }
    ],
    "include": ["code_interpreter_call.outputs"]
  }'
```

**Response:**

```json
{
  "id": "resp_xyz789",
  "object": "response",
  "model": "gpt-4o",
  "output_text": "Based on the analysis of quarterly_sales.csv:\n\n**1. Total Revenue by Region:**\n- North America: $2,450,000 (45%)\n- Europe: $1,890,000 (35%)\n- Asia Pacific: $1,080,000 (20%)\n\n**2. Top 5 Products by Sales:**\n1. Widget Pro - $987,000\n2. Gadget Plus - $756,000\n3. Device Ultra - $543,000\n4. Tool Master - $432,000\n5. Kit Premium - $321,000\n\n**3. Month-over-Month Growth:**\n- Q1: Baseline\n- Q2: +15% growth\n- Q3: +23% growth\n- Q4: +18% growth\n\nI've created a bar chart showing revenue distribution by region (see attached image).",
  "tool_calls": [
    {
      "id": "call_abc123",
      "type": "code_interpreter",
      "container_id": "container_def456",
      "code": "import pandas as pd\nimport matplotlib.pyplot as plt\n\n# Load CSV\ndf = pd.read_csv('quarterly_sales.csv')\n\n# Calculate revenue by region\nrevenue_by_region = df.groupby('region')['revenue'].sum()\n\n# Create bar chart\nplt.figure(figsize=(10, 6))\nrevenue_by_region.plot(kind='bar')\nplt.title('Revenue by Region')\nplt.xlabel('Region')\nplt.ylabel('Revenue ($)')\nplt.tight_layout()\nplt.savefig('revenue_chart.png')\n\nprint(f\"Total Revenue: ${df['revenue'].sum():,.2f}\")\nprint(f\"\\nTop 5 Products:\\n{df.groupby('product')['revenue'].sum().sort_values(ascending=False).head()}\")",
      "outputs": [
        {
          "type": "logs",
          "logs": "Total Revenue: $5,420,000.00\n\nTop 5 Products:\nproduct\nWidget Pro      987000.0\nGadget Plus     756000.0\nDevice Ultra    543000.0\nTool Master     432000.0\nKit Premium     321000.0\nName: revenue, dtype: float64"
        },
        {
          "type": "image",
          "image": "iVBORw0KGgoAAAANSUhEUgAAA..."
        }
      ]
    }
  ],
  "usage": {
    "input_tokens": 1250,
    "output_tokens": 420,
    "total_tokens": 1670
  }
}
```

**Step 3: Ask Follow-up Questions (Reuse Container)**

```bash
# Continue analysis in the same container (saves $0.03)
curl -X POST http://localhost:3000/api/responses/text \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "input": "Now predict next quarter revenue using linear regression on the growth trend",
    "tools": [
      {
        "type": "code_interpreter",
        "container": "container_def456"
      }
    ],
    "include": ["code_interpreter_call.outputs"]
  }'
```

**Response:**

```json
{
  "id": "resp_follow123",
  "output_text": "Based on linear regression analysis of the growth trend:\n\n**Q1 Next Year Predicted Revenue:** $6,397,600\n\nThis represents a projected 18% growth from Q4, consistent with the observed trend. The regression model has an R² of 0.94, indicating strong predictive confidence.\n\nKey factors:\n- Average quarterly growth: 18.7%\n- Seasonality adjusted\n- 95% confidence interval: $6,140,000 - $6,655,000",
  "tool_calls": [
    {
      "type": "code_interpreter",
      "container_id": "container_def456",
      "code": "from sklearn.linear_model import LinearRegression\nimport numpy as np\n\n# Prepare data\nquarters = np.array([1, 2, 3, 4]).reshape(-1, 1)\nrevenue = np.array([5420000, 6233000, 7666590, 9046776])\n\n# Train model\nmodel = LinearRegression()\nmodel.fit(quarters, revenue)\n\n# Predict next quarter\nnext_quarter = np.array([[5]])\npredicted = model.predict(next_quarter)[0]\n\nprint(f\"Predicted Q1 Revenue: ${predicted:,.2f}\")\nprint(f\"Growth from Q4: {((predicted / revenue[-1]) - 1) * 100:.1f}%\")\nprint(f\"R² Score: {model.score(quarters, revenue):.2f}\")",
      "outputs": [
        {
          "type": "logs",
          "logs": "Predicted Q1 Revenue: $6,397,600.00\nGrowth from Q4: 18.2%\nR² Score: 0.94"
        }
      ]
    }
  ]
}
```

#### Workflow Summary

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Upload File (Files API)                                 │
│    POST /api/files                                          │
│    → Returns: file_id                                       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Analyze with Code Interpreter (Responses API)           │
│    POST /api/responses/text                                 │
│    • Include file_id in tools[].container.file_ids          │
│    • Model loads file in Python sandbox                     │
│    • Returns: analysis + charts + container_id              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Follow-up Questions (Reuse Container)                   │
│    POST /api/responses/text                                 │
│    • Use same container_id (data still loaded)              │
│    • Save $0.03 per request                                 │
│    • Ask multiple questions about same file                 │
└─────────────────────────────────────────────────────────────┘
```

#### Cost Breakdown

| Action | Cost | Notes |
|--------|------|-------|
| File Upload | Free | Storage costs may apply |
| Container Creation | $0.03 | First Code Interpreter request |
| Container Reuse | Free | Same container within 1-hour session |
| Model Tokens | Variable | Based on gpt-4o pricing (~$2.50/1M input) |

**Example Total Cost:**
- Upload: $0.00
- Analysis (1,250 input + 420 output tokens): ~$0.01
- Container: $0.03
- Follow-up (500 input + 200 output tokens): ~$0.003
- **Total: ~$0.043**

#### Supported Analysis Types

With uploaded files and Code Interpreter, you can:

- **Data Analysis** - Statistics, aggregations, correlations
- **Visualizations** - Charts, graphs, heatmaps (matplotlib, seaborn)
- **Machine Learning** - Predictions, clustering, classification (scikit-learn)
- **Text Processing** - NLP, sentiment analysis, extraction
- **Image Analysis** - OCR, computer vision, transformations
- **Audio Processing** - Transcription, analysis, waveform visualization
- **Code Review** - Static analysis, complexity metrics, documentation

#### Python Libraries Available

Code Interpreter sandboxes include:
- **Data:** pandas, numpy, scipy
- **Visualization:** matplotlib, seaborn, plotly
- **ML:** scikit-learn, xgboost
- **NLP:** nltk, spacy
- **Image:** PIL, opencv
- **Audio:** librosa, pydub
- **Web:** requests, beautifulsoup4

## Core Components

### OpenAI Responses Service (Orchestrator)

**File:** [src/openai/services/openai-responses.service.ts](src/openai/services/openai-responses.service.ts)
**Size:** ~860 lines

**Purpose:** Orchestrates all OpenAI Responses API interactions and delegates streaming event handling to specialized handler services.

**Key Methods:**

| Method | Return Type | Description |
|--------|-------------|-------------|
| `createTextResponse(dto)` | `Promise<Responses.Response>` | Non-streaming text generation |
| `createTextResponseStream(dto)` | `AsyncIterable<SSEEvent>` | Streaming text with SSE |
| `createImageResponse(dto)` | `Promise<Responses.Response>` | Image generation via gpt-image-1 |
| `createImageResponseStream(dto)` | `AsyncIterable<SSEEvent>` | Image with progressive rendering |
| `retrieve(id)` | `Promise<Responses.Response>` | Get stored response |
| `delete(id)` | `Promise<Responses.DeletedResponse>` | Delete response |
| `cancel(id)` | `Promise<Responses.Response>` | Cancel background response |
| `resumeResponseStream(id)` | `AsyncIterable<SSEEvent>` | Resume interrupted stream |

**Utility Methods:**
- `extractUsage()` - Extract token counts, caching, reasoning tokens
- `estimateCost()` - Calculate cost based on token usage
- `extractResponseMetadata()` - Extract status, error, optimization params

**Type Safety:**
- Uses official OpenAI SDK types (`Responses.Response`, `ResponseCreateParams`)
- No `any` types
- Custom type guards for safe error handling

### Streaming Handler Services

9 specialized services handle 51 event types:

#### 1. Lifecycle Events Handler
**File:** [src/openai/services/handlers/lifecycle-events.handler.ts](src/openai/services/handlers/lifecycle-events.handler.ts)

**Events:** `response.created`, `queued`, `in_progress`, `completed`, `incomplete`, `failed`, `error`

**Purpose:** Manages response lifecycle from initialization to completion, extracting usage stats and final metadata.

#### 2. Text Events Handler
**File:** [src/openai/services/handlers/text-events.handler.ts](src/openai/services/handlers/text-events.handler.ts)

**Events:** `output_text.delta`, `done`, `annotation.added`

**Purpose:** Streams incremental text chunks, accumulates full text in state, handles annotations.

#### 3. Reasoning Events Handler
**File:** [src/openai/services/handlers/reasoning-events.handler.ts](src/openai/services/handlers/reasoning-events.handler.ts)

**Events:** `reasoning_text.delta/done`, `reasoning_summary_part.added/done`, `reasoning_summary_text.delta/done`

**Purpose:** Handles o-series model (o1, o3, gpt-5) reasoning tokens and summaries for cost tracking.

#### 4. Tool Calling Events Handler
**File:** [src/openai/services/handlers/tool-calling-events.handler.ts](src/openai/services/handlers/tool-calling-events.handler.ts)

**Events:** Function calls, code interpreter, file/web search, custom tools (15 total)

**Purpose:** Manages all tool execution workflows, tracks call state by `call_id`, logs execution results.

#### 5. Image Events Handler
**File:** [src/openai/services/handlers/image-events.handler.ts](src/openai/services/handlers/image-events.handler.ts)

**Events:** `image_generation_call.in_progress`, `generating`, `partial_image`, `completed`

**Purpose:** Streams base64-encoded partial images for progressive rendering (0-3 partials).

#### 6. Audio Events Handler
**File:** [src/openai/services/handlers/audio-events.handler.ts](src/openai/services/handlers/audio-events.handler.ts)

**Events:** `audio.delta/done`, `audio.transcript.delta/done`

**Purpose:** Handles TTS/voice output with synchronized audio chunks and transcripts.

#### 7. MCP Events Handler
**File:** [src/openai/services/handlers/mcp-events.handler.ts](src/openai/services/handlers/mcp-events.handler.ts)

**Events:** MCP call lifecycle (5), tool listing (3)

**Purpose:** Manages Model Context Protocol events for tool discovery and execution.

#### 8. Refusal Events Handler
**File:** [src/openai/services/handlers/refusal-events.handler.ts](src/openai/services/handlers/refusal-events.handler.ts)

**Events:** `refusal.delta/done`

**Purpose:** Handles model refusals for content policy violations, provides user-friendly messages.

#### 9. Structural Events Handler
**File:** [src/openai/services/handlers/structural-events.handler.ts](src/openai/services/handlers/structural-events.handler.ts)

**Events:** `output_item.added/done`, `content_part.added/done`, unknown events

**Purpose:** Tracks message structure boundaries and handles unrecognized event types for investigation.

### Logger Service

**File:** [src/common/services/logger.service.ts](src/common/services/logger.service.ts)

**Purpose:** Structured JSON logging to files organized by date and API type.

**Methods:**
- `logOpenAIInteraction(entry)` - Logs full request/response to `logs/YYYY-MM-DD/{api}.log`
- `logStreamingEvent(entry)` - Logs individual SSE events with sequence numbers

**Log Structure:**

```
logs/
├── 2025-11-12/
│   ├── responses.log    # All Responses API calls
│   ├── images.log       # All Images API calls
│   └── videos.log       # All Videos API calls
```

**Log Entry Format:**

```json
{
  "timestamp": "2025-11-12T10:30:00.000Z",
  "api": "responses",
  "endpoint": "/v1/responses",
  "request": { ... },
  "response": { ... },
  "metadata": {
    "latency_ms": 1234,
    "tokens_used": 150,
    "cached_tokens": 20,
    "reasoning_tokens": 35,
    "cost_estimate": 0.003,
    "rate_limit_headers": {},
    "response_status": "completed",
    "conversation": { "id": "conv_abc123" },
    "service_tier": "auto",
    "safety_identifier": "hashed-user-id"
  }
}
```

### Interceptors

#### Logging Interceptor
**File:** [src/common/interceptors/logging.interceptor.ts](src/common/interceptors/logging.interceptor.ts)

**Purpose:** Automatically logs all OpenAI API requests/responses.

**Features:**
- Applied globally to all endpoints
- Extracts API type from URL (responses/images/videos)
- Skips logging for streaming endpoints (handlers log events)
- Captures request body, response, latency
- Estimates cost based on token usage
- Uses RxJS tap/catchError operators

**Application:**
```typescript
@UseInterceptors(LoggingInterceptor)
export class ResponsesController { ... }
```

#### Retry Interceptor
**File:** [src/common/interceptors/retry.interceptor.ts](src/common/interceptors/retry.interceptor.ts)

**Purpose:** Automatic retry with exponential backoff for transient failures.

**Configuration:**
- Max retries: 3
- Base delay: 1000ms
- Max delay: 10000ms
- Exponential backoff: `min(maxDelay, baseDelay * 2^retryCount) + jitter`
- Jitter: 0-20% to avoid thundering herd

**Retryable Errors:**
- 429 (Rate Limit)
- 5xx (Server Errors)
- Network errors (ECONNRESET, ETIMEDOUT, ECONNREFUSED, ENETUNREACH, ENOTFOUND)

**Non-Retryable Errors:**
- 4xx (except 429) - Client errors requiring user action

### Filters

#### OpenAI Exception Filter
**File:** [src/common/filters/openai-exception.filter.ts](src/common/filters/openai-exception.filter.ts)

**Purpose:** Production-grade error handling with actionable messages.

**Error Detection Strategy:** Uses OpenAI SDK `instanceof` checks for reliable type detection.

**Supported Error Types:**
- `OpenAI.RateLimitError` (429) - Extracts `Retry-After` header
- `OpenAI.AuthenticationError` (401) - Invalid API key
- `OpenAI.PermissionDeniedError` (403) - Resource access denied
- `OpenAI.NotFoundError` (404) - Resource not found
- `OpenAI.BadRequestError` (400) - Routes to 15 image-specific error codes
- `OpenAI.InternalServerError` (5xx) - OpenAI server errors
- `OpenAI.APIConnectionTimeoutError` - Request timeout
- Network errors (ECONNREFUSED, ETIMEDOUT, etc.)

**Image-Specific Error Codes (15):**
- Format: `invalid_image`, `invalid_image_format`, `invalid_base64_image`, `invalid_image_url`
- Size: `image_too_large`, `image_too_small`, `image_file_too_large`, `empty_image_file`
- Content: `image_content_policy_violation`, `failed_to_download_image`, `image_file_not_found`
- Parse: `image_parse_error`, `invalid_image_mode`, `unsupported_image_media_type`
- Other: `vector_store_timeout`

**Error Response Structure:**

```json
{
  "statusCode": 400,
  "timestamp": "2025-11-12T12:00:00.000Z",
  "path": "/api/responses/text",
  "message": "Image exceeds maximum size limit",
  "request_id": "req_123abc",
  "error_code": "image_too_large",
  "parameter": "images[0]",
  "hint": "Maximum image size is 20MB. Resize or compress your image before uploading.",
  "openai_error": {
    "type": "invalid_request_error",
    "code": "image_too_large",
    "param": "images[0]",
    "message": "Image file too large"
  }
}
```

### DTOs (Data Transfer Objects)

#### CreateTextResponseDto
**File:** [src/openai/dto/create-text-response.dto.ts](src/openai/dto/create-text-response.dto.ts)

**Purpose:** Request validation for text generation with 27 parameters.

**Validation Approach:** class-validator decorators (`@IsString()`, `@IsOptional()`, `@Min()`, `@Max()`, `@IsEnum()`)

**Parameter Categories:**
- **Basic:** `model`, `input`, `instructions`, `temperature`, `top_p`
- **Conversation:** `conversation`, `previous_response_id`, `store`
- **Response Control:** `max_output_tokens`, `tool_choice`, `parallel_tool_calls`
- **Text Config:** `text` (format, verbosity)
- **Optimization:** `prompt_cache_key`, `service_tier`, `background`, `truncation`
- **Safety:** `safety_identifier`, `metadata`
- **Advanced:** `stream_options`, `prompt`, `include`, `reasoning`

#### CreateImageResponseDto
**File:** [src/openai/dto/create-image-response.dto.ts](src/openai/dto/create-image-response.dto.ts)

**Purpose:** Request validation for image generation with 9 image-specific parameters.

**Inherits:** All text generation parameters from `CreateTextResponseDto`

**Image Parameters:** `image_model`, `image_quality`, `image_format`, `image_size`, `image_moderation`, `image_background`, `input_fidelity`, `output_compression`, `partial_images`

### Configuration

#### Environment Validation
**File:** [src/config/env.validation.ts](src/config/env.validation.ts)

**Purpose:** Type-safe environment variable validation using Zod.

**Validation Features:**
- Fails fast on startup with detailed error messages
- Automatic TypeScript type inference
- Custom constraints (min, max, startsWith, enum)
- Coercion for numeric types

**Example:**
```typescript
OPENAI_API_KEY: z.string()
  .min(1, 'OPENAI_API_KEY is required')
  .startsWith('sk-', 'OPENAI_API_KEY must start with "sk-"')
```

**Type Inference:**
```typescript
export type EnvConfig = z.infer<typeof envSchema>
```

#### Configuration Factory
**File:** [src/config/configuration.ts](src/config/configuration.ts)

**Purpose:** Configuration factory for ConfigModule.

**Configuration Structure:**
- `port`, `nodeEnv`
- `openai`: `apiKey`, `baseUrl`, `defaultModel`, `timeout`, `maxRetries`, `retryDelay`
- `logging`: `level`, `dir`

**Usage:**
```typescript
constructor(private readonly configService: ConfigService) {
  const apiKey = this.configService.get<string>('openai.apiKey');
}
```

## Error Handling

### Three-Layer Approach

1. **OpenAIExceptionFilter** - Catches and transforms OpenAI SDK errors
2. **RetryInterceptor** - Automatically retries transient failures
3. **Service Layer** - Validates responses and throws appropriate errors

### Key Features

- ✅ **Request ID Tracking** - All errors include OpenAI request IDs for support
- ✅ **Parameter Context** - Shows which parameter caused the error
- ✅ **Actionable Hints** - Specific guidance on fixing each error type
- ✅ **Rate Limit Details** - Full rate limit info (`x-ratelimit-*` headers)
- ✅ **Comprehensive Logging** - All errors logged with original_error for debugging
- ✅ **Type-Safe** - 100% type-safe with custom type guards

### Example Error Scenarios

**Rate Limit (429):**
```json
{
  "statusCode": 429,
  "message": "Rate limit exceeded",
  "request_id": "req_abc123",
  "rate_limit_info": {
    "limit_requests": 3500,
    "remaining_requests": 0,
    "reset_requests": "2025-11-12T10:30:00Z"
  },
  "retry_after_seconds": 60,
  "hint": "You've exceeded your rate limit. Retry after 60 seconds."
}
```

**Authentication Error (401):**
```json
{
  "statusCode": 401,
  "message": "Invalid API key",
  "hint": "Check that your OPENAI_API_KEY starts with 'sk-' and is active"
}
```

**Image Too Large (400):**
```json
{
  "statusCode": 400,
  "message": "Image exceeds maximum size limit",
  "error_code": "image_too_large",
  "parameter": "images[0]",
  "hint": "Maximum image size is 20MB. Resize or compress your image before uploading."
}
```

### Client-Side Error Handling Patterns

#### Pattern 1: Basic Error Handling with Retry

```typescript
import axios from 'axios';

interface ErrorResponse {
  statusCode: number;
  message: string;
  error_code?: string;
  hint?: string;
  retry_after_seconds?: number;
}

async function generateText(prompt: string, maxRetries = 3): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post('http://localhost:3000/api/responses/text', {
        model: 'gpt-4o',
        input: prompt,
      });

      return response.data;

    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const errorData: ErrorResponse = error.response.data;

        // Handle rate limit with exponential backoff
        if (errorData.statusCode === 429) {
          const retryAfter = errorData.retry_after_seconds || Math.pow(2, attempt);

          if (attempt < maxRetries) {
            console.log(`Rate limited. Retrying in ${retryAfter}s (attempt ${attempt}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            continue;
          }
        }

        // Handle authentication errors (non-retryable)
        if (errorData.statusCode === 401) {
          console.error('❌ Authentication failed:', errorData.message);
          console.error('💡 Hint:', errorData.hint);
          throw new Error('AUTHENTICATION_FAILED');
        }

        // Handle validation errors (non-retryable)
        if (errorData.statusCode === 400) {
          console.error('❌ Validation error:', errorData.message);
          console.error('💡 Hint:', errorData.hint);
          if (errorData.error_code) {
            console.error('📋 Error code:', errorData.error_code);
          }
          throw new Error('VALIDATION_FAILED');
        }

        // Handle server errors (retryable)
        if (errorData.statusCode >= 500 && attempt < maxRetries) {
          const backoff = Math.pow(2, attempt);
          console.log(`Server error. Retrying in ${backoff}s (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, backoff * 1000));
          continue;
        }
      }

      // Unknown error - rethrow
      throw error;
    }
  }

  throw new Error('MAX_RETRIES_EXCEEDED');
}
```

#### Pattern 2: Production-Ready Error Handler with Logging

```typescript
import axios, { AxiosError } from 'axios';
import winston from 'winston';

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

class OpenAIClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorCode?: string,
    public hint?: string,
    public requestId?: string,
  ) {
    super(message);
    this.name = 'OpenAIClientError';
  }
}

async function safeAPICall<T>(
  apiCall: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryableStatusCodes?: number[];
    logErrors?: boolean;
  } = {},
): Promise<T> {
  const {
    maxRetries = 3,
    retryableStatusCodes = [429, 500, 502, 503, 504],
    logErrors = true,
  } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();

    } catch (error) {
      const axiosError = error as AxiosError<ErrorResponse>;

      if (axiosError.response) {
        const errorData = axiosError.response.data;

        // Log error with context
        if (logErrors) {
          logger.error('OpenAI API Error', {
            statusCode: errorData.statusCode,
            message: errorData.message,
            errorCode: errorData.error_code,
            hint: errorData.hint,
            attempt: attempt,
            maxRetries: maxRetries,
            timestamp: new Date().toISOString(),
          });
        }

        // Check if error is retryable
        const isRetryable = retryableStatusCodes.includes(errorData.statusCode);

        if (isRetryable && attempt < maxRetries) {
          const backoff = Math.min(Math.pow(2, attempt) * 1000, 30000); // Max 30s

          logger.info('Retrying API call', {
            attempt: attempt,
            backoffMs: backoff,
            errorCode: errorData.error_code,
          });

          await new Promise(resolve => setTimeout(resolve, backoff));
          continue;
        }

        // Non-retryable or max retries exceeded
        throw new OpenAIClientError(
          errorData.message,
          errorData.statusCode,
          errorData.error_code,
          errorData.hint,
          axiosError.response.headers['x-request-id'],
        );
      }

      // Network error or unknown error
      if (logErrors) {
        logger.error('Network or unknown error', {
          message: error instanceof Error ? error.message : String(error),
          attempt: attempt,
        });
      }

      if (attempt < maxRetries) {
        const backoff = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }

      throw error;
    }
  }

  throw new Error('Unreachable');
}

// Usage example
async function generateWithRetry(prompt: string) {
  try {
    const result = await safeAPICall(
      () => axios.post('http://localhost:3000/api/responses/text', {
        model: 'gpt-4o',
        input: prompt,
      }),
      { maxRetries: 5, logErrors: true },
    );

    return result.data;

  } catch (error) {
    if (error instanceof OpenAIClientError) {
      console.error(`OpenAI Error [${error.errorCode}]: ${error.message}`);
      console.error(`Hint: ${error.hint}`);
      console.error(`Request ID: ${error.requestId}`);
    } else {
      console.error('Unexpected error:', error);
    }

    throw error;
  }
}
```

#### Pattern 3: Multi-API Error Handling

```typescript
import axios from 'axios';

// Unified error handler for all OpenAI endpoints
class APIClient {
  constructor(private baseURL: string = 'http://localhost:3000') {}

  private async handleRequest<T>(
    method: 'get' | 'post' | 'delete' | 'patch',
    endpoint: string,
    data?: any,
  ): Promise<T> {
    try {
      const response = await axios({
        method,
        url: `${this.baseURL}${endpoint}`,
        data,
      });

      return response.data;

    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const errorData: ErrorResponse = error.response.data;

        // API-specific error handling
        if (endpoint.startsWith('/api/images')) {
          return this.handleImageError(errorData);
        } else if (endpoint.startsWith('/api/videos')) {
          return this.handleVideoError(errorData);
        } else if (endpoint.startsWith('/api/files')) {
          return this.handleFileError(errorData);
        } else if (endpoint.startsWith('/api/responses')) {
          return this.handleResponseError(errorData);
        }
      }

      throw error;
    }
  }

  private handleImageError(error: ErrorResponse): never {
    const errorHandlers: Record<string, string> = {
      'image_too_large': 'Image exceeds 20MB limit. Resize or compress before uploading.',
      'invalid_image_format': 'Only PNG files are supported for image editing.',
      'invalid_size_for_model': 'DALL-E 2 supports 256x256, 512x512, 1024x1024. DALL-E 3 supports 1024x1024, 1792x1024, 1024x1792.',
    };

    const customHint = errorHandlers[error.error_code || ''] || error.hint;

    console.error('🖼️  Image API Error:', error.message);
    console.error('💡 Solution:', customHint);

    throw new Error(`IMAGE_API_ERROR: ${error.message}`);
  }

  private handleVideoError(error: ErrorResponse): never {
    const errorHandlers: Record<string, string> = {
      'video_generation_failed': 'Video generation failed. Check prompt clarity and try again.',
      'video_timeout': 'Video generation timed out. Try reducing duration or complexity.',
      'video_not_found': 'Video ID not found or expired (videos expire after 30 days).',
    };

    const customHint = errorHandlers[error.error_code || ''] || error.hint;

    console.error('🎬 Video API Error:', error.message);
    console.error('💡 Solution:', customHint);

    throw new Error(`VIDEO_API_ERROR: ${error.message}`);
  }

  private handleFileError(error: ErrorResponse): never {
    const errorHandlers: Record<string, string> = {
      'file_too_large': 'File exceeds 512MB limit. Use Uploads API for files > 512MB.',
      'unsupported_format': 'File format not supported. See supported formats in documentation.',
      'download_forbidden': 'Files with purpose="assistants" cannot be downloaded via API.',
    };

    const customHint = errorHandlers[error.error_code || ''] || error.hint;

    console.error('📁 File API Error:', error.message);
    console.error('💡 Solution:', customHint);

    throw new Error(`FILE_API_ERROR: ${error.message}`);
  }

  private handleResponseError(error: ErrorResponse): never {
    const errorHandlers: Record<string, string> = {
      'invalid_model': 'Model not supported. Use gpt-4o, gpt-4o-mini, or o-series models.',
      'context_length_exceeded': 'Input too long. Reduce input length or use larger context model.',
      'content_filter_triggered': 'Content violates OpenAI usage policies. Modify your input.',
    };

    const customHint = errorHandlers[error.error_code || ''] || error.hint;

    console.error('💬 Responses API Error:', error.message);
    console.error('💡 Solution:', customHint);

    throw new Error(`RESPONSES_API_ERROR: ${error.message}`);
  }

  // Public API methods
  async generateText(prompt: string) {
    return this.handleRequest('post', '/api/responses/text', {
      model: 'gpt-4o',
      input: prompt,
    });
  }

  async generateImage(prompt: string, model: string = 'dall-e-2') {
    return this.handleRequest('post', '/api/images/generate', {
      prompt,
      model,
    });
  }

  async generateVideo(prompt: string) {
    return this.handleRequest('post', '/api/videos', {
      prompt,
      model: 'sora-2',
    });
  }

  async uploadFile(file: File, purpose: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('purpose', purpose);

    return this.handleRequest('post', '/api/files', formData);
  }
}

// Usage
const client = new APIClient();

async function run() {
  try {
    const text = await client.generateText('Hello');
    const image = await client.generateImage('A cat');
    const video = await client.generateVideo('Ocean waves');
  } catch (error) {
    // Errors are already logged with hints
    process.exit(1);
  }
}
```

#### Pattern 4: Error Recovery Workflows

```typescript
// Graceful degradation pattern
async function generateImageWithFallback(prompt: string) {
  const models = ['gpt-image-1', 'dall-e-3', 'dall-e-2'];

  for (const model of models) {
    try {
      console.log(`Trying ${model}...`);

      const response = await axios.post('http://localhost:3000/api/images/generate', {
        prompt,
        model,
        response_format: model === 'gpt-image-1' ? 'b64_json' : 'url',
      });

      console.log(`✓ Success with ${model}`);
      return response.data;

    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const errorData: ErrorResponse = error.response.data;

        console.warn(`✗ ${model} failed:`, errorData.message);

        // If it's a model-specific error, try next model
        if (errorData.error_code?.includes('model') || errorData.statusCode === 400) {
          continue;
        }

        // For other errors (rate limit, auth, server), don't retry with different model
        throw error;
      }

      throw error;
    }
  }

  throw new Error('All models failed');
}

// Circuit breaker pattern
class CircuitBreaker {
  private failures = 0;
  private lastFailTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000, // 60s
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailTime > this.timeout) {
        this.state = 'half-open';
        console.log('Circuit breaker entering half-open state');
      } else {
        throw new Error('Circuit breaker is open - service unavailable');
      }
    }

    try {
      const result = await fn();

      // Success - reset circuit
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failures = 0;
        console.log('Circuit breaker closed');
      }

      return result;

    } catch (error) {
      this.failures++;
      this.lastFailTime = Date.now();

      if (this.failures >= this.threshold) {
        this.state = 'open';
        console.error(`Circuit breaker opened after ${this.failures} failures`);
      }

      throw error;
    }
  }
}

// Usage
const breaker = new CircuitBreaker(5, 60000);

async function generateTextWithCircuitBreaker(prompt: string) {
  try {
    return await breaker.execute(() =>
      axios.post('http://localhost:3000/api/responses/text', {
        model: 'gpt-4o',
        input: prompt,
      })
    );
  } catch (error) {
    console.error('Request failed or circuit breaker open');
    throw error;
  }
}
```

### Common Error Codes Reference

#### Responses API Error Codes

| Code | Status | Description | Solution |
|------|--------|-------------|----------|
| `invalid_model` | 400 | Model not supported | Use gpt-4o, gpt-4o-mini, or o-series |
| `context_length_exceeded` | 400 | Input too long | Reduce input or use larger context model |
| `content_filter_triggered` | 400 | Content policy violation | Modify input to comply with policies |
| `invalid_tools` | 400 | Tool configuration invalid | Check tools array format and parameters |
| `rate_limit_exceeded` | 429 | Too many requests | Wait and retry after specified seconds |

#### Images API Error Codes

| Code | Status | Description | Solution |
|------|--------|-------------|----------|
| `image_too_large` | 400 | Image exceeds size limit | Resize to < 20MB for DALL-E 2 |
| `invalid_image_format` | 400 | Unsupported format | Use PNG files only for edits/variations |
| `invalid_size_for_model` | 400 | Size incompatible with model | Check size options per model |
| `invalid_prompt` | 400 | Prompt violates policies | Modify prompt content |

#### Videos API Error Codes

| Code | Status | Description | Solution |
|------|--------|-------------|----------|
| `video_generation_failed` | 500 | Generation failed | Simplify prompt or reduce duration |
| `video_timeout` | 408 | Generation timed out | Reduce complexity or duration |
| `video_not_found` | 404 | Video expired or deleted | Videos expire after 30 days |
| `invalid_video_params` | 400 | Invalid parameters | Check size, duration, aspect ratio |

#### Files API Error Codes

| Code | Status | Description | Solution |
|------|--------|-------------|----------|
| `file_too_large` | 400 | File exceeds 512MB | Use Uploads API for files > 512MB |
| `unsupported_format` | 400 | File format not supported | Check supported formats list |
| `download_forbidden` | 403 | Download not allowed | Files with purpose=assistants cannot be downloaded |
| `file_not_found` | 404 | File deleted or expired | Verify file ID and check expiration |

## Testing

### Test Coverage

**Unit Tests:** 660+ tests across all components
- All 9 streaming handlers
- Responses API service and controller
- Videos API service and controller (140+ tests)
- Files API service, controller, and DTOs (191 tests)
- Logger service
- Interceptors (logging, retry, edge cases)
- Exception filter (39 tests)
- DTOs and configuration

**E2E Tests:**
- [test/openai-responses.e2e-spec.ts](test/openai-responses.e2e-spec.ts) - Text generation
- [test/openai-images.e2e-spec.ts](test/openai-images.e2e-spec.ts) - Image generation
- [test/openai-streaming.e2e-spec.ts](test/openai-streaming.e2e-spec.ts) - Streaming
- [test/videos.e2e-spec.ts](test/videos.e2e-spec.ts) - Videos API (15 tests)
- [test/files.e2e-spec.ts](test/files.e2e-spec.ts) - Files API (19 tests)

### Running Tests

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov

# E2E tests
npm run test:e2e

# Debug tests
npm run test:debug
```

## Development

### Commands

```bash
# Build
npm run build

# Run in development mode (auto-reload)
npm run start:dev

# Run in production mode
npm run start:prod

# Lint code
npm run lint

# Format code
npm run format
```

### Project Structure

```
src/
├── config/
│   ├── configuration.ts              # Configuration factory
│   ├── env.validation.ts             # Zod validation schema
│   └── *.spec.ts                     # Config unit tests
├── common/
│   ├── services/
│   │   ├── logger.service.ts         # Structured JSON logging
│   │   └── logger.service.spec.ts    # Logger tests
│   ├── interceptors/
│   │   ├── logging.interceptor.ts    # Request/response logging
│   │   ├── retry.interceptor.ts      # Auto-retry with backoff
│   │   ├── *.spec.ts                 # Interceptor tests
│   │   └── edge-cases.spec.ts        # Edge case tests
│   ├── filters/
│   │   ├── openai-exception.filter.ts  # Error handling
│   │   └── openai-exception.filter.spec.ts  # 39 filter tests
│   ├── testing/
│   │   └── mock-logger.service.ts    # Test utilities
│   └── common.module.ts
├── openai/
│   ├── services/
│   │   ├── openai-responses.service.ts  # Orchestrator (~860 lines)
│   │   ├── openai-responses.service.spec.ts  # Service tests
│   │   └── handlers/                 # 9 streaming handlers
│   │       ├── lifecycle-events.handler.ts
│   │       ├── text-events.handler.ts
│   │       ├── reasoning-events.handler.ts
│   │       ├── tool-calling-events.handler.ts
│   │       ├── image-events.handler.ts
│   │       ├── audio-events.handler.ts
│   │       ├── mcp-events.handler.ts
│   │       ├── refusal-events.handler.ts
│   │       ├── structural-events.handler.ts
│   │       └── *.spec.ts             # Handler tests
│   ├── controllers/
│   │   ├── responses.controller.ts   # 8 endpoints
│   │   └── responses.controller.spec.ts  # Controller tests
│   ├── dto/
│   │   ├── create-text-response.dto.ts  # 27 parameters
│   │   ├── create-image-response.dto.ts # 9 image parameters
│   │   ├── stream-event.dto.ts       # SSE event types
│   │   └── *.spec.ts                 # DTO tests
│   ├── interfaces/
│   │   ├── stream-state.interface.ts # Shared streaming state
│   │   ├── sse-event.interface.ts    # SSE event structure
│   │   └── error-codes.interface.ts  # Error code mappings
│   └── openai.module.ts
├── app.module.ts
└── main.ts
test/
├── integration/                      # Integration tests
├── openai-responses.e2e-spec.ts      # Text generation E2E
├── openai-images.e2e-spec.ts         # Image generation E2E
├── openai-streaming.e2e-spec.ts      # Streaming E2E
└── README.e2e.md                     # E2E test documentation
```

### OpenAI SDK Usage

- **ALWAYS use Responses API** - `client.responses.create()`, NOT `chat.completions.create()`
- Import types: `import type { Responses } from 'openai/resources/responses'`
- Response type: `Responses.Response`
- Request params: `Responses.ResponseCreateParamsNonStreaming`
- Parameters: Use `input` (not `messages`), `instructions` (not system message)
- Response structure: Access `response.output_text`, `response.usage.input_tokens`

## Resources

### Official Documentation

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses)
- [OpenAI Streaming Guide](https://platform.openai.com/docs/guides/streaming-responses)
- [OpenAI Node.js SDK](https://github.com/openai/openai-node)
- [OpenAI Images API](https://platform.openai.com/docs/guides/images)
- [OpenAI Videos API](https://platform.openai.com/docs/guides/video-generation)

### NestJS Documentation

- [NestJS Documentation](https://docs.nestjs.com)
- [NestJS Exception Filters](https://docs.nestjs.com/exception-filters)
- [NestJS Interceptors](https://docs.nestjs.com/interceptors)
- [NestJS Validation](https://docs.nestjs.com/techniques/validation)

### Libraries

- [Zod Documentation](https://zod.dev)
- [class-validator](https://github.com/typestack/class-validator)
- [RxJS Documentation](https://rxjs.dev)

## Cost Estimation

The application logs approximate costs based on token usage:

| Model | Input Tokens | Output Tokens |
|-------|--------------|---------------|
| **GPT-4o** | $2.50/1M | $10.00/1M |
| **GPT-5** | $1.25/1M | $10.00/1M |
| **DALL-E 3** | ~$0.04-$0.08 per image | - |
| **Sora-2** | ~$0.30-$0.50 per 10s video | - |

**Note:** Costs are estimates. Check [OpenAI Pricing](https://openai.com/pricing) for current rates.

## Troubleshooting

### "OPENAI_API_KEY is required"
Ensure `.env` file exists with `OPENAI_API_KEY=sk-...`

### "Rate limit exceeded"
Your OpenAI account hit rate limits. Check the `retry_after_seconds` field and wait before retrying.

### Build errors
```bash
# Clear and reinstall
rm -rf node_modules package-lock.json dist
npm install
npm run build
```

### Streaming connection issues
- Check firewall settings for SSE connections
- Verify `Accept: text/event-stream` header
- Use `-N` flag with curl to disable buffering

## License

MIT

## Contributing

This is a testing/reference project. Feel free to:
- Use as a template for your OpenAI integrations
- Report issues or suggest improvements
- Submit PRs for bug fixes or documentation enhancements

## Support

For OpenAI API issues:
1. Check [OpenAI Status](https://status.openai.com)
2. Verify API key permissions and billing
3. Check rate limits for your tier
4. Contact OpenAI support with request IDs from error logs

For project-specific issues:
- Check existing tests for usage examples
- Examine logs in `logs/YYYY-MM-DD/` for debugging

---

**Built with ❤️ as a comprehensive reference for integrating OpenAI APIs with NestJS**
