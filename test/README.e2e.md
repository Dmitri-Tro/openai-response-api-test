# E2E Test Suite Documentation

This directory contains comprehensive end-to-end tests for the OpenAI Response API wrapper using **real OpenAI API calls**.

## Test Files

### ✅ [app.e2e-spec.ts](app.e2e-spec.ts)
Basic application health check - always runs, no API key needed.

### 🔑 [openai-responses.e2e-spec.ts](openai-responses.e2e-spec.ts)
**17 comprehensive tests** for text generation covering:
- Basic text generation with various parameters
- Validation (missing fields, invalid ranges)
- Advanced features (JSON output, function calling, metadata, store)
- Text streaming (SSE events, sequence numbers)
- Response retrieval and deletion

**Status:** ✅ Passing (requires OPENAI_API_KEY)

### 🔑 [openai-streaming.e2e-spec.ts](openai-streaming.e2e-spec.ts)
**15 comprehensive tests** for streaming features:
- Text delta streaming with multiple chunks
- Usage data tracking
- Function call argument streaming
- Structured JSON output streaming
- Multi-turn conversation streaming
- Stream options and safety identifiers
- Background response resumption

**Status:** ✅ Passing (requires OPENAI_API_KEY)

### 🔑 [openai-images.e2e-spec.ts](openai-images.e2e-spec.ts)
**21 comprehensive tests** for image generation:
- Basic image generation
- Image parameters (size, quality, format, compression)
- Advanced features (transparent backgrounds, input fidelity)
- Progressive streaming with partial images
- Multi-turn image modification
- Performance options (service tier, background execution)

**Status:** ✅ Passing (requires OPENAI_API_KEY)

## Running E2E Tests

### Without API Key (Skips Tests)
```bash
npm run test:e2e
```

Output:
```
⚠️  OPENAI_API_KEY not set - skipping OpenAI E2E tests
To run these tests: OPENAI_API_KEY=sk-... npm run test:e2e

Test Suites: 1 passed (app.e2e-spec.ts only)
Tests:       1 passed, 53 skipped
```

### With API Key (Runs Real Tests)
```bash
OPENAI_API_KEY=sk-your-key-here npm run test:e2e
```

Output:
```
✅ Text response: "Hello World" (35 tokens)
✅ Function call: get_weather({"location": "San Francisco"})
✅ Streaming: 12 deltas, text: "1, 2, 3, 4, 5"
✅ JSON output: {"name": "Alice", "age": 30}
✅ Image: data:image/png;base64,iVBORw0KG...

Test Suites: 4 passed
Tests:       53 passed
Time:        60s
```

## Test Configuration

### Environment Variables
- `OPENAI_API_KEY` - Required for running real API tests
- No key = tests auto-skip with warning

### Models Used
- **Text**: `gpt-4o-mini` - Fast, cheap, suitable for testing
- **Images**: `gpt-5` with `image_generation` tool - Automatically invokes `gpt-image-1` for image generation
  - Usage: Set `model: 'gpt-5'` and the API automatically calls gpt-image-1 via the image_generation tool
  - Supports gpt-5 series, gpt-4.1 series, and o-series (o1, o3, o3-mini, o4-mini)

### Timeouts
- Basic tests: 30 seconds
- Streaming tests: 30 seconds
- Image tests: 60-90 seconds (longer generation time)
- Multi-turn tests: 60 seconds (multiple API calls)

## Test Coverage

### Text Generation (17 tests)
- ✅ Basic text generation
- ✅ Parameter validation (temperature, top_p, max_tokens)
- ✅ Structured output (JSON)
- ✅ Function calling with tools
- ✅ Metadata tracking
- ✅ Response storage and retrieval
- ✅ Response deletion

### Streaming (15 tests)
- ✅ Text delta events
- ✅ Sequence number tracking
- ✅ Usage data in final event
- ✅ Function call streaming
- ✅ Structured JSON streaming
- ✅ Multi-turn conversation
- ✅ Metadata and safety identifiers
- ✅ Background response resumption

### Images (21 tests - Passing)
- ✅ Basic image generation with gpt-5
- ✅ Image parameters (size, quality, format, compression)
- ✅ Advanced features (transparent backgrounds, input fidelity, partial images)
- ✅ Multi-turn image modification with previous_response_id
- ✅ Performance options (service_tier, background execution)

## Cost Estimation

Running the full e2e suite with API key costs approximately:
- **Text tests** (17 tests): ~$0.01 (using gpt-4o-mini with max_output_tokens=16-30)
- **Streaming tests** (15 tests): ~$0.01 (short responses with minimal tokens)
- **Image tests** (21 tests): ~$0.21-$0.42 (21 images at $0.01-$0.02 per image with gpt-image-1)

**Total per run**: ~$0.23-$0.44

**Note**: Image generation is the primary cost driver. Consider running image tests less frequently or with smaller batches for cost optimization.

## CI/CD Integration

### Recommended Setup
```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests
on:
  schedule:
    - cron: '0 0 * * *'  # Daily
  workflow_dispatch:     # Manual trigger

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:e2e
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

### Best Practices
1. **Don't run on every commit** - costs add up quickly
2. **Use scheduled runs** - daily or weekly
3. **Store API key in secrets** - never commit to repo
4. **Set up cost alerts** - monitor OpenAI usage dashboard
5. **Use test API key** - separate from production

## Debugging Failed Tests

### Test Skipped - No API Key
```
⚠️  OPENAI_API_KEY not set - skipping OpenAI E2E tests
```
**Fix**: Set `OPENAI_API_KEY` environment variable

### 401 Unauthorized
```
statusCode: 401
error: Unauthorized
```
**Fix**: Check API key is valid and active

### 429 Rate Limit
```
statusCode: 429
error: Too Many Requests
```
**Fix**: Wait before retrying, or upgrade API tier

### 400 Model Not Found
```
Error: The requested model 'gpt-image-1' is not supported
```
**Fix**: Model not available yet - test will auto-skip

### Network Timeout
```
thrown: "Exceeded timeout of 30000 ms"
```
**Fix**: Increase timeout or check network/API status

## Test Development Guidelines

### Adding New E2E Tests
```typescript
testIf(hasApiKey)('should test new feature', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/responses/text')
    .send({
      model: 'gpt-4o-mini',
      input: 'Test input',
      max_output_tokens: 10, // Keep small for cost
    })
    .expect(201);

  expect(response.body.output_text).toBeTruthy();
  console.log(`✅ Test passed: ${response.body.id}`);
}, 30000); // Timeout in ms
```

### Best Practices
1. ✅ Use `testIf(hasApiKey)` to auto-skip without key
2. ✅ Use `gpt-4o-mini` for text tests (cost efficiency)
3. ✅ Use `gpt-5` for image tests (automatically invokes gpt-image-1)
4. ✅ Set `max_output_tokens` >= 16 (minimum enforced by OpenAI API)
5. ✅ Add descriptive console.log for success cases
6. ✅ Set appropriate timeouts (30s text, 60s images, 90s multi-turn)
7. ✅ Clean up created resources (delete stored responses with store: true)

## Limitations & Known Issues

### Current Limitations
1. **max_output_tokens minimum is 16** - OpenAI API enforces a minimum of 16 tokens, tests use 16-30
2. **Store parameter may not work** - Depends on API tier/access
3. **Background execution** - May require upgraded API access
4. **Some advanced features** - May not be available in all tiers (e.g., prompt caching, certain service_tier options)

### Working Around Limitations
- Tests auto-skip when features aren't available (checks for OPENAI_API_KEY)
- Error messages are captured and logged for debugging
- Retry logic handles transient failures (rate limits, network errors)
- Validation errors are caught and reported with clear messages

## Metrics & Reporting

### Test Execution Metrics
- Total tests: 54 (1 health check + 17 text + 15 streaming + 21 images)
- Skipped without key: 53 tests (all except health check)
- Passing with key: 54 tests (all tests)
- Average runtime: ~60 seconds (with real API, includes image generation)

### Success Indicators
```
✅ Text response: "..." (X tokens)
✅ Function call: get_weather(...)
✅ Streaming: X deltas
✅ Stored and retrieved response: resp_xxx
```

## Future Enhancements

### Potential Additions
- [ ] Video generation tests (when Sora-2 is available in Responses API)
- [ ] Audio/TTS streaming tests (real-time audio generation)
- [ ] Reasoning model (o-series) specific tests with reasoning tokens tracking
- [ ] Load testing (concurrent requests, stress testing)
- [ ] Latency benchmarking (measure p50, p95, p99 response times)
- [ ] Cost tracking and reporting (automated cost analysis per test run)
- [ ] Edge cases: very large outputs (10k+ tokens), rapid sequential requests
- [ ] Parameterized tests using Jest's test.each() for cleaner test code

## Support

For issues or questions:
1. Check OpenAI API status: https://status.openai.com
2. Review OpenAI docs: https://platform.openai.com/docs
3. Check API key permissions in OpenAI dashboard
4. Verify billing/usage limits
