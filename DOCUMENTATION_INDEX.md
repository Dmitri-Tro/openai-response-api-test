# 📚 Documentation Index

> **Complete guide to OpenAI API Testing & Reference Implementation**

Welcome! This index helps you navigate all documentation resources in this project.

---

## 🚀 Start Here

| Document | Audience | Description |
|----------|----------|-------------|
| **[README.md](README.md)** | End Users | Complete API documentation, quick start, usage examples |
| **[QUICK_START.md](docs/QUICK_START.md)** | New Users | 5-minute setup guide with common use cases |
| **[MIGRATION_GUIDE.md](docs/MIGRATION_GUIDE.md)** | Migrators | Migrate from Chat Completions to Responses API |
| **[TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** | Support | Common issues and solutions |

---

## 📖 By Topic

### Getting Started
- [Quick Start Guide](docs/QUICK_START.md) - Get running in 5 minutes
- [Installation & Setup](#) → See [README.md § Quick Start](README.md#quick-start)
- [Environment Configuration](#) → See [README.md § Configuration](README.md#configuration)
- [First API Call](#) → See [docs/QUICK_START.md](docs/QUICK_START.md)

### API Modules
| Module | User Guide | Key Features |
|--------|-----------|--------------|
| **Responses API** | [README.md § Responses API](README.md#responses-api) | [Streaming Events](README.md#streaming-events) |
| **Videos API** | [README.md § Videos API](README.md#videos-api) | [Video Status Polling](README.md#videos-api) |
| **Files API** | [README.md § Files API](README.md#files-api) | [67 File Formats](README.md#supported-file-formats) |
| **Vector Stores API** | [README.md § Vector Stores API](README.md#vector-stores-api) | [RAG Workflows](README.md#rag-workflow-example) |
| **Images API** | [README.md § Images API](README.md#images-api) | [3 Model Comparison](README.md#image-models-comparison) |
| **Audio API** | [README.md § Audio API](README.md#audio-api) | [13 Voice Options](README.md#voice-options) |
| **Code Interpreter** | [README.md § Code Interpreter](README.md#code-interpreter-tool-configuration) | [Production Guide](docs/code-interpreter-guide.md) |

### Architecture & Design
- [Architecture Overview](README.md#architecture-overview) - Module organization, request flow
- [Streaming Events](README.md#streaming-events) - 51+ event types, SSE implementation
- [Error Handling](README.md#error-handling) - Error codes, recovery strategies
- [Testing](README.md#testing) - Unit, integration, E2E tests (2,605 tests)

### Testing
- [Testing Overview](README.md#testing) - Unit, integration, E2E test structure (2,605 tests)
- [Running Tests](docs/QUICK_START.md#development) - Test commands and coverage

### Production Deployment
- [Code Interpreter Production Guide](docs/code-interpreter-guide.md) - Container management, security, optimization
- [Environment Configuration](README.md#configuration) - API keys, timeouts, logging levels
- [Error Handling](README.md#error-handling) - Retry logic, error recovery strategies

### Migration & Troubleshooting
- [Migration from Chat Completions](docs/MIGRATION_GUIDE.md) - Migrate from legacy API
- [Common Issues](docs/TROUBLESHOOTING.md) - Solutions to frequent problems
- [Error Code Reference](README.md#error-codes) - All error codes with solutions

---

## 🔍 By Role

### **I'm a New User**
1. Start: [docs/QUICK_START.md](docs/QUICK_START.md)
2. Configure: [README.md § Configuration](README.md#configuration)
3. First API Call: [docs/QUICK_START.md § First Request](docs/QUICK_START.md)
4. Explore: [README.md § API Documentation](README.md#api-documentation)

### **I'm a Developer**
1. Architecture: [README.md § Architecture Overview](README.md#architecture-overview)
2. Testing: [README.md § Testing](README.md#testing)
3. API Reference: [README.md § API Documentation](README.md#api-documentation)
4. Code Examples: [docs/QUICK_START.md](docs/QUICK_START.md)

### **I'm Deploying to Production**
1. Code Interpreter: [docs/code-interpreter-guide.md](docs/code-interpreter-guide.md)
2. Security: [docs/code-interpreter-guide.md § Security](docs/code-interpreter-guide.md#security-best-practices)
3. Performance: [docs/code-interpreter-guide.md § Optimization](docs/code-interpreter-guide.md#performance-optimization)
4. Configuration: [README.md § Configuration](README.md#configuration)

### **I'm Contributing**
1. Architecture: [README.md § Architecture Overview](README.md#architecture-overview)
2. Testing: [README.md § Testing](README.md#testing)
3. Code Examples: [docs/QUICK_START.md](docs/QUICK_START.md)
4. Migration Guide: [docs/MIGRATION_GUIDE.md](docs/MIGRATION_GUIDE.md)

---

## 🎯 Quick Reference

### Common Tasks

```typescript
// Generate text with Responses API
POST /api/responses/text
{
  "model": "gpt-4o",
  "input": "Hello, world!",
  "stream": false
}

// Upload file for code interpreter
POST /api/files
Content-Type: multipart/form-data
file: <binary>
purpose: "assistants"

// Create vector store for RAG
POST /api/vector-stores
{
  "name": "My Docs",
  "file_ids": ["file-abc123"]
}

// Generate image
POST /api/images/generate
{
  "model": "gpt-image-1",
  "prompt": "A serene landscape",
  "size": "1024x1024"
}
```

### Useful Links

- **Official OpenAI Docs**: [platform.openai.com/docs](https://platform.openai.com/docs)
- **OpenAI Node.js SDK**: [github.com/openai/openai-node](https://github.com/openai/openai-node)
- **NestJS Documentation**: [docs.nestjs.com](https://docs.nestjs.com)
- **Swagger UI** (when running): [localhost:3000/api-docs](http://localhost:3000/api-docs)

---

## 📝 Need Help?

1. **Can't find what you're looking for?** Use GitHub search: <kbd>Ctrl+K</kbd> or <kbd>Cmd+K</kbd>
2. **Having issues?** Check [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for solutions
3. **Migrating from Chat Completions?** See [MIGRATION_GUIDE.md](docs/MIGRATION_GUIDE.md)
4. **Need quick start?** Follow [QUICK_START.md](docs/QUICK_START.md)

---

**Last Updated**: November 2025
