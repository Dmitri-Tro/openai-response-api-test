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

/**
 * Helper function to validate chunking strategy configuration
 *
 * Use this as a standalone validator in controllers or services.
 *
 * @param chunkingStrategy - Chunking strategy object to validate
 * @returns True if chunking strategy is valid, false otherwise
 *
 * @example
 * ```typescript
 * // In a service
 * if (!validateChunkingStrategy(dto.chunking_strategy)) {
 *   throw new BadRequestException(
 *     getChunkingStrategyErrorMessage(dto.chunking_strategy)
 *   );
 * }
 * ```
 */
export function validateChunkingStrategy(chunkingStrategy: unknown): boolean {
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

    const staticConfig = strategy.static;

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

  // Invalid type
  return false;
}

/**
 * Helper function to get detailed error message for chunking strategy validation
 *
 * @param chunkingStrategy - Chunking strategy object that failed validation
 * @returns Detailed error message
 *
 * @example
 * ```typescript
 * if (!validateChunkingStrategy(strategy)) {
 *   const errorMessage = getChunkingStrategyErrorMessage(strategy);
 *   throw new BadRequestException(errorMessage);
 * }
 * ```
 */
export function getChunkingStrategyErrorMessage(
  chunkingStrategy: unknown,
): string {
  // Handle undefined (should be valid, but if called, provide message)
  if (chunkingStrategy === undefined) {
    return 'Chunking strategy is optional and can be undefined';
  }

  // Handle non-object
  if (typeof chunkingStrategy !== 'object' || chunkingStrategy === null) {
    return `Chunking strategy must be an object. Received: ${typeof chunkingStrategy}`;
  }

  const strategy = chunkingStrategy as Record<string, unknown>;

  // Handle missing type
  if (!('type' in strategy)) {
    return `Chunking strategy must have a 'type' field. Received: ${Object.keys(strategy).join(', ')}`;
  }

  // Handle invalid type value
  if (typeof strategy.type !== 'string') {
    return `Chunking strategy 'type' must be a string. Received: ${typeof strategy.type}`;
  }

  // Handle invalid type enum
  if (strategy.type !== 'auto' && strategy.type !== 'static') {
    return `Invalid chunking strategy type '${strategy.type}'. Valid types: 'auto', 'static'`;
  }

  // Validate auto type
  if (strategy.type === 'auto') {
    if (Object.keys(strategy).length !== 1) {
      return `Auto chunking strategy should only have 'type' field. Received additional fields: ${Object.keys(
        strategy,
      )
        .filter((k) => k !== 'type')
        .join(', ')}`;
    }
  }

  // Validate static type
  if (strategy.type === 'static') {
    if (!('static' in strategy)) {
      return `Static chunking strategy must have 'static' configuration object`;
    }

    const staticConfig = strategy.static;

    if (typeof staticConfig !== 'object' || staticConfig === null) {
      return `Static configuration must be an object. Received: ${typeof staticConfig}`;
    }

    const config = staticConfig as Record<string, unknown>;

    // Check required fields
    if (!('max_chunk_size_tokens' in config)) {
      return `Static configuration missing required field: 'max_chunk_size_tokens'`;
    }

    if (!('chunk_overlap_tokens' in config)) {
      return `Static configuration missing required field: 'chunk_overlap_tokens'`;
    }

    // Validate max_chunk_size_tokens
    const maxChunkSize = config.max_chunk_size_tokens;
    if (typeof maxChunkSize !== 'number') {
      return `max_chunk_size_tokens must be a number. Received: ${typeof maxChunkSize}`;
    }
    if (!Number.isInteger(maxChunkSize)) {
      return `max_chunk_size_tokens must be an integer. Received: ${maxChunkSize}`;
    }
    if (maxChunkSize < 100 || maxChunkSize > 4096) {
      return `max_chunk_size_tokens must be between 100 and 4096. Received: ${maxChunkSize}`;
    }

    // Validate chunk_overlap_tokens
    const chunkOverlap = config.chunk_overlap_tokens;
    if (typeof chunkOverlap !== 'number') {
      return `chunk_overlap_tokens must be a number. Received: ${typeof chunkOverlap}`;
    }
    if (!Number.isInteger(chunkOverlap)) {
      return `chunk_overlap_tokens must be an integer. Received: ${chunkOverlap}`;
    }
    if (chunkOverlap < 0) {
      return `chunk_overlap_tokens must be non-negative. Received: ${chunkOverlap}`;
    }

    // Validate overlap constraint
    if (chunkOverlap > maxChunkSize / 2) {
      return `chunk_overlap_tokens (${chunkOverlap}) cannot exceed half of max_chunk_size_tokens (${maxChunkSize / 2})`;
    }
  }

  return `Invalid chunking strategy configuration. Requirements:
    - type: must be 'auto' or 'static'
    - For 'auto': only { type: 'auto' } is valid
    - For 'static':
      - max_chunk_size_tokens: integer between 100-4096
      - chunk_overlap_tokens: integer, max {max_chunk_size_tokens / 2}`;
}

/**
 * Validate chunking strategy parameters with error throwing
 *
 * This function matches the signature of the service layer's validateChunkingParameters method.
 * It validates static chunking configuration and throws errors for invalid parameters.
 *
 * @param strategy - Chunking strategy to validate
 * @returns true if valid
 * @throws Error if invalid
 *
 * @example
 * ```typescript
 * // In a service
 * validateChunkingParametersOrThrow({
 *   type: 'static',
 *   static: {
 *     max_chunk_size_tokens: 800,
 *     chunk_overlap_tokens: 400,
 *   },
 * });
 * ```
 */
export function validateChunkingParametersOrThrow(
  strategy: Record<string, unknown>,
): boolean {
  if (strategy.type === 'static' && 'static' in strategy) {
    const staticConfig = strategy.static as Record<string, unknown>;
    const maxTokens = staticConfig.max_chunk_size_tokens as number;
    const overlapTokens = staticConfig.chunk_overlap_tokens as number;

    if (maxTokens < 100 || maxTokens > 4096) {
      throw new Error('max_chunk_size_tokens must be between 100 and 4096');
    }

    if (overlapTokens > maxTokens / 2) {
      throw new Error(
        'chunk_overlap_tokens cannot exceed half of max_chunk_size_tokens',
      );
    }
  }

  return true;
}
