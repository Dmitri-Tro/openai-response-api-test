import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Validator constraint for prompt parameter configuration
 *
 * Validates:
 * - id: required string starting with "pmpt_"
 * - variables: optional object with string or complex type values
 * - version: optional string
 *
 * @see {@link https://platform.openai.com/docs/api-reference/responses#prompt-templates}
 */
@ValidatorConstraint({ async: false })
export class IsPromptValidConstraint implements ValidatorConstraintInterface {
  validate(prompt: unknown): boolean {
    // null and undefined are valid (handled by @IsOptional())
    if (prompt === null || prompt === undefined) {
      return true;
    }

    // Must be an object
    if (typeof prompt !== 'object' || prompt === null) {
      return false;
    }

    const promptObj = prompt as Record<string, unknown>;

    // Validate required 'id' field
    if (!('id' in promptObj) || !this.validateId(promptObj.id)) {
      return false;
    }

    // Validate optional 'variables' field
    if (
      'variables' in promptObj &&
      promptObj.variables !== undefined &&
      promptObj.variables !== null &&
      !this.validateVariables(promptObj.variables)
    ) {
      return false;
    }

    // Validate optional 'version' field
    if (
      'version' in promptObj &&
      promptObj.version !== undefined &&
      promptObj.version !== null &&
      !this.validateVersion(promptObj.version)
    ) {
      return false;
    }

    return true;
  }

  /**
   * Validate prompt ID format
   * Must be a non-empty string starting with "pmpt_"
   */
  private validateId(id: unknown): boolean {
    if (typeof id !== 'string') {
      return false;
    }

    // Must start with "pmpt_"
    if (!id.startsWith('pmpt_')) {
      return false;
    }

    // Must have content after "pmpt_" prefix
    if (id.length <= 5) {
      return false;
    }

    return true;
  }

  /**
   * Validate variables object structure
   * Can contain string values or complex objects (ResponseInputText, ResponseInputImage, ResponseInputFile)
   */
  private validateVariables(variables: unknown): boolean {
    // Must be an object
    if (typeof variables !== 'object' || variables === null) {
      return false;
    }

    const variablesObj = variables as Record<string, unknown>;

    // Each variable value must be either a string or a valid input object
    for (const [key, value] of Object.entries(variablesObj)) {
      // Key must be a non-empty string
      if (typeof key !== 'string' || key.length === 0) {
        return false;
      }

      // Value can be:
      // 1. A string
      // 2. A ResponseInputText object
      // 3. A ResponseInputImage object
      // 4. A ResponseInputFile object
      if (typeof value === 'string') {
        continue; // String values are valid
      }

      // If not a string, must be an object with a 'type' field
      if (typeof value !== 'object' || value === null) {
        return false;
      }

      const valueObj = value as Record<string, unknown>;

      // Must have a 'type' field
      if (!('type' in valueObj)) {
        return false;
      }

      const type = valueObj.type;

      // Validate based on type
      if (type === 'input_text') {
        if (!this.validateInputText(valueObj)) {
          return false;
        }
      } else if (type === 'input_image') {
        if (!this.validateInputImage(valueObj)) {
          return false;
        }
      } else if (type === 'input_file') {
        if (!this.validateInputFile(valueObj)) {
          return false;
        }
      } else {
        // Unknown type
        return false;
      }
    }

    return true;
  }

  /**
   * Validate ResponseInputText object
   * Must have: type='input_text', text (string)
   */
  private validateInputText(obj: Record<string, unknown>): boolean {
    return 'text' in obj && typeof obj.text === 'string' && obj.text.length > 0;
  }

  /**
   * Validate ResponseInputImage object
   * Must have: type='input_image', detail
   * Must have at least one of: image_url, image_data
   */
  private validateInputImage(obj: Record<string, unknown>): boolean {
    // detail is required
    if (
      !('detail' in obj) ||
      !['low', 'high', 'auto'].includes(obj.detail as string)
    ) {
      return false;
    }

    // Must have either image_url or image_data
    const hasImageUrl = 'image_url' in obj && typeof obj.image_url === 'string';
    const hasImageData =
      'image_data' in obj && typeof obj.image_data === 'string';

    return hasImageUrl || hasImageData;
  }

  /**
   * Validate ResponseInputFile object
   * Must have: type='input_file'
   * Must have at least one of: file_id, file_data
   */
  private validateInputFile(obj: Record<string, unknown>): boolean {
    // Must have either file_id or file_data
    const hasFileId = 'file_id' in obj && typeof obj.file_id === 'string';
    const hasFileData = 'file_data' in obj && typeof obj.file_data === 'string';

    if (!hasFileId && !hasFileData) {
      return false;
    }

    // If file_id is provided, validate format (must start with "file-")
    if (hasFileId && obj.file_id) {
      const fileId = obj.file_id as string;
      if (!fileId.startsWith('file-') || fileId.length <= 5) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate version field
   * Must be a non-empty string
   */
  private validateVersion(version: unknown): boolean {
    return typeof version === 'string' && version.length > 0;
  }

  defaultMessage(): string {
    return 'Invalid prompt configuration. Prompt must have a valid id (pmpt_*), optional variables object, and optional version string.';
  }
}

/**
 * Decorator for validating prompt parameter
 *
 * @example
 * ```typescript
 * @IsPromptValid()
 * prompt?: Responses.ResponsePrompt | null;
 * ```
 */
export function IsPromptValid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsPromptValidConstraint,
    });
  };
}
