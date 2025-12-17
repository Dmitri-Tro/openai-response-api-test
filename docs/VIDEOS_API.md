# Videos API Documentation

Complete documentation of the OpenAI Videos API (Sora) implementation in this NestJS project.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [REST Endpoints](#rest-endpoints)
4. [Request Parameters](#request-parameters)
5. [Response Structure](#response-structure)
6. [Async Polling Pattern](#async-polling-pattern)
7. [Video Lifecycle](#video-lifecycle)
8. [Download Variants](#download-variants)
9. [Remix Feature](#remix-feature)
10. [SDK Integration](#sdk-integration)
11. [Error Handling](#error-handling)
12. [Cost Estimation](#cost-estimation)
13. [Testing Architecture](#testing-architecture)
14. [Usage Examples](#usage-examples)

---

## Overview

The Videos API implements OpenAI's Sora text-to-video generation service. Unlike the Responses API which uses streaming, the Videos API uses an **asynchronous job pattern** with polling - video generation is a long-running operation that can take 2-10 minutes to complete.

### Key Characteristics

| Aspect | Details |
|--------|---------|
| **Pattern** | Async job polling (not streaming) |
| **Generation Time** | 2-10 minutes typical |
| **Models** | `sora-2`, `sora-2-pro` |
| **Durations** | 4, 8, or 12 seconds |
| **Output Format** | MP4 (H.264 video, AAC audio) |
| **Additional Assets** | Thumbnail (JPEG), Spritesheet (JPEG) |

### Videos API vs Responses API

| Feature | Videos API | Responses API |
|---------|-----------|---------------|
| **Communication** | Polling | Streaming (SSE) |
| **Wait Time** | Minutes | Seconds |
| **Output** | Binary files | Text/JSON |
| **Status Tracking** | Progress percentage | Event stream |
| **Cost Model** | Per-second pricing | Token-based |

---

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Videos API Architecture                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐     ┌───────────────────────────────────────┐ │
│  │  HTTP Request    │     │           VideosController            │ │
│  │  POST /api/videos│────▶│  - createVideo()                      │ │
│  │  GET /api/videos │     │  - getVideoStatus()                   │ │
│  │  DELETE /api/... │     │  - pollUntilComplete()                │ │
│  └──────────────────┘     │  - downloadVideo()                    │ │
│                           │  - listVideos()                       │ │
│                           │  - deleteVideo()                      │ │
│                           │  - remixVideo()                       │ │
│                           └───────────────┬───────────────────────┘ │
│                                           │                          │
│                                           ▼                          │
│                           ┌───────────────────────────────────────┐ │
│                           │        OpenAIVideosService            │ │
│                           │  - createVideo()                      │ │
│                           │  - getVideoStatus()                   │ │
│                           │  - pollUntilComplete()                │ │
│                           │  - downloadVideo()                    │ │
│                           │  - listVideos()                       │ │
│                           │  - deleteVideo()                      │ │
│                           │  - remixVideo()                       │ │
│                           │  - extractVideoMetadata()             │ │
│                           └───────────────┬───────────────────────┘ │
│                                           │                          │
│                    ┌──────────────────────┼──────────────────────┐  │
│                    │                      │                      │  │
│                    ▼                      ▼                      ▼  │
│  ┌─────────────────────┐ ┌─────────────────────┐ ┌──────────────────┐
│  │    OpenAI SDK       │ │   LoggerService     │ │ Cost Estimation  │
│  │  client.videos.*    │ │ logOpenAIInteraction│ │ calculateVideoCost│
│  └─────────────────────┘ └─────────────────────┘ └──────────────────┘
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### File Structure

```
src/openai/
├── controllers/
│   ├── videos.controller.ts          # 7 REST endpoints
│   └── videos.controller.spec.ts     # Controller tests (562 lines)
├── services/
│   ├── openai-videos.service.ts      # 8 public methods
│   └── openai-videos.service.spec.ts # Service tests (614 lines)
├── dto/
│   ├── create-video.dto.ts           # Request validation
│   └── create-video.dto.spec.ts      # DTO tests (690 lines)
└── validators/
    ├── video-duration.validator.ts   # Duration validation
    ├── video-size.validator.ts       # Resolution validation
    └── *.spec.ts                     # Validator tests (495 lines)

src/common/
├── utils/
│   └── cost-estimation.utils.ts      # Video cost calculation
└── mixins/
    └── binary-streaming.mixin.ts     # Binary file streaming

test/
└── videos.e2e-spec.ts                # E2E tests (470 lines)
```

---

## REST Endpoints

### Endpoint Summary

| Method | Path | Status | Purpose |
|--------|------|--------|---------|
| `POST` | `/api/videos` | 201 | Create video generation job |
| `GET` | `/api/videos/:id` | 200 | Get current video status |
| `GET` | `/api/videos/:id/poll` | 200 | Poll until completion |
| `GET` | `/api/videos/:id/download` | 200 | Download video/assets |
| `GET` | `/api/videos` | 200 | List all videos |
| `DELETE` | `/api/videos/:id` | 200 | Delete video |
| `POST` | `/api/videos/:id/remix` | 201 | Create video variation |

### 1. Create Video

```http
POST /api/videos
Content-Type: application/json

{
  "prompt": "A serene mountain landscape at sunset with birds flying over a lake",
  "model": "sora-2",
  "seconds": "8",
  "size": "1280x720"
}
```

**Response** (201 Created):
```json
{
  "id": "vid_abc123xyz789",
  "object": "video",
  "status": "queued",
  "progress": 0,
  "model": "sora-2",
  "seconds": "8",
  "size": "1280x720",
  "prompt": "A serene mountain landscape at sunset...",
  "created_at": 1702425600,
  "completed_at": null,
  "expires_at": null,
  "remixed_from_video_id": null,
  "error": null
}
```

### 2. Get Video Status

```http
GET /api/videos/vid_abc123xyz789
```

**Response** (200 OK):
```json
{
  "id": "vid_abc123xyz789",
  "object": "video",
  "status": "in_progress",
  "progress": 45,
  "model": "sora-2",
  ...
}
```

### 3. Poll Until Complete

```http
GET /api/videos/vid_abc123xyz789/poll?maxWaitMs=600000
```

**Query Parameters**:
- `maxWaitMs` (optional): Maximum wait time in milliseconds (default: 600000 = 10 minutes)

**Response** (200 OK - when completed):
```json
{
  "id": "vid_abc123xyz789",
  "object": "video",
  "status": "completed",
  "progress": 100,
  "completed_at": 1702425720,
  "expires_at": 1702512120,
  ...
}
```

### 4. Download Video

```http
GET /api/videos/vid_abc123xyz789/download?variant=video
```

**Query Parameters**:
- `variant` (optional): `video` (default), `thumbnail`, or `spritesheet`

**Response**: Binary file stream with headers:
```
Content-Type: video/mp4 (or image/jpeg)
Content-Disposition: attachment; filename="vid_abc123xyz789.mp4"
```

### 5. List Videos

```http
GET /api/videos?limit=20&order=desc
```

**Query Parameters**:
- `limit` (optional): Number of results (default: 10)
- `order` (optional): `asc` or `desc` by created_at (default: `desc`)

**Response** (200 OK):
```json
[
  { "id": "vid_abc123", "status": "completed", ... },
  { "id": "vid_xyz456", "status": "in_progress", ... }
]
```

### 6. Delete Video

```http
DELETE /api/videos/vid_abc123xyz789
```

**Response** (200 OK):
```json
{
  "id": "vid_abc123xyz789",
  "object": "video.deleted",
  "deleted": true
}
```

### 7. Remix Video

```http
POST /api/videos/vid_abc123xyz789/remix
Content-Type: application/json

{
  "prompt": "A stormy beach with heavy waves"
}
```

**Response** (201 Created):
```json
{
  "id": "vid_new_remix_id",
  "object": "video",
  "status": "queued",
  "remixed_from_video_id": "vid_abc123xyz789",
  ...
}
```

---

## Request Parameters

### CreateVideoDto

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | string | Yes | - | Text description (1-500 characters) |
| `model` | enum | No | `'sora-2'` | Model selection |
| `seconds` | enum | No | `'4'` | Video duration (STRING literal) |
| `size` | enum | No | `'720x1280'` | Output resolution |

### Model Options

| Model | Quality | Speed | Cost/sec | Use Case |
|-------|---------|-------|----------|----------|
| `sora-2` | Standard | Fastest | ~$0.125 | Social media, drafts, prototypes |
| `sora-2-pro` | Professional | Slowest | ~$0.40 | Production content, marketing |

### Duration Options

| Value | Cost (sora-2) | Cost (sora-2-pro) | Use Case |
|-------|---------------|-------------------|----------|
| `'4'` | ~$0.50 | ~$1.60 | Short clips, stories |
| `'8'` | ~$1.00 | ~$3.20 | Standard content |
| `'12'` | ~$1.50 | ~$4.80 | Detailed scenes |

**CRITICAL**: Duration must be a STRING literal (`'4'`), not a number (`4`).

### Resolution Options

| Value | Aspect Ratio | Orientation | Platform |
|-------|--------------|-------------|----------|
| `'720x1280'` | 9:16 | Portrait | Mobile/TikTok/Reels |
| `'1280x720'` | 16:9 | Landscape | YouTube/Desktop |
| `'1024x1792'` | 9:16 | Portrait Hi-res | Premium mobile |
| `'1792x1024'` | 16:9 | Landscape Hi-res | Premium desktop |

### Validation Rules

```typescript
export class CreateVideoDto {
  @IsString()
  @Length(1, 500)
  prompt!: string;

  @IsEnum(['sora-2', 'sora-2-pro'])
  @IsOptional()
  model?: Videos.VideoModel;

  @IsEnum(['4', '8', '12'])
  @IsOptional()
  seconds?: Videos.VideoSeconds;

  @IsEnum(['720x1280', '1280x720', '1024x1792', '1792x1024'])
  @IsOptional()
  size?: Videos.VideoSize;
}
```

---

## Response Structure

### Videos.Video Interface

```typescript
interface Video {
  id: string;                  // Unique identifier (e.g., "vid_abc123")
  object: 'video';             // Always "video"
  status: VideoStatus;         // 'queued' | 'in_progress' | 'completed' | 'failed'
  progress: number;            // 0-100 completion percentage
  model: VideoModel;           // 'sora-2' | 'sora-2-pro'
  seconds: VideoSeconds;       // '4' | '8' | '12'
  size: VideoSize;             // Resolution string
  prompt: string | null;       // Original prompt
  created_at: number;          // Unix timestamp (seconds)
  completed_at: number | null; // Completion timestamp
  expires_at: number | null;   // Asset expiration timestamp
  remixed_from_video_id: string | null; // Parent video if remix
  error: VideoCreateError | null;       // Error details if failed
}

interface VideoCreateError {
  code: string;                // Error code
  message: string;             // Human-readable message
}

interface VideoDeleteResponse {
  id: string;
  object: 'video.deleted';
  deleted: boolean;
}
```

---

## Async Polling Pattern

### Overview

Unlike streaming APIs, video generation uses asynchronous polling:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   CREATE    │────▶│    POLL     │────▶│   COMPLETE  │────▶│  DOWNLOAD   │
│ POST /videos│     │ GET /poll   │     │ status:done │     │ GET /download│
│ status:queue│     │ (repeat)    │     │ progress:100│     │ binary MP4  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### Exponential Backoff Strategy

The polling mechanism uses exponential backoff to reduce API load:

```typescript
async pollUntilComplete(videoId: string, maxWaitMs: number = 600000): Promise<Video> {
  const startTime = Date.now();
  let waitTime = 5000;  // Start with 5 seconds

  while (Date.now() - startTime < maxWaitMs) {
    const video = await this.getVideoStatus(videoId);

    // Return on terminal status
    if (video.status === 'completed' || video.status === 'failed') {
      return video;
    }

    // Wait with exponential backoff
    await this.sleep(waitTime);
    waitTime = Math.min(waitTime + 5000, 20000);  // Cap at 20s
  }

  throw new GatewayTimeoutException('Video generation timeout');
}
```

### Backoff Timing

| Poll # | Wait Before | Cumulative Time |
|--------|-------------|-----------------|
| 1 | 0s (immediate) | 0s |
| 2 | 5s | 5s |
| 3 | 10s | 15s |
| 4 | 15s | 30s |
| 5+ | 20s (max) | 50s, 70s, 90s... |

### Timeout Handling

- **Default timeout**: 600,000ms (10 minutes)
- **Custom timeout**: Pass `maxWaitMs` query parameter
- **Timeout error**: HTTP 504 Gateway Timeout

```typescript
// Example with custom 5-minute timeout
GET /api/videos/vid_abc123/poll?maxWaitMs=300000
```

---

## Video Lifecycle

### State Machine

```
                    ┌──────────────────────────────────────┐
                    │                                      │
                    ▼                                      │
┌─────────┐    ┌─────────────┐    ┌───────────┐    ┌──────┴────┐
│ QUEUED  │───▶│ IN_PROGRESS │───▶│ COMPLETED │───▶│ DOWNLOADED │
│ (0%)    │    │ (1-99%)     │    │ (100%)    │    │ (binary)   │
└─────────┘    └──────┬──────┘    └───────────┘    └────────────┘
                      │
                      ▼
                ┌──────────┐
                │  FAILED  │
                │ (error)  │
                └──────────┘
```

### Status Values

| Status | Progress | Description | Next Actions |
|--------|----------|-------------|--------------|
| `queued` | 0% | Job waiting to start | Poll or wait |
| `in_progress` | 1-99% | Actively generating | Poll for updates |
| `completed` | 100% | Ready for download | Download assets |
| `failed` | varies | Generation failed | Check error, retry |

### Asset Expiration

- Generated videos have a retention period
- Check `expires_at` field for expiration timestamp
- Download before expiration or assets become unavailable
- HTTP 410 Gone returned after expiration

---

## Download Variants

### Available Variants

| Variant | Format | Content-Type | Description |
|---------|--------|--------------|-------------|
| `video` | MP4 | video/mp4 | Full video (H.264 + AAC) |
| `thumbnail` | JPEG | image/jpeg | Single frame preview |
| `spritesheet` | JPEG | image/jpeg | Grid of video frames |

### Binary Streaming Implementation

```typescript
@Get(':id/download')
async downloadVideo(
  @Param('id') id: string,
  @Query('variant') variant: 'video' | 'thumbnail' | 'spritesheet' = 'video',
  @Res() res: Response,
): Promise<void> {
  const response = await this.videosService.downloadVideo(id, variant);

  const contentType = variant === 'video' ? 'video/mp4' : 'image/jpeg';
  const extension = variant === 'video' ? 'mp4' : 'jpg';

  await streamBinaryResponse(response, res, contentType, `${id}.${extension}`);
}
```

### streamBinaryResponse Mixin

```typescript
export async function streamBinaryResponse(
  response: Response,
  expressRes: ExpressResponse,
  contentType: string,
  filename: string,
): Promise<void> {
  expressRes.setHeader('Content-Type', contentType);
  expressRes.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

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

---

## Remix Feature

### What is Remix?

Remix creates variations of existing videos with different prompts while maintaining the visual style and structure of the source video.

### Remix Workflow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Original Video │     │  Remix Request  │     │   New Video     │
│  status:complete│────▶│  POST /remix    │────▶│  status:queued  │
│  vid_original   │     │  {prompt: "..."}│     │  vid_remix_new  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Remix Characteristics

- Creates a **new** video job (separate ID)
- Maintains visual style of source video
- Inherits model and duration from source
- Each remix is **separately billable**
- Source video must be `completed` status

### Example

```typescript
// Create original video
const original = await service.createVideo({
  prompt: 'A sunny beach with gentle waves',
  model: 'sora-2',
  seconds: '8'
});
await service.pollUntilComplete(original.id);

// Create variations
const stormy = await service.remixVideo(original.id, 'A stormy beach with heavy waves');
const sunset = await service.remixVideo(original.id, 'A beach at golden hour sunset');

// Poll each remix separately
await service.pollUntilComplete(stormy.id);
await service.pollUntilComplete(sunset.id);
```

---

## SDK Integration

### OpenAI Client Methods

```typescript
export class Videos extends APIResource {
  create(body: VideoCreateParams): APIPromise<Video>;
  retrieve(videoID: string): APIPromise<Video>;
  list(query?: VideoListParams): PagePromise<VideosPage, Video>;
  delete(videoID: string): APIPromise<VideoDeleteResponse>;
  downloadContent(videoID: string, query?: VideoDownloadContentParams): APIPromise<Response>;
  remix(videoID: string, body: VideoRemixParams): APIPromise<Video>;
}
```

### Type Imports

```typescript
import type { Videos } from 'openai/resources/videos';

// Use SDK types directly
const params: Videos.VideoCreateParams = { /* ... */ };
const video: Videos.Video = await client.videos.create(params);
```

### Service Implementation Pattern

```typescript
@Injectable()
export class OpenAIVideosService {
  constructor(
    @Inject(OPENAI_CLIENT) private readonly client: OpenAI,
    private readonly loggerService: LoggerService,
  ) {}

  async createVideo(dto: CreateVideoDto): Promise<Videos.Video> {
    const startTime = Date.now();

    // Build params with optional field spread
    const params: Videos.VideoCreateParams = {
      prompt: dto.prompt,
      ...(dto.model && { model: dto.model }),
      ...(dto.seconds && { seconds: dto.seconds }),
      ...(dto.size && { size: dto.size }),
    };

    const video = await this.client.videos.create(params);

    // Calculate cost and log
    const costEstimate = calculateVideoCost(
      dto.model || 'sora-2',
      parseInt(dto.seconds || '4', 10),
    );

    this.loggerService.logOpenAIInteraction({
      timestamp: new Date().toISOString(),
      api: 'videos',
      endpoint: '/v1/videos',
      request: params,
      response: video,
      metadata: {
        latency_ms: Date.now() - startTime,
        video_id: video.id,
        cost_estimate: costEstimate,
      },
    });

    return video;
  }
}
```

---

## Error Handling

### Video Error Codes

| Error Code | HTTP Status | Description | Hint |
|------------|-------------|-------------|------|
| `video_generation_failed` | 500 | Internal generation error | Retry request |
| `invalid_video_prompt` | 400 | Content policy violation | Modify prompt |
| `video_generation_timeout` | 504 | Exceeded time limit | Simplify prompt |
| `video_model_not_available` | 404 | Model unavailable | Use supported model |
| `invalid_video_duration` | 400 | Invalid seconds value | Use "4", "8", or "12" |
| `invalid_video_size` | 400 | Invalid resolution | Use supported size |
| `video_expired` | 410 | Assets no longer available | Generate new video |
| `video_quota_exceeded` | 429 | Rate limit reached | Wait and retry |

### Error Response Structure

```typescript
interface EnhancedErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string;
  error_code?: string;
  hint?: string;
  request_id?: string;
  retry_after_seconds?: number;
  openai_error?: {
    type: string;
    code?: string;
    message: string;
  };
}
```

### Failed Video Response

```json
{
  "id": "vid_abc123",
  "status": "failed",
  "progress": 50,
  "error": {
    "code": "video_generation_failed",
    "message": "Generation failed due to content policy"
  }
}
```

---

## Cost Estimation

### Pricing Model

Cost scales **linearly** with duration:

```typescript
function calculateVideoCost(model: string, durationSeconds: number): number {
  const pricePerSecond = model === 'sora-2-pro' ? 0.4 : 0.125;
  return pricePerSecond * durationSeconds;
}
```

### Cost Matrix

| Model | 4 seconds | 8 seconds | 12 seconds |
|-------|-----------|-----------|------------|
| `sora-2` | $0.50 | $1.00 | $1.50 |
| `sora-2-pro` | $1.60 | $3.20 | $4.80 |

### Cost Tracking

Costs are logged with each request:

```typescript
this.loggerService.logOpenAIInteraction({
  // ...
  metadata: {
    cost_estimate: 0.50,
    model: 'sora-2',
    duration_seconds: 4,
  },
});
```

---

## Testing Architecture

### Test Coverage Summary

| Layer | File | Lines | Test Cases |
|-------|------|-------|------------|
| Unit (Service) | `openai-videos.service.spec.ts` | 614 | 41 |
| Unit (Controller) | `videos.controller.spec.ts` | 562 | 36 |
| DTO Validation | `create-video.dto.spec.ts` | 690 | 64 |
| Validators | `video-*.validator.spec.ts` | 495 | 80+ |
| E2E | `videos.e2e-spec.ts` | 470 | 18 |
| **Total** | | **2,831** | **239+** |

### Mock Patterns

**Service Mock**:
```typescript
const mockOpenAIClient = {
  videos: {
    create: jest.fn(),
    retrieve: jest.fn(),
    list: jest.fn(),
    delete: jest.fn(),
    downloadContent: jest.fn(),
    remix: jest.fn(),
  },
};
```

**Video Fixtures**:
```typescript
const mockQueuedVideo: Videos.Video = {
  id: 'vid_abc123',
  status: 'queued',
  progress: 0,
  // ...
};

const mockCompletedVideo: Videos.Video = {
  id: 'vid_abc123',
  status: 'completed',
  progress: 100,
  completed_at: 1234567890,
  // ...
};

const mockFailedVideo: Videos.Video = {
  id: 'vid_abc123',
  status: 'failed',
  progress: 50,
  error: {
    code: 'video_generation_failed',
    message: 'Generation failed due to content policy',
  },
};
```

### Polling Tests with Fake Timers

```typescript
it('should use exponential backoff during polling', async () => {
  jest.useFakeTimers();

  mockOpenAIClient.videos.retrieve
    .mockResolvedValueOnce({ status: 'queued' })
    .mockResolvedValueOnce({ status: 'in_progress' })
    .mockResolvedValueOnce({ status: 'completed' });

  const pollPromise = service.pollUntilComplete('vid_abc123');

  await jest.advanceTimersByTimeAsync(5000);   // First backoff
  await jest.advanceTimersByTimeAsync(10000);  // Second backoff

  const result = await pollPromise;
  expect(result.status).toBe('completed');

  jest.useRealTimers();
});
```

### E2E Auto-Skip Pattern

```typescript
const hasApiKey = !!process.env.OPENAI_API_KEY;
const testIf = (condition: boolean) => (condition ? it : it.skip);

describe('Videos API (E2E)', () => {
  testIf(hasApiKey)('should create video', async () => {
    // Test runs only if OPENAI_API_KEY is set
  }, 60000);
});
```

### Test Categories

**Service Tests** (41 cases):
- createVideo: parameters, models, durations, sizes, errors
- getVideoStatus: states, error handling
- pollUntilComplete: backoff, timeout, terminal states
- downloadVideo: variants, error cases
- listVideos: pagination, sorting
- deleteVideo: success, errors
- remixVideo: creation, validation
- extractVideoMetadata: all fields

**Controller Tests** (36 cases):
- HTTP layer verification
- Service delegation
- Binary streaming
- Status codes

**DTO Tests** (64 cases):
- Valid configurations (all combinations)
- Invalid prompt (types, length)
- Invalid model/seconds/size
- Optional parameters
- Type safety

---

## Usage Examples

### Basic Video Generation

```bash
# 1. Create video
curl -X POST http://localhost:3000/api/videos \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A serene beach at sunset with gentle waves",
    "model": "sora-2",
    "seconds": "4",
    "size": "1280x720"
  }'

# Response: { "id": "vid_abc123", "status": "queued", ... }

# 2. Poll until complete
curl "http://localhost:3000/api/videos/vid_abc123/poll"

# Response: { "id": "vid_abc123", "status": "completed", ... }

# 3. Download video
curl -O http://localhost:3000/api/videos/vid_abc123/download
```

### TypeScript Client Example

```typescript
import axios from 'axios';
import * as fs from 'fs';

const API_BASE = 'http://localhost:3000/api';

async function generateVideo(prompt: string): Promise<void> {
  // Step 1: Create video job
  const createResponse = await axios.post(`${API_BASE}/videos`, {
    prompt,
    model: 'sora-2',
    seconds: '8',
    size: '1280x720',
  });

  const videoId = createResponse.data.id;
  console.log(`Created video job: ${videoId}`);

  // Step 2: Poll until complete
  const pollResponse = await axios.get(
    `${API_BASE}/videos/${videoId}/poll?maxWaitMs=600000`
  );

  if (pollResponse.data.status === 'failed') {
    throw new Error(pollResponse.data.error.message);
  }

  console.log('Video generation complete!');

  // Step 3: Download video
  const downloadResponse = await axios.get(
    `${API_BASE}/videos/${videoId}/download`,
    { responseType: 'arraybuffer' }
  );

  fs.writeFileSync('output.mp4', Buffer.from(downloadResponse.data));
  console.log('Video saved to output.mp4');

  // Optional: Download thumbnail
  const thumbnailResponse = await axios.get(
    `${API_BASE}/videos/${videoId}/download?variant=thumbnail`,
    { responseType: 'arraybuffer' }
  );

  fs.writeFileSync('thumbnail.jpg', Buffer.from(thumbnailResponse.data));
}

generateVideo('A time-lapse of clouds over mountains').catch(console.error);
```

### Client-Side Polling (Manual)

```typescript
async function pollVideoStatus(videoId: string, maxAttempts = 60): Promise<Video> {
  let waitTime = 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(`/api/videos/${videoId}`);
    const video = await response.json();

    if (video.status === 'completed' || video.status === 'failed') {
      return video;
    }

    console.log(`Progress: ${video.progress}%`);

    await new Promise(resolve => setTimeout(resolve, waitTime));
    waitTime = Math.min(waitTime + 5000, 20000);
  }

  throw new Error('Polling timeout');
}
```

### Creating Multiple Remixes

```typescript
async function createRemixSeries(sourceVideoId: string, prompts: string[]): Promise<Video[]> {
  const remixes: Video[] = [];

  for (const prompt of prompts) {
    // Create remix
    const response = await axios.post(`/api/videos/${sourceVideoId}/remix`, {
      prompt,
    });

    // Poll until complete
    const completed = await axios.get(
      `/api/videos/${response.data.id}/poll`
    );

    remixes.push(completed.data);
  }

  return remixes;
}

// Usage
const variations = await createRemixSeries('vid_original', [
  'Same scene but during a storm',
  'Same scene at golden hour',
  'Same scene in winter with snow',
]);
```

---

## Key Implementation Details

### Type Safety

- All interfaces use OpenAI SDK types - **NO `any` types**
- String literals required for `seconds` and `size` parameters
- Full TypeScript strict mode compliance

### String Literal Requirement

```typescript
// CORRECT - String literals
{ seconds: '4', size: '720x1280' }

// INCORRECT - Numbers will fail validation
{ seconds: 4, size: 720 }
```

### Module Registration

```typescript
// openai.module.ts
@Module({
  controllers: [VideosController],
  providers: [OpenAIVideosService],
  exports: [OpenAIVideosService],
})
export class OpenAIModule {}
```

### Design Patterns Used

1. **Async Job Pattern**: Polling instead of streaming for long operations
2. **Exponential Backoff**: Gradually increasing poll intervals
3. **Pass-Through Response**: Service returns SDK responses as-is
4. **Binary Streaming Mixin**: Shared utility for file downloads
5. **Type-Safe DTOs**: Full OpenAI SDK type integration
6. **Dependency Injection**: OpenAI client via NestJS provider pattern

---

## References

- [OpenAI Videos API Documentation](https://platform.openai.com/docs/api-reference/videos)
- [OpenAI Sora Documentation](https://platform.openai.com/docs/guides/video-generation)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Project README](../README.md)
- [Streaming Documentation](./STREAMING.md)
- [Data Flow Documentation](./DATA_FLOW.md)
