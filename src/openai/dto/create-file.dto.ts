import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { Files } from 'openai/resources/files';

/**
 * Expiration policy for uploaded files
 * Files will be automatically deleted after the specified duration
 */
export class ExpiresAfterDto {
  /**
   * Timestamp anchor for expiration calculation
   * Currently only 'created_at' is supported by OpenAI
   */
  @ApiProperty({
    description:
      'Timestamp anchor for expiration calculation. Only "created_at" is supported.',
    enum: ['created_at'],
    example: 'created_at',
  })
  @IsEnum(['created_at'], {
    message: 'anchor must be "created_at"',
  })
  anchor!: 'created_at';

  /**
   * Duration in seconds after anchor before file expires
   * Minimum: 3600 (1 hour)
   * Maximum: 2592000 (30 days)
   */
  @ApiProperty({
    description:
      'Duration in seconds after anchor before file expires.\n' +
      'Range: 3600 (1 hour) to 2592000 (30 days)',
    minimum: 3600,
    maximum: 2592000,
    example: 86400, // 24 hours
  })
  @IsNumber()
  @Min(3600, { message: 'seconds must be at least 3600 (1 hour)' })
  @Max(2592000, { message: 'seconds must be at most 2592000 (30 days)' })
  seconds!: number;
}

/**
 * Data Transfer Object for uploading files via OpenAI Files API
 *
 * This DTO encapsulates all parameters for file upload requests using the
 * Files API (`client.files.create()`).
 *
 * **Core Parameters:**
 * - `purpose` - Intended use case for the file (required)
 * - `expires_after` - Optional expiration policy for automatic deletion
 *
 * **File Purposes:**
 * - **'assistants'**: Documents for Assistants API (file_search tool)
 *   - Supported: PDF, TXT, DOCX, MD, HTML, JS, PY, JSON, CSV, XML, etc.
 *   - Max size: 512 MB per file
 *   - Cannot be downloaded via API
 *   - Used with vector stores for semantic search
 *
 * - **'vision'**: Images for vision models
 *   - Supported: PNG, JPEG, JPG, GIF, WEBP
 *   - Max size: 20 MB per file
 *   - Used for image understanding and analysis
 *
 * - **'batch'**: Input files for Batch API
 *   - Format: JSONL only
 *   - Max size: 200 MB per file
 *   - Each line is a separate API request
 *
 * - **'fine-tune'**: Training data for fine-tuning
 *   - Format: JSONL only (strict format required)
 *   - Max size: 512 MB per file
 *   - Used for model customization
 *
 * - **'user_data'**: General purpose files
 *   - Wide variety of formats supported
 *   - Max size: 512 MB per file
 *   - Can be used with code_interpreter tool
 *
 * - **'evals'**: Evaluation datasets
 *   - Format: JSONL
 *   - Max size: 512 MB per file
 *   - Used for model evaluation
 *
 * **Size Limits:**
 * - Standard API: Up to 512 MB per file
 * - Uploads API (for larger files): Up to 8 GB per file
 * - Organization total: 100 GB storage limit
 *
 * **File Processing:**
 * - Files may have status: 'uploaded', 'processed', or 'error'
 * - Some file types require processing before use (e.g., fine-tuning data)
 * - Use `waitForProcessing()` service method to poll until ready
 *
 * **Expiration Policy:**
 * - Optional automatic deletion after specified duration
 * - Useful for temporary files and cost optimization
 * - Range: 1 hour (3600s) to 30 days (2592000s)
 *
 * **Integration Points:**
 * - Phase 2.14: Files with purpose='assistants' → file_search tool
 * - Phase 2.16: Files with purpose='user_data' → code_interpreter tool
 * - Phase 8: Files attached to vector stores for semantic search
 *
 * **Validation:**
 * All fields are validated using class-validator decorators.
 *
 * @see {@link https://platform.openai.com/docs/api-reference/files/create}
 * @see {@link https://platform.openai.com/docs/guides/files}
 */
export class CreateFileDto {
  /**
   * Intended purpose of the uploaded file
   *
   * The purpose determines:
   * - File format requirements
   * - Size limits
   * - Whether file can be downloaded
   * - Which APIs can use the file
   *
   * **Purpose Options:**
   *
   * **'assistants'**:
   * - Use case: Assistants API, file_search tool
   * - Formats: Documents (PDF, TXT, DOCX, MD, HTML, JSON, CSV, etc.)
   * - Max size: 512 MB
   * - Download: ❌ Forbidden (API restriction)
   * - Processing: Required
   * - Integration: Vector stores (Phase 8)
   *
   * **'vision'**:
   * - Use case: Image understanding, vision models
   * - Formats: Images (PNG, JPEG, JPG, GIF, WEBP)
   * - Max size: 20 MB
   * - Download: ✅ Allowed
   * - Processing: Not required
   *
   * **'batch'**:
   * - Use case: Batch API input
   * - Formats: JSONL only
   * - Max size: 200 MB
   * - Download: ✅ Allowed
   * - Processing: Required
   * - Format: One API request per line
   *
   * **'fine-tune'**:
   * - Use case: Model fine-tuning training data
   * - Formats: JSONL only (strict format)
   * - Max size: 512 MB
   * - Download: ✅ Allowed
   * - Processing: Required (validation)
   * - Format: Training examples with prompts/completions
   *
   * **'user_data'**:
   * - Use case: General purpose, code_interpreter
   * - Formats: Wide variety (CSV, JSON, Excel, TXT, etc.)
   * - Max size: 512 MB
   * - Download: ✅ Allowed
   * - Processing: Not required
   * - Integration: Code interpreter tool (Phase 2.16)
   *
   * **'evals'**:
   * - Use case: Model evaluation datasets
   * - Formats: JSONL
   * - Max size: 512 MB
   * - Download: ✅ Allowed
   * - Processing: Required
   *
   * @example 'assistants'
   */
  @ApiProperty({
    description:
      'Intended purpose of the file:\n' +
      '  - "assistants": Documents for Assistants API (file_search)\n' +
      '  - "vision": Images for vision models\n' +
      '  - "batch": Input files for Batch API (JSONL)\n' +
      '  - "fine-tune": Training data for fine-tuning (JSONL)\n' +
      '  - "user_data": General purpose files\n' +
      '  - "evals": Evaluation datasets (JSONL)\n' +
      '\n' +
      'Purpose determines format requirements, size limits, and download permissions.',
    enum: ['assistants', 'vision', 'batch', 'fine-tune', 'user_data', 'evals'],
    example: 'assistants',
  })
  @IsEnum(
    ['assistants', 'vision', 'batch', 'fine-tune', 'user_data', 'evals'],
    {
      message:
        'purpose must be one of: "assistants", "vision", "batch", "fine-tune", "user_data", "evals"',
    },
  )
  purpose!: Files.FilePurpose;

  /**
   * Optional expiration policy for automatic file deletion
   *
   * Configure automatic deletion of files after a specified duration.
   * Useful for:
   * - Temporary files (preprocessing, analysis)
   * - Cost optimization (avoid storage quota limits)
   * - Compliance (data retention policies)
   *
   * **Expiration Configuration:**
   * - `anchor`: Timestamp to calculate from (only 'created_at' supported)
   * - `seconds`: Duration before expiration (3600-2592000)
   *
   * **Duration Guidelines:**
   * - Minimum: 3600 seconds (1 hour)
   * - Maximum: 2592000 seconds (30 days)
   * - Short-term temp files: 3600-86400 (1-24 hours)
   * - Medium-term: 86400-604800 (1-7 days)
   * - Long-term: 604800-2592000 (7-30 days)
   *
   * **Important Notes:**
   * - Expired files are permanently deleted (cannot be recovered)
   * - Expiration is approximate (may take a few minutes)
   * - Files can still be manually deleted before expiration
   * - Expiration does not prevent immediate use
   *
   * **Common Durations:**
   * - 3600 (1 hour): Very temporary processing files
   * - 86400 (24 hours): Daily temp files
   * - 604800 (7 days): Weekly cleanup
   * - 2592000 (30 days): Maximum retention
   *
   * **Example:**
   * ```typescript
   * {
   *   anchor: 'created_at',
   *   seconds: 86400  // Delete after 24 hours
   * }
   * ```
   *
   * @default undefined (no expiration)
   */
  @ApiPropertyOptional({
    description:
      'Optional expiration policy for automatic deletion.\n' +
      'Configure files to be deleted after a specified duration:\n' +
      '  - anchor: "created_at" (only supported value)\n' +
      '  - seconds: 3600 (1 hour) to 2592000 (30 days)\n' +
      '\n' +
      'Use for temporary files, cost optimization, or compliance.\n' +
      'Expired files are permanently deleted and cannot be recovered.',
    type: ExpiresAfterDto,
    example: {
      anchor: 'created_at',
      seconds: 86400, // 24 hours
    },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExpiresAfterDto)
  expires_after?: ExpiresAfterDto;
}
