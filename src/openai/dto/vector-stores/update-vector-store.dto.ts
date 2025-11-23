import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type * as Shared from 'openai/resources/shared';
import { IsMetadataValid } from '../../validators/metadata.validator';
import { ExpiresAfterDto } from './create-vector-store.dto';

/**
 * Data Transfer Object for updating vector stores
 *
 * Allows modification of vector store properties after creation.
 * Only specified fields will be updated (partial update).
 *
 * **Updatable Fields:**
 * - `name` - Change human-readable name
 * - `expires_after` - Modify or remove expiration policy
 * - `metadata` - Replace metadata (not merged, full replacement)
 *
 * **Important Notes:**
 * - Cannot modify: file_ids, chunking_strategy (set at creation)
 * - To change files: use add/remove file endpoints
 * - Setting field to `null` removes that configuration
 * - Metadata is replaced entirely, not merged
 *
 * **Null Values:**
 * - `name: null` - Removes name
 * - `expires_after: null` - Disables expiration
 * - `metadata: null` - Removes all metadata
 *
 * @see {@link https://platform.openai.com/docs/api-reference/vector-stores/update}
 */
export class UpdateVectorStoreDto {
  /**
   * Updated name for the vector store
   *
   * Set to null to remove the name.
   *
   * @example 'Updated Documentation Store'
   */
  @ApiPropertyOptional({
    description: 'Updated name for vector store. Set to null to remove name.',
    example: 'Updated Product Documentation',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  name?: string | null;

  /**
   * Updated expiration policy
   *
   * Modify the automatic deletion configuration.
   * Set to null to disable expiration entirely.
   *
   * **Configuration:**
   * - anchor: 'last_active_at' (only supported value)
   * - days: 1-365 (days after last activity)
   *
   * **Use Cases:**
   * - Extend expiration: Increase days value
   * - Shorten expiration: Decrease days value
   * - Disable expiration: Set to null
   * - Enable expiration: Provide new policy
   *
   * @example { anchor: 'last_active_at', days: 30 }
   */
  @ApiPropertyOptional({
    description:
      'Updated expiration policy.\n' +
      '  - Provide new policy: { anchor: "last_active_at", days: 1-365 }\n' +
      '  - Disable expiration: null\n' +
      '\n' +
      'Changes when vector store will be automatically deleted.',
    type: ExpiresAfterDto,
    nullable: true,
    example: {
      anchor: 'last_active_at',
      days: 30,
    },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExpiresAfterDto)
  expires_after?: ExpiresAfterDto | null;

  /**
   * Updated metadata for the vector store
   *
   * **Important:** Metadata is REPLACED, not merged.
   * To modify a single key, include all existing keys.
   *
   * **Constraints:**
   * - Maximum: 16 key-value pairs
   * - Keys: max 64 characters
   * - Values: max 512 characters (strings only)
   *
   * **Examples:**
   * - Replace all: `{ new_key: 'new_value' }`
   * - Remove all: `null`
   * - Preserve existing: Include all current pairs + changes
   *
   * @example { category: 'documentation', version: '3.0', updated_at: '2025-01-15' }
   */
  @ApiPropertyOptional({
    description:
      'Updated metadata (REPLACES existing, not merged).\n' +
      '  - Provide object: Replace all metadata\n' +
      '  - Set to null: Remove all metadata\n' +
      '\n' +
      'Constraints: Max 16 pairs, keys max 64 chars, values max 512 chars.',
    nullable: true,
    example: { category: 'documentation', version: '3.0' },
  })
  @IsOptional()
  @IsMetadataValid()
  metadata?: Shared.Metadata | null;
}
