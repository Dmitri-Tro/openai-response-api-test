import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsNumber,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsSearchFilterValid } from '../../validators/search-filter.validator';
import type * as Shared from 'openai/resources/shared';

/**
 * Ranking Options for Vector Store Search
 *
 * Controls the ranking algorithm and score threshold for search results.
 */
export class RankingOptionsDto {
  /**
   * Ranking algorithm to use
   *
   * - `'none'`: No ranking, return all matches
   * - `'auto'`: Automatically select best ranker
   * - `'default-2024-11-15'`: Specific ranker version
   *
   * @example 'auto'
   */
  @ApiPropertyOptional({
    description:
      'Ranking algorithm:\n' +
      '  - "none": No ranking\n' +
      '  - "auto": Auto-select best (default)\n' +
      '  - "default-2024-11-15": Specific version',
    enum: ['none', 'auto', 'default-2024-11-15'],
    example: 'auto',
  })
  @IsOptional()
  @IsEnum(['none', 'auto', 'default-2024-11-15'])
  ranker?: 'none' | 'auto' | 'default-2024-11-15';

  /**
   * Minimum relevance score threshold
   *
   * **Range:** 0-1
   * - 0: Include all results (no filtering)
   * - 0.5: Medium relevance threshold
   * - 1: Only perfect matches
   *
   * **Use Cases:**
   * - 0.3-0.5: Broad search, high recall
   * - 0.5-0.7: Balanced precision/recall
   * - 0.7-1.0: High precision, strict matching
   *
   * @example 0.7
   */
  @ApiPropertyOptional({
    description:
      'Minimum relevance score (0-1).\n' +
      '  - 0: Include all\n' +
      '  - 0.5: Medium threshold\n' +
      '  - 1: Perfect matches only',
    minimum: 0,
    maximum: 1,
    example: 0.7,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  score_threshold?: number;
}

/**
 * Data Transfer Object for searching vector stores
 *
 * Performs semantic search across indexed files in a vector store.
 * Returns ranked results with content chunks and metadata.
 *
 * **Query Types:**
 * - String: Single query (most common)
 * - Array: Multiple queries (multi-query search)
 *
 * **Filtering:**
 * - Comparison filters: Match metadata fields (eq, ne, gt, gte, lt, lte)
 * - Compound filters: Combine with AND/OR logic
 * - Nested filters: Complex boolean expressions
 *
 * **Ranking:**
 * - Ranker selection: Auto or specific version
 * - Score threshold: Filter by relevance score
 *
 * **Response Format:**
 * ```typescript
 * {
 *   file_id: string,
 *   filename: string,
 *   score: number,
 *   content: [{ type: 'text', text: string }],
 *   attributes: Record<string, any>
 * }[]
 * ```
 *
 * @see {@link https://platform.openai.com/docs/api-reference/vector-stores/search}
 */
export class SearchVectorStoreDto {
  /**
   * Search query (single or multiple)
   *
   * **Single Query:**
   * ```typescript
   * "How do I reset my password?"
   * ```
   *
   * **Multiple Queries (multi-query search):**
   * ```typescript
   * ["password reset", "forgot password", "account recovery"]
   * ```
   *
   * **Best Practices:**
   * - Be specific: "How to configure OAuth2" vs "OAuth"
   * - Natural language: Questions work well
   * - Avoid too broad: "documentation" vs "user authentication flow"
   * - Multiple queries: Increase recall for ambiguous intents
   *
   * @example 'How do I configure the authentication system?'
   */
  @ApiProperty({
    description:
      'Search query string or array of query strings.\n' +
      'Multiple queries increase recall for different phrasings.',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'How do I configure OAuth2 authentication?',
  })
  @IsString({ each: true })
  query!: string | string[];

  /**
   * Maximum number of results to return
   *
   * **Range:** 1-50
   * **Default:** 20
   *
   * **Guidelines:**
   * - 1-10: High precision, top results only
   * - 10-20: Balanced (default)
   * - 20-50: Broad recall, more context
   *
   * @example 10
   */
  @ApiPropertyOptional({
    description: 'Maximum results to return. Range: 1-50. Default: 20.',
    minimum: 1,
    maximum: 50,
    default: 20,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  max_num_results?: number;

  /**
   * Metadata filters for search refinement
   *
   * **Comparison Filter:**
   * ```typescript
   * {
   *   key: 'category',
   *   type: 'eq',
   *   value: 'documentation'
   * }
   * ```
   *
   * **Compound Filter (AND):**
   * ```typescript
   * {
   *   type: 'and',
   *   filters: [
   *     { key: 'category', type: 'eq', value: 'docs' },
   *     { key: 'year', type: 'gte', value: 2024 }
   *   ]
   * }
   * ```
   *
   * **Compound Filter (OR):**
   * ```typescript
   * {
   *   type: 'or',
   *   filters: [
   *     { key: 'priority', type: 'eq', value: 'high' },
   *     { key: 'urgent', type: 'eq', value: true }
   *   ]
   * }
   * ```
   *
   * **Nested Filters:**
   * ```typescript
   * {
   *   type: 'and',
   *   filters: [
   *     { key: 'active', type: 'eq', value: true },
   *     {
   *       type: 'or',
   *       filters: [
   *         { key: 'lang', type: 'eq', value: 'en' },
   *         { key: 'lang', type: 'eq', value: 'es' }
   *       ]
   *     }
   *   ]
   * }
   * ```
   *
   * **Supported Operators:**
   * - `'eq'`: Equal to
   * - `'ne'`: Not equal to
   * - `'gt'`: Greater than
   * - `'gte'`: Greater than or equal
   * - `'lt'`: Less than
   * - `'lte'`: Less than or equal
   */
  @ApiPropertyOptional({
    description:
      'Metadata filters for search refinement.\n' +
      '\n' +
      'Comparison: { key: string, type: operator, value: primitive }\n' +
      'Compound: { type: "and" | "or", filters: Filter[] }\n' +
      '\n' +
      'Operators: eq, ne, gt, gte, lt, lte\n' +
      'Supports nested compound filters for complex logic.',
    example: {
      type: 'and',
      filters: [
        { key: 'category', type: 'eq', value: 'documentation' },
        { key: 'year', type: 'gte', value: 2024 },
      ],
    },
  })
  @IsOptional()
  @IsSearchFilterValid()
  filters?: Shared.ComparisonFilter | Shared.CompoundFilter;

  /**
   * Ranking options for result ordering
   *
   * Configure which ranking algorithm to use and score threshold.
   *
   * **Configuration:**
   * - `ranker`: Algorithm selection ('auto' recommended)
   * - `score_threshold`: Minimum relevance score (0-1)
   *
   * **Example:**
   * ```typescript
   * {
   *   ranker: 'auto',
   *   score_threshold: 0.7  // Only return results with score >= 0.7
   * }
   * ```
   */
  @ApiPropertyOptional({
    description:
      'Ranking options:\n' +
      '  - ranker: "auto" | "none" | "default-2024-11-15"\n' +
      '  - score_threshold: 0-1 (minimum relevance)',
    type: RankingOptionsDto,
    example: {
      ranker: 'auto',
      score_threshold: 0.7,
    },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RankingOptionsDto)
  ranking_options?: RankingOptionsDto;

  /**
   * Rewrite query for optimization
   *
   * When true, OpenAI may rewrite the natural language query
   * to improve search quality.
   *
   * **Use Cases:**
   * - true: Conversational queries, ambiguous phrasing
   * - false: Precise technical queries, keyword matching
   *
   * **Example Rewrites:**
   * - "How do I do X?" → "X configuration steps"
   * - "What's the best way to Y?" → "Y best practices"
   *
   * @default false
   */
  @ApiPropertyOptional({
    description:
      'Allow OpenAI to rewrite query for better search quality.\n' +
      'Useful for natural language queries.',
    default: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  rewrite_query?: boolean;
}
