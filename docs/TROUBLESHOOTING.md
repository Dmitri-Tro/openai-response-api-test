# 🔧 Troubleshooting Guide

> **Solutions to common issues and error messages**

This guide helps you quickly resolve common problems when using this OpenAI API implementation.

---

## Table of Contents

- [Environment & Configuration](#environment--configuration)
- [API Errors](#api-errors)
- [Build & Runtime Errors](#build--runtime-errors)
- [Streaming Issues](#streaming-issues)
- [File Upload Problems](#file-upload-problems)
- [Performance Issues](#performance-issues)
- [Testing Problems](#testing-problems)

---

## Environment & Configuration

### ❌ Error: "OPENAI_API_KEY not set"

**Symptoms**:
```
[Nest] ERROR Env validation error: Required field OPENAI_API_KEY is missing
```

**Causes**:
1. Missing `.env` file
2. API key not in `.env`
3. API key format incorrect

**Solutions**:

1. **Create `.env` file**:
   ```bash
   cp .env.example .env
   ```

2. **Add your API key**:
   ```env
   OPENAI_API_KEY=sk-your-actual-api-key-here
   ```

3. **Verify format**:
   - Must start with `sk-`
   - No quotes around value
   - No spaces before/after `=`

4. **Restart server**:
   ```bash
   npm run start:dev
   ```

**Still not working?**
```bash
# Check if .env is being loaded
cat .env | grep OPENAI_API_KEY

# Verify environment variable
echo $OPENAI_API_KEY
```

---

### ❌ Error: "Port 3000 already in use"

**Symptoms**:
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution 1 - Change Port**:
```env
# In .env file
PORT=3001
```

**Solution 2 - Kill Existing Process**:

**macOS/Linux**:
```bash
# Find process using port 3000
lsof -ti:3000

# Kill it
lsof -ti:3000 | xargs kill -9
```

**Windows**:
```cmd
# Find process
netstat -ano | findstr :3000

# Kill it (replace <PID> with actual number)
taskkill /PID <PID> /F
```

---

### ❌ Error: "Cannot find module"

**Symptoms**:
```
Error: Cannot find module './dist/main'
```

**Cause**: Project not built or stale build

**Solution**:
```bash
# Clean rebuild
rm -rf dist node_modules
npm install
npm run build
npm run start
```

---

### ❌ Error: "Invalid API key format"

**Symptoms**:
```
[Nest] ERROR OpenAI API key must start with 'sk-'
```

**Solution**:

1. **Check API key** at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. **Copy entire key** (including `sk-` prefix)
3. **Update `.env`**:
   ```env
   OPENAI_API_KEY=sk-proj-abc123xyz789...
   ```

**Note**: New API keys start with `sk-proj-` instead of just `sk-`

---

## API Errors

### ❌ Error 401: "Incorrect API key"

**Symptoms**:
```json
{
  "error": {
    "message": "Incorrect API key provided",
    "type": "invalid_request_error",
    "code": "invalid_api_key"
  }
}
```

**Causes**:
1. API key is wrong/expired
2. API key not active
3. Typo in `.env` file

**Solutions**:

1. **Generate new API key**:
   - Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Click "Create new secret key"
   - Copy and paste into `.env`

2. **Check organization**:
   - Ensure API key belongs to correct organization
   - Check organization settings

3. **Verify billing**:
   - Go to [platform.openai.com/account/billing](https://platform.openai.com/account/billing)
   - Ensure payment method is valid

---

### ❌ Error 429: "Rate limit exceeded"

**Symptoms**:
```json
{
  "error": {
    "message": "Rate limit reached",
    "type": "tokens",
    "code": "rate_limit_exceeded"
  }
}
```

**Automatic Handling**: This API automatically retries with exponential backoff (up to 3 attempts).

**Manual Solutions**:

1. **Wait and retry** - Rate limits reset after 1 minute
2. **Reduce request rate** - Add delays between requests
3. **Upgrade tier** - Higher tiers get better rate limits
4. **Use cheaper models** - `gpt-4o-mini` has higher limits than `gpt-4o`

**Check limits**:
```bash
# Response headers show rate limit info
curl -i http://localhost:3000/api/responses/text \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","input":"Hi"}'

# Look for headers:
# x-ratelimit-limit-requests: 500
# x-ratelimit-remaining-requests: 499
# x-ratelimit-reset-requests: 120ms
```

---

### ❌ Error 500: "The server had an error"

**Symptoms**:
```json
{
  "error": {
    "message": "The server had an error while processing your request",
    "type": "server_error"
  }
}
```

**Automatic Handling**: This API automatically retries server errors.

**Manual Solutions**:

1. **Wait 30 seconds** - OpenAI servers may be experiencing issues
2. **Check status** - Visit [status.openai.com](https://status.openai.com)
3. **Retry request** - Often works on second attempt
4. **Use different model** - Try `gpt-4o-mini` if `gpt-4o` fails

---

### ❌ Error: "Invalid model parameter"

**Symptoms**:
```json
{
  "error": {
    "message": "The model `gpt-5` does not exist",
    "type": "invalid_request_error",
    "code": "model_not_found"
  }
}
```

**Solution**: Use supported models

**Supported models**:
- Text: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo`, `o1`, `o3-mini`
- Images: `gpt-image-1`, `dall-e-3`, `dall-e-2`
- Audio: `whisper-1`, `gpt-4o-transcribe`, `tts-1`, `tts-1-hd`
- Video: `sora-2`, `sora-2-pro`

**Check model availability**:
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

---

## Build & Runtime Errors

### ❌ TypeScript Compilation Errors

**Symptoms**:
```
error TS2304: Cannot find name 'any'
```

**Cause**: Strict TypeScript mode enabled

**Solution**: Fix type errors (do NOT disable strict mode)

```typescript
// ❌ Wrong - using 'any'
function process(data: any) {...}

// ✅ Correct - proper type
import type { Responses } from 'openai/resources/responses';
function process(data: Responses.Response) {...}
```

---

### ❌ ESLint Errors

**Symptoms**:
```
error @typescript-eslint/no-explicit-any: Unexpected any. Specify a different type
```

**Solution**: Use proper types instead of `any`

```typescript
// ❌ Wrong
const result: any = await someFunction();

// ✅ Correct
const result: Responses.Response = await someFunction();

// ✅ Also correct for unknown types
const result: unknown = await someFunction();
if (typeof result === 'object' && result !== null) {
  // Type-safe access
}
```

---

## Streaming Issues

### ❌ Error: "Stream not closing"

**Symptoms**: Stream continues indefinitely, no `response.completed` event

**Causes**:
1. Network timeout
2. Server-side issue
3. Client not consuming events fast enough

**Solutions**:

1. **Add timeout**:
   ```typescript
   const timeout = setTimeout(() => {
     stream.controller.abort();
   }, 60000); // 60 seconds

   for await (const event of stream) {
     // Process event
   }

   clearTimeout(timeout);
   ```

2. **Check event handling**:
   ```typescript
   for await (const event of stream) {
     console.log('Event:', event.type); // Log all events

     if (event.type === 'response.completed') {
       break; // Explicit exit
     }
   }
   ```

---

### ❌ Error: "Unexpected SSE format"

**Symptoms**: Can't parse Server-Sent Events

**Solution**: Use proper SSE parser

```typescript
// ✅ Correct - Using SDK
for await (const event of stream) {
  // SDK handles parsing
  console.log(event);
}

// ❌ Wrong - Manual parsing
const text = await stream.text();
const lines = text.split('\n');
// Error-prone!
```

---

## File Upload Problems

### ❌ Error: "File too large"

**Symptoms**:
```json
{
  "error": {
    "message": "File size exceeds maximum allowed (512 MB)",
    "code": "file_too_large"
  }
}
```

**Limits**:
- **Files API**: 512 MB
- **Audio transcription**: 25 MB
- **Image upload**: 4 MB

**Solutions**:

1. **Compress file**:
   ```bash
   # For images
   convert input.png -quality 85 output.jpg

   # For audio
   ffmpeg -i input.mp3 -b:a 128k output.mp3
   ```

2. **Split file**:
   ```bash
   # Split into 100MB chunks
   split -b 100m large_file.csv chunk_
   ```

---

### ❌ Error: "Invalid file type"

**Symptoms**:
```json
{
  "error": {
    "message": "File type 'exe' not supported for purpose 'assistants'",
    "code": "invalid_file_type"
  }
}
```

**Solution**: Use supported formats

**Supported formats by purpose**:

- **assistants**: .txt, .pdf, .docx, .csv, .json, .md (67 total formats)
- **transcription**: .flac, .mp3, .mp4, .mpeg, .mpga, .m4a, .ogg, .wav, .webm
- **images**: .png, .jpg, .jpeg, .webp, .gif

**Check file format**:
```bash
file myfile.dat  # Shows actual file type
```

---

## Performance Issues

### ❌ Slow Response Times

**Symptoms**: Requests taking > 30 seconds

**Causes**:
1. Using expensive models (`gpt-4o` vs `gpt-4o-mini`)
2. Large input prompts
3. Code interpreter execution time
4. Network latency

**Solutions**:

1. **Use faster models**:
   ```json
   {
     "model": "gpt-4o-mini"  // 3-5x faster than gpt-4o
   }
   ```

2. **Enable streaming**:
   ```json
   {
     "stream": true  // See results immediately
   }
   ```

3. **Reduce prompt size**:
   ```typescript
   // ❌ Slow - large context
   input: longDocument + question

   // ✅ Fast - use vector search
   tools: [{
     type: 'file_search',
     vector_store_ids: ['vs_123']
   }]
   ```

4. **Reuse containers** (code interpreter):
   ```json
   {
     "container_id": "container_xyz"  // Saves $0.03 + startup time
   }
   ```

---

### ❌ High API Costs

**Symptoms**: Unexpected billing charges

**Solutions**:

1. **Use cheaper models**:
   - `gpt-4o-mini` ($0.15/1M tokens) vs `gpt-4o` ($2.50/1M tokens)

2. **Enable prompt caching**:
   ```json
   {
     "prompt_cache_key": "my-instructions-v1"
   }
   ```

3. **Reuse code interpreter containers**:
   ```json
   {
     "container_id": "container_abc"  // Saves $0.03 per request
   }
   ```

4. **Monitor usage**:
   - Check logs at `logs/YYYY-MM-DD/responses.log`
   - Look for `cost_estimate` field

---

## Testing Problems

### ❌ E2E Tests Skipped

**Symptoms**:
```
⚠️  OPENAI_API_KEY not set - skipping E2E tests
```

**Cause**: API key not in environment

**Solution**:

1. **Set API key for tests**:
   ```bash
   OPENAI_API_KEY=sk-... npm run test:e2e
   ```

2. **Or add to `.env.test`**:
   ```env
   OPENAI_API_KEY=sk-test-key-here
   ```

---

### ❌ Tests Failing with Rate Limits

**Symptoms**: E2E tests fail with 429 errors

**Solutions**:

1. **Reduce concurrency**:
   ```bash
   jest --maxWorkers=1  # Run tests sequentially
   ```

2. **Add delays**:
   ```typescript
   afterEach(async () => {
     await new Promise(resolve => setTimeout(resolve, 1000));
   });
   ```

3. **Use test API key** with higher limits

---

## Advanced Troubleshooting

### Enable Debug Logging

```env
# In .env
LOG_LEVEL=debug
```

**Check logs**:
```bash
tail -f logs/$(date +%Y-%m-%d)/responses.log
```

### Inspect Network Requests

```typescript
// Add request interceptor
axios.interceptors.request.use(request => {
  console.log('Request:', request);
  return request;
});
```

### Check OpenAI Status

- **Status Page**: [status.openai.com](https://status.openai.com)
- **API Incidents**: [status.openai.com/incidents](https://status.openai.com/incidents)

### Verify SDK Version

```bash
npm list openai
# Should show: openai@6.9.1 or higher
```

---

## Still Having Issues?

1. **Check logs**: `logs/YYYY-MM-DD/*.log`
2. **Enable debug mode**: `LOG_LEVEL=debug`
3. **Test with minimal example**:
   ```bash
   curl -X POST http://localhost:3000/api/responses/text \
     -H "Content-Type: application/json" \
     -d '{"model":"gpt-4o-mini","input":"Hi"}'
   ```
4. **Review error code**: See [README.md § Error Codes](../README.md#error-codes)
5. **Check OpenAI status**: [status.openai.com](https://status.openai.com)

---

## Common Error Codes Reference

| Code | Meaning | Quick Fix |
|------|---------|-----------|
| `invalid_api_key` | Wrong API key | Regenerate at platform.openai.com |
| `rate_limit_exceeded` | Too many requests | Wait 1 minute, reduce rate |
| `insufficient_quota` | Out of credits | Add payment method |
| `model_not_found` | Invalid model | Use supported model |
| `context_length_exceeded` | Prompt too long | Reduce input or use vector search |
| `file_too_large` | File > 512 MB | Compress or split file |
| `invalid_file_type` | Unsupported format | Check supported formats |

**Full error reference**: [README.md § Error Handling](../README.md#error-handling)

---

**Last Updated**: January 2025
