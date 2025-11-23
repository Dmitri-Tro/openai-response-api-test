/**
 * Vector Store File Batch Interface
 *
 * Batch operations for adding multiple files to a vector store efficiently.
 * Reduces API calls and provides unified status tracking for bulk operations.
 *
 * Features:
 * - Add up to 500 files in a single batch
 * - Track batch processing status and file counts
 * - Cancel batch operations in progress
 * - Individual file status tracking within batch
 *
 * Workflow:
 * 1. Create batch with file_ids or files array
 * 2. Poll batch until status is 'completed' or 'cancelled'
 * 3. Check file_counts for indexing progress
 * 4. List batch files to see individual file statuses
 *
 * @see https://platform.openai.com/docs/api-reference/vector-stores-file-batches
 */

import type { VectorStores } from 'openai/resources/vector-stores';

/**
 * Vector Store File Batch type from OpenAI SDK
 *
 * Represents a batch operation for adding multiple files to a vector store.
 */
export type VectorStoreFileBatch = VectorStores.VectorStoreFileBatch;

/**
 * Batch File Configuration
 *
 * Individual file configuration within a batch operation.
 * Allows per-file customization of attributes and chunking strategy.
 *
 * Fields:
 * - file_id: The uploaded file ID (required)
 * - attributes: Custom metadata for the file
 * - chunking_strategy: Override global chunking strategy for this file
 *
 * @example
 * {
 *   file_id: 'file-abc123',
 *   attributes: { category: 'documentation', priority: 'high' },
 *   chunking_strategy: { type: 'static', static: { max_chunk_size_tokens: 800, chunk_overlap_tokens: 400 } }
 * }
 */
export type BatchFile = NonNullable<
  VectorStores.FileBatchCreateParams['files']
>[number];

/**
 * Batch Status
 *
 * Indicates the current state of the batch operation.
 *
 * Values:
 * - 'in_progress': Batch is processing files
 * - 'completed': All files processed (some may have failed)
 * - 'cancelled': Batch operation was cancelled
 */
export type BatchStatus = VectorStores.VectorStoreFileBatch['status'];

/**
 * File Batch Create Parameters
 *
 * Parameters for creating a new file batch.
 *
 * Two mutually exclusive patterns:
 *
 * Pattern 1 - Global Configuration:
 * {
 *   file_ids: ['file-abc', 'file-def'],
 *   attributes: { shared: 'metadata' },        // Applied to all files
 *   chunking_strategy: { type: 'auto' }        // Applied to all files
 * }
 *
 * Pattern 2 - Individual Configuration:
 * {
 *   files: [
 *     { file_id: 'file-abc', attributes: {...}, chunking_strategy: {...} },
 *     { file_id: 'file-def', attributes: {...}, chunking_strategy: {...} }
 *   ]
 * }
 */
export type FileBatchCreateParams = VectorStores.FileBatchCreateParams;
