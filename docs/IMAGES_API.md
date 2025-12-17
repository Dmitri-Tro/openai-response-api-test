# Images API Documentation

Complete documentation of the OpenAI Images API (DALL-E 2, DALL-E 3, gpt-image-1) implementation in this NestJS project.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Supported Models](#supported-models)
4. [REST Endpoints](#rest-endpoints)
5. [Request Parameters](#request-parameters)
6. [Response Structure](#response-structure)
7. [File Upload Handling](#file-upload-handling)
8. [Custom Validators](#custom-validators)
9. [SDK Integration](#sdk-integration)
10. [Streaming Events](#streaming-events)
11. [Error Handling](#error-handling)
12. [Cost Estimation](#cost-estimation)
13. [Testing Architecture](#testing-architecture)
14. [Usage Examples](#usage-examples)

---

## Overview

The Images API provides image generation, editing, and variation capabilities using OpenAI's DALL-E models. This project supports both the **standalone Images API** (DALL-E 2/3) and the **Responses API** with gpt-image-1.

### API Variants

| API | Models | Operations | Response Format | Streaming |
|-----|--------|------------|-----------------|-----------|
| **Images API** (Phase 5) | DALL-E 2, DALL-E 3 | Generate, Edit, Variations | url, b64_json | No |
| **Responses API** (Phase 2) | gpt-image-1, gpt-image-1-mini | Generate (conversational) | b64_json only | Yes |

### Key Features

- **Three Operations**: Generate from text, edit with masks, create variations
- **Multiple Models**: DALL-E 2 (budget), DALL-E 3 (premium), gpt-image-1 (multimodal)
- **File Upload**: Multipart form-data support for edit/variation operations
- **Progressive Rendering**: Streaming partial images with gpt-image-1
- **Cross-Field Validation**: Model-specific size and parameter constraints

---

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Images API Architecture                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐     ┌───────────────────────────────────────┐ │
│  │  HTTP Request    │     │           ImagesController            │ │
│  │  POST /generate  │────▶│  - generateImages()                   │ │
│  │  POST /edit      │     │  - editImage()                        │ │
│  │  POST /variations│     │  - createImageVariation()             │ │
│  └──────────────────┘     └───────────────┬───────────────────────┘ │
│                                           │                          │
│        ┌──────────────────────────────────┼──────────────────────┐  │
│        │                                  │                      │  │
│        ▼                                  ▼                      ▼  │
│  ┌─────────────┐              ┌─────────────────────┐   ┌────────────┐
│  │ Validators  │              │ OpenAIImagesService │   │   DTOs     │
│  │ - ModelSize │              │ - generateImages()  │   │ - Create   │
│  │ - ImageFile │              │ - editImage()       │   │ - Edit     │
│  └─────────────┘              │ - createVariation() │   │ - Variation│
│                               │ - extractUrls()     │   └────────────┘
│                               │ - extractBase64()   │                │
│                               └─────────┬───────────┘                │
│                                         │                            │
│                    ┌────────────────────┼────────────────────┐       │
│                    │                    │                    │       │
│                    ▼                    ▼                    ▼       │
│  ┌─────────────────────┐ ┌─────────────────────┐ ┌──────────────────┐
│  │    OpenAI SDK       │ │   LoggerService     │ │ Cost Estimation  │
│  │  client.images.*    │ │ logOpenAIInteraction│ │ calculateImageCost│
│  └─────────────────────┘ └─────────────────────┘ └──────────────────┘
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### File Structure

```
src/openai/
├── controllers/
│   ├── images.controller.ts              # 3 REST endpoints
│   └── images.controller.spec.ts         # Controller tests (22 tests)
├── services/
│   ├── openai-images.service.ts          # 5 public methods
│   ├── openai-images.service.spec.ts     # Service tests (32 tests)
│   └── handlers/
│       ├── image-events.handler.ts       # Streaming event handling
│       └── image-events.handler.spec.ts  # Event handler tests (24 tests)
├── dto/
│   └── images/
│       ├── create-images.dto.ts          # Generation parameters
│       ├── edit-image.dto.ts             # Edit parameters
│       ├── image-variation.dto.ts        # Variation parameters
│       └── *.spec.ts                     # DTO tests (64 tests)
├── interfaces/
│   └── images/
│       ├── image.interface.ts            # Core types
│       ├── image-generation.interface.ts # Generation types
│       ├── image-edit.interface.ts       # Edit types
│       └── image-variation.interface.ts  # Variation types
└── validators/
    ├── image-model-size.validator.ts     # Cross-field validation
    ├── image-file.validator.ts           # File upload validation
    └── *.spec.ts                         # Validator tests (63 tests)

test/
├── images.e2e-spec.ts                    # E2E tests (22 tests)
└── openai-images.e2e-spec.ts             # Responses API E2E (18 tests)
```

---

## Supported Models

### Model Comparison

| Feature | DALL-E 2 | DALL-E 3 | gpt-image-1 |
|---------|----------|----------|-------------|
| **Quality** | Standard only | Standard, HD | Low, Medium, High, Auto |
| **Style** | N/A | Vivid, Natural | N/A |
| **Max Images (n)** | 1-10 | 1 only | 1 only |
| **Sizes** | 256², 512², 1024² | 1024², 1792×1024, 1024×1792 | 1024², 1024×1536, 1536×1024, auto |
| **Response Format** | url, b64_json | url, b64_json | b64_json only |
| **Edit Support** | Yes | No | No |
| **Variations** | Yes | No | No |
| **Revised Prompt** | No | Yes | No |
| **Cost/Image** | $0.016-$0.02 | $0.04-$0.12 | ~$0.02 |
| **Best For** | Budget, multiple images | Premium quality | Multimodal, streaming |

### Size Constraints by Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    Model-Size Compatibility                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  gpt-image-1:                                                    │
│    ✓ 1024x1024 (square)                                         │
│    ✓ 1024x1536 (portrait)                                       │
│    ✓ 1536x1024 (landscape)                                      │
│    ✓ auto (automatic)                                           │
│    ✗ 256x256, 512x512, 1792x1024, 1024x1792                    │
│                                                                  │
│  DALL-E 3:                                                       │
│    ✓ 1024x1024 (square)                                         │
│    ✓ 1792x1024 (wide landscape)                                 │
│    ✓ 1024x1792 (tall portrait)                                  │
│    ✗ 256x256, 512x512, auto                                     │
│                                                                  │
│  DALL-E 2:                                                       │
│    ✓ 256x256 (small, cheapest)                                  │
│    ✓ 512x512 (medium)                                           │
│    ✓ 1024x1024 (large)                                          │
│    ✗ 1792x1024, 1024x1792, auto                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## REST Endpoints

### Endpoint Summary

| Method | Path | Content-Type | Purpose |
|--------|------|--------------|---------|
| `POST` | `/api/images/generate` | application/json | Generate images from text |
| `POST` | `/api/images/edit` | multipart/form-data | Edit images with mask |
| `POST` | `/api/images/variations` | multipart/form-data | Create image variations |

### 1. Generate Images

**Endpoint**: `POST /api/images/generate`

```http
POST /api/images/generate
Content-Type: application/json

{
  "model": "dall-e-3",
  "prompt": "A serene mountain landscape at sunset with birds flying over a lake",
  "size": "1792x1024",
  "quality": "hd",
  "style": "natural",
  "n": 1,
  "response_format": "url",
  "user": "user-12345"
}
```

**Response** (200 OK):
```json
{
  "created": 1701888237,
  "data": [
    {
      "url": "https://oaidalleapiprodscus.blob.core.windows.net/...",
      "revised_prompt": "A serene mountain landscape with a lake, snow-capped peaks..."
    }
  ]
}
```

### 2. Edit Image

**Endpoint**: `POST /api/images/edit`

```http
POST /api/images/edit
Content-Type: multipart/form-data

------boundary
Content-Disposition: form-data; name="image"; filename="original.png"
Content-Type: image/png
[PNG binary data]
------boundary
Content-Disposition: form-data; name="mask"; filename="mask.png"
Content-Type: image/png
[PNG binary data]
------boundary
Content-Disposition: form-data; name="prompt"
Add a red door to the house
------boundary
Content-Disposition: form-data; name="n"
2
------boundary
Content-Disposition: form-data; name="size"
1024x1024
------boundary--
```

**Requirements**:
- **Image**: PNG, JPEG, or WEBP (< 4MB, must be square)
- **Mask** (optional): PNG only (< 4MB, same dimensions as image)
- **Model**: DALL-E 2 only

### 3. Create Variations

**Endpoint**: `POST /api/images/variations`

```http
POST /api/images/variations
Content-Type: multipart/form-data

------boundary
Content-Disposition: form-data; name="image"; filename="source.png"
Content-Type: image/png
[PNG binary data]
------boundary
Content-Disposition: form-data; name="n"
3
------boundary
Content-Disposition: form-data; name="size"
1024x1024
------boundary--
```

**Requirements**:
- **Image**: PNG only (< 4MB, must be square)
- **Model**: DALL-E 2 only
- **No prompt required** (stylistic variations only)

---

## Request Parameters

### CreateImagesDto (Image Generation)

| Parameter | Type | Required | Default | Models | Description |
|-----------|------|----------|---------|--------|-------------|
| `prompt` | string | Yes | - | All | Text description (max 4000 chars) |
| `model` | enum | No | `dall-e-2` | - | `dall-e-2`, `dall-e-3`, `gpt-image-1` |
| `n` | number | No | 1 | All | Images to generate (1-10 for DALL-E 2, 1 only for others) |
| `size` | enum | No | `1024x1024` | All | Model-specific sizes |
| `quality` | enum | No | - | DALL-E 3 | `standard`, `hd` (4x more expensive) |
| `style` | enum | No | - | DALL-E 3 | `vivid` (hyper-real), `natural` (less dramatic) |
| `response_format` | enum | No | `url` | DALL-E 2/3 | `url` (expires 60min), `b64_json` |
| `user` | string | No | - | All | End-user identifier for abuse monitoring |

### EditImageDto (Image Editing)

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | string | Yes | - | Edit description (max 1000 chars) |
| `model` | enum | No | `dall-e-2` | Only `dall-e-2` supported |
| `n` | number | No | 1 | Edited images (1-10) |
| `size` | enum | No | `1024x1024` | `256x256`, `512x512`, `1024x1024` |
| `response_format` | enum | No | `url` | `url`, `b64_json` |
| `user` | string | No | - | End-user identifier |

### ImageVariationDto (Image Variations)

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `model` | enum | No | `dall-e-2` | Only `dall-e-2` supported |
| `n` | number | No | 1 | Variations to generate (1-10) |
| `size` | enum | No | `1024x1024` | `256x256`, `512x512`, `1024x1024` |
| `response_format` | enum | No | `url` | `url`, `b64_json` |
| `user` | string | No | - | End-user identifier |

### CreateImageResponseDto (Responses API with gpt-image-1)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `input` | string | - | Prompt describing image (required) |
| `image_model` | enum | `gpt-image-1` | `gpt-image-1`, `gpt-image-1-mini` |
| `image_quality` | enum | `auto` | `low`, `medium`, `high`, `auto` |
| `image_format` | enum | `png` | `png`, `webp`, `jpeg` |
| `image_size` | enum | `auto` | `1024x1024`, `1024x1536`, `1536x1024`, `auto` |
| `image_moderation` | enum | `auto` | `auto`, `low` |
| `image_background` | enum | `auto` | `transparent`, `opaque`, `auto` |
| `input_fidelity` | enum | null | `high`, `low` (prompt adherence) |
| `output_compression` | number | 100 | 0-100 (quality vs size) |
| `partial_images` | number | 0 | 0-3 (progressive rendering count) |

---

## Response Structure

### ImagesResponse

```typescript
interface ImagesResponse {
  created: number;              // Unix timestamp (seconds)
  data: Image[];                // Array of generated images
  background?: string;          // Background type used
  output_format?: string;       // Output format used
  quality?: string;             // Quality level used
  size?: string;                // Dimensions used
  usage?: {                     // Token usage (gpt-image-1)
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

interface Image {
  url?: string;                 // Direct URL (expires in 60 minutes)
  b64_json?: string;            // Base64-encoded image data
  revised_prompt?: string;      // DALL-E 3 only: safety-moderated prompt
}
```

### Response Format Behavior

| Model | `url` Format | `b64_json` Format |
|-------|--------------|-------------------|
| DALL-E 2 | ✓ Supported | ✓ Supported |
| DALL-E 3 | ✓ Supported | ✓ Supported |
| gpt-image-1 | ✗ Not supported | ✓ Required |

**URL Expiration**: Direct URLs expire in **60 minutes**. Use `b64_json` for permanent storage.

---

## File Upload Handling

### Controller Interceptors

**Single File (Variations)**:
```typescript
@Post('variations')
@UseInterceptors(FileInterceptor('image'))
async createImageVariation(
  @UploadedFile() image: Express.Multer.File,
  @Body() dto: ImageVariationDto,
): Promise<ImagesResponse>
```

**Multiple Files (Edit)**:
```typescript
@Post('edit')
@UseInterceptors(FileFieldsInterceptor([
  { name: 'image', maxCount: 1 },
  { name: 'mask', maxCount: 1 },
]))
async editImage(
  @UploadedFiles() files: {
    image?: Express.Multer.File[];
    mask?: Express.Multer.File[];
  },
  @Body() dto: EditImageDto,
): Promise<ImagesResponse>
```

### File Conversion for SDK

The service uses OpenAI's `toFile()` helper to convert Multer files:

```typescript
import { toFile } from 'openai';

const imageFile = await toFile(
  image.buffer,          // Buffer data
  image.originalname,    // Filename
  { type: image.mimetype }  // MIME type
);

const response = await this.client.images.edit({
  image: imageFile,
  mask: maskFile,
  prompt: dto.prompt,
});
```

### File Requirements

| Aspect | Image File | Mask File |
|--------|-----------|-----------|
| **Formats** | PNG, JPEG, WEBP | PNG only |
| **Max Size** | 4 MB | 4 MB |
| **Dimensions** | Must be square | Must match image |
| **Required** | Yes (edit/variation) | No (edit only) |
| **Transparency** | Preserved | Alpha=0 indicates edit regions |

---

## Custom Validators

### @IsImageModelSizeValid()

Cross-field validation ensuring size is compatible with selected model.

**Location**: `src/openai/validators/image-model-size.validator.ts`

```typescript
@ValidatorConstraint({ async: false })
export class IsImageModelSizeValidConstraint {
  validate(size: unknown, args: ValidationArguments): boolean {
    const model = args.object.model || 'dall-e-2';

    if (model === 'gpt-image-1') {
      return ['1024x1024', '1024x1536', '1536x1024', 'auto'].includes(size);
    }
    if (model === 'dall-e-3') {
      return ['1024x1024', '1792x1024', '1024x1792'].includes(size);
    }
    if (model === 'dall-e-2') {
      return ['256x256', '512x512', '1024x1024'].includes(size);
    }
    return false;
  }

  defaultMessage(args: ValidationArguments): string {
    const model = args.object.model || 'dall-e-2';
    return getImageModelSizeErrorMessage(model, args.value);
  }
}
```

**Error Messages**:
- gpt-image-1 with 512x512: `"Size '512x512' is not supported for gpt-image-1. Valid sizes: 1024x1024, 1024x1536, 1536x1024, auto"`
- DALL-E 3 with 256x256: `"Size '256x256' is not supported for DALL-E 3. Valid sizes: 1024x1024, 1792x1024, 1024x1792"`
- DALL-E 2 with 1792x1024: `"Size '1792x1024' is not supported for DALL-E 2. Valid sizes: 256x256, 512x512, 1024x1024"`

**Helper Functions**:
```typescript
// Standalone validation
function validateImageModelSize(model: string, size: unknown): boolean;

// Error message generation
function getImageModelSizeErrorMessage(model: string, size: unknown): string;
```

### @IsImageFileValid()

Validates uploaded image files for format and size.

**Location**: `src/openai/validators/image-file.validator.ts`

```typescript
@ValidatorConstraint({ async: false })
export class IsImageFileValidConstraint {
  private readonly MAX_FILE_SIZE = 4 * 1024 * 1024;  // 4MB
  private readonly VALID_MIME_TYPES = [
    'image/png',
    'image/jpeg',
    'image/webp'
  ];

  validate(file: unknown): boolean {
    if (file === undefined || file === null) return true;  // Optional mask

    if (!isValidFileObject(file)) return false;

    const { mimetype, size } = file as { mimetype: string; size: number };

    return (
      this.VALID_MIME_TYPES.includes(mimetype) &&
      size > 0 &&
      size <= this.MAX_FILE_SIZE
    );
  }
}
```

**Type Guard**:
```typescript
function isMulterFile(file: unknown): file is Express.Multer.File {
  return (
    typeof file === 'object' &&
    file !== null &&
    'mimetype' in file &&
    'size' in file &&
    'buffer' in file &&
    'originalname' in file
  );
}
```

---

## SDK Integration

### Service Methods

```typescript
@Injectable()
export class OpenAIImagesService {
  constructor(
    @Inject(OPENAI_CLIENT) private readonly client: OpenAI,
    private readonly loggerService: LoggerService,
  ) {}

  async generateImages(dto: CreateImagesDto): Promise<ImagesResponse> {
    const params: Images.ImageGenerateParamsNonStreaming = {
      prompt: dto.prompt,
      ...(dto.model && { model: dto.model }),
      ...(dto.n && { n: dto.n }),
      ...(dto.size && { size: dto.size }),
      ...(dto.quality && { quality: dto.quality }),
      ...(dto.style && { style: dto.style }),
      // gpt-image-1 doesn't accept response_format
      ...(dto.response_format && dto.model !== 'gpt-image-1' && {
        response_format: dto.response_format,
      }),
      ...(dto.user && { user: dto.user }),
    };

    const response = await this.client.images.generate(params);

    // Log with cost estimate
    const costEstimate = calculateImageCost(
      dto.model || 'dall-e-2',
      dto.size || '1024x1024',
      dto.quality || 'standard',
      dto.n || 1,
    );

    this.loggerService.logOpenAIInteraction({
      api: 'images',
      endpoint: '/v1/images/generations',
      request: params,
      response,
      metadata: {
        latency_ms: Date.now() - startTime,
        model: dto.model,
        images_generated: response.data.length,
        cost_estimate: costEstimate,
        has_revised_prompt: !!response.data[0]?.revised_prompt,
      },
    });

    return response;
  }

  async editImage(
    image: Express.Multer.File,
    mask: Express.Multer.File | undefined,
    dto: EditImageDto,
  ): Promise<ImagesResponse> {
    // Convert Multer files to SDK File objects
    const imageFile = await toFile(image.buffer, image.originalname, {
      type: image.mimetype,
    });
    const maskFile = mask
      ? await toFile(mask.buffer, mask.originalname, { type: mask.mimetype })
      : undefined;

    const params: Images.ImageEditParamsNonStreaming = {
      image: imageFile,
      prompt: dto.prompt,
      ...(maskFile && { mask: maskFile }),
      ...(dto.model && { model: dto.model }),
      ...(dto.n && { n: dto.n }),
      ...(dto.size && { size: dto.size }),
      // NOTE: response_format removed - API rejects it
      ...(dto.user && { user: dto.user }),
    };

    return await this.client.images.edit(params);
  }

  async createImageVariation(
    image: Express.Multer.File,
    dto: ImageVariationDto,
  ): Promise<ImagesResponse> {
    const imageFile = await toFile(image.buffer, image.originalname, {
      type: image.mimetype,
    });

    const params: Images.ImageCreateVariationParams = {
      image: imageFile,
      ...(dto.model && { model: dto.model }),
      ...(dto.n && { n: dto.n }),
      ...(dto.size && { size: dto.size }),
      // NOTE: response_format removed - API rejects it
      ...(dto.user && { user: dto.user }),
    };

    return await this.client.images.createVariation(params);
  }

  // Helper methods
  extractImageUrls(response: ImagesResponse): string[] {
    return response.data
      .filter((img) => img.url !== undefined)
      .map((img) => img.url!);
  }

  extractBase64Images(response: ImagesResponse): string[] {
    return response.data
      .filter((img) => img.b64_json !== undefined)
      .map((img) => img.b64_json!);
  }
}
```

### Type Imports

```typescript
import type { Images } from 'openai/resources/images';

export type ImagesResponse = Images.ImagesResponse;
export type Image = Images.Image;
export type ImageGenerateParams = Images.ImageGenerateParamsNonStreaming;
export type ImageEditParams = Images.ImageEditParamsNonStreaming;
export type ImageCreateVariationParams = Images.ImageCreateVariationParams;
```

---

## Streaming Events

### gpt-image-1 via Responses API

When using gpt-image-1 through the Responses API with streaming enabled, image generation emits these events:

```typescript
@Injectable()
export class ImageEventsHandler {
  // Event: response.image_generation_call.in_progress
  // Event: response.image_generation_call.generating
  *handleImageGenProgress(event, state, sequence): Iterable<SSEEvent> {
    yield {
      event: 'image_generation_call.in_progress',
      data: JSON.stringify({ call_id, sequence }),
      sequence,
    };
  }

  // Event: response.image_generation_call.partial_image
  // Enabled when partial_images: 1-3
  *handleImageGenPartial(event, state, sequence): Iterable<SSEEvent> {
    yield {
      event: 'image_gen_partial',
      data: JSON.stringify({
        call_id,
        image_data,  // base64: data:image/png;base64,...
        sequence,
      }),
      sequence,
    };
  }

  // Event: response.image_generation_call.completed
  *handleImageGenCompleted(event, state, sequence): Iterable<SSEEvent> {
    yield {
      event: 'image_gen_completed',
      data: JSON.stringify({
        call_id,
        image_data,  // Final base64 image
        sequence,
      }),
      sequence,
    };
  }
}
```

### Streaming Event Flow

```
┌─────────────────┐
│   in_progress   │  Image generation started
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   generating    │  Actively generating
└────────┬────────┘
         │
         ├──────────────────────────────┐
         │  (if partial_images > 0)     │
         ▼                              │
┌─────────────────┐                     │
│ partial_image 1 │  First preview      │
└────────┬────────┘                     │
         │                              │
         ▼                              │
┌─────────────────┐                     │
│ partial_image 2 │  Better preview     │
└────────┬────────┘                     │
         │                              │
         ▼                              │
┌─────────────────┐                     │
│ partial_image 3 │  Near-final        │
└────────┬────────┘                     │
         │◄─────────────────────────────┘
         ▼
┌─────────────────┐
│   completed     │  Final high-quality image
└─────────────────┘
```

---

## Error Handling

### Image-Specific Error Codes

| Error Code | HTTP | Description | Hint |
|------------|------|-------------|------|
| `invalid_image_prompt` | 400 | Content policy violation | Modify prompt |
| `image_generation_failed` | 500 | Internal generation error | Retry request |
| `model_not_available` | 404 | Model unavailable | Use supported model |
| `quota_exceeded` | 429 | Rate limit reached | Wait for reset |
| `invalid_image_dimensions` | 400 | Non-square image | Resize to square |
| `mask_dimensions_mismatch` | 400 | Mask size doesn't match | Resize mask |
| `operation_not_supported` | 400 | Model doesn't support operation | DALL-E 3 doesn't support edits |
| `invalid_image_file` | 400 | Corrupted or wrong format | Use PNG/JPEG/WEBP < 4MB |
| `invalid_image_size` | 400 | Invalid size for model | Check model constraints |
| `invalid_quality_setting` | 400 | Invalid quality | DALL-E 3: standard/hd |
| `image_too_large` | 400 | Exceeds max size | Compress or resize |
| `image_content_policy_violation` | 400 | Image violates policy | Review content |

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
  openai_error?: {
    type: string;
    code?: string;
    message: string;
  };
}
```

---

## Cost Estimation

### Pricing Model

```typescript
function calculateImageCost(
  model: string,
  size: string,
  quality: string,
  n: number,
): number {
  let costPerImage: number;

  if (model === 'dall-e-3') {
    if (quality === 'hd') {
      costPerImage = size === '1024x1024' ? 0.08 : 0.12;
    } else {
      costPerImage = 0.04;
    }
  } else if (model === 'dall-e-2') {
    switch (size) {
      case '1024x1024': costPerImage = 0.02; break;
      case '512x512': costPerImage = 0.018; break;
      case '256x256': costPerImage = 0.016; break;
      default: costPerImage = 0.02;
    }
  } else {  // gpt-image-1
    costPerImage = 0.02;
  }

  return costPerImage * n;
}
```

### Cost Matrix

| Model | Size | Quality | Price/Image |
|-------|------|---------|-------------|
| **DALL-E 3** | 1024x1024 | HD | $0.08 |
| **DALL-E 3** | 1792x1024 / 1024x1792 | HD | $0.12 |
| **DALL-E 3** | Any | Standard | $0.04 |
| **DALL-E 2** | 1024x1024 | - | $0.02 |
| **DALL-E 2** | 512x512 | - | $0.018 |
| **DALL-E 2** | 256x256 | - | $0.016 |
| **gpt-image-1** | Any | - | ~$0.02 |

---

## Testing Architecture

### Test Coverage Summary

| Component | File | Tests | Key Areas |
|-----------|------|-------|-----------|
| Service | `openai-images.service.spec.ts` | 32 | 3 operations, all models |
| Controller | `images.controller.spec.ts` | 22 | Endpoints, file handling |
| CreateImagesDto | `create-images.dto.spec.ts` | 29 | All parameters |
| EditImageDto | `edit-image.dto.spec.ts` | 16 | Edit constraints |
| ImageVariationDto | `image-variation.dto.spec.ts` | 19 | Variation constraints |
| ModelSizeValidator | `image-model-size.validator.spec.ts` | 35 | Cross-field validation |
| ImageFileValidator | `image-file.validator.spec.ts` | 28 | File validation |
| ImageEventsHandler | `image-events.handler.spec.ts` | 24 | Streaming events |
| E2E (Images API) | `images.e2e-spec.ts` | 22 | Full integration |
| E2E (Responses API) | `openai-images.e2e-spec.ts` | 18 | gpt-image-1 |
| **Total** | | **332** | |

### Mock Patterns

**OpenAI Client Mock**:
```typescript
const mockOpenAIClient = {
  images: {
    generate: jest.fn(),
    edit: jest.fn(),
    createVariation: jest.fn(),
  },
};
```

**toFile Mock**:
```typescript
jest.mock('openai', () => ({
  toFile: jest.fn((buffer, filename, options) =>
    Promise.resolve({
      name: filename,
      type: options?.type || 'application/octet-stream',
      size: buffer.length,
    }),
  ),
}));
```

### E2E Auto-Skip Pattern

```typescript
const hasApiKey = !!process.env.OPENAI_API_KEY;
const testIf = (condition: boolean) => (condition ? it : it.skip);

testIf(hasApiKey)('should generate DALL-E 3 image', async () => {
  // Test runs only if API key available
}, 60000);
```

---

## Usage Examples

### Generate Images (cURL)

**DALL-E 3 with HD Quality**:
```bash
curl -X POST http://localhost:3000/api/images/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "dall-e-3",
    "prompt": "A serene mountain landscape at sunset",
    "size": "1792x1024",
    "quality": "hd",
    "style": "natural"
  }'
```

**DALL-E 2 Multiple Images**:
```bash
curl -X POST http://localhost:3000/api/images/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "dall-e-2",
    "prompt": "A cute baby sea otter",
    "size": "512x512",
    "n": 5,
    "response_format": "b64_json"
  }'
```

### Edit Image (cURL)

```bash
curl -X POST http://localhost:3000/api/images/edit \
  -F "image=@original.png" \
  -F "mask=@mask.png" \
  -F "prompt=Add a red door to the house" \
  -F "n=2" \
  -F "size=1024x1024"
```

### Create Variations (cURL)

```bash
curl -X POST http://localhost:3000/api/images/variations \
  -F "image=@source.png" \
  -F "n=3" \
  -F "size=1024x1024"
```

### TypeScript Client Example

```typescript
import axios from 'axios';
import * as fs from 'fs';
import FormData from 'form-data';

const API_BASE = 'http://localhost:3000/api';

// Generate image
async function generateImage(prompt: string): Promise<string> {
  const response = await axios.post(`${API_BASE}/images/generate`, {
    model: 'dall-e-3',
    prompt,
    size: '1024x1024',
    quality: 'hd',
    response_format: 'b64_json',
  });

  const base64 = response.data.data[0].b64_json;
  const buffer = Buffer.from(base64, 'base64');
  fs.writeFileSync('output.png', buffer);

  console.log('Revised prompt:', response.data.data[0].revised_prompt);
  return 'output.png';
}

// Edit image with mask
async function editImage(
  imagePath: string,
  maskPath: string,
  prompt: string,
): Promise<string[]> {
  const form = new FormData();
  form.append('image', fs.createReadStream(imagePath));
  form.append('mask', fs.createReadStream(maskPath));
  form.append('prompt', prompt);
  form.append('n', '2');
  form.append('size', '1024x1024');

  const response = await axios.post(`${API_BASE}/images/edit`, form, {
    headers: form.getHeaders(),
  });

  return response.data.data.map((img: any) => img.url);
}

// Create variations
async function createVariations(imagePath: string): Promise<string[]> {
  const form = new FormData();
  form.append('image', fs.createReadStream(imagePath));
  form.append('n', '3');
  form.append('size', '512x512');

  const response = await axios.post(`${API_BASE}/images/variations`, form, {
    headers: form.getHeaders(),
  });

  return response.data.data.map((img: any) => img.url);
}

// Usage
generateImage('A futuristic city at night')
  .then((path) => console.log('Image saved to:', path))
  .catch(console.error);
```

### Progressive Rendering (Responses API)

```typescript
async function generateWithProgress(prompt: string): Promise<void> {
  const response = await fetch('http://localhost:3000/api/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-5',
      input: prompt,
      stream: true,
      image_model: 'gpt-image-1',
      image_quality: 'high',
      image_size: 'auto',
      partial_images: 3,  // Enable progressive rendering
    }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));

        if (data.event === 'image_gen_partial') {
          console.log('Partial image received:', data.sequence);
          // Display preview: data.image_data (base64)
        } else if (data.event === 'image_gen_completed') {
          console.log('Final image received');
          // Display final: data.image_data (base64)
        }
      }
    }
  }
}
```

---

## Key Implementation Details

### Important Limitations

1. **gpt-image-1**: Only supports `b64_json` response format (no URL)
2. **DALL-E 3**: Only generates 1 image at a time (`n` must be 1)
3. **Edit/Variations**: Only supported by DALL-E 2
4. **response_format**: Removed from edit/variation operations (API rejects it)
5. **URL Expiration**: Direct URLs expire in 60 minutes

### Module Registration

```typescript
// openai.module.ts
@Module({
  controllers: [ImagesController],
  providers: [OpenAIImagesService, ImageEventsHandler],
  exports: [OpenAIImagesService],
})
export class OpenAIModule {}
```

### Design Patterns

1. **Conditional Parameters**: Uses spread operator with model-specific checks
2. **File Conversion**: Uses OpenAI SDK's `toFile()` helper
3. **Cross-Field Validation**: Custom decorator for model-size compatibility
4. **Type Safety**: Full TypeScript with OpenAI SDK types (no `any`)
5. **Comprehensive Logging**: All operations logged with cost estimates

---

## References

- [OpenAI Images API Documentation](https://platform.openai.com/docs/api-reference/images)
- [DALL-E Documentation](https://platform.openai.com/docs/guides/images)
- [NestJS File Upload Documentation](https://docs.nestjs.com/techniques/file-upload)
- [Project README](../README.md)
- [Streaming Documentation](./STREAMING.md)
- [Responses API Documentation](./RESPONSES_API.md)
