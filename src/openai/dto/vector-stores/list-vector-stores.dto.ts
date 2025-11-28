import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsEnum, IsString } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Data Transfer Object for listing vector stores with pagination
 *
 * Retrieves a list of vector stores with cursor-based pagination.
 * Results are sorted by creation timestamp.
 *
 * **Pagination:**
 * - Default: 20 results per page
 * - Maximum: 100 results per page
 * - Uses cursor-based pagination (not offset-based)
 *
 * **Cursor Navigation:**
 * - `after`: Get results after this cursor (next page)
 * - `before`: Get results before this cursor (previous page)
 * - Cursors are opaque strings from response metadata
 *
 * **Sorting:**
 * - `order: 'asc'` - Oldest first
 * - `order: 'desc'` - Newest first (default)
 * - Sorted by `created_at` timestamp
 *
 * **Response Format:**
 * ```typescript
 * {
 *   data: VectorStore[],
 *   first_id: string,
 *   last_id: string,
 *   has_more: boolean
 * }
 * ```
 *
 * @see {@link https://platform.openai.com/docs/api-reference/vector-stores/list}
 */
export class ListVectorStoresDto {
  /**
   * Number of vector stores to return per page
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
   * Sort order by creation timestamp
   *
   * - `'asc'`: Ascending (oldest first)
   * - `'desc'`: Descending (newest first) [default]
   *
   * **Use Cases:**
   * - 'desc': Find recent vector stores
   * - 'asc': Process in creation order
   *
   * @example 'desc'
   */
  @ApiPropertyOptional({
    description:
      'Sort order by created_at timestamp.\n' +
      '  - "asc": Oldest first\n' +
      '  - "desc": Newest first (default)',
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
   * 1. GET /vector-stores?limit=20
   * 2. Response includes: `last_id: "vs_xyz"`
   * 3. GET /vector-stores?limit=20&after=vs_xyz
   *
   * @example 'vs_abc123xyz789'
   */
  @ApiPropertyOptional({
    description:
      'Cursor for next page. Use last_id from previous response.\n' +
      'Mutually exclusive with "before" parameter.',
    example: 'vs_abc123xyz789',
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
   * 1. GET /vector-stores?limit=20 (page 2)
   * 2. Response includes: `first_id: "vs_abc"`
   * 3. GET /vector-stores?limit=20&before=vs_abc (page 1)
   *
   * @example 'vs_xyz789abc123'
   */
  @ApiPropertyOptional({
    description:
      'Cursor for previous page. Use first_id from current response.\n' +
      'Mutually exclusive with "after" parameter.',
    example: 'vs_xyz789abc123',
  })
  @IsOptional()
  @IsString()
  before?: string;
}
