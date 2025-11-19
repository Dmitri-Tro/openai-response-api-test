import type { Responses } from 'openai/resources/responses';
import type { CodeInterpreterToolConfig } from './code-interpreter-tool.interface';

/**
 * File Search Tool Configuration
 *
 * Enables semantic search through uploaded files in vector stores.
 * Requires Vector Stores API (Phase 5) for vector store creation.
 *
 * @see https://platform.openai.com/docs/api-reference/responses/create#responses-create-tools
 */
export interface FileSearchToolConfig {
  /**
   * Tool type identifier
   */
  type: 'file_search';

  /**
   * Array of vector store IDs to search
   *
   * - Must start with "vs_"
   * - Can search across multiple stores
   * - Stores must be created via Vector Stores API
   *
   * @example ['vs_abc123', 'vs_def456']
   */
  vector_store_ids: string[];

  /**
   * Maximum number of search results to use in response generation
   *
   * - Range: 1-50
   * - Default: 20 (OpenAI default)
   * - Higher values increase context but may affect performance
   *
   * @example 10
   */
  max_num_results?: number;

  /**
   * Ranking configuration for search result filtering
   *
   * @example { ranker: 'auto', score_threshold: 0.7 }
   */
  ranking_options?: FileSearchRankingOptions;
}

/**
 * Ranking Options for File Search Results
 */
export interface FileSearchRankingOptions {
  /**
   * Ranker algorithm selection
   *
   * - 'auto': Let OpenAI choose best ranker
   * - 'default-2024-11-15': Specific ranker version
   */
  ranker?: 'auto' | 'default-2024-11-15';

  /**
   * Minimum relevance score threshold (0-1)
   *
   * - Filters out results below this confidence level
   * - 0: Include all results
   * - 1: Only perfect matches
   *
   * @minimum 0
   * @maximum 1
   * @example 0.7
   */
  score_threshold?: number;
}

/**
 * Combined tool type supporting all Responses API tools
 *
 * Includes:
 * - All OpenAI SDK tool types (function, web_search, custom_tool, etc.)
 * - FileSearchToolConfig with enhanced type safety and validation
 * - CodeInterpreterToolConfig with enhanced type safety and validation
 */
export type ResponsesToolConfig =
  | NonNullable<Responses.ResponseCreateParamsNonStreaming['tools']>[number]
  | FileSearchToolConfig
  | CodeInterpreterToolConfig;
