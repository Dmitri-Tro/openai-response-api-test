import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Validator constraint for file_search tool configuration
 *
 * Validates:
 * - vector_store_ids: non-empty array of strings starting with "vs_"
 * - max_num_results: number between 1-50 (optional)
 * - ranking_options.ranker: 'auto' | 'default-2024-11-15' (optional)
 * - ranking_options.score_threshold: number between 0-1 (optional)
 */
@ValidatorConstraint({ async: false })
export class IsFileSearchToolConstraint
  implements ValidatorConstraintInterface
{
  validate(tools: unknown): boolean {
    if (!Array.isArray(tools)) {
      return true; // Let @IsArray() handle this
    }

    for (const tool of tools) {
      if (
        typeof tool === 'object' &&
        tool !== null &&
        'type' in tool &&
        // Type assertion: narrow unknown to check discriminator field
        (tool as { type: unknown }).type === 'file_search'
      ) {
        // Type assertion: treat as record for dynamic property access during validation
        const fileSearchTool = tool as Record<string, unknown>;

        // Validate vector_store_ids
        if (
          !('vector_store_ids' in fileSearchTool) ||
          !this.validateVectorStoreIds(fileSearchTool.vector_store_ids)
        ) {
          return false;
        }

        // Validate max_num_results
        if (
          'max_num_results' in fileSearchTool &&
          fileSearchTool.max_num_results !== undefined &&
          !this.validateMaxNumResults(fileSearchTool.max_num_results)
        ) {
          return false;
        }

        // Validate ranking_options
        if (
          'ranking_options' in fileSearchTool &&
          fileSearchTool.ranking_options !== undefined &&
          !this.validateRankingOptions(fileSearchTool.ranking_options)
        ) {
          return false;
        }
      }
    }

    return true;
  }

  private validateVectorStoreIds(vectorStoreIds: unknown): boolean {
    // Must be an array
    if (!Array.isArray(vectorStoreIds)) {
      return false;
    }

    // Must not be empty
    if (vectorStoreIds.length === 0) {
      return false;
    }

    // Each ID must be a string starting with "vs_"
    for (const id of vectorStoreIds) {
      if (typeof id !== 'string' || !id.startsWith('vs_')) {
        return false;
      }
    }

    return true;
  }

  private validateMaxNumResults(maxNumResults: unknown): boolean {
    // Must be a number
    if (typeof maxNumResults !== 'number') {
      return false;
    }

    // Must be between 1 and 50
    if (maxNumResults < 1 || maxNumResults > 50) {
      return false;
    }

    // Must be an integer
    if (!Number.isInteger(maxNumResults)) {
      return false;
    }

    return true;
  }

  private validateRankingOptions(rankingOptions: unknown): boolean {
    // Must be an object
    if (typeof rankingOptions !== 'object' || rankingOptions === null) {
      return false;
    }

    const options = rankingOptions as Record<string, unknown>;

    // Validate ranker if present
    if (options.ranker !== undefined) {
      if (
        typeof options.ranker !== 'string' ||
        (options.ranker !== 'auto' && options.ranker !== 'default-2024-11-15')
      ) {
        return false;
      }
    }

    // Validate score_threshold if present
    if (options.score_threshold !== undefined) {
      if (typeof options.score_threshold !== 'number') {
        return false;
      }
      if (options.score_threshold < 0 || options.score_threshold > 1) {
        return false;
      }
    }

    return true;
  }

  defaultMessage(): string {
    return `Invalid file_search tool configuration. Requirements:
      - vector_store_ids: must be non-empty array of strings starting with "vs_"
      - max_num_results: must be integer between 1-50 (optional)
      - ranking_options.ranker: must be "auto" or "default-2024-11-15" (optional)
      - ranking_options.score_threshold: must be number between 0-1 (optional)`;
  }
}

/**
 * Decorator for validating file_search tool configuration
 *
 * Usage:
 * ```typescript
 * @IsArray()
 * @IsOptional()
 * @IsFileSearchToolValid()
 * tools?: FileSearchToolConfig[];
 * ```
 */
export function IsFileSearchToolValid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsFileSearchToolConstraint,
    });
  };
}
