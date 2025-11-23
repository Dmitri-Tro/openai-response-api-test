import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

/**
 * Validator constraint for image model-size compatibility
 *
 * Validates that the chosen image size is compatible with the chosen model.
 *
 * **gpt-image-1 Supported Sizes**:
 * - 1024x1024 (square)
 * - 1024x1536 (portrait)
 * - 1536x1024 (landscape)
 * - auto (automatically determined)
 *
 * **DALL-E 3 Supported Sizes**:
 * - 1024x1024 (square)
 * - 1792x1024 (landscape)
 * - 1024x1792 (portrait)
 *
 * **DALL-E 2 Supported Sizes**:
 * - 256x256 (small)
 * - 512x512 (medium)
 * - 1024x1024 (large)
 *
 * **Validation Logic**:
 * - If model is 'gpt-image-1' and size is not in [1024x1024, 1024x1536, 1536x1024, auto] → Invalid
 * - If model is 'dall-e-3' and size is 256x256 or 512x512 → Invalid
 * - If model is 'dall-e-2' and size is 1792x1024 or 1024x1792 → Invalid
 * - If model is not specified, assume dall-e-2 (default)
 *
 * @example
 * ```typescript
 * // Valid combinations
 * { model: 'gpt-image-1', size: 'auto' }    // ✓
 * { model: 'gpt-image-1', size: '1024x1536' } // ✓
 * { model: 'dall-e-3', size: '1024x1024' } // ✓
 * { model: 'dall-e-3', size: '1792x1024' } // ✓
 * { model: 'dall-e-2', size: '512x512' }   // ✓
 *
 * // Invalid combinations
 * { model: 'gpt-image-1', size: '256x256' }   // ✗
 * { model: 'dall-e-3', size: '256x256' }   // ✗
 * { model: 'dall-e-2', size: '1792x1024' } // ✗
 * ```
 */
@ValidatorConstraint({ async: false })
export class IsImageModelSizeValidConstraint
  implements ValidatorConstraintInterface
{
  validate(size: unknown, args: ValidationArguments): boolean {
    // Get the object being validated
    const object = args.object as Record<string, unknown>;
    const model = (object.model as string) || 'dall-e-2'; // Default to dall-e-2

    // Size must be a string
    if (typeof size !== 'string') {
      return true; // Let @IsString() handle this
    }

    // gpt-image-1 size validation
    if (model === 'gpt-image-1') {
      const validGptImage1Sizes = [
        '1024x1024',
        '1024x1536',
        '1536x1024',
        'auto',
      ];
      return validGptImage1Sizes.includes(size);
    }

    // DALL-E 3 size validation
    if (model === 'dall-e-3') {
      const validDalle3Sizes = ['1024x1024', '1792x1024', '1024x1792'];
      return validDalle3Sizes.includes(size);
    }

    // DALL-E 2 size validation
    if (model === 'dall-e-2') {
      const validDalle2Sizes = ['256x256', '512x512', '1024x1024'];
      return validDalle2Sizes.includes(size);
    }

    // Unknown model - let enum validation handle it
    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    const object = args.object as Record<string, unknown>;
    const model = (object.model as string) || 'dall-e-2';
    const size = args.value as string;

    if (model === 'gpt-image-1') {
      return `Size '${size}' is not supported for gpt-image-1. Valid sizes: 1024x1024, 1024x1536, 1536x1024, auto`;
    }

    if (model === 'dall-e-3') {
      return `Size '${size}' is not supported for DALL-E 3. Valid sizes: 1024x1024, 1792x1024, 1024x1792`;
    }

    if (model === 'dall-e-2') {
      return `Size '${size}' is not supported for DALL-E 2. Valid sizes: 256x256, 512x512, 1024x1024`;
    }

    return `Invalid model-size combination: model='${model}', size='${size}'`;
  }
}

/**
 * Decorator to validate image model-size compatibility
 *
 * Ensures that the `size` field is compatible with the `model` field in the same DTO.
 *
 * **Usage in DTO**:
 * ```typescript
 * export class CreateImagesDto {
 *   @IsEnum(['dall-e-2', 'dall-e-3'])
 *   model?: 'dall-e-2' | 'dall-e-3' = 'dall-e-2';
 *
 *   @IsImageModelSizeValid()
 *   size?: string = '1024x1024';
 * }
 * ```
 *
 * @param validationOptions - Optional class-validator options
 */
export function IsImageModelSizeValid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsImageModelSizeValidConstraint,
    });
  };
}
