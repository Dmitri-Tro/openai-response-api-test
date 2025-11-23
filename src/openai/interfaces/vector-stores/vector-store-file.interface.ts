/**
 * Vector Store File Interface
 *
 * Represents a file attached to a vector store for indexing and search.
 * Files must be uploaded via Files API before being added to a vector store.
 *
 * Lifecycle:
 * 1. Upload file via Files API (get file_id)
 * 2. Add file to vector store
 * 3. File status changes: 'in_progress' → 'completed' | 'failed' | 'cancelled'
 * 4. Poll until status is 'completed'
 * 5. File is searchable via file_search tool
 *
 * @see https://platform.openai.com/docs/api-reference/vector-stores-files
 */

import type { VectorStores } from 'openai/resources/vector-stores';

/**
 * Vector Store File type from OpenAI SDK
 *
 * Represents a file attached to a vector store with indexing status.
 */
export type VectorStoreFile = VectorStores.VectorStoreFile;

/**
 * Vector Store File Deleted Response
 *
 * Returned when a file is successfully removed from a vector store.
 */
export type VectorStoreFileDeleted = VectorStores.VectorStoreFileDeleted;

/**
 * File Indexing Error
 *
 * Contains error details when file indexing fails.
 *
 * Fields:
 * - code: Error code (e.g., 'server_error', 'unsupported_file', 'invalid_file')
 * - message: Human-readable error description
 */
export type LastError = VectorStores.VectorStoreFile['last_error'];

/**
 * Vector Store File Status
 *
 * Indicates the current indexing state of a file.
 *
 * Values:
 * - 'in_progress': File is being processed and indexed
 * - 'completed': File successfully indexed and searchable
 * - 'failed': Indexing failed (see last_error for details)
 * - 'cancelled': Indexing was cancelled before completion
 */
export type VectorStoreFileStatus = VectorStores.VectorStoreFile['status'];

/**
 * Chunking Strategy Parameter for File
 *
 * Controls how the file content is split into chunks for embedding.
 *
 * Can be:
 * - 'auto': OpenAI automatically determines optimal chunking
 * - Static configuration: Custom token ranges with overlap
 *
 * @see chunking-strategy.interface.ts for detailed types
 */
export type FileChunkingStrategyParam =
  VectorStores.FileCreateParams['chunking_strategy'];

/**
 * File Content Response
 *
 * Contains the content chunks and embeddings from a vector store file.
 */
export type FileContentResponse = VectorStores.FileContentResponse;
