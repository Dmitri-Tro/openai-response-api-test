# Files API Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [File Purposes](#file-purposes)
4. [REST Endpoints](#rest-endpoints)
5. [Request Parameters](#request-parameters)
6. [Response Structure](#response-structure)
7. [File Upload Handling](#file-upload-handling)
8. [Binary Download Streaming](#binary-download-streaming)
9. [Polling for File Processing](#polling-for-file-processing)
10. [Custom Validators](#custom-validators)
11. [SDK Integration](#sdk-integration)
12. [Error Handling](#error-handling)
13. [Size Limits & Constraints](#size-limits--constraints)
14. [Cost Estimation](#cost-estimation)
15. [Testing Architecture](#testing-architecture)
16. [Usage Examples](#usage-examples)

---

## Overview

The Files API provides comprehensive file management capabilities for uploading, retrieving, listing, downloading, and deleting files in OpenAI's storage. Files are used across multiple OpenAI features including Assistants (file_search), Vision, Batch API, Fine-tuning, Code Interpreter, and Evaluations.

### Key Capabilities

| Feature | Description |
|---------|-------------|
| **Upload** | Upload files up to 512 MB with purpose-specific validation |
| **Retrieve** | Get file metadata including processing status |
| **List** | List files with filtering by purpose, sorting, and pagination |
| **Download** | Stream binary file content (except assistants purpose) |
| **Delete** | Permanently remove files from storage |
| **Polling** | Wait for file processing with exponential backoff |
| **Expiration** | Optional automatic deletion after specified duration |

### Supported File Purposes

```
assistants  - Documents for file_search tool (PDF, TXT, DOCX, code files)
vision      - Images for vision models (PNG, JPEG, GIF, WEBP)
batch       - JSONL input for Batch API
fine-tune   - JSONL training data for model fine-tuning
user_data   - General purpose files for code_interpreter
evals       - JSONL evaluation datasets
```

---

## Architecture

### Module Structure

```
src/openai/
├── controllers/
│   └── files.controller.ts          # REST endpoints (5 routes)
├── services/
│   └── openai-files.service.ts      # OpenAI SDK integration (6 methods)
├── dto/
│   ├── create-file.dto.ts           # Upload request validation
│   └── list-files.dto.ts            # List query parameters
├── validators/
│   ├── file-purpose.validator.ts    # Purpose enum validation
│   ├── file-size.validator.ts       # Size limits by purpose
│   └── file-type.validator.ts       # MIME type validation
└── interfaces/
    └── error-codes.interface.ts     # File-specific error codes
```

### Request Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FILES API REQUEST FLOW                          │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │ HTTP Request │ (multipart/form-data for upload)
    └──────┬───────┘
           │
           ▼
    ┌──────────────────────┐
    │  LoggingInterceptor  │ Records start time, request details
    └──────────┬───────────┘
           │
           ▼
    ┌──────────────────────┐
    │   FileInterceptor    │ Multer extracts file from multipart
    │      (Multer)        │ Creates Express.Multer.File object
    └──────────┬───────────┘
           │
           ▼
    ┌──────────────────────┐
    │   FilesController    │ Validates DTO, extracts file buffer
    │                      │ Routes to appropriate service method
    └──────────┬───────────┘
           │
           ▼
    ┌──────────────────────┐
    │  OpenAIFilesService  │ Converts buffer using toFile()
    │                      │ Calls OpenAI SDK methods
    └──────────┬───────────┘
           │
           ▼
    ┌──────────────────────┐
    │     OpenAI SDK       │ client.files.create/retrieve/list/delete/content
    │                      │ Returns Files.FileObject or Response
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
    │ HTTP Response│ (JSON or binary stream)
    └──────────────┘
```

### Service Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          OpenAIFilesService                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Dependencies:                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                                │
│  │   OPENAI_CLIENT  │  │   LoggerService  │                                │
│  │   (Singleton)    │  │   (Logging)      │                                │
│  └────────┬─────────┘  └────────┬─────────┘                                │
│           │                     │                                           │
│           ▼                     ▼                                           │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │                      Public Methods                          │           │
│  ├─────────────────────────────────────────────────────────────┤           │
│  │  uploadFile(buffer, filename, purpose, expiresAfter?)       │           │
│  │  retrieveFile(fileId)                                        │           │
│  │  listFiles(purpose?, order?, limit?)                         │           │
│  │  deleteFile(fileId)                                          │           │
│  │  downloadFileContent(fileId)                                 │           │
│  │  pollUntilComplete(fileId, maxWaitMs?)                       │           │
│  │  extractFileMetadata(file)                                   │           │
│  └─────────────────────────────────────────────────────────────┘           │
│                                                                              │
│  Private Helpers:                                                            │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │  sleep(ms) - Utility for polling delays                      │           │
│  └─────────────────────────────────────────────────────────────┘           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## File Purposes

The Files API supports 6 distinct purposes, each with specific constraints and use cases:

### Purpose Comparison Matrix

| Purpose | Formats | Max Size | Download | Processing | Integration |
|---------|---------|----------|----------|------------|-------------|
| **assistants** | PDF, TXT, DOCX, MD, HTML, code, data | 512 MB | No | Required | Vector stores, file_search |
| **vision** | PNG, JPEG, JPG, GIF, WEBP | 20 MB | Yes | No | Vision models |
| **batch** | JSONL only | 200 MB | Yes | Required | Batch API |
| **fine-tune** | JSONL only | 512 MB | Yes | Required | Fine-tuning jobs |
| **user_data** | All assistants + Excel | 512 MB | Yes | No | Code interpreter |
| **evals** | JSONL only | 512 MB | Yes | Required | Model evaluation |

### Purpose Details

#### assistants (Documents for Knowledge Retrieval)

Used with the `file_search` tool in Assistants API for semantic search across documents.

**Supported MIME Types:**
```
Documents:
- application/pdf
- text/plain
- text/markdown
- text/html
- application/vnd.openxmlformats-officedocument.wordprocessingml.document

Code Files:
- application/javascript
- application/typescript
- text/x-python
- text/x-java
- text/x-c
- text/x-c++

Data Files:
- application/json
- application/jsonl
- text/csv
- application/xml
- text/xml
```

**Constraints:**
- Maximum file size: 512 MB
- Download: **FORBIDDEN** (OpenAI policy restriction)
- Processing: Required before use
- Must be added to vector store for file_search

#### vision (Images for Vision Models)

Used for image understanding and analysis with vision-capable models.

**Supported MIME Types:**
```
- image/png
- image/jpeg
- image/jpg
- image/gif
- image/webp
```

**Constraints:**
- Maximum file size: 20 MB (smallest limit)
- Download: Allowed
- Processing: Not required
- Direct use with vision models

#### batch (Batch API Input)

Used as input files for the Batch API for processing multiple requests.

**Supported MIME Types:**
```
- application/jsonl (JSONL only)
```

**File Structure:**
```jsonl
{"custom_id": "request-1", "method": "POST", "url": "/v1/chat/completions", "body": {...}}
{"custom_id": "request-2", "method": "POST", "url": "/v1/chat/completions", "body": {...}}
```

**Constraints:**
- Maximum file size: 200 MB
- Download: Allowed
- Processing: Required (validation)
- One API request per line

#### fine-tune (Training Data)

Used as training data for model fine-tuning.

**Supported MIME Types:**
```
- application/jsonl (JSONL only)
```

**File Structure:**
```jsonl
{"messages": [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}
{"messages": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}
```

**Constraints:**
- Maximum file size: 512 MB
- Download: Allowed
- Processing: Required (validation)
- Minimum 10 examples recommended

#### user_data (General Purpose)

Used for general file storage and code interpreter tool.

**Supported MIME Types:**
```
All assistants formats plus:
- application/vnd.ms-excel
- application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
- application/octet-stream
```

**Constraints:**
- Maximum file size: 512 MB
- Download: Allowed
- Processing: Not required
- Works with code_interpreter tool

#### evals (Evaluation Datasets)

Used for model evaluation datasets.

**Supported MIME Types:**
```
- application/jsonl (JSONL only)
```

**Constraints:**
- Maximum file size: 512 MB
- Download: Allowed
- Processing: Required

---

## REST Endpoints

### Endpoint Overview

| Method | Route | Handler | Description |
|--------|-------|---------|-------------|
| POST | `/api/files` | uploadFile | Upload a file with purpose |
| GET | `/api/files` | listFiles | List files with filtering |
| GET | `/api/files/:id` | getFile | Get file metadata |
| GET | `/api/files/:id/content` | downloadFile | Download file content |
| DELETE | `/api/files/:id` | deleteFile | Delete a file |

### POST /api/files - Upload File

Upload a file to OpenAI storage.

**Request:**
```http
POST /api/files HTTP/1.1
Content-Type: multipart/form-data

--boundary
Content-Disposition: form-data; name="file"; filename="document.pdf"
Content-Type: application/pdf

<binary file content>
--boundary
Content-Disposition: form-data; name="purpose"

assistants
--boundary
Content-Disposition: form-data; name="expires_after"

{"anchor": "created_at", "seconds": 86400}
--boundary--
```

**Response:** `201 Created`
```json
{
  "id": "file-abc123xyz789",
  "object": "file",
  "bytes": 1048576,
  "created_at": 1699000000,
  "filename": "document.pdf",
  "purpose": "assistants",
  "status": "uploaded",
  "status_details": null,
  "expires_at": null
}
```

### GET /api/files - List Files

List files with optional filtering, sorting, and pagination.

**Request:**
```http
GET /api/files?purpose=assistants&order=desc&limit=20 HTTP/1.1
```

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| purpose | string | No | all | Filter by file purpose |
| order | string | No | desc | Sort order (asc/desc) |
| limit | number | No | 20 | Number of files (1-10000) |

**Response:** `200 OK`
```json
[
  {
    "id": "file-abc123xyz789",
    "object": "file",
    "bytes": 1048576,
    "created_at": 1699000000,
    "filename": "document.pdf",
    "purpose": "assistants",
    "status": "processed"
  },
  {
    "id": "file-def456uvw012",
    "object": "file",
    "bytes": 524288,
    "created_at": 1698990000,
    "filename": "data.jsonl",
    "purpose": "batch",
    "status": "processed"
  }
]
```

### GET /api/files/:id - Get File Metadata

Retrieve detailed metadata for a specific file.

**Request:**
```http
GET /api/files/file-abc123xyz789 HTTP/1.1
```

**Response:** `200 OK`
```json
{
  "id": "file-abc123xyz789",
  "object": "file",
  "bytes": 1048576,
  "created_at": 1699000000,
  "filename": "document.pdf",
  "purpose": "assistants",
  "status": "processed",
  "status_details": null,
  "expires_at": 1699086400
}
```

### GET /api/files/:id/content - Download File

Download the binary content of a file.

**Request:**
```http
GET /api/files/file-abc123xyz789/content HTTP/1.1
```

**Response:** `200 OK`
```http
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="document.pdf"

<binary file content>
```

**Restrictions:**
- Files with `purpose="assistants"` **cannot be downloaded** (returns 403)

### DELETE /api/files/:id - Delete File

Permanently delete a file from storage.

**Request:**
```http
DELETE /api/files/file-abc123xyz789 HTTP/1.1
```

**Response:** `200 OK`
```json
{
  "id": "file-abc123xyz789",
  "object": "file",
  "deleted": true
}
```

---

## Request Parameters

### CreateFileDto

Parameters for file upload requests.

```typescript
export class CreateFileDto {
  /**
   * The intended purpose for the file.
   * Determines allowed file types, size limits, and capabilities.
   */
  @IsEnum(['assistants', 'vision', 'batch', 'fine-tune', 'user_data', 'evals'])
  purpose!: Files.FilePurpose;

  /**
   * Optional expiration policy for automatic deletion.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => ExpiresAfterDto)
  expires_after?: ExpiresAfterDto;
}

export class ExpiresAfterDto {
  /**
   * The anchor point for expiration calculation.
   * Only 'created_at' is currently supported.
   */
  @IsEnum(['created_at'])
  anchor!: 'created_at';

  /**
   * Duration in seconds after anchor before file expires.
   * Range: 3600 (1 hour) to 2592000 (30 days)
   */
  @IsNumber()
  @Min(3600)
  @Max(2592000)
  seconds!: number;
}
```

**Expiration Duration Guidelines:**
| Duration | Seconds | Use Case |
|----------|---------|----------|
| 1 hour | 3600 | Temporary processing |
| 24 hours | 86400 | Daily workflows |
| 7 days | 604800 | Weekly batches |
| 30 days | 2592000 | Long-term storage |

### ListFilesDto

Query parameters for file listing.

```typescript
export class ListFilesDto {
  /**
   * Filter files by purpose.
   */
  @IsOptional()
  @IsEnum(['assistants', 'vision', 'batch', 'fine-tune', 'user_data', 'evals'])
  purpose?: Files.FilePurpose;

  /**
   * Sort order by created_at timestamp.
   * 'desc' = newest first (default)
   * 'asc' = oldest first
   */
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  order?: 'asc' | 'desc';

  /**
   * Number of files to return.
   * Range: 1 to 10000 (default: 20)
   */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number;
}
```

---

## Response Structure

### Files.FileObject

The primary response type for file operations.

```typescript
interface FileObject {
  /** Unique identifier (format: file-xxx) */
  id: string;

  /** Object type discriminator */
  object: 'file';

  /** File size in bytes */
  bytes: number;

  /** Unix timestamp of creation */
  created_at: number;

  /** Original filename */
  filename: string;

  /** File purpose */
  purpose: 'assistants' | 'vision' | 'batch' | 'fine-tune' | 'user_data' | 'evals';

  /** Processing status */
  status: 'uploaded' | 'processed' | 'error';

  /** Error details if status is 'error' */
  status_details?: string | null;

  /** Unix timestamp when file expires (if set) */
  expires_at?: number | null;
}
```

### File Status States

```
┌──────────────────────────────────────────────────────────────────┐
│                      FILE STATUS LIFECYCLE                        │
└──────────────────────────────────────────────────────────────────┘

                        ┌─────────────┐
                        │   Upload    │
                        │   Request   │
                        └──────┬──────┘
                               │
                               ▼
                        ┌─────────────┐
                        │  uploaded   │ ← Initial state
                        │             │   File received
                        └──────┬──────┘
                               │
                    ┌──────────┴──────────┐
                    │   Processing...     │
                    │   (async)           │
                    └──────────┬──────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
              ▼                                 ▼
       ┌─────────────┐                   ┌─────────────┐
       │  processed  │ ← Ready           │    error    │ ← Failed
       │             │   for use         │             │   Check details
       └─────────────┘                   └─────────────┘
```

### Files.FileDeleted

Response for successful deletion.

```typescript
interface FileDeleted {
  /** File ID that was deleted */
  id: string;

  /** Object type */
  object: 'file';

  /** Deletion confirmation */
  deleted: boolean;
}
```

### FileMetadata (Helper Interface)

Extracted metadata structure for internal use.

```typescript
export interface FileMetadata {
  id: string;
  object: 'file';
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
  status: 'uploaded' | 'processed' | 'error';
  status_details?: string | null;
  expires_at?: number | null;
}
```

---

## File Upload Handling

### Multer Configuration

The Files API uses NestJS `FileInterceptor` with Multer for multipart form-data handling.

```typescript
@Post()
@HttpCode(HttpStatus.CREATED)
@UseInterceptors(FileInterceptor('file'))
@ApiConsumes('multipart/form-data')
async uploadFile(
  @UploadedFile() file: Express.Multer.File,
  @Body() dto: CreateFileDto,
): Promise<Files.FileObject>
```

### Express.Multer.File Object

```typescript
interface MulterFile {
  /** Field name from form */
  fieldname: string;

  /** Original filename from client */
  originalname: string;

  /** Transfer encoding */
  encoding: string;

  /** MIME type */
  mimetype: string;

  /** File size in bytes */
  size: number;

  /** File content as Buffer */
  buffer: Buffer;
}
```

### Using toFile() Helper

The OpenAI SDK provides a `toFile()` helper for converting buffers to File-like objects.

```typescript
import OpenAI, { toFile } from 'openai';

async uploadFile(
  fileBuffer: Buffer,
  filename: string,
  purpose: Files.FilePurpose,
  expiresAfter?: Files.FileCreateParams['expires_after'],
): Promise<Files.FileObject> {
  const params: Files.FileCreateParams = {
    file: await toFile(fileBuffer, filename),
    purpose,
    ...(expiresAfter && { expires_after: expiresAfter }),
  };

  return await this.client.files.create(params);
}
```

### Upload Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                       FILE UPLOAD FLOW                           │
└─────────────────────────────────────────────────────────────────┘

  ┌─────────────────┐
  │ Multipart Form  │
  │ (file + purpose)│
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ FileInterceptor │ Multer parses multipart
  │    (Multer)     │ Extracts buffer + metadata
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ CreateFileDto   │ Validates purpose
  │   Validation    │ Validates expires_after
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │   toFile()      │ Converts Buffer to
  │    Helper       │ File-like object
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ client.files    │ Sends to OpenAI
  │   .create()     │ Returns FileObject
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  LoggerService  │ Logs metadata
  │                 │ (no file content)
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ Files.FileObject│ Returns to client
  │   Response      │ status: 'uploaded'
  └─────────────────┘
```

---

## Binary Download Streaming

### Binary Streaming Mixin

The project uses a shared mixin for streaming binary responses from OpenAI.

**Location:** `src/common/mixins/binary-streaming.mixin.ts`

```typescript
export async function streamBinaryResponse(
  response: Response,           // OpenAI SDK Response (fetch-API compatible)
  expressRes: ExpressResponse,  // Express Response object
  contentType: string,          // MIME type for response
  filename: string,             // For Content-Disposition header
): Promise<void> {
  expressRes.setHeader('Content-Type', contentType);
  expressRes.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"`,
  );

  if (response.body) {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      expressRes.write(value);
    }
  }
  expressRes.end();
}
```

### Content-Type Detection

The controller maps file extensions to MIME types for proper download headers.

```typescript
private getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const contentTypeMap: Record<string, string> = {
    // Documents
    pdf: 'application/pdf',
    txt: 'text/plain',
    md: 'text/markdown',
    html: 'text/html',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

    // Images
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',

    // Data
    json: 'application/json',
    jsonl: 'application/jsonl',
    csv: 'text/csv',
    xml: 'application/xml',

    // Code
    js: 'application/javascript',
    ts: 'application/typescript',
    py: 'text/x-python',
    java: 'text/x-java',
    c: 'text/x-c',
    cpp: 'text/x-c++',
  };
  return contentTypeMap[ext || ''] || 'application/octet-stream';
}
```

### Download Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      FILE DOWNLOAD FLOW                          │
└─────────────────────────────────────────────────────────────────┘

  ┌─────────────────┐
  │ GET /files/:id  │
  │    /content     │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ retrieveFile()  │ Get metadata
  │                 │ (filename, purpose)
  └────────┬────────┘
           │
           ├──────────────────────────────┐
           │                              │
           ▼                              ▼
  ┌─────────────────┐            ┌─────────────────┐
  │ purpose check   │            │ purpose check   │
  │ != 'assistants' │            │ == 'assistants' │
  └────────┬────────┘            └────────┬────────┘
           │                              │
           ▼                              ▼
  ┌─────────────────┐            ┌─────────────────┐
  │ downloadFile    │            │     Error       │
  │   Content()     │            │   403 Forbidden │
  └────────┬────────┘            └─────────────────┘
           │
           ▼
  ┌─────────────────┐
  │ getContentType  │ Detect MIME type
  │   (filename)    │ from extension
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ streamBinary    │ Set headers
  │   Response()    │ Stream chunks
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ Binary Response │ Content-Type
  │                 │ Content-Disposition
  └─────────────────┘
```

---

## Polling for File Processing

### Exponential Backoff Strategy

Files may require processing after upload. The service provides polling with exponential backoff.

```typescript
async pollUntilComplete(
  fileId: string,
  maxWaitMs: number = 600000,  // 10 minutes default
): Promise<Files.FileObject> {
  const startTime = Date.now();
  let waitTime = 5000;  // Start with 5 seconds

  while (Date.now() - startTime < maxWaitMs) {
    const file = await this.retrieveFile(fileId);

    // Check for terminal states
    if (file.status === 'processed' || file.status === 'error') {
      return file;
    }

    // Exponential backoff: 5s → 10s → 15s → 20s (max)
    await this.sleep(waitTime);
    waitTime = Math.min(waitTime + 5000, 20000);
  }

  throw new Error(`File ${fileId} did not complete within ${maxWaitMs}ms`);
}
```

### Polling Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| Initial Delay | 5 seconds | First poll after upload |
| Increment | +5 seconds | Added each poll |
| Maximum Delay | 20 seconds | Cap on poll interval |
| Default Timeout | 10 minutes | Total wait time |

### Polling Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    POLLING WITH EXPONENTIAL BACKOFF              │
└─────────────────────────────────────────────────────────────────┘

  Upload Response (status: 'uploaded')
           │
           ▼
  ┌─────────────────┐
  │ Poll #1 (5s)    │────► status: 'uploaded' ─┐
  └─────────────────┘                          │
                                               ▼
  ┌─────────────────┐                    ┌─────────┐
  │ Poll #2 (10s)   │────► status: 'uploaded' ─┤ Wait... │
  └─────────────────┘                    └─────────┘
                                               │
  ┌─────────────────┐                          ▼
  │ Poll #3 (15s)   │────► status: 'uploaded' ─┐
  └─────────────────┘                          │
                                               ▼
  ┌─────────────────┐                    ┌─────────┐
  │ Poll #4 (20s)   │────► status: 'processed' │ Done!   │
  └─────────────────┘                    └─────────┘
           │
           ▼
  ┌─────────────────┐
  │ Return FileObject│
  │ (ready for use) │
  └─────────────────┘


  Timing:  ──5s──┬──10s──┬──15s──┬──20s──┬──20s──┬── ...
                 │       │       │       │       │
               Poll 1  Poll 2  Poll 3  Poll 4  Poll 5
```

---

## Custom Validators

### File Purpose Validator

Validates that purpose is one of the allowed values with helpful typo detection.

**Location:** `src/openai/validators/file-purpose.validator.ts`

```typescript
@ValidatorConstraint({ name: 'IsFilePurposeValid', async: false })
export class IsFilePurposeConstraint implements ValidatorConstraintInterface {
  private readonly validPurposes = [
    'assistants',
    'batch',
    'fine-tune',
    'vision',
    'user_data',
    'evals',
  ];

  validate(value: unknown): boolean {
    return typeof value === 'string' && this.validPurposes.includes(value);
  }

  defaultMessage(): string {
    return `purpose must be one of: ${this.validPurposes.join(', ')}`;
  }
}
```

**Typo Detection:**
```
'assistant'  → Did you mean 'assistants'?
'finetune'   → Did you mean 'fine-tune'?
'userdata'   → Did you mean 'user_data'?
'image'      → Did you mean 'vision'?
```

### File Size Validator

Cross-field validation for file size based on purpose.

**Location:** `src/openai/validators/file-size.validator.ts`

```typescript
export const FILE_SIZE_LIMITS_MB: Record<string, number> = {
  assistants: 512,
  vision: 20,
  batch: 200,
  'fine-tune': 512,
  user_data: 512,
  evals: 512,
};

export const FILE_SIZE_LIMITS_BYTES: Record<string, number> = {
  assistants: 536870912,   // 512 MB
  vision: 20971520,        // 20 MB
  batch: 209715200,        // 200 MB
  'fine-tune': 536870912,  // 512 MB
  user_data: 536870912,    // 512 MB
  evals: 536870912,        // 512 MB
};

export function validateFileSize(fileSizeBytes: number, purpose: string): boolean {
  const limit = FILE_SIZE_LIMITS_BYTES[purpose];
  return limit !== undefined && fileSizeBytes <= limit;
}

export function getFileSizeErrorMessage(fileSizeBytes: number, purpose: string): string {
  const limit = FILE_SIZE_LIMITS_MB[purpose];
  const sizeMB = (fileSizeBytes / 1024 / 1024).toFixed(2);
  return `File size ${sizeMB} MB exceeds ${limit} MB limit for purpose '${purpose}'`;
}
```

### File Type Validator

Validates MIME types per purpose with extension mapping.

**Location:** `src/openai/validators/file-type.validator.ts`

```typescript
export const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  assistants: [
    'application/pdf',
    'text/plain',
    'text/markdown',
    'text/html',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/javascript',
    'application/typescript',
    'text/x-python',
    'text/x-java',
    'text/x-c',
    'text/x-c++',
    'application/json',
    'application/jsonl',
    'text/csv',
    'application/xml',
    'text/xml',
  ],
  vision: [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
  ],
  batch: ['application/jsonl'],
  'fine-tune': ['application/jsonl'],
  user_data: [
    // All assistants types plus...
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream',
  ],
  evals: ['application/jsonl'],
};

export const EXTENSION_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  html: 'text/html',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  js: 'application/javascript',
  ts: 'application/typescript',
  py: 'text/x-python',
  json: 'application/json',
  jsonl: 'application/jsonl',
  csv: 'text/csv',
  xml: 'application/xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
```

---

## SDK Integration

### OpenAI SDK Import Patterns

```typescript
import OpenAI, { toFile } from 'openai';
import type { Files } from 'openai/resources/files';
```

### SDK Method Signatures

| Operation | SDK Method | Parameters | Returns |
|-----------|-----------|------------|---------|
| Upload | `client.files.create()` | `Files.FileCreateParams` | `Files.FileObject` |
| Retrieve | `client.files.retrieve()` | `fileId: string` | `Files.FileObject` |
| List | `client.files.list()` | `Files.FileListParams` | `Page<Files.FileObject>` |
| Delete | `client.files.delete()` | `fileId: string` | `Files.FileDeleted` |
| Content | `client.files.content()` | `fileId: string` | `Response` |

### Parameter Construction Pattern

```typescript
// Upload with conditional parameters
const params: Files.FileCreateParams = {
  file: await toFile(fileBuffer, filename),
  purpose,
  ...(expiresAfter && { expires_after: expiresAfter }),
};

// List with conditional filtering
const params: Files.FileListParams = {
  ...(purpose && { purpose }),
  ...(order && { order }),
  ...(limit && { limit }),
};
```

### Response Handling

```typescript
// List returns paginated response - extract data array
const page = await this.client.files.list(params);
return page.data;  // Files.FileObject[]

// Content returns fetch Response - use for streaming
const response: Response = await this.client.files.content(fileId);
// response.body is ReadableStream
```

---

## Error Handling

### File-Specific Error Codes

```typescript
type FileErrorCode =
  // Upload Errors
  | 'file_too_large'        // 413 - Exceeds size limit
  | 'file_upload_failed'    // 500 - Upload error
  | 'invalid_file_format'   // 400 - Unsupported format
  | 'unsupported_file'      // 400 - File type not supported

  // Processing Errors
  | 'processing_failed'     // 400 - OpenAI processing failure
  | 'file_parsing_error'    // 400 - Invalid file structure

  // Access Errors
  | 'file_not_found'        // 404 - File ID doesn't exist
  | 'download_forbidden'    // 403 - Cannot download assistants files
  | 'file_deleted'          // 410 - File was previously deleted

  // Purpose Errors
  | 'invalid_purpose'       // 400 - Invalid purpose value
  | 'purpose_mismatch';     // 400 - Purpose incompatible with operation
```

### Error Code Mappings

```typescript
export const FILE_ERROR_CODE_MAPPINGS: Record<FileErrorCode, ErrorMapping> = {
  file_too_large: {
    status: 413,
    message: 'File exceeds maximum size limit',
    hint: 'File must be under 512 MB for standard API. Use Uploads API for files up to 8 GB.',
  },
  download_forbidden: {
    status: 403,
    message: 'File download not allowed',
    hint: 'Files with purpose "assistants" cannot be downloaded via API due to OpenAI policy.',
  },
  invalid_purpose: {
    status: 400,
    message: 'Invalid file purpose',
    hint: 'Purpose must be one of: assistants, vision, batch, fine-tune, user_data, evals.',
  },
  file_not_found: {
    status: 404,
    message: 'File not found',
    hint: 'Verify the file ID is correct and the file has not been deleted.',
  },
  processing_failed: {
    status: 400,
    message: 'File processing failed',
    hint: 'Check file format and content. For JSONL files, ensure valid JSON on each line.',
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
  error_code?: ErrorCode;
  parameter?: string | null;
  hint?: string;
  rate_limit_info?: RateLimitInfo;
  retry_after_seconds?: number | string;
  openai_error?: {
    type: string;
    code?: string;
    param?: string | null;
    message: string;
    full_error?: unknown;
  };
}
```

### Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      ERROR HANDLING FLOW                         │
└─────────────────────────────────────────────────────────────────┘

  ┌─────────────────┐
  │  OpenAI SDK     │
  │    throws       │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ OpenAIException │ Catches all exceptions
  │    Filter       │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  Detect Error   │ instanceof checks:
  │    Type         │ - APIError
  │                 │ - RateLimitError
  │                 │ - BadRequestError
  │                 │ - NotFoundError
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  Map to Error   │ Uses FILE_ERROR_CODE_MAPPINGS
  │    Code         │ Extracts hint and status
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  Build Enhanced │ Adds:
  │   Response      │ - request_id
  │                 │ - rate_limit_info
  │                 │ - retry_after_seconds
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │    Return       │ User-friendly error
  │   Response      │ with actionable hint
  └─────────────────┘
```

---

## Size Limits & Constraints

### File Size Limits by Purpose

| Purpose | Limit (MB) | Limit (Bytes) | Notes |
|---------|------------|---------------|-------|
| assistants | 512 | 536,870,912 | Largest for documents |
| vision | 20 | 20,971,520 | Smallest for images |
| batch | 200 | 209,715,200 | JSONL input files |
| fine-tune | 512 | 536,870,912 | Training data |
| user_data | 512 | 536,870,912 | General purpose |
| evals | 512 | 536,870,912 | Evaluation datasets |

### Organization Limits

| Limit | Value | Notes |
|-------|-------|-------|
| Total Storage | 100 GB | Organization-wide |
| Max File Size (Standard) | 512 MB | Per file |
| Max File Size (Uploads API) | 8 GB | Large file support |
| Files per Vector Store | 10,000 | Per vector store |

### Expiration Constraints

| Parameter | Minimum | Maximum | Notes |
|-----------|---------|---------|-------|
| seconds | 3600 | 2592000 | 1 hour to 30 days |
| anchor | created_at | created_at | Only value supported |

---

## Cost Estimation

### Storage Costs

Files consume storage quota. The project logs file metadata for cost tracking:

```typescript
this.loggerService.logOpenAIInteraction({
  metadata: {
    file_id: file.id,
    bytes: file.bytes,
    purpose: file.purpose,
    created_at: file.created_at,
    expires_at: file.expires_at,
  },
});
```

### Processing Costs

Files with `purpose` requiring processing may incur additional costs:
- `assistants` - Processing for vector store indexing
- `batch` - Processing for request validation
- `fine-tune` - Processing for training data validation
- `evals` - Processing for evaluation dataset validation

---

## Testing Architecture

### Test Coverage Summary

| Component | File | Lines | Test Cases |
|-----------|------|-------|------------|
| Service | `openai-files.service.spec.ts` | 654 | 47 |
| Controller | `files.controller.spec.ts` | 765 | 43 |
| CreateFileDto | `create-file.dto.spec.ts` | 528 | 43 |
| ListFilesDto | `list-files.dto.spec.ts` | 596 | 53 |
| E2E Tests | `files.e2e-spec.ts` | 532 | 19 |
| **Total** | **5 files** | **3,075** | **~205** |

### Test Categories

#### Service Tests (47 tests)
- Upload with all parameters and purposes
- Retrieve file metadata and status
- List with filtering, sorting, pagination
- Delete operations and confirmations
- Download content (success and forbidden)
- Polling with exponential backoff
- Metadata extraction

#### Controller Tests (43 tests)
- All 5 endpoints
- File upload handling with Multer
- Content-type detection
- Binary streaming responses
- Error handling scenarios

#### DTO Validation Tests (96 tests)
- Valid configurations
- Invalid values and types
- Boundary values
- Nested object validation
- PlainToClass transformations

#### E2E Tests (19 tests)
- Real API integration
- File lifecycle (upload → retrieve → delete)
- Purpose-specific behavior
- Error responses

### Mock Patterns

```typescript
// OpenAI Client Mock
const mockOpenAIClient = {
  files: {
    create: jest.fn(),
    retrieve: jest.fn(),
    list: jest.fn(),
    delete: jest.fn(),
    content: jest.fn(),
  },
};

// toFile Function Mock
jest.mock('openai', () => ({
  __esModule: true,
  toFile: jest.fn((buffer, filename) => Promise.resolve({ buffer, filename })),
}));

// Response Mock for Streaming
const mockOpenAIResponse: Response = {
  body: {
    getReader: jest.fn().mockReturnValue({
      read: jest.fn()
        .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2, 3]) })
        .mockResolvedValueOnce({ done: true, value: undefined }),
    }),
  },
} as unknown as Response;
```

---

## Usage Examples

### Upload a File

**cURL:**
```bash
curl -X POST http://localhost:3000/api/files \
  -F "file=@document.pdf" \
  -F "purpose=assistants"
```

**With Expiration:**
```bash
curl -X POST http://localhost:3000/api/files \
  -F "file=@temp-data.jsonl" \
  -F "purpose=batch" \
  -F 'expires_after={"anchor":"created_at","seconds":86400}'
```

**TypeScript:**
```typescript
const formData = new FormData();
formData.append('file', fileBlob, 'document.pdf');
formData.append('purpose', 'assistants');

const response = await fetch('/api/files', {
  method: 'POST',
  body: formData,
});

const file = await response.json();
console.log(file.id);  // file-abc123xyz789
```

### List Files with Filtering

**cURL:**
```bash
# List all files
curl http://localhost:3000/api/files

# Filter by purpose
curl "http://localhost:3000/api/files?purpose=assistants"

# With sorting and pagination
curl "http://localhost:3000/api/files?purpose=batch&order=asc&limit=50"
```

**TypeScript:**
```typescript
const params = new URLSearchParams({
  purpose: 'assistants',
  order: 'desc',
  limit: '20',
});

const response = await fetch(`/api/files?${params}`);
const files = await response.json();
```

### Get File Metadata

**cURL:**
```bash
curl http://localhost:3000/api/files/file-abc123xyz789
```

**TypeScript:**
```typescript
const response = await fetch('/api/files/file-abc123xyz789');
const file = await response.json();

console.log(file.status);  // 'processed'
console.log(file.bytes);   // 1048576
```

### Download File Content

**cURL:**
```bash
curl -O http://localhost:3000/api/files/file-abc123xyz789/content
```

**TypeScript:**
```typescript
const response = await fetch('/api/files/file-abc123xyz789/content');
const blob = await response.blob();

// Save to file
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'downloaded-file.pdf';
a.click();
```

### Delete a File

**cURL:**
```bash
curl -X DELETE http://localhost:3000/api/files/file-abc123xyz789
```

**TypeScript:**
```typescript
const response = await fetch('/api/files/file-abc123xyz789', {
  method: 'DELETE',
});

const result = await response.json();
console.log(result.deleted);  // true
```

### Poll Until Processed

**TypeScript (Service):**
```typescript
// Upload file
const file = await filesService.uploadFile(
  buffer,
  'training-data.jsonl',
  'fine-tune',
);

// Wait for processing
const processedFile = await filesService.pollUntilComplete(
  file.id,
  300000,  // 5 minute timeout
);

if (processedFile.status === 'error') {
  console.error('Processing failed:', processedFile.status_details);
} else {
  console.log('File ready for use');
}
```

### Add File to Vector Store

**After Upload:**
```typescript
// 1. Upload file with assistants purpose
const file = await filesService.uploadFile(
  documentBuffer,
  'knowledge-base.pdf',
  'assistants',
);

// 2. Wait for processing
const processedFile = await filesService.pollUntilComplete(file.id);

// 3. Add to vector store
await vectorStoresService.addFile(vectorStoreId, {
  file_id: processedFile.id,
  chunking_strategy: { type: 'auto' },
});
```

---

## Integration with Other APIs

### Vector Stores Integration

Files with `purpose='assistants'` are used with Vector Stores for semantic search.

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Upload File   │ ──►  │  Add to Vector  │ ──►  │   file_search   │
│ purpose:        │      │     Store       │      │      Tool       │
│ 'assistants'    │      │                 │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

### Batch API Integration

Files with `purpose='batch'` are used as input for Batch API.

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Upload JSONL  │ ──►  │  Create Batch   │ ──►  │  Process Batch  │
│ purpose:'batch' │      │     Job         │      │   Requests      │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

### Fine-tuning Integration

Files with `purpose='fine-tune'` are used for model training.

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ Upload Training │ ──►  │ Create Fine-tune│ ──►  │  Custom Model   │
│ purpose:        │      │      Job        │      │                 │
│ 'fine-tune'     │      │                 │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

### Code Interpreter Integration

Files with `purpose='user_data'` are used with the code_interpreter tool.

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Upload Data   │ ──►  │  Attach to      │ ──►  │ code_interpreter│
│ purpose:        │      │   Message       │      │   Analysis      │
│ 'user_data'     │      │                 │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

---

## Related Documentation

- [RESPONSES_API.md](./RESPONSES_API.md) - Responses API with file_search tool
- [STREAMING.md](./STREAMING.md) - Streaming architecture and events
- [DATA_FLOW.md](./DATA_FLOW.md) - Request/response data flow
- [README.md](../README.md) - Project overview and setup
