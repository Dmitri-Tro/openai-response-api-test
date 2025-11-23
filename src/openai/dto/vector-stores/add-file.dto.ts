import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, Matches } from 'class-validator';
import type { VectorStores } from 'openai/resources/vector-stores';
import { IsChunkingStrategyValid } from '../../validators/chunking-strategy.validator';

/**
 * Data Transfer Object for adding a file to a vector store
 *
 * Attaches a previously uploaded file to a vector store for indexing.
 * The file will be processed, chunked, and embedded for semantic search.
 *
 * **Prerequisites:**
 * - File must be uploaded via Files API (Phase 4)
 * - File ID format: "file-" followed by identifier
 * - Supported formats: 67+ including PDF, TXT, DOCX, MD, code files
 *
 * **Processing Flow:**
 * 1. File attached to vector store
 * 2. Status: 'in_progress' (file being processed and chunked)
 * 3. Status: 'completed' (file indexed and searchable)
 * 4. Status: 'failed' | 'cancelled' (error cases)
 *
 * **Attributes:**
 * - Custom metadata for the file-vector store relationship
 * - Not the same as file metadata or vector store metadata
 * - Used for filtering search results
 * - Example: { priority: 'high', category: 'api-docs' }
 *
 * **Chunking Strategy:**
 * - If provided, overrides vector store default
 * - Use for files requiring different chunk sizes
 * - Cannot be changed after attachment
 *
 * @see {@link https://platform.openai.com/docs/api-reference/vector-stores-files/create}
 */
export class AddFileDto {
  /**
   * File ID to attach to vector store
   *
   * **Requirements:**
   * - Must start with "file-"
   * - File must exist in your account
   * - File must not already be attached to this vector store
   *
   * **Upload Files:**
   * ```bash
   * POST /api/files
   * Content-Type: multipart/form-data
   * purpose: assistants
   * ```
   *
   * **Supported Formats (67+):**
   * - Documents: PDF, TXT, DOCX, MD, HTML, RTF
   * - Code: JS, PY, TS, JAVA, C, CPP, GO, RUST, etc.
   * - Data: JSON, CSV, XML, YAML
   * - Presentations: PPTX, PPT
   * - Spreadsheets: XLSX, XLS
   *
   * @example 'file-abc123xyz789012345678901'
   */
  @ApiProperty({
    description:
      'File ID to attach. Must start with "file-".\n' +
      'File must be uploaded via Files API first.',
    example: 'file-abc123xyz789012345678901',
  })
  @IsString()
  @Matches(/^file-/, {
    message: 'file_id must start with "file-"',
  })
  file_id!: string;

  /**
   * Custom attributes for this file-vector store relationship
   *
   * Metadata specific to this file in this vector store.
   * Used for filtering search results by file properties.
   *
   * **Value Types:** string | number | boolean
   *
   * **Use Cases:**
   * - Categorization: `{ category: 'api-docs', section: 'auth' }`
   * - Prioritization: `{ priority: 'high', verified: true }`
   * - Versioning: `{ version: '2.0', deprecated: false }`
   * - Filtering: Use in search filters to narrow results
   *
   * **Important:**
   * - Not the same as file metadata (Files API)
   * - Not the same as vector store metadata
   * - Specific to this attachment relationship
   *
   * @example { category: 'documentation', priority: 'high', verified: true }
   */
  @ApiPropertyOptional({
    description:
      'Custom attributes for file-vector store relationship.\n' +
      'Values: string | number | boolean\n' +
      '\n' +
      'Use for search filtering and categorization.',
    example: { category: 'documentation', priority: 'high', verified: true },
    nullable: true,
  })
  @IsOptional()
  attributes?: Record<string, string | number | boolean> | null;

  /**
   * Chunking strategy override for this specific file
   *
   * If provided, overrides the vector store's default chunking strategy.
   * Use when this file requires different chunk sizes than other files.
   *
   * **Auto Strategy (default):**
   * ```typescript
   * { type: 'auto' }
   * ```
   *
   * **Static Strategy (custom):**
   * ```typescript
   * {
   *   type: 'static',
   *   static: {
   *     max_chunk_size_tokens: 800,    // 100-4096
   *     chunk_overlap_tokens: 400      // max: max_chunk_size_tokens / 2
   *   }
   * }
   * ```
   *
   * **When to Override:**
   * - Large reference documents: Larger chunks (2000-4096)
   * - Code files: Smaller chunks (400-800)
   * - FAQs: Very small chunks (100-400)
   * - Technical specs: Medium chunks (800-1600)
   *
   * **Important:**
   * - Cannot be changed after attachment
   * - To change, must remove and re-add file
   *
   * @default Uses vector store's chunking_strategy
   */
  @ApiPropertyOptional({
    description:
      'Override chunking strategy for this file.\n' +
      '  - Auto: { type: "auto" }\n' +
      '  - Static: { type: "static", static: { max_chunk_size_tokens, chunk_overlap_tokens } }\n' +
      '\n' +
      'If omitted, uses vector store default. Cannot be changed after attachment.',
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
}
