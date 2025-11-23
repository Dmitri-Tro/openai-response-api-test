import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsArray, ValidateNested, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import type { VectorStores } from 'openai/resources/vector-stores';
import { IsChunkingStrategyValid } from '../../validators/chunking-strategy.validator';

/**
 * Individual File Configuration for Batch Operations
 *
 * Allows per-file customization within a batch.
 */
export class BatchFileConfigDto {
  /**
   * File ID to attach
   */
  @ApiPropertyOptional({
    description: 'File ID to attach (must start with "file-")',
    example: 'file-abc123xyz789',
  })
  @IsOptional()
  @Matches(/^file-/, { message: 'file_id must start with "file-"' })
  file_id?: string;

  /**
   * Custom attributes for this file
   */
  @ApiPropertyOptional({
    description: 'Custom attributes for this file',
    example: { category: 'docs', priority: 'high' },
  })
  @IsOptional()
  attributes?: Record<string, string | number | boolean>;

  /**
   * Chunking strategy override for this file
   */
  @ApiPropertyOptional({
    description: 'Chunking strategy override for this file',
    example: {
      type: 'static',
      static: { max_chunk_size_tokens: 800, chunk_overlap_tokens: 400 },
    },
  })
  @IsOptional()
  @IsChunkingStrategyValid()
  chunking_strategy?: VectorStores.FileChunkingStrategyParam;
}

/**
 * Data Transfer Object for batch file operations
 *
 * Efficiently attach multiple files to a vector store in a single operation.
 * Supports two configuration patterns: global or individual.
 *
 * **Two Patterns (Mutually Exclusive):**
 *
 * **Pattern 1 - Global Configuration:**
 * Apply same attributes and chunking to all files:
 * ```typescript
 * {
 *   file_ids: ['file-abc', 'file-def', 'file-xyz'],
 *   attributes: { category: 'docs', verified: true },
 *   chunking_strategy: { type: 'auto' }
 * }
 * ```
 *
 * **Pattern 2 - Individual Configuration:**
 * Customize each file separately:
 * ```typescript
 * {
 *   files: [
 *     {
 *       file_id: 'file-abc',
 *       attributes: { priority: 'high' },
 *       chunking_strategy: { type: 'static', static: {...} }
 *     },
 *     {
 *       file_id: 'file-def',
 *       attributes: { priority: 'low' },
 *       chunking_strategy: { type: 'auto' }
 *     }
 *   ]
 * }
 * ```
 *
 * **Batch Limits:**
 * - Maximum: 500 files per batch
 * - For larger operations, create multiple batches
 * - Monitor batch status via polling endpoints
 *
 * **Batch Status:**
 * - 'in_progress': Files being processed
 * - 'completed': All files processed (check file_counts for failures)
 * - 'cancelled': Batch operation cancelled
 *
 * **File Counts:**
 * ```typescript
 * {
 *   total: 100,
 *   in_progress: 20,
 *   completed: 75,
 *   failed: 3,
 *   cancelled: 2
 * }
 * ```
 *
 * **Error Handling:**
 * - Individual file failures don't fail entire batch
 * - Check `last_error` on failed files
 * - Batch completes even if some files fail
 *
 * @see {@link https://platform.openai.com/docs/api-reference/vector-stores-file-batches}
 */
export class AddFileBatchDto {
  /**
   * Array of file IDs (Pattern 1: Global configuration)
   *
   * Use this pattern when all files should have:
   * - Same attributes
   * - Same chunking strategy
   * - Simple batch operation
   *
   * **Mutually Exclusive with `files` parameter.**
   *
   * **Requirements:**
   * - Each ID must start with "file-"
   * - Maximum 500 files per batch
   * - Files must exist in your account
   * - Files not already attached to this vector store
   *
   * @example ['file-abc123', 'file-def456', 'file-xyz789']
   */
  @ApiPropertyOptional({
    description:
      'Array of file IDs for global configuration.\n' +
      'Mutually exclusive with "files" parameter.\n' +
      'Max 500 files. All files get same attributes/chunking.',
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
   * Global attributes for all files (Pattern 1 only)
   *
   * Applied to all files in `file_ids` array.
   * Ignored if using `files` array (Pattern 2).
   *
   * **Value Types:** string | number | boolean
   *
   * @example { category: 'documentation', batch_id: '2025-01-15' }
   */
  @ApiPropertyOptional({
    description:
      'Global attributes applied to all files in file_ids array.\n' +
      'Only used with Pattern 1 (file_ids). Ignored with Pattern 2 (files).',
    example: { category: 'documentation', verified: true },
  })
  @IsOptional()
  attributes?: Record<string, string | number | boolean>;

  /**
   * Global chunking strategy for all files (Pattern 1 only)
   *
   * Applied to all files in `file_ids` array.
   * Ignored if using `files` array (Pattern 2).
   *
   * **Auto Strategy:**
   * ```typescript
   * { type: 'auto' }
   * ```
   *
   * **Static Strategy:**
   * ```typescript
   * {
   *   type: 'static',
   *   static: {
   *     max_chunk_size_tokens: 800,
   *     chunk_overlap_tokens: 400
   *   }
   * }
   * ```
   *
   * @default Uses vector store's default chunking_strategy
   */
  @ApiPropertyOptional({
    description:
      'Global chunking strategy for all files in file_ids array.\n' +
      'Only used with Pattern 1 (file_ids). Ignored with Pattern 2 (files).',
    example: {
      type: 'static',
      static: { max_chunk_size_tokens: 800, chunk_overlap_tokens: 400 },
    },
  })
  @IsOptional()
  @IsChunkingStrategyValid()
  chunking_strategy?: VectorStores.FileChunkingStrategyParam;

  /**
   * Array of file configurations (Pattern 2: Individual configuration)
   *
   * Use this pattern when files need:
   * - Different attributes per file
   * - Different chunking strategies per file
   * - Fine-grained control
   *
   * **Mutually Exclusive with `file_ids` parameter.**
   *
   * **Each file object:**
   * ```typescript
   * {
   *   file_id: string,            // Required
   *   attributes?: {...},          // Optional per-file
   *   chunking_strategy?: {...}    // Optional per-file
   * }
   * ```
   *
   * **Example:**
   * ```typescript
   * [
   *   {
   *     file_id: 'file-abc',
   *     attributes: { priority: 'high', type: 'api' },
   *     chunking_strategy: { type: 'static', static: { max_chunk_size_tokens: 1200, chunk_overlap_tokens: 600 } }
   *   },
   *   {
   *     file_id: 'file-def',
   *     attributes: { priority: 'low', type: 'faq' },
   *     chunking_strategy: { type: 'auto' }
   *   }
   * ]
   * ```
   *
   * @example [{ file_id: 'file-abc', attributes: { priority: 'high' } }]
   */
  @ApiPropertyOptional({
    description:
      'Array of file configurations with individual settings.\n' +
      'Mutually exclusive with "file_ids" parameter.\n' +
      'Max 500 files. Each file can have unique attributes/chunking.',
    type: [BatchFileConfigDto],
    example: [
      {
        file_id: 'file-abc123',
        attributes: { priority: 'high' },
        chunking_strategy: { type: 'auto' },
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchFileConfigDto)
  files?: BatchFileConfigDto[];
}
