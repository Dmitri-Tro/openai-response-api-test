import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsEnum, IsString } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Data Transfer Object for listing files in a vector store
 *
 * Retrieves files attached to a vector store with pagination and filtering.
 * Results are sorted by creation timestamp.
 *
 * **Pagination:**
 * - Default: 20 results per page
 * - Maximum: 100 results per page
 * - Cursor-based pagination (not offset-based)
 *
 * **Filtering by Status:**
 * - 'in_progress': Files currently being indexed
 * - 'completed': Files successfully indexed and searchable
 * - 'failed': Files that failed indexing
 * - 'cancelled': Files whose indexing was cancelled
 * - Omit filter to get all files
 *
 * **Cursor Navigation:**
 * - `after`: Get results after this cursor (next page)
 * - `before`: Get results before this cursor (previous page)
 * - Cursors are opaque strings from response metadata
 *
 * **Sorting:**
 * - `order: 'asc'` - Oldest first
 * - `order: 'desc'` - Newest first (default)
 * - Sorted by attachment timestamp (not file creation)
 *
 * **Response Format:**
 * ```typescript
 * {
 *   data: VectorStoreFile[],
 *   first_id: string,
 *   last_id: string,
 *   has_more: boolean
 * }
 * ```
 *
 * **File Status Details:**
 * ```typescript
 * {
 *   id: string,
 *   vector_store_id: string,
 *   status: 'in_progress' | 'completed' | 'failed' | 'cancelled',
 *   last_error?: { code: string, message: string },
 *   chunking_strategy?: {...},
 *   created_at: number
 * }
 * ```
 *
 * @see {@link https://platform.openai.com/docs/api-reference/vector-stores-files/list}
 */
export class ListVectorStoreFilesDto {
  /**
   * Number of files to return per page
   *
   * **Range:** 1-100
   * **Default:** 20
   *
   * **Guidelines:**
   * - Small limit (10-20): Faster response, more requests
   * - Large limit (50-100): Fewer requests, slower response
   * - Default (20): Balanced for most use cases
   *
   * @example 20
   */
  @ApiPropertyOptional({
    description: 'Number of results to return. Range: 1-100. Default: 20.',
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /**
   * Sort order by attachment timestamp
   *
   * - `'asc'`: Ascending (oldest first)
   * - `'desc'`: Descending (newest first) [default]
   *
   * **Use Cases:**
   * - 'desc': Find recently added files
   * - 'asc': Process in attachment order
   *
   * **Note:** Sorted by when file was attached to vector store,
   * not when file was uploaded to Files API.
   *
   * @example 'desc'
   */
  @ApiPropertyOptional({
    description:
      'Sort order by attachment timestamp.\n' +
      '  - "asc": Oldest first\n' +
      '  - "desc": Newest first (default)\n' +
      '\n' +
      'Based on vector store attachment time, not file upload time.',
    enum: ['asc', 'desc'],
    default: 'desc',
    example: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  order?: 'asc' | 'desc';

  /**
   * Cursor for fetching the next page
   *
   * Use the `last_id` from the previous response to get the next page.
   * Mutually exclusive with `before` parameter.
   *
   * **Example Flow:**
   * 1. GET /vector-stores/{id}/files?limit=20
   * 2. Response includes: `last_id: "file-xyz"`
   * 3. GET /vector-stores/{id}/files?limit=20&after=file-xyz
   *
   * @example 'file-abc123xyz789'
   */
  @ApiPropertyOptional({
    description:
      'Cursor for next page. Use last_id from previous response.\n' +
      'Mutually exclusive with "before" parameter.',
    example: 'file-abc123xyz789',
  })
  @IsOptional()
  @IsString()
  after?: string;

  /**
   * Cursor for fetching the previous page
   *
   * Use the `first_id` from the current response to get the previous page.
   * Mutually exclusive with `after` parameter.
   *
   * **Example Flow:**
   * 1. GET /vector-stores/{id}/files?limit=20 (page 2)
   * 2. Response includes: `first_id: "file-abc"`
   * 3. GET /vector-stores/{id}/files?limit=20&before=file-abc (page 1)
   *
   * @example 'file-xyz789abc123'
   */
  @ApiPropertyOptional({
    description:
      'Cursor for previous page. Use first_id from current response.\n' +
      'Mutually exclusive with "after" parameter.',
    example: 'file-xyz789abc123',
  })
  @IsOptional()
  @IsString()
  before?: string;

  /**
   * Filter files by processing status
   *
   * **Status Values:**
   * - `'in_progress'`: Files currently being indexed
   *   - File is being chunked and embedded
   *   - Not yet searchable
   *   - Poll until 'completed'
   *
   * - `'completed'`: Successfully indexed files
   *   - File fully processed
   *   - Searchable via file_search tool
   *   - Check file_counts.completed for count
   *
   * - `'failed'`: Files that failed indexing
   *   - Processing encountered error
   *   - Check `last_error` for details
   *   - Not searchable
   *   - Common errors: unsupported format, corrupted file, too large
   *
   * - `'cancelled'`: Cancelled file operations
   *   - Batch was cancelled before completion
   *   - Not searchable
   *   - Check batch status for reason
   *
   * **Omit parameter:** Returns all files regardless of status
   *
   * **Use Cases:**
   * - Monitor indexing: `filter: 'in_progress'`
   * - Verify searchable: `filter: 'completed'`
   * - Debug failures: `filter: 'failed'`
   * - Audit cancellations: `filter: 'cancelled'`
   *
   * @example 'completed'
   */
  @ApiPropertyOptional({
    description:
      'Filter by file processing status.\n' +
      '  - "in_progress": Currently indexing\n' +
      '  - "completed": Successfully indexed and searchable\n' +
      '  - "failed": Indexing failed (check last_error)\n' +
      '  - "cancelled": Operation cancelled\n' +
      '\n' +
      'Omit to get all files regardless of status.',
    enum: ['in_progress', 'completed', 'failed', 'cancelled'],
    example: 'completed',
  })
  @IsOptional()
  @IsEnum(['in_progress', 'completed', 'failed', 'cancelled'])
  filter?: 'in_progress' | 'completed' | 'failed' | 'cancelled';
}
