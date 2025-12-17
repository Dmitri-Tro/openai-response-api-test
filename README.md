# OpenAI API Testing & Reference Implementation

> **A production-ready NestJS application demonstrating best practices for integrating OpenAI APIs with comprehensive error handling, streaming support, and structured logging.**

## Overview

This project serves as a **reference implementation** for OpenAI API integration in NestJS applications, featuring:

| API | Description | Documentation |
|-----|-------------|---------------|
| **Responses API** | Text/image generation, streaming, tool calling | [docs/RESPONSES_API.md](docs/RESPONSES_API.md) |
| **Videos API** | Async video generation with polling | [docs/VIDEOS_API.md](docs/VIDEOS_API.md) |
| **Images API** | DALL-E 2/3, gpt-image-1 generation | [docs/IMAGES_API.md](docs/IMAGES_API.md) |
| **Audio API** | TTS, transcription, translation | [docs/AUDIO_API.md](docs/AUDIO_API.md) |
| **Files API** | File upload, download, management | [docs/FILES_API.md](docs/FILES_API.md) |
| **Vector Stores API** | RAG workflows, semantic search | [docs/VECTOR_STORES_API.md](docs/VECTOR_STORES_API.md) |

### Key Features

- **63+ Streaming Event Types** - 10 specialized handlers for real-time SSE
- **100% Type Safety** - Strict TypeScript, OpenAI SDK types, no `any`
- **Production Error Handling** - 50+ error codes with actionable hints
- **Structured Logging** - JSON logs with cost estimation
- **Automatic Retry** - Exponential backoff for transient failures

---

## Quick Start

### Prerequisites

- Node.js >= 18.x
- npm >= 9.x
- [OpenAI API Key](https://platform.openai.com/api-keys)

### Installation

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env: OPENAI_API_KEY=sk-...

# Build and start
npm run build
npm run start:dev
```

**Application URLs:**
- API: http://localhost:3000
- Swagger Docs: http://localhost:3000/api-docs

### Configuration

```env
# Required
OPENAI_API_KEY=sk-your-api-key-here

# Optional (defaults shown)
PORT=3000
NODE_ENV=development
OPENAI_DEFAULT_MODEL=gpt-4o
OPENAI_TIMEOUT=60000
OPENAI_MAX_RETRIES=3
LOG_LEVEL=debug
```

> **Detailed setup guide:** [docs/QUICK_START.md](docs/QUICK_START.md)

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | NestJS 11 |
| Language | TypeScript 5 (strict mode) |
| OpenAI SDK | openai v6.9.1 |
| Validation | Zod (env), class-validator (DTOs) |
| Documentation | Swagger/OpenAPI |
| Testing | Jest 30, Supertest 7 |

---

## Architecture

```
AppModule (root)
├── ConfigModule (global)     - Zod-validated environment
├── CommonModule (global)     - Logger, Interceptors, Filters
└── OpenAIModule              - 6 APIs, 7 Services, 10 Handlers
```

### Request Flow

```
Client → Controller → RetryInterceptor → LoggingInterceptor
                                              ↓
                                    OpenAI Service → SDK
                                              ↓
                              Streaming Handlers (10) → SSE
                                              ↓
                                    OpenAIExceptionFilter
                                              ↓
                                          Response
```

### Streaming Handlers

| Handler | Events | Purpose |
|---------|--------|---------|
| Lifecycle | 7 | Response lifecycle (created, completed, failed) |
| Text | 3 | Text output streaming |
| Reasoning | 6 | o-series model reasoning tokens |
| Tool Calling | 21 | Functions, code interpreter, file search |
| Image | 4 | Progressive image rendering |
| Audio | 4 | TTS/voice output |
| MCP | 8 | Model Context Protocol |
| Refusal | 2 | Content policy handling |
| Structural | 3 | Message structure |
| Computer Use | 5 | Computer automation |

> **Detailed architecture:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
> **Streaming details:** [docs/STREAMING.md](docs/STREAMING.md)
> **Data flow patterns:** [docs/DATA_FLOW.md](docs/DATA_FLOW.md)

---

## API Endpoints

### Summary (45 Total)

| API | Endpoints | Key Operations |
|-----|-----------|----------------|
| Responses | 9 | Text/image generation, streaming, storage |
| Videos | 7 | Create, poll, download, remix |
| Images | 3 | Generate, edit, variations |
| Audio | 3 | Speech, transcription, translation |
| Files | 5 | Upload, list, download, delete |
| Vector Stores | 18 | CRUD, search, file operations, batches |

### Quick Examples

#### Text Generation

```bash
curl -X POST http://localhost:3000/api/responses/text \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "input": "Explain quantum computing",
    "max_output_tokens": 500
  }'
```

#### Streaming Text

```bash
curl -N http://localhost:3000/api/responses/text/stream \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "input": "Write a short poem",
    "stream": true
  }'
```

#### Image Generation

```bash
curl -X POST http://localhost:3000/api/images/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-1",
    "prompt": "A sunset over mountains",
    "size": "1024x1024"
  }'
```

#### File Upload

```bash
curl -X POST http://localhost:3000/api/files \
  -F "file=@./document.pdf" \
  -F "purpose=assistants"
```

#### Audio Transcription

```bash
curl -X POST http://localhost:3000/api/audio/transcriptions \
  -F "file=@./audio.mp3" \
  -F "model=whisper-1"
```

> **Full API documentation with all parameters and examples:**
> - [docs/RESPONSES_API.md](docs/RESPONSES_API.md) - Text, images, tools, streaming
> - [docs/VIDEOS_API.md](docs/VIDEOS_API.md) - Video generation and polling
> - [docs/IMAGES_API.md](docs/IMAGES_API.md) - DALL-E and gpt-image-1
> - [docs/AUDIO_API.md](docs/AUDIO_API.md) - TTS, STT, translation
> - [docs/FILES_API.md](docs/FILES_API.md) - File management
> - [docs/VECTOR_STORES_API.md](docs/VECTOR_STORES_API.md) - RAG and search

---

## Tool Calling

The Responses API supports multiple tool types:

| Tool | Description |
|------|-------------|
| `function` | Custom function calling with JSON schema |
| `code_interpreter` | Python execution in sandboxed container |
| `file_search` | Semantic search across vector stores |
| `web_search` | Real-time web search |
| `computer_use` | Computer automation (experimental) |

### Code Interpreter Example

```bash
curl -X POST http://localhost:3000/api/responses/text \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "input": "Calculate the factorial of 20",
    "tools": [{"type": "code_interpreter"}],
    "include": ["code_interpreter_call.outputs"]
  }'
```

### File Search Example

```bash
curl -X POST http://localhost:3000/api/responses/text \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "input": "What does the documentation say about error handling?",
    "tools": [{
      "type": "file_search",
      "vector_store_ids": ["vs_abc123"]
    }]
  }'
```

> **Full tool documentation:** [docs/RESPONSES_API.md](docs/RESPONSES_API.md#tool-calling)

---

## Error Handling

All errors are transformed into structured responses with actionable hints:

```json
{
  "statusCode": 429,
  "timestamp": "2025-01-17T10:30:00.000Z",
  "path": "/api/responses/text",
  "message": "Rate limit exceeded",
  "error_code": "rate_limit_exceeded",
  "request_id": "req_abc123",
  "retry_after_seconds": 20,
  "hint": "Wait 20 seconds before retrying. Consider reducing request frequency."
}
```

### Error Categories

| Category | HTTP Status | Examples |
|----------|-------------|----------|
| Authentication | 401 | Invalid API key |
| Rate Limit | 429 | Too many requests |
| Bad Request | 400 | Invalid parameters |
| Not Found | 404 | Resource not found |
| Server Error | 500+ | OpenAI service issues |

> **Full troubleshooting guide:** [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

---

## Development

### Commands

```bash
# Development
npm run start:dev          # Start with hot-reload
npm run build              # Build for production
npm run start:prod         # Run production build

# Code Quality
npm run lint               # ESLint check and fix
npm run format             # Prettier formatting

# Testing
npm run test               # Unit tests
npm run test:e2e           # E2E tests (requires API key)
npm run test:cov           # Coverage report
```

### Project Structure

```
src/
├── config/                # Environment configuration
├── common/                # Shared services, filters, interceptors
│   ├── filters/           # OpenAIExceptionFilter
│   ├── interceptors/      # Logging, Retry
│   └── services/          # Logger, Pricing
└── openai/                # OpenAI API integration
    ├── controllers/       # 6 REST controllers
    ├── services/          # 7 API services
    │   └── handlers/      # 10 streaming handlers
    ├── dto/               # Request validation
    ├── interfaces/        # TypeScript types
    └── validators/        # Custom validators
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [QUICK_START.md](docs/QUICK_START.md) | Getting started in 5 minutes |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical architecture overview |
| [STREAMING.md](docs/STREAMING.md) | 63+ streaming events, SSE implementation |
| [DATA_FLOW.md](docs/DATA_FLOW.md) | Request/response transformations |
| [RESPONSES_API.md](docs/RESPONSES_API.md) | Text, images, tools, streaming |
| [VIDEOS_API.md](docs/VIDEOS_API.md) | Video generation with polling |
| [IMAGES_API.md](docs/IMAGES_API.md) | DALL-E 2/3, gpt-image-1 |
| [AUDIO_API.md](docs/AUDIO_API.md) | TTS, transcription, translation |
| [FILES_API.md](docs/FILES_API.md) | File upload and management |
| [VECTOR_STORES_API.md](docs/VECTOR_STORES_API.md) | RAG workflows, semantic search |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common issues and solutions |

---

## Cost Estimation

The application tracks token usage and estimates costs:

| Model | Input | Output | Cached Input |
|-------|-------|--------|--------------|
| gpt-4o | $2.50/1M | $10.00/1M | $1.25/1M |
| gpt-4o-mini | $0.15/1M | $0.60/1M | $0.075/1M |
| o1 | $15.00/1M | $60.00/1M | $7.50/1M |
| o3-mini | $1.10/1M | $4.40/1M | $0.55/1M |

Costs are logged with each request in `logs/YYYY-MM-DD/{api}.log`.

---

## License

MIT License - see [LICENSE](LICENSE) file.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Resources

- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
- [OpenAI SDK GitHub](https://github.com/openai/openai-node)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Swagger UI](http://localhost:3000/api-docs) (when running)
