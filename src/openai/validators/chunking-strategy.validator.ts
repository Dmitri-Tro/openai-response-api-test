import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Validator constraint for chunking strategy configuration
 *
 * Validates:
 * - type: 'auto' | 'static'
 * - static.max_chunk_size_tokens: 100-4096 (required for static)
 * - static.chunk_overlap_tokens: <= max_chunk_size_tokens / 2 (required for static)
 */
@ValidatorConstraint({ async: false })
export class IsChunkingStrategyConstraint
  implements ValidatorConstraintInterface
{
  validate(chunkingStrategy: unknown): boolean {
    // Optional field - undefined is valid
    if (chunkingStrategy === undefined) {
      return true;
    }

    // Must be an object
    if (typeof chunkingStrategy !== 'object' || chunkingStrategy === null) {
      return false;
    }

    const strategy = chunkingStrategy as Record<string, unknown>;

    // Must have 'type' field
    if (!('type' in strategy) || typeof strategy.type !== 'string') {
      return false;
    }

    // Validate based on type
    if (strategy.type === 'auto') {
      // Auto strategy: only 'type' field allowed
      return Object.keys(strategy).length === 1;
    } else if (strategy.type === 'static') {
      // Static strategy: must have 'static' field
      if (!('static' in strategy)) {
        return false;
      }
      return this.validateStaticConfig(strategy.static);
    }

    // Invalid type
    return false;
  }

  private validateStaticConfig(staticConfig: unknown): boolean {
    // Must be an object
    if (typeof staticConfig !== 'object' || staticConfig === null) {
      return false;
    }

    const config = staticConfig as Record<string, unknown>;

    // Must have both required fields
    if (
      !('max_chunk_size_tokens' in config) ||
      !('chunk_overlap_tokens' in config)
    ) {
      return false;
    }

    // Validate max_chunk_size_tokens
    const maxChunkSize = config.max_chunk_size_tokens;
    if (typeof maxChunkSize !== 'number') {
      return false;
    }
    if (!Number.isInteger(maxChunkSize)) {
      return false;
    }
    if (maxChunkSize < 100 || maxChunkSize > 4096) {
      return false;
    }

    // Validate chunk_overlap_tokens
    const chunkOverlap = config.chunk_overlap_tokens;
    if (typeof chunkOverlap !== 'number') {
      return false;
    }
    if (!Number.isInteger(chunkOverlap)) {
      return false;
    }
    if (chunkOverlap < 0) {
      return false;
    }

    // Overlap must not exceed half of max chunk size
    if (chunkOverlap > maxChunkSize / 2) {
      return false;
    }

    return true;
  }

  defaultMessage(): string {
    return `Invalid chunking strategy configuration. Requirements:
      - type: must be 'auto' or 'static'
      - For 'auto': only { type: 'auto' } is valid
      - For 'static':
        - max_chunk_size_tokens: integer between 100-4096
        - chunk_overlap_tokens: integer, max ${'{'}max_chunk_size_tokens / 2${'}'}`;
  }
}

/**
 * Decorator for validating chunking strategy configuration
 *
 * Usage:
 * ```typescript
 * @IsOptional()
 * @IsChunkingStrategyValid()
 * chunking_strategy?: ChunkingStrategy;
 * ```
 */
export function IsChunkingStrategyValid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsChunkingStrategyConstraint,
    });
  };
}
