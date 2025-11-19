import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Validator constraint for code_interpreter tool configuration
 *
 * Validates:
 * - container.type: must be 'auto' (only supported value)
 * - container.file_ids: array of strings starting with "file-" (optional)
 *
 * Note: container is optional - if omitted, OpenAI manages container lifecycle automatically
 */
@ValidatorConstraint({ async: false })
export class IsCodeInterpreterToolConstraint
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
        (tool as { type: unknown }).type === 'code_interpreter'
      ) {
        // Type assertion: treat as record for dynamic property access during validation
        const codeInterpreterTool = tool as Record<string, unknown>;

        // Container is optional, but if present must be valid
        if (
          'container' in codeInterpreterTool &&
          codeInterpreterTool.container !== undefined
        ) {
          if (!this.validateContainer(codeInterpreterTool.container)) {
            return false;
          }
        }
      }
    }

    return true;
  }

  private validateContainer(container: unknown): boolean {
    // Container can be a string (container ID) or an object (auto configuration)

    // If string, validate it's a container ID
    if (typeof container === 'string') {
      // Container IDs should start with "container_" (OpenAI format)
      // But we'll be lenient and accept any non-empty string
      return container.length > 0;
    }

    // If not string, must be an object
    if (typeof container !== 'object' || container === null) {
      return false;
    }

    const containerObj = container as Record<string, unknown>;

    // Validate container.type (required field in container object)
    if (
      !('type' in containerObj) ||
      !this.validateContainerType(containerObj.type)
    ) {
      return false;
    }

    // Validate container.file_ids (optional)
    if (
      'file_ids' in containerObj &&
      containerObj.file_ids !== undefined &&
      !this.validateFileIds(containerObj.file_ids)
    ) {
      return false;
    }

    return true;
  }

  private validateContainerType(type: unknown): boolean {
    // Must be the string 'auto' (only supported value per OpenAI API)
    return type === 'auto';
  }

  private validateFileIds(fileIds: unknown): boolean {
    // Must be an array
    if (!Array.isArray(fileIds)) {
      return false;
    }

    // Cannot be empty array (omit instead if no files)
    if (fileIds.length === 0) {
      return false;
    }

    // Each file_id must be a string starting with "file-"
    // Format: "file-" followed by 24 alphanumeric characters
    for (const fileId of fileIds) {
      if (typeof fileId !== 'string') {
        return false;
      }

      // Must start with "file-" and have at least one character after prefix
      if (!fileId.startsWith('file-') || fileId.length <= 5) {
        return false;
      }

      // Validate full format (optional strict validation)
      // Some implementations may use different lengths, so we just check prefix
      // Uncomment below for strict 24-character validation:
      // if (!fileIdPattern.test(fileId)) {
      //   return false;
      // }
    }

    return true;
  }

  defaultMessage(): string {
    return `Invalid code_interpreter tool configuration. Requirements:
      - container: optional string (container ID) or object (auto configuration)
      - container (string): non-empty string, preferably starting with "container_"
      - container (object).type: must be "auto" (required if container is object)
      - container (object).file_ids: must be non-empty array of strings starting with "file-" (optional)

      Examples:
      - { type: "code_interpreter" }
      - { type: "code_interpreter", container: "container_abc123" }
      - { type: "code_interpreter", container: { type: "auto", file_ids: ["file-abc123..."] } }`;
  }
}

/**
 * Decorator for validating code_interpreter tool configuration
 *
 * Usage:
 * ```typescript
 * @IsArray()
 * @IsOptional()
 * @IsCodeInterpreterToolValid()
 * tools?: CodeInterpreterToolConfig[];
 * ```
 */
export function IsCodeInterpreterToolValid(
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsCodeInterpreterToolConstraint,
    });
  };
}
