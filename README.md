# OpenAI API Testing & Reference Implementation

> **A production-ready NestJS application demonstrating best practices for integrating OpenAI APIs with comprehensive error handling, streaming support, and structured logging.**

This project serves as a **source of truth** for implementing OpenAI API capabilities in NestJS applications, showcasing:
- **Responses API** (streaming & non-streaming text, image generation via gpt-image-1)
- **Images API** (DALL-E 3) - *Planned*
- **Videos API** (Sora-2) - *Planned*

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

- ⏳ **Images API** (DALL-E 3) - Direct image generation *[Planned]*
- ⏳ **Videos API** (Sora-2) - Video generation *[Planned]*

### Production Features

- ✅ **Comprehensive Error Handling**
  - 15 image-specific error codes with actionable hints
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
| POST | `/api/images/generate` | DALL-E 3 image generation | ⏳ |
| POST | `/api/videos/generate` | Sora-2 video generation | ⏳ |

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

## Testing

### Test Coverage

**Unit Tests:** 450+ tests across all components
- All 9 streaming handlers
- Logger service
- Interceptors (logging, retry, edge cases)
- Exception filter (39 tests)
- DTOs and configuration

**E2E Tests:**
- [test/openai-responses.e2e-spec.ts](test/openai-responses.e2e-spec.ts) - Text generation
- [test/openai-images.e2e-spec.ts](test/openai-images.e2e-spec.ts) - Image generation
- [test/openai-streaming.e2e-spec.ts](test/openai-streaming.e2e-spec.ts) - Streaming

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
- [OpenAI Images API (DALL-E 3)](https://platform.openai.com/docs/guides/images)
- [OpenAI Videos API (Sora 2)](https://platform.openai.com/docs/guides/video-generation)

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
