/**
 * Chunking Strategy Interface
 *
 * Controls how file content is split into chunks for embedding and indexing.
 * Proper chunking is critical for search quality and performance.
 *
 * Strategy Types:
 * - Auto: OpenAI automatically determines optimal chunk size and overlap
 * - Static: Custom token ranges with manual control over chunk size and overlap
 *
 * Best Practices:
 * - Use 'auto' for general-purpose search (recommended default)
 * - Use 'static' for specialized domains requiring fine-tuned chunking
 * - Larger chunks: Better for context-heavy queries, slower search
 * - Smaller chunks: More precise matching, faster search
 * - Overlap: Prevents information loss at chunk boundaries
 *
 * @see https://platform.openai.com/docs/api-reference/vector-stores-files/create#vector-stores-files-create-chunking_strategy
 */

import type { VectorStores } from 'openai/resources/vector-stores';

/**
 * Auto Chunking Strategy
 *
 * OpenAI automatically determines the optimal chunking parameters
 * based on file content and type.
 *
 * Advantages:
 * - No configuration required
 * - Optimized for general-purpose search
 * - Adapts to file format and content
 *
 * @example
 * {
 *   type: 'auto'
 * }
 */
export type AutoChunkingStrategy = VectorStores.AutoFileChunkingStrategyParam;

/**
 * Static Chunking Strategy
 *
 * Manual control over chunk size and overlap using token counts.
 *
 * Configuration:
 * - max_chunk_size_tokens: Size of each chunk (100-4096 tokens)
 * - chunk_overlap_tokens: Overlap between chunks (max: max_chunk_size_tokens / 2)
 *
 * Validation Rules:
 * - max_chunk_size_tokens: Must be 100-4096 (inclusive)
 * - chunk_overlap_tokens: Must be ≤ max_chunk_size_tokens / 2
 * - Both values must be positive integers
 *
 * @example
 * {
 *   type: 'static',
 *   static: {
 *     max_chunk_size_tokens: 800,
 *     chunk_overlap_tokens: 400
 *   }
 * }
 */
export type StaticChunkingStrategy =
  VectorStores.StaticFileChunkingStrategyObjectParam;

/**
 * Chunking Strategy Union Type
 *
 * Can be either auto or static chunking configuration.
 */
export type ChunkingStrategy = AutoChunkingStrategy | StaticChunkingStrategy;

/**
 * Static Chunking Configuration Object
 *
 * The 'static' field within StaticChunkingStrategy.
 */
export type StaticChunkingConfig = VectorStores.StaticFileChunkingStrategy;

/**
 * Chunking Strategy Type
 *
 * Discriminator field for chunking strategy.
 *
 * Values:
 * - 'auto': Automatic chunking
 * - 'static': Manual chunking configuration
 */
export type ChunkingStrategyType = 'auto' | 'static';
