# 🚀 Quick Start Guide

> **Get up and running with OpenAI API in 5 minutes**

This guide walks you through installation, configuration, and your first API calls.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Your First Request](#your-first-request)
- [Common Use Cases](#common-use-cases)
- [Next Steps](#next-steps)

---

## Prerequisites

Before you begin, ensure you have:

✅ **Node.js 18+** - [Download here](https://nodejs.org/)
✅ **npm 9+** - Comes with Node.js
✅ **OpenAI API Key** - [Get one here](https://platform.openai.com/api-keys)
✅ **Basic TypeScript knowledge** - [Learn TypeScript](https://www.typescriptlang.org/docs/)

**Check your versions:**
```bash
node --version  # Should be v18.x.x or higher
npm --version   # Should be 9.x.x or higher
```

---

## Installation

### Step 1: Clone or Download

```bash
# If you have the repository
cd /path/to/openai-response-api-test

# If starting fresh
git clone <repository-url>
cd openai-response-api-test
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages including:
- NestJS 11
- OpenAI SDK 6.9.1
- TypeScript 5
- And 50+ other dependencies

**Expected output:**
```
added 500+ packages in 30s
```

### Step 3: Build the Project

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folder.

**Expected output:**
```
Successfully compiled TypeScript files
```

---

## Configuration

### Step 1: Create Environment File

```bash
cp .env.example .env
```

### Step 2: Add Your OpenAI API Key

Open `.env` in your editor and add your API key:

```env
# Required
OPENAI_API_KEY=sk-your-actual-api-key-here

# Optional (defaults shown)
PORT=3000
NODE_ENV=development
OPENAI_DEFAULT_MODEL=gpt-4o
OPENAI_TIMEOUT=60000
LOG_LEVEL=debug
```

**Where to find your API key:**
1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click "Create new secret key"
3. Copy the key (starts with `sk-`)
4. Paste it into `.env`

⚠️ **Security Note**: Never commit `.env` to git! It's already in `.gitignore`.

### Step 3: Verify Configuration

```bash
# Check if environment loads correctly
npm run build
npm run start
```

You should see:
```
[Nest] INFO [NestApplication] Nest application successfully started
[Nest] INFO Application is running on: http://localhost:3000
```

---

## Your First Request

### Step 1: Start the Server

```bash
npm run start:dev
```

The API will be available at:
- **API Base**: http://localhost:3000
- **Swagger Docs**: http://localhost:3000/api-docs

### Step 2: Test with cURL

#### Simple Text Generation

```bash
curl -X POST http://localhost:3000/api/responses/text \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "input": "Hello! Can you explain what you do in one sentence?"
  }'
```

**Expected response:**
```json
{
  "id": "resp_abc123",
  "object": "response",
  "model": "gpt-4o-mini",
  "output_text": "I'm Claude, an AI assistant created by Anthropic to be helpful, harmless, and honest.",
  "usage": {
    "input_tokens": 15,
    "output_tokens": 20,
    "total_tokens": 35
  },
  "created_at": 1704067200
}
```

#### Streaming Response

```bash
curl -X POST http://localhost:3000/api/responses/text/stream \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "input": "Count from 1 to 5",
    "stream": true
  }'
```

**Expected output (Server-Sent Events):**
```
event: response.created
data: {"id":"resp_xyz789"}

event: response.output_text.delta
data: {"delta":"1"}

event: response.output_text.delta
data: {"delta":", "}

event: response.output_text.delta
data: {"delta":"2"}

...
```

### Step 3: Test with Swagger UI

1. Open http://localhost:3000/api-docs
2. Find "POST /api/responses/text"
3. Click "Try it out"
4. Edit the request body:
   ```json
   {
     "model": "gpt-4o-mini",
     "input": "Tell me a fun fact!"
   }
   ```
5. Click "Execute"
6. See the response below!

---

## Common Use Cases

### 1. Text Generation with Instructions

```bash
curl -X POST http://localhost:3000/api/responses/text \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "instructions": "You are a helpful coding assistant. Provide concise answers with code examples.",
    "input": "How do I read a file in Node.js?"
  }'
```

### 2. Image Generation

```bash
curl -X POST http://localhost:3000/api/images/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-1",
    "prompt": "A serene mountain landscape at sunset",
    "size": "1024x1024",
    "response_format": "b64_json"
  }'
```

### 3. File Upload for Code Interpreter

```bash
# Upload a file first
curl -X POST http://localhost:3000/api/files \
  -H "Content-Type: multipart/form-data" \
  -F "file=@./data.csv" \
  -F "purpose=assistants"

# Use the returned file_id in code interpreter
curl -X POST http://localhost:3000/api/responses/text \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "input": "Analyze the CSV file and create a summary",
    "tools": [{
      "type": "code_interpreter",
      "container": {
        "type": "auto",
        "file_ids": ["file-abc123"]
      }
    }]
  }'
```

### 4. Vector Store for RAG

```bash
# 1. Upload documents
curl -X POST http://localhost:3000/api/files \
  -H "Content-Type: multipart/form-data" \
  -F "file=@./docs/manual.pdf" \
  -F "purpose=assistants"

# 2. Create vector store
curl -X POST http://localhost:3000/api/vector-stores \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Product Documentation",
    "file_ids": ["file-abc123"]
  }'

# 3. Search with file_search tool
curl -X POST http://localhost:3000/api/responses/text \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "input": "How do I reset my password?",
    "tools": [{
      "type": "file_search",
      "vector_store_ids": ["vs_xyz789"]
    }]
  }'
```

### 5. Audio Transcription

```bash
curl -X POST http://localhost:3000/api/audio/transcriptions \
  -H "Content-Type: multipart/form-data" \
  -F "file=@./audio.mp3" \
  -F "model=whisper-1"
```

---

## Next Steps

### 📖 Learn More

- **[Full API Documentation](../README.md)** - Complete reference for all endpoints
- **[Architecture Overview](../README.md#architecture-overview)** - Module organization and request flow
- **[Responses API Guide](./RESPONSES_API.md)** - Code Interpreter, tool calling, streaming
- **[Error Handling](../README.md#error-handling)** - Error codes and solutions

### 🧪 Try Advanced Features

1. **Streaming Events** - [README.md § Streaming](../README.md#streaming-events)
2. **Tool Calling** - [README.md § Tools](../README.md#tool-configuration)
3. **Conversation Management** - [README.md § Conversations](../README.md#conversation-management)
4. **Error Recovery** - [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

### 🛠 Development

```bash
# Run tests
npm test                 # Unit tests
npm run test:e2e         # E2E tests (requires API key)

# Code quality
npm run lint             # Check for errors
npm run format           # Format code

# Development mode
npm run start:dev        # Auto-reload on changes
```

### 🚀 Advanced Documentation

See the detailed API documentation:
- **[Responses API](./RESPONSES_API.md)** - Text generation, tool calling, streaming
- **[Streaming Guide](./STREAMING.md)** - 63+ event types, SSE implementation
- **[Architecture](./ARCHITECTURE.md)** - Module structure, request flow
- **[Data Flow](./DATA_FLOW.md)** - Request/response transformations

---

## 🆘 Troubleshooting

### Issue: "OPENAI_API_KEY not set"

**Solution**: Check your `.env` file exists and has the correct format:
```env
OPENAI_API_KEY=sk-your-key-here
```

### Issue: "Cannot find module"

**Solution**: Rebuild the project:
```bash
rm -rf dist node_modules
npm install
npm run build
```

### Issue: "Port 3000 already in use"

**Solution**: Change port in `.env`:
```env
PORT=3001
```

Or kill the process using port 3000:
```bash
# macOS/Linux
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Issue: Rate Limit Errors

**Solution**: The API automatically retries with exponential backoff. If you still hit limits:
1. Reduce concurrent requests
2. Use cheaper models (gpt-4o-mini vs gpt-4o)
3. Check your OpenAI usage limits

### More Help

- [Full Troubleshooting Guide](./TROUBLESHOOTING.md)
- [Common Issues](../README.md#error-handling)
- [Architecture Overview](./ARCHITECTURE.md)

---

## ✅ Success Checklist

- [ ] Node.js 18+ installed
- [ ] Dependencies installed (`npm install`)
- [ ] Project built (`npm run build`)
- [ ] Environment configured (`.env` with API key)
- [ ] Server starts successfully (`npm run start:dev`)
- [ ] Swagger UI accessible (http://localhost:3000/api-docs)
- [ ] First API call successful
- [ ] Tests passing (`npm test`)

**All checked?** You're ready to build with OpenAI APIs! 🎉

---

**Need Help?** See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) or open an issue.

**Ready for More?** Explore [RESPONSES_API.md](./RESPONSES_API.md) and [STREAMING.md](./STREAMING.md).
