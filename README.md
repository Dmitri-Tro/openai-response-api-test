# OpenAI API Testing Project

A comprehensive NestJS application for testing and documenting OpenAI APIs including Responses API (chat + gpt-image-1), Images API (DALL-E 3), and Videos API (Sora-2).

## Features

- ✅ **Responses API Integration** - Using modern `client.responses.create()` (SDK 6.2+)
  - ✅ Text generation (non-streaming) implemented
  - ⏳ gpt-image-1 image generation (planned)
  - ⏳ Streaming support (planned)
- ⏳ **Images API Integration** - DALL-E 3 image generation (planned)
- ⏳ **Videos API Integration** - Sora-2 video generation (planned)
- ✅ **Comprehensive Logging** - All OpenAI requests/responses logged to JSON files by date
- ✅ **Native Error Handling** - Handles all OpenAI error types (401, 429, 500, 503, timeouts)
- ✅ **Error Response Metadata** - Returns retry-after information for rate limits
- ✅ **SDK Built-in Retries** - OpenAI SDK maxRetries configuration (exponential backoff planned)
- ✅ **Swagger Documentation** - Interactive API documentation at /api-docs
- ✅ **Type-Safe Configuration** - Zod-based environment validation
- ✅ **Service Layer Type Safety** - Using official `Responses.Response` types from OpenAI SDK
- ✅ **Strict TypeScript** - Full type checking in service layer

## Tech Stack

- **Framework**: NestJS 10
- **Language**: TypeScript 5 (strict mode)
- **OpenAI SDK**: openai v6.8.1 (with Responses API support)
- **Validation**:
  - Zod for environment configuration
  - class-validator for request DTOs
- **Documentation**: Swagger/OpenAPI
- **Testing**: Jest (framework setup, tests pending)

## Type Safety

This project emphasizes **strict TypeScript** with proper type definitions:

- ✅ **Official OpenAI SDK Types**: Using `Responses.Response`, `Responses.ResponseCreateParamsNonStreaming` from SDK 6.2+
- ✅ **Responses API (Modern)**: Uses `client.responses.create()` instead of deprecated `chat.completions`
- ✅ **Service Layer**: Fully type-safe with no `any` usage
- ✅ **DTOs**: Using proper OpenAI SDK types (no `any` types)
- ✅ **Custom Type Guards**: Safe type narrowing for error handling
- ✅ **Environment Validation**: Zod schemas with automatic type inference

## Prerequisites

- Node.js >= 18.x
- npm >= 9.x
- OpenAI API Key (get from https://platform.openai.com/api-keys)

## Installation

1. **Clone the repository**
   ```bash
   cd openai-response-api-test
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your OpenAI API key:
   ```env
   OPENAI_API_KEY=sk-your-actual-api-key-here
   PORT=3000
   NODE_ENV=development

   # OpenAI Configuration
   OPENAI_API_BASE_URL=https://api.openai.com/v1
   OPENAI_DEFAULT_MODEL=gpt-4o
   OPENAI_TIMEOUT=60000
   OPENAI_MAX_RETRIES=3

   # Logging
   LOG_LEVEL=debug
   LOG_DIR=./logs
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

## Running the Application

### Development Mode (with auto-reload)
```bash
npm run start:dev
```

### Production Mode
```bash
npm run start:prod
```

### Regular Mode
```bash
npm run start
```

The application will start on `http://localhost:3000` (or the PORT you specified in `.env`)

```
╔════════════════════════════════════════════════════════════════╗
║  OpenAI API Testing Project                                    ║
╠════════════════════════════════════════════════════════════════╣
║  Application is running on: http://localhost:3000              ║
║  Swagger Documentation:     http://localhost:3000/api-docs     ║
╚════════════════════════════════════════════════════════════════╝
```

## API Documentation

Once the application is running, access the interactive Swagger documentation at:

**http://localhost:3000/api-docs**

## API Endpoints

### Responses API (Implemented)

#### POST /api/responses/text
Generate text completion using Responses API (non-streaming)

**Request Body:**
```json
{
  "model": "gpt-4o",
  "input": "Explain quantum computing in simple terms",
  "instructions": "You are a helpful assistant",
  "stream": false
}
```

**Response:** (OpenAI Responses API format)
```json
{
  "id": "resp_abc123",
  "object": "response",
  "created_at": 1234567890,
  "model": "gpt-4o",
  "output_text": "Quantum computing is...",
  "output": [...],
  "usage": {
    "input_tokens": 15,
    "output_tokens": 150,
    "total_tokens": 165
  }
}
```

**Key Differences from Chat Completions API:**
- Uses `output_text` instead of `choices[0].message.content`
- Token counts use `input_tokens`/`output_tokens` instead of `prompt_tokens`/`completion_tokens`
- Response object type is `response` instead of `chat.completion`

### Planned Endpoints

#### GET /api/responses/text/stream (Planned)
Streaming text generation with SSE

#### POST /api/responses/images (Planned)
Image generation with gpt-image-1

#### POST /api/images/generate (Planned)
DALL-E 3 image generation

#### POST /api/videos/generate (Planned)
Sora-2 video generation

## Testing with cURL

### Text Generation
```bash
curl -X POST http://localhost:3000/api/responses/text \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "input": "Write a haiku about programming"
  }'
```

## Logging System

All OpenAI API interactions are automatically logged to the `logs/` directory:

```
logs/
├── 2025-11-11/
│   ├── responses.log    # All Responses API calls
│   ├── images.log       # All Images API calls
│   └── videos.log       # All Videos API calls
```

### Log Format

Each log entry contains:
```json
{
  "timestamp": "2025-11-11T10:30:00.000Z",
  "api": "responses",
  "endpoint": "/v1/chat/completions",
  "request": {
    "model": "gpt-4o",
    "input": "..."
  },
  "response": {
    // Full native OpenAI response
  },
  "metadata": {
    "latency_ms": 1234,
    "tokens_used": 150,
    "cost_estimate": 0.003,
    "rate_limit_headers": {}
  }
}
```

## Error Handling

The application handles all native OpenAI errors:

- **401 Unauthorized** - Invalid API key
- **429 Too Many Requests** - Rate limit exceeded (includes retry-after)
- **500 Internal Server Error** - OpenAI server error
- **503 Service Unavailable** - OpenAI service temporarily unavailable
- **Network Errors** - Timeouts, connection refused, etc.

All errors are logged with full details for investigation.

## Environment Validation

The application uses Zod for type-safe environment validation. If any required environment variables are missing or invalid, you'll get detailed error messages:

```
Environment validation failed:
OPENAI_API_KEY: OPENAI_API_KEY is required
OPENAI_API_KEY: OPENAI_API_KEY must start with "sk-"
```

## Project Structure

```
src/
├── config/
│   ├── configuration.ts         # Configuration factory
│   └── env.validation.ts        # Zod validation schema
├── common/
│   ├── services/
│   │   └── logger.service.ts    # Logging service
│   ├── interceptors/
│   │   └── logging.interceptor.ts  # Request/response logging
│   ├── filters/
│   │   └── openai-exception.filter.ts  # Error handling
│   └── common.module.ts
├── openai/
│   ├── services/
│   │   ├── openai-responses.service.ts  # Responses API
│   │   ├── openai-images.service.ts     # Images API (TODO)
│   │   └── openai-videos.service.ts     # Videos API (TODO)
│   ├── controllers/
│   │   ├── responses.controller.ts
│   │   ├── images.controller.ts (TODO)
│   │   └── videos.controller.ts (TODO)
│   ├── dto/
│   │   └── create-text-response.dto.ts
│   └── openai.module.ts
├── app.module.ts
└── main.ts
```

## Development

### Build
```bash
npm run build
```

### Lint
```bash
npm run lint
```

### Format
```bash
npm run format
```

### Run Tests
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Implementation Progress

See [TODO.md](TODO.md) for detailed implementation plan and progress.

### Completed ✅

**Core Infrastructure:**
- ✅ Project setup with NestJS 10 + TypeScript 5 (strict mode)
- ✅ OpenAI SDK 6.8.1 with Responses API support
- ✅ Zod-based environment validation with type inference
- ✅ Configuration module with ConfigService
- ✅ Logging system with file storage organized by date
- ✅ Native OpenAI error handling with custom exception filter
- ✅ Logging interceptor for request/response tracking
- ✅ Swagger/OpenAPI documentation setup
- ✅ Cost estimation based on token usage

**Responses API:**
- ✅ **Modern API Migration** - Migrated from `chat.completions` to `client.responses.create()`
- ✅ **Text Generation (Non-Streaming)** - POST /api/responses/text endpoint
- ✅ **Service Layer Type Safety** - Using `Responses.Response` and `Responses.ResponseCreateParamsNonStreaming`
- ✅ **Request/Response Logging** - Full native OpenAI response logging to JSON files
- ✅ **Error Handling** - All OpenAI error types (401, 429, 500, 503, network errors)

**Type Safety:**
- ✅ Service layer: 100% type-safe with official OpenAI SDK types
- ✅ DTOs: Using proper OpenAI SDK types (no `any` types)
- ✅ Error handling: Custom type guards for safe type narrowing
- ✅ Environment config: Zod with automatic type inference

### Pending ⏳

**Responses API:**
- ⏳ Text generation (streaming with SSE)
- ⏳ Image generation (gpt-image-1)

**Other APIs:**
- ⏳ Images API - DALL-E 3
- ⏳ Videos API - Sora-2

**Features:**
- ⏳ Custom retry logic with exponential backoff (currently using SDK's built-in retries)
- ⏳ Rate limit header tracking and response

**Testing:**
- ⏳ Unit tests for services
- ⏳ Integration tests with mocked OpenAI API
- ⏳ E2E tests

## Cost Estimation

The application includes basic cost estimation for API calls. Costs are approximate and based on:

- **GPT-4**: ~$0.03/1K input tokens, ~$0.06/1K output tokens
- **GPT-4o**: Lower rates, check OpenAI pricing
- **DALL-E 3**: ~$0.04-$0.08 per image depending on size/quality
- **Sora-2**: ~$0.40 per video (10 seconds)

## Troubleshooting

### "OPENAI_API_KEY is required"
Make sure you've created a `.env` file and added your OpenAI API key.

### "Rate limit exceeded"
Your OpenAI account has hit rate limits. The application will automatically retry with exponential backoff. Check the response for `retry_after_seconds`.

### Build errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear dist folder
rm -rf dist
npm run build
```

## Resources

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses)
- [NestJS Documentation](https://docs.nestjs.com)
- [Zod Documentation](https://zod.dev)

## License

MIT

## Contributing

This is a testing/learning project. Feel free to extend it with additional features!

## Support

If you encounter issues with OpenAI APIs, check:
1. OpenAI API status: https://status.openai.com
2. Your API key permissions
3. Your account billing status
4. Rate limits for your tier
