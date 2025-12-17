# Vector Stores API Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Vector Store Lifecycle](#vector-store-lifecycle)
4. [REST Endpoints](#rest-endpoints)
5. [Request Parameters](#request-parameters)
6. [Response Structure](#response-structure)
7. [File Operations](#file-operations)
8. [Batch Operations](#batch-operations)
9. [Chunking Strategies](#chunking-strategies)
10. [Search & Ranking](#search--ranking)
11. [Polling Patterns](#polling-patterns)
12. [Custom Validators](#custom-validators)
13. [SDK Integration](#sdk-integration)
14. [Error Handling](#error-handling)
15. [Testing Architecture](#testing-architecture)
16. [Usage Examples](#usage-examples)
17. [Integration with Other APIs](#integration-with-other-apis)

---

## Overview

The Vector Stores API enables semantic search capabilities over documents by indexing files into searchable vector embeddings. Vector stores are the foundation for RAG (Retrieval-Augmented Generation) workflows, powering the `file_search` tool in the Responses API.

### Key Capabilities

| Feature | Description |
|---------|-------------|
| **Create** | Create vector stores with optional files and chunking configuration |
| **Search** | Semantic search with ranking, filtering, and score thresholds |
| **Files** | Add, list, update, and remove files from vector stores |
| **Batches** | Bulk file operations (up to 500 files per batch) |
| **Polling** | Wait for indexing with exponential backoff |
| **Expiration** | Auto-delete after configurable inactivity period |
| **Metadata** | Custom key-value pairs for organization and filtering |

### Service Architecture

The `OpenAIVectorStoresService` provides **19 public methods** organized into 4 functional groups:

```
Vector Store Management (6 methods)
├── createVectorStore()
├── retrieveVectorStore()
├── updateVectorStore()
├── listVectorStores()
├── deleteVectorStore()
└── searchVectorStore()

File Operations (7 methods)
├── addFile()
├── listFiles()
├── getFile()
├── updateFile()
├── removeFile()
├── getFileContent()
└── pollFileUntilComplete()

Batch Operations (4 methods)
├── createFileBatch()
├── getFileBatch()
├── cancelFileBatch()
└── listBatchFiles()

Polling Methods (2 methods)
├── pollUntilComplete()
└── pollBatchUntilComplete()
```

---

## Architecture

### Module Structure

```
src/openai/
├── controllers/
│   └── vector-stores.controller.ts    # 18 REST endpoints
├── services/
│   └── openai-vector-stores.service.ts # 19 service methods
├── dto/
│   └── vector-stores/
│       ├── create-vector-store.dto.ts
│       ├── update-vector-store.dto.ts
│       ├── list-vector-stores.dto.ts
│       ├── search-vector-store.dto.ts
│       ├── add-file.dto.ts
│       ├── add-file-batch.dto.ts
│       └── list-vector-store-files.dto.ts
├── validators/
│   ├── chunking-strategy.validator.ts
│   ├── search-filter.validator.ts
│   ├── metadata.validator.ts
│   └── vector-store-id.validator.ts
└── interfaces/
    └── vector-stores/
        ├── vector-store.interface.ts
        ├── vector-store-file.interface.ts
        ├── vector-store-batch.interface.ts
        ├── chunking-strategy.interface.ts
        └── search-filter.interface.ts
```

### Request Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VECTOR STORES API REQUEST FLOW                       │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │ HTTP Request │
    └──────┬───────┘
           │
           ▼
    ┌──────────────────────┐
    │  LoggingInterceptor  │ Records start time, request details
    └──────────┬───────────┘
           │
           ▼
    ┌──────────────────────┐
    │ VectorStoresController│ Routes to appropriate handler
    │                      │ Validates DTOs with decorators
    └──────────┬───────────┘
           │
           ▼
    ┌──────────────────────┐
    │ Custom Validators    │ @IsChunkingStrategyValid
    │                      │ @IsSearchFilterValid
    │                      │ @IsMetadataValid
    └──────────┬───────────┘
           │
           ▼
    ┌──────────────────────┐
    │ OpenAIVectorStores   │ Builds SDK parameters
    │      Service         │ Calls OpenAI client methods
    └──────────┬───────────┘
           │
           ▼
    ┌──────────────────────┐
    │     OpenAI SDK       │ client.vectorStores.*
    │                      │ client.vectorStores.files.*
    │                      │ client.vectorStores.fileBatches.*
    └──────────┬───────────┘
           │
           ▼
    ┌──────────────────────┐
    │   LoggerService      │ Logs request/response with metadata
    │                      │ Stores in logs/YYYY-MM-DD/
    └──────────┬───────────┘
           │
           ▼
    ┌──────────────────────┐
    │ OpenAIExceptionFilter│ Catches errors, transforms to
    │                      │ EnhancedErrorResponse with hints
    └──────────┬───────────┘
           │
           ▼
    ┌──────────────┐
    │ HTTP Response│ (JSON)
    └──────────────┘
```

### Nested Route Architecture

```
/api/vector-stores
├── POST /                                    Create vector store
├── GET /                                     List vector stores
├── GET /:vectorStoreId                       Get vector store
├── PATCH /:vectorStoreId                     Update vector store
├── DELETE /:vectorStoreId                    Delete vector store
├── POST /:vectorStoreId/search               Search vector store
├── POST /:vectorStoreId/poll                 Poll until complete
│
├── /:vectorStoreId/files
│   ├── POST /                                Add file
│   ├── GET /                                 List files
│   ├── GET /:fileId                          Get file
│   ├── PATCH /:fileId                        Update file attributes
│   ├── DELETE /:fileId                       Remove file
│   ├── GET /:fileId/content                  Get file content
│   └── POST /:fileId/poll                    Poll file until complete
│
└── /:vectorStoreId/file-batches
    ├── POST /                                Create batch
    ├── GET /:batchId                         Get batch
    ├── POST /:batchId/cancel                 Cancel batch
    └── GET /:batchId/files                   List batch files
```

---

## Vector Store Lifecycle

### Status States

```
┌─────────────────────────────────────────────────────────────────┐
│                    VECTOR STORE STATUS LIFECYCLE                 │
└─────────────────────────────────────────────────────────────────┘

                        ┌─────────────┐
                        │   Create    │
                        │   Request   │
                        └──────┬──────┘
                               │
                               ▼
                        ┌─────────────┐
                        │ in_progress │ ← Files being indexed
                        │             │   file_counts tracked
                        └──────┬──────┘
                               │
              ┌────────────────┴────────────────┐
              │   All files indexed             │   Expiration reached
              │                                 │   (if expires_after set)
              ▼                                 ▼
       ┌─────────────┐                   ┌─────────────┐
       │  completed  │ ← Ready           │   expired   │ ← Auto-deleted
       │             │   for search      │             │
       └─────────────┘                   └─────────────┘
```

### File Counts Structure

Track indexing progress with file_counts:

```typescript
{
  total: number,        // Total files in vector store
  in_progress: number,  // Files currently being indexed
  completed: number,    // Successfully indexed files
  failed: number,       // Files that failed indexing
  cancelled: number     // Files whose indexing was cancelled
}
```

### Expiration Policy

Vector stores can auto-delete after inactivity:

```typescript
{
  anchor: 'last_active_at',  // Only supported value
  days: number               // 1-365 days
}
```

**Inactivity Triggers:**
- No searches performed
- No files added/removed
- No updates to vector store

---

## REST Endpoints

### Endpoint Overview

| Method | Route | Handler | Description |
|--------|-------|---------|-------------|
| POST | `/api/vector-stores` | createVectorStore | Create new vector store |
| GET | `/api/vector-stores` | listVectorStores | List with pagination |
| GET | `/api/vector-stores/:id` | retrieveVectorStore | Get by ID |
| PATCH | `/api/vector-stores/:id` | updateVectorStore | Update properties |
| DELETE | `/api/vector-stores/:id` | deleteVectorStore | Delete vector store |
| POST | `/api/vector-stores/:id/search` | searchVectorStore | Semantic search |
| POST | `/api/vector-stores/:id/poll` | pollUntilComplete | Wait for indexing |

### POST /api/vector-stores - Create Vector Store

Create a new vector store with optional files and configuration.

**Request:**
```json
{
  "name": "Knowledge Base",
  "file_ids": ["file-abc123", "file-def456"],
  "chunking_strategy": {
    "type": "auto"
  },
  "expires_after": {
    "anchor": "last_active_at",
    "days": 7
  },
  "metadata": {
    "project": "documentation",
    "version": "1.0"
  }
}
```

**Response:** `201 Created`
```json
{
  "id": "vs_abc123xyz789",
  "object": "vector_store",
  "created_at": 1699000000,
  "name": "Knowledge Base",
  "usage_bytes": 0,
  "file_counts": {
    "in_progress": 2,
    "completed": 0,
    "failed": 0,
    "cancelled": 0,
    "total": 2
  },
  "status": "in_progress",
  "last_active_at": 1699000000,
  "expires_after": {
    "anchor": "last_active_at",
    "days": 7
  },
  "expires_at": null,
  "metadata": {
    "project": "documentation",
    "version": "1.0"
  }
}
```

### GET /api/vector-stores - List Vector Stores

List all vector stores with cursor-based pagination.

**Request:**
```http
GET /api/vector-stores?limit=20&order=desc HTTP/1.1
```

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| limit | number | No | 20 | Results per page (1-100) |
| order | string | No | desc | Sort order (asc/desc) |
| after | string | No | - | Cursor for next page |
| before | string | No | - | Cursor for previous page |

**Response:** `200 OK`
```json
[
  {
    "id": "vs_abc123xyz789",
    "object": "vector_store",
    "name": "Knowledge Base",
    "status": "completed",
    "file_counts": { "total": 5, "completed": 5, ... }
  },
  ...
]
```

### POST /api/vector-stores/:id/search - Semantic Search

Perform semantic search with ranking and filtering.

**Request:**
```json
{
  "query": "How do I authenticate users?",
  "max_num_results": 10,
  "ranking_options": {
    "ranker": "auto",
    "score_threshold": 0.5
  },
  "filters": {
    "type": "and",
    "filters": [
      { "key": "category", "type": "eq", "value": "authentication" },
      { "key": "year", "type": "gte", "value": 2024 }
    ]
  }
}
```

**Response:** `200 OK`
```json
[
  {
    "file_id": "file-abc123",
    "filename": "auth-guide.pdf",
    "score": 0.89,
    "content": [
      {
        "type": "text",
        "text": "User authentication is performed using JWT tokens..."
      }
    ],
    "attributes": { "category": "authentication" }
  }
]
```

---

## Request Parameters

### CreateVectorStoreDto

```typescript
export class CreateVectorStoreDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @Matches(/^file-/, { each: true })
  file_ids?: string[];  // Max 500 files

  @IsOptional()
  @IsChunkingStrategyValid()
  chunking_strategy?: VectorStores.FileChunkingStrategyParam;

  @IsOptional()
  @ValidateNested()
  @Type(() => ExpiresAfterDto)
  expires_after?: ExpiresAfterDto;

  @IsOptional()
  @IsMetadataValid()
  metadata?: Shared.Metadata;  // Max 16 pairs

  @IsOptional()
  @IsString()
  description?: string;
}

export class ExpiresAfterDto {
  @IsString()
  anchor!: 'last_active_at';  // Only supported value

  @IsNumber()
  @Min(1)
  @Max(365)
  days!: number;
}
```

### UpdateVectorStoreDto

```typescript
export class UpdateVectorStoreDto {
  @IsOptional()
  @IsString()
  name?: string | null;  // Set to null to remove

  @IsOptional()
  @ValidateNested()
  @Type(() => ExpiresAfterDto)
  expires_after?: ExpiresAfterDto | null;

  @IsOptional()
  @IsMetadataValid()
  metadata?: Shared.Metadata | null;  // Replaced entirely
}
```

**Note:** Cannot update `file_ids` or `chunking_strategy` after creation.

### SearchVectorStoreDto

```typescript
export class SearchVectorStoreDto {
  @IsString({ each: true })
  query!: string | string[];  // Single or multi-query

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  max_num_results?: number;  // Default: 20

  @IsOptional()
  @IsSearchFilterValid()
  filters?: Shared.ComparisonFilter | Shared.CompoundFilter;

  @IsOptional()
  @ValidateNested()
  @Type(() => RankingOptionsDto)
  ranking_options?: RankingOptionsDto;

  @IsOptional()
  @IsBoolean()
  rewrite_query?: boolean;
}

export class RankingOptionsDto {
  @IsOptional()
  @IsEnum(['none', 'auto', 'default-2024-11-15'])
  ranker?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  score_threshold?: number;
}
```

### ListVectorStoresDto

```typescript
export class ListVectorStoresDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;  // Default: 20

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  order?: 'asc' | 'desc';  // Default: 'desc'

  @IsOptional()
  @IsString()
  after?: string;  // Cursor for next page

  @IsOptional()
  @IsString()
  before?: string;  // Cursor for previous page
}
```

---

## Response Structure

### VectorStore Object

```typescript
interface VectorStore {
  id: string;                     // Format: vs_xxx
  object: 'vector_store';
  created_at: number;             // Unix timestamp
  name: string | null;
  usage_bytes: number;            // Storage used
  file_counts: FileCounts;
  status: 'in_progress' | 'completed' | 'expired';
  last_active_at: number | null;  // Last activity timestamp
  expires_after: ExpiresAfter | null;
  expires_at: number | null;      // Calculated expiration
  metadata: Record<string, string>;
}
```

### VectorStoreFile Object

```typescript
interface VectorStoreFile {
  id: string;                     // File ID (file-xxx)
  object: 'vector_store.file';
  usage_bytes: number;
  created_at: number;
  vector_store_id: string;
  status: 'in_progress' | 'completed' | 'failed' | 'cancelled';
  last_error: LastError | null;
  chunking_strategy: ChunkingStrategy;
}

interface LastError {
  code: string;      // e.g., 'server_error', 'unsupported_file'
  message: string;
}
```

### VectorStoreFileBatch Object

```typescript
interface VectorStoreFileBatch {
  id: string;                     // Format: vsfb_xxx
  object: 'vector_store.files_batch';
  created_at: number;
  vector_store_id: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  file_counts: FileCounts;
}
```

### Search Response

```typescript
interface VectorStoreSearchResponse {
  file_id: string;
  filename: string;
  score: number;                  // Relevance (0-1)
  content: Array<{
    type: 'text';
    text: string;
  }>;
  attributes: Record<string, any> | null;
}
```

---

## File Operations

### Adding Files

Files must be uploaded via the Files API before attaching to vector stores.

**Endpoint:** `POST /api/vector-stores/:vectorStoreId/files`

**Request:**
```json
{
  "file_id": "file-abc123xyz789",
  "attributes": {
    "category": "documentation",
    "priority": "high"
  },
  "chunking_strategy": {
    "type": "static",
    "static": {
      "max_chunk_size_tokens": 800,
      "chunk_overlap_tokens": 400
    }
  }
}
```

**AddFileDto:**
```typescript
export class AddFileDto {
  @IsString()
  @Matches(/^file-/, { message: 'file_id must start with "file-"' })
  file_id!: string;

  @IsOptional()
  attributes?: Record<string, string | number | boolean> | null;

  @IsOptional()
  @IsChunkingStrategyValid()
  chunking_strategy?: VectorStores.FileChunkingStrategyParam;
}
```

### File Status Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                      FILE STATUS LIFECYCLE                       │
└─────────────────────────────────────────────────────────────────┘

                        ┌─────────────┐
                        │  Add File   │
                        │  to Store   │
                        └──────┬──────┘
                               │
                               ▼
                        ┌─────────────┐
                        │ in_progress │ ← Indexing
                        │             │   Creating embeddings
                        └──────┬──────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
  ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
  │  completed  │       │   failed    │       │  cancelled  │
  │  Searchable │       │ Check error │       │  User abort │
  └─────────────┘       └─────────────┘       └─────────────┘
```

### Listing Files with Filtering

**Endpoint:** `GET /api/vector-stores/:vectorStoreId/files`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| limit | number | Results per page (1-100) |
| order | string | Sort order (asc/desc) |
| after | string | Cursor for next page |
| filter | string | Status filter: `in_progress`, `completed`, `failed`, `cancelled` |

**ListVectorStoreFilesDto:**
```typescript
export class ListVectorStoreFilesDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  after?: string;

  @IsOptional()
  @IsString()
  before?: string;

  @IsOptional()
  @IsEnum(['in_progress', 'completed', 'failed', 'cancelled'])
  filter?: string;
}
```

### Getting File Content

Retrieve parsed/chunked content from an indexed file.

**Endpoint:** `GET /api/vector-stores/:vectorStoreId/files/:fileId/content`

**Response:**
```json
[
  {
    "type": "text",
    "text": "Chunk 1 content..."
  },
  {
    "type": "text",
    "text": "Chunk 2 content..."
  }
]
```

---

## Batch Operations

### Two Configuration Patterns

#### Pattern 1: Global Configuration

Apply same settings to all files in batch:

```json
{
  "file_ids": ["file-abc", "file-def", "file-xyz"],
  "attributes": {
    "category": "docs",
    "verified": true
  },
  "chunking_strategy": {
    "type": "auto"
  }
}
```

#### Pattern 2: Individual Configuration

Customize each file separately:

```json
{
  "files": [
    {
      "file_id": "file-abc",
      "attributes": { "priority": "high" },
      "chunking_strategy": {
        "type": "static",
        "static": {
          "max_chunk_size_tokens": 2000,
          "chunk_overlap_tokens": 500
        }
      }
    },
    {
      "file_id": "file-def",
      "attributes": { "priority": "low" },
      "chunking_strategy": { "type": "auto" }
    }
  ]
}
```

### AddFileBatchDto

```typescript
export class AddFileBatchDto {
  // Pattern 1: Global configuration
  @IsOptional()
  @IsArray()
  @Matches(/^file-/, { each: true })
  file_ids?: string[];

  @IsOptional()
  attributes?: Record<string, string | number | boolean>;

  @IsOptional()
  @IsChunkingStrategyValid()
  chunking_strategy?: VectorStores.FileChunkingStrategyParam;

  // Pattern 2: Individual configuration
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchFileConfigDto)
  files?: BatchFileConfigDto[];
}

export class BatchFileConfigDto {
  @IsOptional()
  @Matches(/^file-/)
  file_id?: string;

  @IsOptional()
  attributes?: Record<string, string | number | boolean>;

  @IsOptional()
  @IsChunkingStrategyValid()
  chunking_strategy?: VectorStores.FileChunkingStrategyParam;
}
```

### Batch Constraints

| Constraint | Value |
|------------|-------|
| Maximum files per batch | 500 |
| Patterns | Mutually exclusive (file_ids OR files) |
| Failure behavior | Individual failures don't fail batch |
| Status tracking | file_counts updated in real-time |

### Batch Status Tracking

```
┌─────────────────────────────────────────────────────────────────┐
│                      BATCH STATUS LIFECYCLE                      │
└─────────────────────────────────────────────────────────────────┘

                        ┌─────────────┐
                        │ Create Batch│
                        │ (500 files) │
                        └──────┬──────┘
                               │
                               ▼
                        ┌─────────────┐
                        │ in_progress │ ← file_counts:
                        │             │   total: 500
                        │             │   in_progress: 480
                        │             │   completed: 15
                        │             │   failed: 3
                        │             │   cancelled: 2
                        └──────┬──────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
              ▼                                 ▼
       ┌─────────────┐                   ┌─────────────┐
       │  completed  │                   │  cancelled  │
       │ file_counts:│                   │ (user abort)│
       │ total: 500  │                   │             │
       │ completed:492                   └─────────────┘
       │ failed: 8   │
       └─────────────┘
```

---

## Chunking Strategies

### Strategy Types

#### Auto Chunking (Default)

OpenAI automatically determines optimal chunk size.

```json
{
  "type": "auto"
}
```

**Use Cases:**
- General-purpose search
- Mixed document types
- When unsure of optimal parameters

#### Static Chunking (Advanced)

Custom chunk size and overlap.

```json
{
  "type": "static",
  "static": {
    "max_chunk_size_tokens": 800,
    "chunk_overlap_tokens": 400
  }
}
```

**Parameters:**
| Parameter | Range | Description |
|-----------|-------|-------------|
| max_chunk_size_tokens | 100-4096 | Maximum tokens per chunk |
| chunk_overlap_tokens | 0 to max/2 | Overlap between chunks |

### Chunking Best Practices

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHUNKING STRATEGY GUIDE                       │
└─────────────────────────────────────────────────────────────────┘

  Document Type          Chunk Size        Overlap        Notes
  ─────────────────────────────────────────────────────────────────
  Reference docs         2000-4096         500-1000       Better context
  Technical specs        800-1600          200-400        Balanced
  Code files             400-800           100-200        Function-level
  FAQs / Q&A             100-400           50-100         Question-level
  Long-form articles     1000-2000         250-500        Paragraph-level
```

### Chunking Validation Rules

```typescript
// Validation constraints
max_chunk_size_tokens:
  - Must be integer
  - Range: 100-4096 (inclusive)

chunk_overlap_tokens:
  - Must be integer >= 0
  - Cannot exceed max_chunk_size_tokens / 2
  - Formula: overlap <= max / 2

// Examples
{ max: 800, overlap: 400 }   // Valid (400 <= 800/2)
{ max: 800, overlap: 401 }   // Invalid (401 > 800/2)
{ max: 4096, overlap: 2048 } // Valid (2048 <= 4096/2)
```

**Important:** Chunking strategy cannot be changed after file attachment. Must remove and re-add file.

---

## Search & Ranking

### Search Query Types

#### Single Query
```json
{
  "query": "How do I reset my password?"
}
```

#### Multi-Query (Batch)
```json
{
  "query": [
    "How do I reset my password?",
    "What are the password requirements?",
    "How to enable two-factor authentication?"
  ]
}
```

### Search Filters

#### Comparison Operators

| Operator | Description | Example |
|----------|-------------|---------|
| eq | Equal | `{ "key": "status", "type": "eq", "value": "active" }` |
| ne | Not equal | `{ "key": "status", "type": "ne", "value": "archived" }` |
| gt | Greater than | `{ "key": "year", "type": "gt", "value": 2023 }` |
| gte | Greater or equal | `{ "key": "year", "type": "gte", "value": 2024 }` |
| lt | Less than | `{ "key": "priority", "type": "lt", "value": 5 }` |
| lte | Less or equal | `{ "key": "priority", "type": "lte", "value": 3 }` |

#### Compound Filters (AND/OR)

```json
{
  "type": "and",
  "filters": [
    { "key": "category", "type": "eq", "value": "documentation" },
    {
      "type": "or",
      "filters": [
        { "key": "language", "type": "eq", "value": "en" },
        { "key": "language", "type": "eq", "value": "es" }
      ]
    }
  ]
}
```

### Ranking Options

```typescript
{
  "ranking_options": {
    "ranker": "auto",           // 'none' | 'auto' | 'default-2024-11-15'
    "score_threshold": 0.5      // 0-1 range
  }
}
```

**Score Threshold Guidelines:**

| Threshold | Use Case |
|-----------|----------|
| 0.0 | Include all results |
| 0.3-0.5 | Broad search, high recall |
| 0.5-0.7 | Balanced precision/recall |
| 0.7-1.0 | High precision, strict matching |

### Query Rewriting

Enable OpenAI to optimize natural language queries:

```json
{
  "query": "password help",
  "rewrite_query": true
}
```

OpenAI may rewrite to: "How do I reset or change my password?"

---

## Polling Patterns

### Exponential Backoff Strategy

All polling methods use identical backoff:

```
┌─────────────────────────────────────────────────────────────────┐
│                    POLLING WITH EXPONENTIAL BACKOFF              │
└─────────────────────────────────────────────────────────────────┘

  Create/Add Request (status: 'in_progress')
           │
           ▼
  ┌─────────────────┐
  │ Poll #1 (5s)    │────► status: 'in_progress' ─┐
  └─────────────────┘                             │
                                                  ▼
  ┌─────────────────┐                       ┌─────────┐
  │ Poll #2 (10s)   │────► status: 'in_progress' ─┤ Wait... │
  └─────────────────┘                       └─────────┘
                                                  │
  ┌─────────────────┐                             ▼
  │ Poll #3 (15s)   │────► status: 'in_progress' ─┐
  └─────────────────┘                             │
                                                  ▼
  ┌─────────────────┐                       ┌─────────┐
  │ Poll #4 (20s)   │────► status: 'completed' ─→ │  Done!  │
  └─────────────────┘                       └─────────┘


  Timing:  ──5s──┬──10s──┬──15s──┬──20s──┬──20s──┬── ...
                 │       │       │       │       │
               Poll 1  Poll 2  Poll 3  Poll 4  Poll 5
```

### Polling Configuration

| Parameter | Default | Maximum | Description |
|-----------|---------|---------|-------------|
| Initial Delay | 5 seconds | - | First poll after request |
| Increment | +5 seconds | - | Added each iteration |
| Max Delay | 20 seconds | - | Cap on poll interval |
| Default Timeout | 10 minutes | 10 minutes | Total wait time |

### Polling Endpoints

**Vector Store Polling:**
```http
POST /api/vector-stores/:vectorStoreId/poll?max_wait_ms=30000
```

**File Polling:**
```http
POST /api/vector-stores/:vectorStoreId/files/:fileId/poll?max_wait_ms=30000
```

**Implementation:**
```typescript
async pollUntilComplete(
  vectorStoreId: string,
  maxWaitMs: number = 600000,
): Promise<VectorStores.VectorStore> {
  const startTime = Date.now();
  let waitTime = 5000;

  while (Date.now() - startTime < maxWaitMs) {
    const vectorStore = await this.retrieveVectorStore(vectorStoreId);

    if (vectorStore.status === 'completed' || vectorStore.status === 'expired') {
      return vectorStore;
    }

    await this.sleep(waitTime);
    waitTime = Math.min(waitTime + 5000, 20000);
  }

  throw new Error(`Vector store did not complete within ${maxWaitMs}ms`);
}
```

---

## Custom Validators

### Chunking Strategy Validator

**Location:** `src/openai/validators/chunking-strategy.validator.ts`

```typescript
@ValidatorConstraint({ name: 'IsChunkingStrategyValid', async: false })
export class IsChunkingStrategyConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return validateChunkingStrategy(value);
  }

  defaultMessage(): string {
    return getChunkingStrategyErrorMessage(value);
  }
}

// Helper functions
export function validateChunkingStrategy(strategy: unknown): boolean
export function getChunkingStrategyErrorMessage(strategy: unknown): string
export function validateChunkingParametersOrThrow(strategy: unknown): boolean
```

### Search Filter Validator

**Location:** `src/openai/validators/search-filter.validator.ts`

```typescript
@ValidatorConstraint({ name: 'IsSearchFilterValid', async: false })
export class IsSearchFilterConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return validateSearchFilter(value);
  }
}

// Supports recursive compound filter validation
// Validates comparison operators: eq, ne, gt, gte, lt, lte
// Validates compound operators: and, or
```

### Metadata Validator

**Location:** `src/openai/validators/metadata.validator.ts`

```typescript
// Constraints enforced:
// - Maximum: 16 key-value pairs
// - Key length: max 64 characters
// - Value length: max 512 characters
// - Values: strings only

export function validateMetadata(metadata: unknown): boolean
export function getMetadataErrorMessage(metadata: unknown): string
```

### Vector Store ID Validator

**Location:** `src/openai/validators/vector-store-id.validator.ts`

```typescript
// Format: vs_[alphanumeric]
// Valid: vs_abc123, vs_abc123xyz789def456
// Invalid: file_abc, VS_abc, vs-abc
```

---

## SDK Integration

### OpenAI SDK Import Pattern

```typescript
import type { VectorStores } from 'openai/resources/vector-stores';
import type * as Shared from 'openai/resources/shared';
```

### SDK Method Signatures

```typescript
// Vector Store Management
await client.vectorStores.create(params: VectorStoreCreateParams)
await client.vectorStores.retrieve(vectorStoreId: string)
await client.vectorStores.update(vectorStoreId, params)
await client.vectorStores.list(params)
await client.vectorStores.delete(vectorStoreId)
await client.vectorStores.search(vectorStoreId, params)

// File Operations - IMPORTANT: Resource ID first
await client.vectorStores.files.create(vectorStoreId, params)
await client.vectorStores.files.list(vectorStoreId, params)
await client.vectorStores.files.retrieve(fileId, { vector_store_id: vectorStoreId })
await client.vectorStores.files.delete(vectorStoreId, fileId)
await client.vectorStores.files.content(fileId, { vector_store_id: vectorStoreId })

// Batch Operations
await client.vectorStores.fileBatches.create(vectorStoreId, params)
await client.vectorStores.fileBatches.retrieve(vectorStoreId, batchId)
await client.vectorStores.fileBatches.cancel(vectorStoreId, batchId)
await client.vectorStores.fileBatches.listFiles(vectorStoreId, batchId, params)
```

**Critical Pattern:** File retrieval requires non-standard parameter order:
```typescript
// CORRECT
await client.vectorStores.files.retrieve(fileId, { vector_store_id: vectorStoreId });

// INCORRECT
await client.vectorStores.files.retrieve(vectorStoreId, fileId);
```

### Parameter Construction Pattern

```typescript
// Conditional parameter inclusion
const params: VectorStores.VectorStoreCreateParams = {
  ...(dto.name && { name: dto.name }),
  ...(dto.file_ids && { file_ids: dto.file_ids }),
  ...(dto.chunking_strategy && { chunking_strategy: dto.chunking_strategy }),
  ...(dto.expires_after && { expires_after: dto.expires_after }),
  ...(dto.metadata && { metadata: dto.metadata }),
};
```

---

## Error Handling

### Vector Store Error Codes

```typescript
type VectorStoreErrorCode =
  // Lifecycle Errors
  | 'vector_store_not_found'        // 404
  | 'vector_store_expired'          // 410
  | 'vector_store_limit_exceeded'   // 429
  | 'vector_store_creation_failed'  // 500

  // File Errors
  | 'file_already_attached'         // 409
  | 'file_not_in_vector_store'      // 404
  | 'file_indexing_failed'          // 400
  | 'file_indexing_timeout'         // 504
  | 'invalid_chunking_strategy'     // 400
  | 'chunk_size_invalid'            // 400
  | 'chunk_overlap_invalid'         // 400

  // Batch Errors
  | 'batch_not_found'               // 404
  | 'batch_too_large'               // 400
  | 'batch_processing_failed'       // 400

  // Search Errors
  | 'search_failed'                 // 500
  | 'invalid_search_query'          // 400
  | 'invalid_search_filter'         // 400

  // Metadata Errors
  | 'metadata_too_large'            // 400
  | 'metadata_key_too_long'         // 400
  | 'metadata_value_too_long'       // 400
```

### Error Code Mappings

```typescript
export const VECTOR_STORE_ERROR_CODE_MAPPINGS = {
  vector_store_not_found: {
    status: 404,
    message: 'Vector store not found',
    hint: 'The vector store ID does not exist or has been deleted.',
  },
  chunk_overlap_invalid: {
    status: 400,
    message: 'Chunk overlap exceeds limit',
    hint: 'chunk_overlap_tokens cannot exceed half of max_chunk_size_tokens.',
  },
  file_indexing_timeout: {
    status: 504,
    message: 'File indexing timed out',
    hint: 'Large files may require more time. Use polling to check status.',
  },
  batch_too_large: {
    status: 400,
    message: 'Batch exceeds maximum file limit',
    hint: 'Batch operations are limited to 500 files. Split into multiple batches.',
  },
  metadata_too_large: {
    status: 400,
    message: 'Metadata exceeds limit',
    hint: 'Maximum 16 key-value pairs allowed. Keys max 64 chars, values max 512 chars.',
  },
};
```

### Enhanced Error Response

```typescript
interface EnhancedErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string;
  request_id?: string;
  error_code?: VectorStoreErrorCode;
  parameter?: string | null;
  hint?: string;
  rate_limit_info?: RateLimitInfo;
  retry_after_seconds?: number;
}
```

---

## Testing Architecture

### Test Coverage Summary

| Component | File | Test Cases |
|-----------|------|------------|
| Service | `openai-vector-stores.service.spec.ts` | 54 |
| Controller | `vector-stores.controller.spec.ts` | 54 |
| DTOs | `create-vector-store.dto.spec.ts` | 10 |
| Validators | `chunking-strategy.validator.spec.ts` | 64 |
| Validators | `search-filter.validator.spec.ts` | 67+ |
| Validators | `vector-store-id.validator.spec.ts` | 27 |
| E2E | `vector-stores.e2e-spec.ts` | 20 |
| **Total** | | **~296** |

### Test Categories

#### Service Unit Tests (54 tests)
- Vector store CRUD operations
- File operations (add, list, get, update, remove)
- Batch operations (create, get, cancel, list)
- Polling methods with exponential backoff
- Search with ranking and filters

#### Controller Tests (54 tests)
- All 18 endpoints
- Request validation
- Response formatting
- Error handling

#### Validator Tests (158+ tests)
- Chunking strategy validation (64 tests)
- Search filter validation (67+ tests)
- Vector store ID format (27 tests)
- Recursive compound filter validation

#### E2E Tests (20 tests)
- Real API integration
- Full lifecycle testing
- Resource cleanup

### Mock Patterns

```typescript
// OpenAI client mock structure
mockOpenAIClient = {
  vectorStores: {
    create: jest.fn(),
    retrieve: jest.fn(),
    update: jest.fn(),
    list: jest.fn(),
    delete: jest.fn(),
    search: jest.fn(),
    files: {
      create: jest.fn(),
      list: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      content: jest.fn(),
    },
    fileBatches: {
      create: jest.fn(),
      retrieve: jest.fn(),
      cancel: jest.fn(),
      listFiles: jest.fn(),
    },
  },
};
```

---

## Usage Examples

### Create Vector Store with Files

**cURL:**
```bash
curl -X POST http://localhost:3000/api/vector-stores \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Product Documentation",
    "file_ids": ["file-abc123", "file-def456"],
    "chunking_strategy": { "type": "auto" },
    "expires_after": { "anchor": "last_active_at", "days": 30 },
    "metadata": { "project": "docs", "version": "2.0" }
  }'
```

**TypeScript:**
```typescript
const vectorStore = await fetch('/api/vector-stores', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Product Documentation',
    file_ids: ['file-abc123', 'file-def456'],
    chunking_strategy: { type: 'auto' },
    expires_after: { anchor: 'last_active_at', days: 30 },
  }),
}).then(r => r.json());

console.log(vectorStore.id);  // vs_xyz789
```

### Search with Filters

**cURL:**
```bash
curl -X POST http://localhost:3000/api/vector-stores/vs_xyz789/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How do I configure authentication?",
    "max_num_results": 5,
    "ranking_options": {
      "ranker": "auto",
      "score_threshold": 0.6
    },
    "filters": {
      "type": "and",
      "filters": [
        { "key": "category", "type": "eq", "value": "security" },
        { "key": "year", "type": "gte", "value": 2024 }
      ]
    }
  }'
```

### Add Files in Batch

**cURL:**
```bash
curl -X POST http://localhost:3000/api/vector-stores/vs_xyz789/file-batches \
  -H "Content-Type: application/json" \
  -d '{
    "file_ids": ["file-aaa", "file-bbb", "file-ccc"],
    "chunking_strategy": {
      "type": "static",
      "static": {
        "max_chunk_size_tokens": 1000,
        "chunk_overlap_tokens": 200
      }
    }
  }'
```

### Poll Until Complete

**TypeScript:**
```typescript
// Create vector store with files
const vs = await createVectorStore({
  name: 'My Store',
  file_ids: ['file-abc'],
});

// Poll until indexing completes
const response = await fetch(
  `/api/vector-stores/${vs.id}/poll?max_wait_ms=60000`,
  { method: 'POST' }
);

const completed = await response.json();
console.log(completed.status);  // 'completed'
console.log(completed.file_counts.completed);  // 1
```

### Full RAG Workflow

**TypeScript:**
```typescript
// 1. Upload file via Files API
const file = await uploadFile(documentBuffer, 'guide.pdf', 'assistants');

// 2. Create vector store with file
const vectorStore = await createVectorStore({
  name: 'Knowledge Base',
  file_ids: [file.id],
  chunking_strategy: { type: 'auto' },
});

// 3. Poll until indexed
await pollUntilComplete(vectorStore.id);

// 4. Use in Responses API with file_search tool
const response = await client.responses.create({
  model: 'gpt-4o',
  input: 'What does the guide say about authentication?',
  tools: [{
    type: 'file_search',
    vector_store_ids: [vectorStore.id],
  }],
});
```

---

## Integration with Other APIs

### Files API Integration

Files must be uploaded before attaching to vector stores:

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Upload File   │ ──►  │   Add to Vector │ ──►  │   Semantic      │
│ purpose:        │      │      Store      │      │   Search        │
│ 'assistants'    │      │                 │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

**Supported File Formats (67+):**
- Documents: PDF, TXT, DOCX, MD, HTML, RTF
- Code: JS, PY, TS, JAVA, C, CPP, GO, RUST
- Data: JSON, CSV, XML, YAML

### Responses API Integration

Use vector stores with the `file_search` tool:

```typescript
const response = await client.responses.create({
  model: 'gpt-4o',
  input: 'Find documentation about user authentication',
  tools: [{
    type: 'file_search',
    vector_store_ids: ['vs_abc123', 'vs_def456'],
    max_num_results: 10,
    ranking_options: {
      ranker: 'auto',
      score_threshold: 0.5,
    },
  }],
});
```

### Streaming Events

The `file_search` tool emits streaming events:

```typescript
// Tool call events
response.file_search.searching     // Search started
response.file_search.results       // Results returned
response.file_search.completed     // Search completed
```

---

## Related Documentation

- [FILES_API.md](./FILES_API.md) - Upload files for vector stores
- [RESPONSES_API.md](./RESPONSES_API.md) - Use file_search tool
- [STREAMING.md](./STREAMING.md) - Handle file_search streaming events
- [DATA_FLOW.md](./DATA_FLOW.md) - Request/response data flow
- [README.md](../README.md) - Project overview and setup
