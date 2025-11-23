import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { Files } from 'openai/resources/files';

/**
 * Data Transfer Object for listing files via OpenAI Files API
 *
 * This DTO encapsulates query parameters for file listing requests using the
 * Files API (`client.files.list()`).
 *
 * **Query Parameters:**
 * - `purpose` - Filter files by intended use case (optional)
 * - `order` - Sort order by created_at timestamp (optional)
 * - `limit` - Number of files to return (optional, for pagination)
 *
 * **Filtering by Purpose:**
 * Filter files to only those with a specific purpose:
 * - 'assistants' - Documents for Assistants API
 * - 'vision' - Images for vision models
 * - 'batch' - Batch API input files
 * - 'fine-tune' - Fine-tuning training data
 * - 'user_data' - General purpose files
 * - 'evals' - Evaluation datasets
 *
 * **Sorting:**
 * Files are sorted by `created_at` timestamp:
 * - 'desc' (default): Newest files first
 * - 'asc': Oldest files first
 *
 * **Pagination:**
 * The `limit` parameter controls how many files are returned:
 * - Default: 20 files per page (OpenAI default)
 * - Minimum: 1 file
 * - Maximum: 10,000 files
 * - Use pagination for large file collections
 *
 * **Usage Examples:**
 *
 * **List all files (default):**
 * ```typescript
 * GET /api/files
 * // Returns up to 20 files, newest first
 * ```
 *
 * **Filter by purpose:**
 * ```typescript
 * GET /api/files?purpose=assistants
 * // Returns only assistant files
 * ```
 *
 * **Change sort order:**
 * ```typescript
 * GET /api/files?order=asc
 * // Returns oldest files first
 * ```
 *
 * **Paginate results:**
 * ```typescript
 * GET /api/files?limit=50
 * // Returns up to 50 files
 * ```
 *
 * **Combined filters:**
 * ```typescript
 * GET /api/files?purpose=vision&order=desc&limit=10
 * // Returns 10 newest vision files
 * ```
 *
 * **Performance Notes:**
 * - Large limits may slow response time
 * - Use purpose filter to reduce result set
 * - Consider pagination for large collections
 * - OpenAI API supports cursor-based pagination (implement if needed)
 *
 * @see {@link https://platform.openai.com/docs/api-reference/files/list}
 */
export class ListFilesDto {
  /**
   * Filter files by purpose
   *
   * Return only files with the specified purpose. If omitted, all files
   * are returned regardless of purpose.
   *
   * **Purpose Values:**
   * - **'assistants'**: Documents for Assistants API (file_search)
   * - **'vision'**: Images for vision models
   * - **'batch'**: Batch API input files
   * - **'fine-tune'**: Fine-tuning training data
   * - **'user_data'**: General purpose files
   * - **'evals'**: Evaluation datasets
   *
   * **Use Cases:**
   * - List all assistant documents: `purpose=assistants`
   * - List training datasets: `purpose=fine-tune`
   * - List vision images: `purpose=vision`
   * - List all files: omit parameter
   *
   * **Example:**
   * ```typescript
   * GET /api/files?purpose=assistants
   * // Returns only files with purpose='assistants'
   * ```
   *
   * @default undefined (all purposes)
   * @example 'assistants'
   */
  @ApiPropertyOptional({
    description:
      'Filter files by purpose:\n' +
      '  - "assistants": Documents for Assistants API\n' +
      '  - "vision": Images for vision models\n' +
      '  - "batch": Batch API input files\n' +
      '  - "fine-tune": Fine-tuning training data\n' +
      '  - "user_data": General purpose files\n' +
      '  - "evals": Evaluation datasets\n' +
      '\n' +
      'Omit to list all files regardless of purpose.',
    enum: ['assistants', 'vision', 'batch', 'fine-tune', 'user_data', 'evals'],
    example: 'assistants',
  })
  @IsOptional()
  @IsEnum(
    ['assistants', 'vision', 'batch', 'fine-tune', 'user_data', 'evals'],
    {
      message:
        'purpose must be one of: "assistants", "vision", "batch", "fine-tune", "user_data", "evals"',
    },
  )
  purpose?: Files.FilePurpose;

  /**
   * Sort order by created_at timestamp
   *
   * Determine the order in which files are returned:
   * - **'desc'** (default): Newest files first (descending by created_at)
   * - **'asc'**: Oldest files first (ascending by created_at)
   *
   * **When to use 'desc' (default):**
   * - Most recent uploads first
   * - Latest files most relevant
   * - Typical use case (show recent work)
   *
   * **When to use 'asc':**
   * - Chronological history needed
   * - Process files in upload order
   * - Find oldest files for cleanup
   *
   * **Example:**
   * ```typescript
   * GET /api/files?order=asc
   * // Returns files oldest to newest
   *
   * GET /api/files?order=desc
   * // Returns files newest to oldest (default)
   * ```
   *
   * @default 'desc'
   * @example 'desc'
   */
  @ApiPropertyOptional({
    description:
      'Sort order by created_at timestamp:\n' +
      '  - "desc": Newest files first (default)\n' +
      '  - "asc": Oldest files first\n' +
      '\n' +
      'Use "desc" to see recent uploads. Use "asc" for chronological history.',
    enum: ['asc', 'desc'],
    default: 'desc',
    example: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'], {
    message: 'order must be either "asc" or "desc"',
  })
  order?: 'asc' | 'desc';

  /**
   * Number of files to return (pagination)
   *
   * Controls the maximum number of files returned in a single response.
   * Use for pagination when dealing with large file collections.
   *
   * **Range:**
   * - Minimum: 1 file
   * - Maximum: 10,000 files
   * - Default: 20 files (OpenAI default)
   *
   * **Guidelines:**
   * - **Small list (1-20)**: Fast response, good for UI display
   * - **Medium list (20-100)**: Balance between performance and completeness
   * - **Large list (100-1000)**: Slower response, use only when needed
   * - **Very large (1000+)**: May impact performance, consider pagination
   *
   * **Pagination Strategy:**
   * For large file collections, use cursor-based pagination:
   * 1. Request first page: `limit=100`
   * 2. Check response for `has_more` flag
   * 3. Use `after` parameter to get next page
   *
   * **Performance:**
   * - Larger limits increase API response time
   * - Combine with `purpose` filter to reduce result set
   * - Use appropriate limit for your use case
   *
   * **Example:**
   * ```typescript
   * GET /api/files?limit=50
   * // Returns up to 50 files
   *
   * GET /api/files?limit=10&purpose=vision
   * // Returns up to 10 vision files
   * ```
   *
   * @default 20 (OpenAI default)
   * @example 20
   */
  @ApiPropertyOptional({
    description:
      'Maximum number of files to return (pagination).\n' +
      'Range: 1 to 10,000\n' +
      'Default: 20 (OpenAI default)\n' +
      '\n' +
      'Use smaller limits for faster responses. Larger limits may impact performance.\n' +
      'Combine with purpose filter to reduce result set.',
    minimum: 1,
    maximum: 10000,
    default: 20,
    example: 20,
    type: Number,
  })
  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'limit must be at least 1' })
  @Type(() => Number)
  limit?: number;
}
