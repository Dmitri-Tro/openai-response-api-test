/**
 * Vector Store Interface
 *
 * Vector stores enable semantic search over uploaded files by creating
 * searchable embeddings. Used with the file_search tool in Responses API
 * for Retrieval-Augmented Generation (RAG) workflows.
 *
 * Features:
 * - Store and index uploaded files for semantic search
 * - Support for 67+ file formats (PDF, TXT, Markdown, code files, etc.)
 * - Automatic or custom chunking strategies
 * - Metadata filtering for search refinement
 * - Configurable expiration policies
 * - Batch file operations for efficiency
 *
 * Workflow:
 * 1. Upload files via Files API
 * 2. Create vector store with chunking strategy
 * 3. Add files to vector store
 * 4. Poll until indexing complete
 * 5. Use file_search tool in Responses API
 *
 * @see https://platform.openai.com/docs/api-reference/vector-stores
 * @see https://platform.openai.com/docs/guides/file-search
 */

import type { VectorStores } from 'openai/resources/vector-stores';
import type * as Shared from 'openai/resources/shared';

/**
 * Main Vector Store type from OpenAI SDK
 *
 * Represents a collection of indexed files that can be searched semantically.
 */
export type VectorStore = VectorStores.VectorStore;

/**
 * Vector Store Deleted Response
 *
 * Returned when a vector store is successfully deleted.
 */
export type VectorStoreDeleted = VectorStores.VectorStoreDeleted;

/**
 * Expiration Policy Configuration
 *
 * Controls when a vector store is automatically deleted.
 *
 * @example
 * {
 *   anchor: 'last_active_at',
 *   days: 7
 * }
 */
export type ExpiresAfter = VectorStores.VectorStore.ExpiresAfter;

/**
 * File Counts in Vector Store
 *
 * Tracks the status of files being indexed in a vector store.
 *
 * Fields:
 * - in_progress: Number of files currently being indexed
 * - completed: Number of successfully indexed files
 * - failed: Number of files that failed indexing
 * - cancelled: Number of files whose indexing was cancelled
 * - total: Total number of files in the vector store
 */
export type FileCounts = VectorStores.VectorStore.FileCounts;

/**
 * Vector Store Status
 *
 * Indicates the current lifecycle state of a vector store.
 *
 * Values:
 * - 'in_progress': Files are being indexed
 * - 'completed': All files successfully indexed
 * - 'expired': Vector store has expired per expiration policy
 */
export type VectorStoreStatus = VectorStores.VectorStore['status'];

/**
 * Metadata for Vector Store
 *
 * Custom key-value pairs for storing additional information.
 *
 * Constraints:
 * - Maximum 16 key-value pairs
 * - Keys: max 64 characters
 * - Values: max 512 characters
 * - Only string values supported
 */
export type VectorStoreMetadata = Shared.Metadata;
