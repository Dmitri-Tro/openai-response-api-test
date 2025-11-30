# 🔄 Migration Guide: Chat Completions → Responses API

> **Migrate from legacy Chat Completions API to the modern Responses API**

The Responses API (released March 2025) combines the simplicity of Chat Completions with advanced features like tool use, state management, and multi-modal support.

---

## Table of Contents

- [Why Migrate?](#why-migrate)
- [Key Differences](#key-differences)
- [Migration Steps](#migration-steps)
- [API Changes](#api-changes)
- [Code Examples](#code-examples)
- [Breaking Changes](#breaking-changes)
- [FAQs](#faqs)

---

## Why Migrate?

### Benefits of Responses API

✅ **Simplified Tool Use** - Built-in tools (web_search, file_search, code_interpreter, computer_use)
✅ **Better Streaming** - 51+ semantic event types vs generic chunks
✅ **State Management** - Native conversation and session handling
✅ **Multi-Modal** - Text, images, audio in single API
✅ **Cost Optimization** - Prompt caching, container reuse
✅ **Future-Proof** - Official recommended API, active development

### Timeline

- **March 2025**: Responses API launched
- **June 2025**: Chat Completions enters maintenance mode (security updates only)
- **December 2025**: New features only in Responses API
- **2026+**: Full deprecation planned

**Recommendation**: Migrate now to benefit from latest features and avoid future breaking changes.

---

## Key Differences

### API Endpoints

| Legacy (Chat Completions) | Modern (Responses API) |
|---------------------------|------------------------|
| `POST /v1/chat/completions` | `POST /v1/responses` |
| `messages` array | `input` string + `instructions` |
| `response_format` object | `text` object |
| No built-in tools | `tools` with file_search, code_interpreter, web_search |
| Basic streaming | 51+ event types with state management |

### Request Structure

**Chat Completions (Legacy)**:
```javascript
{
  "model": "gpt-4o",
  "messages": [
    {"role": "system", "content": "You are helpful"},
    {"role": "user", "content": "Hello"}
  ],
  "response_format": {"type": "text"}
}
```

**Responses API (Modern)**:
```javascript
{
  "model": "gpt-4o",
  "instructions": "You are helpful",
  "input": "Hello",
  "text": {}  // Optional structured output config
}
```

### Response Structure

**Chat Completions (Legacy)**:
```javascript
{
  "id": "chatcmpl_123",
  "choices": [{
    "message": {"role": "assistant", "content": "Hi!"},
    "finish_reason": "stop"
  }],
  "usage": {...}
}
```

**Responses API (Modern)**:
```javascript
{
  "id": "resp_123",
  "output_text": "Hi!",
  "usage": {...},
  "model": "gpt-4o",
  "created_at": 1704067200
}
```

---

## Migration Steps

### Step 1: Update OpenAI SDK

```bash
# Check current version
npm list openai

# Upgrade to latest (6.9.1+)
npm install openai@latest
```

**Minimum required version**: `openai@6.2.0` (Responses API support)

### Step 2: Change Endpoint

**Before**:
```typescript
const response = await client.chat.completions.create({...});
```

**After**:
```typescript
const response = await client.responses.create({...});
```

### Step 3: Update Request Parameters

| Chat Completions | Responses API | Notes |
|------------------|---------------|-------|
| `messages` | `input` | Combine user messages into single string |
| `messages[0].content` (system) | `instructions` | System message becomes instructions |
| `response_format` | `text` | New structured output configuration |
| `tools` (functions only) | `tools` (built-in + functions) | Enhanced with OpenAI tools |
| `stream` | `stream` | Same behavior, better events |

### Step 4: Update Response Handling

**Before (Chat Completions)**:
```typescript
const content = response.choices[0].message.content;
const tokens = response.usage.total_tokens;
```

**After (Responses API)**:
```typescript
const content = response.output_text;
const tokens = response.usage.total_tokens;
```

### Step 5: Update Streaming Code

**Before (Chat Completions)**:
```typescript
for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta?.content || '';
  process.stdout.write(delta);
}
```

**After (Responses API)**:
```typescript
for await (const event of stream) {
  if (event.type === 'response.output_text.delta') {
    process.stdout.write(event.delta);
  }
}
```

---

## API Changes

### 1. Messages → Input + Instructions

**Before**:
```typescript
// Chat Completions
const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    {role: 'system', content: 'You are a helpful assistant'},
    {role: 'user', content: 'What is TypeScript?'}
  ]
});
```

**After**:
```typescript
// Responses API
const response = await client.responses.create({
  model: 'gpt-4o',
  instructions: 'You are a helpful assistant',
  input: 'What is TypeScript?'
});
```

**Migration tip**: Extract system message → `instructions`, combine user messages → `input`

### 2. Multi-Turn Conversations

**Before**:
```typescript
// Chat Completions - manual message history
const messages = [
  {role: 'system', content: 'You are helpful'},
  {role: 'user', content: 'Hi'},
  {role: 'assistant', content: 'Hello!'},
  {role: 'user', content: 'How are you?'}
];

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages
});
```

**After**:
```typescript
// Responses API - conversation_id handles state
const response1 = await client.responses.create({
  model: 'gpt-4o',
  input: 'Hi'
});

const conversationId = response1.conversation_id;

const response2 = await client.responses.create({
  model: 'gpt-4o',
  input: 'How are you?',
  conversation_id: conversationId  // Maintains context
});
```

**Migration tip**: Use `conversation_id` for state management instead of manual message arrays

### 3. Tool Calling (Function Calling)

**Before**:
```typescript
// Chat Completions
const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{role: 'user', content: 'What is the weather?'}],
  tools: [{
    type: 'function',
    function: {
      name: 'get_weather',
      parameters: {...}
    }
  }]
});
```

**After**:
```typescript
// Responses API
const response = await client.responses.create({
  model: 'gpt-4o',
  input: 'What is the weather?',
  tools: [{
    type: 'function',  // Same as before
    name: 'get_weather',
    parameters: {...}
  }]
});
```

**Migration tip**: Function tools work the same, but now you can add built-in tools (web_search, file_search, code_interpreter)

### 4. Streaming Events

**Before**:
```typescript
// Chat Completions - generic chunks
for await (const chunk of stream) {
  console.log(chunk.choices[0]?.delta);
}
```

**After**:
```typescript
// Responses API - semantic events
for await (const event of stream) {
  switch (event.type) {
    case 'response.created':
      console.log('Started:', event.response.id);
      break;
    case 'response.output_text.delta':
      process.stdout.write(event.delta);
      break;
    case 'response.completed':
      console.log('\nDone!');
      break;
  }
}
```

**Migration tip**: Use event types instead of checking for delta presence

---

## Code Examples

### Example 1: Simple Text Generation

<table>
<tr>
<th>Chat Completions (Legacy)</th>
<th>Responses API (Modern)</th>
</tr>
<tr>
<td>

```typescript
import OpenAI from 'openai';

const client = new OpenAI();

const response = await client
  .chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: 'Say hi'
      }
    ]
  });

console.log(
  response.choices[0]
    .message.content
);
```

</td>
<td>

```typescript
import OpenAI from 'openai';

const client = new OpenAI();

const response = await client
  .responses.create({
    model: 'gpt-4o',
    input: 'Say hi'
  });

console.log(
  response.output_text
);
```

</td>
</tr>
</table>

### Example 2: Streaming

<table>
<tr>
<th>Chat Completions (Legacy)</th>
<th>Responses API (Modern)</th>
</tr>
<tr>
<td>

```typescript
const stream = await client
  .chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: 'Count to 5'
    }],
    stream: true
  });

for await (const chunk of stream) {
  const delta = chunk.choices[0]
    ?.delta?.content || '';
  process.stdout.write(delta);
}
```

</td>
<td>

```typescript
const stream = await client
  .responses.create({
    model: 'gpt-4o',
    input: 'Count to 5',
    stream: true
  });

for await (const event of stream) {
  if (event.type ===
      'response.output_text.delta') {
    process.stdout.write(
      event.delta
    );
  }
}
```

</td>
</tr>
</table>

### Example 3: With System Instructions

<table>
<tr>
<th>Chat Completions (Legacy)</th>
<th>Responses API (Modern)</th>
</tr>
<tr>
<td>

```typescript
const response = await client
  .chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are a pirate'
      },
      {
        role: 'user',
        content: 'Introduce yourself'
      }
    ]
  });
```

</td>
<td>

```typescript
const response = await client
  .responses.create({
    model: 'gpt-4o',
    instructions: 'You are a pirate',
    input: 'Introduce yourself'
  });
```

</td>
</tr>
</table>

---

## Breaking Changes

### 1. No More `choices` Array

**Impact**: Code accessing `response.choices[0]` will break

**Solution**:
```typescript
// Before
const text = response.choices[0].message.content;

// After
const text = response.output_text;
```

### 2. Different Event Structure for Streaming

**Impact**: Streaming parsers expecting Chat Completions format will break

**Solution**: Update event handlers to use new event types

```typescript
// Before
if (chunk.choices[0]?.delta?.content) {
  // Process delta
}

// After
if (event.type === 'response.output_text.delta') {
  // Process event.delta
}
```

### 3. Response Format Changes

**Impact**: `response_format: {type: "json_object"}` syntax changed

**Solution**:
```typescript
// Before (Chat Completions)
{
  model: 'gpt-4o',
  response_format: {type: "json_object"}
}

// After (Responses API)
{
  model: 'gpt-4o',
  text: {
    type: "json_object"
  }
}
```

### 4. Function Tools Syntax

**Impact**: Minor - `function` wrapper removed from tools

**Solution**:
```typescript
// Before
tools: [{
  type: 'function',
  function: {name: 'get_weather', ...}
}]

// After (flattened)
tools: [{
  type: 'function',
  name: 'get_weather',
  ...
}]
```

---

## FAQs

### Q: Can I use both APIs simultaneously during migration?

**A**: Yes! The OpenAI SDK supports both APIs in the same codebase:

```typescript
// Old code still works
const chatResponse = await client.chat.completions.create({...});

// New code uses Responses API
const response = await client.responses.create({...});
```

### Q: Will my existing API key work?

**A**: Yes, the same API key works for both APIs.

### Q: Do I need to change my pricing plan?

**A**: No, pricing is per-token and model-based, not API-based.

### Q: What about fine-tuned models?

**A**: Fine-tuned models work with Responses API using the same `model` parameter.

### Q: Are there performance differences?

**A**: Responses API has slight improvements:
- Better prompt caching (automatic)
- More efficient streaming (semantic events)
- Built-in state management (reduces prompt size)

### Q: What if I use LangChain or other frameworks?

**A**: Most frameworks support Responses API:
- **LangChain**: Update to latest version, use `ChatOpenAI` with `api_type="responses"`
- **LlamaIndex**: Native support in v0.10+
- **Haystack**: Adapter available in v2.0+

### Q: Can I still use JSON mode?

**A**: Yes, but the syntax changed:

```typescript
// Before
response_format: {type: "json_object"}

// After
text: {type: "json_object"}
```

---

## Next Steps

1. **Test Migration** - Start with non-critical endpoints
2. **Update Dependencies** - Upgrade OpenAI SDK to 6.9.1+
3. **Refactor Code** - Use find-and-replace for common patterns
4. **Update Tests** - Adjust assertions for new response structure
5. **Monitor Logs** - Watch for errors during gradual rollout
6. **Go Production** - Switch traffic after successful testing

---

## Additional Resources

- **Official Migration Guide**: [platform.openai.com/docs/guides/migrate-to-responses](https://platform.openai.com/docs/guides/migrate-to-responses)
- **Responses API Docs**: [platform.openai.com/docs/api-reference/responses](https://platform.openai.com/docs/api-reference/responses)
- **SDK Documentation**: [github.com/openai/openai-node](https://github.com/openai/openai-node)
- **This Project's Examples**: [README.md](../README.md)

---

**Need Help?** See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) or open an issue.
