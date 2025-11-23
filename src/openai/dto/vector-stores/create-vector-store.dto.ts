import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsArray,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { VectorStores } from 'openai/resources/vector-stores';
import type * as Shared from 'openai/resources/shared';
import { IsChunkingStrategyValid } from '../../validators/chunking-strategy.validator';
import { IsMetadataValid } from '../../validators/metadata.validator';

/**
 * Expiration Policy for Vector Stores
 *
 * Configures automatic deletion of vector stores after inactivity.
 */
export class ExpiresAfterDto {
  /**
   * Anchor timestamp for expiration calculation
   * Only 'last_active_at' is supported by OpenAI
   */
  @ApiProperty({
    description:
      'Anchor for expiration calculation. Only "last_active_at" is supported.',
    enum: ['last_active_at'],
    example: 'last_active_at',
  })
  @IsString()
  anchor!: 'last_active_at';

  /**
   * Number of days after anchor before vector store expires
   * Range: 1-365 days
   */
  @ApiProperty({
    description:
      'Days after last activity before vector store expires. Range: 1-365 days',
    minimum: 1,
    maximum: 365,
    example: 7,
  })
  days!: number;
}

/**
 * Data Transfer Object for creating vector stores via OpenAI Vector Stores API
 *
 * Vector stores enable semantic search over uploaded files by creating searchable
 * embeddings. Essential for RAG (Retrieval-Augmented Generation) workflows.
 *
 * **Core Parameters:**
 * - `file_ids` - Initial files to attach (optional)
 * - `chunking_strategy` - How files are split for embedding (optional)
 * - `expires_after` - Automatic deletion policy (optional)
 * - `metadata` - Custom key-value pairs (optional)
 * - `name` - Human-readable name (optional)
 * - `description` - Detailed description (optional)
 *
 * **Workflow:**
 * 1. Upload files via Files API (Phase 4)
 * 2. Create vector store with file_ids
 * 3. Files are automatically indexed (status: 'in_progress')
 * 4. Poll until status: 'completed'
 * 5. Use file_search tool in Responses API
 *
 * **Chunking Strategies:**
 * - **Auto (default)**: OpenAI determines optimal chunk size
 *   ```typescript
 *   { type: 'auto' }
 *   ```
 * - **Static (custom)**: Manual control over token ranges
 *   ```typescript
 *   {
 *     type: 'static',
 *     static: {
 *       max_chunk_size_tokens: 800,  // 100-4096
 *       chunk_overlap_tokens: 400     // max: max_chunk_size_tokens / 2
 *     }
 *   }
 *   ```
 *
 * **Expiration Policies:**
 * - Anchor: 'last_active_at' (only supported value)
 * - Days: 1-365 (delete after inactivity)
 * - Example: Delete after 7 days of no searches
 *
 * **Metadata Constraints:**
 * - Maximum 16 key-value pairs
 * - Keys: max 64 characters
 * - Values: max 512 characters (strings only)
 *
 * **Integration Points:**
 * - Phase 4 (Files API): Upload files before attaching
 * - Phase 2.14 (file_search tool): Use vector_store_ids in Responses API
 * - ToolCallingEventsHandler: Handles file_search events (3 handlers)
 *
 * @see {@link https://platform.openai.com/docs/api-reference/vector-stores/create}
 * @see {@link https://platform.openai.com/docs/guides/file-search}
 */
export class CreateVectorStoreDto {
  /**
   * Optional name for the vector store
   *
   * Human-readable identifier for organizational purposes.
   * Not used for search or indexing.
   *
   * @example 'Product Documentation'
   */
  @ApiPropertyOptional({
    description: 'Optional human-readable name for the vector store',
    example: 'Product Documentation Vector Store',
  })
  @IsOptional()
  @IsString()
  name?: string;

  /**
   * Array of file IDs to attach and index in the vector store
   *
   * Files must be:
   * - Previously uploaded via Files API (Phase 4)
   * - Format: "file-" followed by identifier
   * - Maximum batch size: 500 files (for larger batches, use file batches)
   *
   * Supported file formats (67+ total):
   * - Documents: PDF, TXT, DOCX, MD, HTML, RTF
   * - Code: JS, PY, TS, JAVA, C, CPP, GO, RUST, etc.
   * - Data: JSON, CSV, XML, YAML
   * - Presentations: PPTX, PPT
   * - Spreadsheets: XLSX, XLS, CSV
   *
   * @example ['file-abc123xyz789', 'file-def456uvw012']
   */
  @ApiPropertyOptional({
    description:
      'Array of file IDs to attach to vector store. Files must start with "file-".\n' +
      'Max 500 files per request. Use file batches for larger operations.',
    type: [String],
    example: ['file-abc123xyz789', 'file-def456uvw012'],
  })
  @IsOptional()
  @IsArray()
  @Matches(/^file-/, {
    each: true,
    message: 'Each file_id must start with "file-"',
  })
  file_ids?: string[];

  /**
   * Chunking strategy for file processing
   *
   * Controls how file content is split into chunks for embedding.
   *
   * **Auto Strategy (default):**
   * ```typescript
   * { type: 'auto' }
   * ```
   * - OpenAI automatically determines optimal chunk size
   * - Recommended for general-purpose search
   * - No configuration required
   *
   * **Static Strategy (advanced):**
   * ```typescript
   * {
   *   type: 'static',
   *   static: {
   *     max_chunk_size_tokens: 800,
   *     chunk_overlap_tokens: 400
   *   }
   * }
   * ```
   * - Manual control over chunk boundaries
   * - max_chunk_size_tokens: 100-4096 (required)
   * - chunk_overlap_tokens: max half of max_chunk_size_tokens (required)
   *
   * **Best Practices:**
   * - Larger chunks: Better context, slower search
   * - Smaller chunks: More precise, faster search
   * - Overlap: Prevents information loss at boundaries
   *
   * @default { type: 'auto' }
   */
  @ApiPropertyOptional({
    description:
      'Chunking strategy for file processing.\n' +
      '  - Auto: { type: "auto" } (default)\n' +
      '  - Static: { type: "static", static: { max_chunk_size_tokens: 800, chunk_overlap_tokens: 400 } }\n' +
      '\n' +
      'Static constraints:\n' +
      '  - max_chunk_size_tokens: 100-4096\n' +
      '  - chunk_overlap_tokens: max half of max_chunk_size_tokens',
    example: {
      type: 'static',
      static: {
        max_chunk_size_tokens: 800,
        chunk_overlap_tokens: 400,
      },
    },
  })
  @IsOptional()
  @IsChunkingStrategyValid()
  chunking_strategy?: VectorStores.FileChunkingStrategyParam;

  /**
   * Expiration policy for automatic deletion
   *
   * Configure vector store to be deleted after period of inactivity.
   *
   * **Configuration:**
   * - anchor: 'last_active_at' (only supported value)
   * - days: 1-365 (days after last search/update)
   *
   * **Use Cases:**
   * - Temporary analysis projects (1-7 days)
   * - Weekly content updates (7 days)
   * - Monthly data refresh (30 days)
   * - Cost optimization (auto-cleanup)
   *
   * **Important:**
   * - "Last active" updates on: search operations, file additions
   * - Expired vector stores are permanently deleted
   * - Files in vector store are NOT deleted (remain in Files API)
   *
   * @example { anchor: 'last_active_at', days: 7 }
   */
  @ApiPropertyOptional({
    description:
      'Optional expiration policy for automatic deletion.\n' +
      '  - anchor: "last_active_at" (only supported)\n' +
      '  - days: 1-365 (days after last activity)\n' +
      '\n' +
      'Vector store deleted after inactivity period. Files remain in Files API.',
    type: ExpiresAfterDto,
    example: {
      anchor: 'last_active_at',
      days: 7,
    },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExpiresAfterDto)
  expires_after?: ExpiresAfterDto;

  /**
   * Custom metadata for the vector store
   *
   * Store additional information as key-value pairs.
   *
   * **Constraints:**
   * - Maximum: 16 key-value pairs
   * - Keys: max 64 characters
   * - Values: max 512 characters (strings only)
   *
   * **Use Cases:**
   * - Categorization: { category: 'documentation', version: 'v2.0' }
   * - Ownership: { team: 'engineering', owner: 'john@example.com' }
   * - Lifecycle: { environment: 'production', created_by: 'api' }
   * - Search filtering: Filter results by metadata fields
   *
   * @example { category: 'documentation', language: 'en', version: '2.0' }
   */
  @ApiPropertyOptional({
    description:
      'Custom metadata as key-value pairs.\n' +
      'Constraints:\n' +
      '  - Max 16 pairs\n' +
      '  - Keys: max 64 chars\n' +
      '  - Values: max 512 chars (strings only)\n' +
      '\n' +
      'Use for categorization, ownership tracking, or search filtering.',
    example: { category: 'documentation', language: 'en', version: '2.0' },
  })
  @IsOptional()
  @IsMetadataValid()
  metadata?: Shared.Metadata;

  /**
   * Optional description of the vector store
   *
   * Detailed explanation of the vector store's purpose and contents.
   *
   * @example 'Contains all product documentation PDFs for semantic search in customer support workflows'
   */
  @ApiPropertyOptional({
    description:
      'Optional detailed description of vector store purpose and contents',
    example:
      'Product documentation for semantic search in customer support chatbot',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
