/**
 * Search Filter Interface
 *
 * Filters for refining vector store search results based on file metadata.
 * Enables precise control over which files are included in search results.
 *
 * Filter Types:
 * - Comparison Filter: Single condition on file metadata (eq, ne, gt, gte, lt, lte)
 * - Compound Filter: Combine multiple filters with logical operators (AND, OR)
 *
 * Use Cases:
 * - Filter by file attributes (category, date, priority, etc.)
 * - Combine multiple conditions with AND/OR logic
 * - Exclude specific files from search results
 * - Search within date ranges or numeric thresholds
 *
 * @see https://platform.openai.com/docs/api-reference/vector-stores/search#vector-stores-search-filters
 */

import type * as Shared from 'openai/resources/shared';

/**
 * Comparison Filter
 *
 * Single condition comparing a metadata field to a value.
 *
 * Operators:
 * - 'eq': Equal to (supports string, number, boolean)
 * - 'ne': Not equal to (supports string, number, boolean)
 * - 'gt': Greater than (number only)
 * - 'gte': Greater than or equal to (number only)
 * - 'lt': Less than (number only)
 * - 'lte': Less than or equal to (number only)
 *
 * @example Equal to
 * {
 *   key: 'category',
 *   type: 'eq',
 *   value: 'documentation'
 * }
 *
 * @example Greater than or equal
 * {
 *   key: 'priority',
 *   type: 'gte',
 *   value: 5
 * }
 */
export type ComparisonFilter = Shared.ComparisonFilter;

/**
 * Compound Filter
 *
 * Combines multiple filters using logical operators.
 *
 * Operators:
 * - 'and': All filters must match
 * - 'or': At least one filter must match
 *
 * Nesting:
 * - Filters can be nested for complex logic
 * - Combine comparison and compound filters
 *
 * @example AND logic
 * {
 *   type: 'and',
 *   filters: [
 *     { key: 'category', type: 'eq', value: 'docs' },
 *     { key: 'year', type: 'gte', value: 2024 }
 *   ]
 * }
 *
 * @example OR logic
 * {
 *   type: 'or',
 *   filters: [
 *     { key: 'priority', type: 'eq', value: 'high' },
 *     { key: 'urgent', type: 'eq', value: true }
 *   ]
 * }
 *
 * @example Nested logic
 * {
 *   type: 'and',
 *   filters: [
 *     { key: 'category', type: 'eq', value: 'docs' },
 *     {
 *       type: 'or',
 *       filters: [
 *         { key: 'lang', type: 'eq', value: 'en' },
 *         { key: 'lang', type: 'eq', value: 'es' }
 *       ]
 *     }
 *   ]
 * }
 */
export type CompoundFilter = Shared.CompoundFilter;

/**
 * Search Filter Union Type
 *
 * Can be either a comparison filter or a compound filter.
 */
export type SearchFilter = ComparisonFilter | CompoundFilter;

/**
 * Filter Comparison Operator
 *
 * Supported comparison types for metadata filtering.
 */
export type FilterOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte';

/**
 * Compound Filter Operator
 *
 * Logical operators for combining multiple filters.
 */
export type CompoundOperator = 'and' | 'or';

/**
 * Ranking Options for Search
 *
 * Controls the ranking algorithm and score threshold for search results.
 *
 * Fields:
 * - ranker: Ranking algorithm version ('auto' or specific version)
 * - score_threshold: Minimum relevance score (0-1)
 *
 * @example
 * {
 *   ranker: 'default-2024-11-15',
 *   score_threshold: 0.7
 * }
 */
export interface RankingOptions {
  /**
   * Ranking algorithm to use
   * - 'none': No ranking
   * - 'auto': Automatically select best ranker
   * - 'default-2024-11-15': Specific ranker version
   */
  ranker?: 'none' | 'auto' | 'default-2024-11-15';

  /**
   * Minimum relevance score threshold (0-1)
   * - 0: Include all results
   * - 1: Only perfect matches
   */
  score_threshold?: number;
}

/**
 * Search Response Content
 *
 * Content chunks from search results.
 */
export interface SearchResponseContent {
  /**
   * Content chunk text
   */
  text: string;

  /**
   * Content type (always 'text')
   */
  type: 'text';
}

/**
 * Vector Store Search Response
 *
 * Individual search result from a vector store query.
 */
export interface VectorStoreSearchResponse {
  /**
   * ID of the file containing this result
   */
  file_id: string;

  /**
   * Name of the file
   */
  filename: string;

  /**
   * Relevance score (higher = more relevant)
   */
  score: number;

  /**
   * Content chunks matching the query
   */
  content: SearchResponseContent[];

  /**
   * File attributes (metadata)
   */
  attributes: Record<string, string | number | boolean> | null;
}
