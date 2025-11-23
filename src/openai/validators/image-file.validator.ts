import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Validator constraint for uploaded image files
 *
 * Validates image files uploaded for edit and variation operations.
 *
 * **Validation Rules**:
 * - **Format**: PNG, JPEG, or WEBP
 * - **Size**: Less than 4MB (for DALL-E 2)
 * - **MIME Types**: image/png, image/jpeg, image/webp
 *
 * **Note**: Dimension validation (square images) is handled server-side by OpenAI
 *
 * @example
 * ```typescript
 * // Valid files
 * { mimetype: 'image/png', size: 2097152 }      // 2MB PNG ✓
 * { mimetype: 'image/jpeg', size: 3145728 }     // 3MB JPEG ✓
 * { mimetype: 'image/webp', size: 1048576 }     // 1MB WEBP ✓
 *
 * // Invalid files
 * { mimetype: 'image/gif', size: 1048576 }      // GIF not supported ✗
 * { mimetype: 'image/png', size: 5242880 }      // 5MB too large ✗
 * ```
 */
@ValidatorConstraint({ async: false })
export class IsImageFileValidConstraint
  implements ValidatorConstraintInterface
{
  private readonly MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB in bytes
  private readonly VALID_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

  validate(file: unknown): boolean {
    // File is optional in some cases (mask parameter)
    if (file === undefined || file === null) {
      return true;
    }

    // Check if file object has expected properties
    if (
      typeof file !== 'object' ||
      !('mimetype' in file) ||
      !('size' in file)
    ) {
      return false;
    }

    const imageFile = file as { mimetype: unknown; size: unknown };

    // Validate mimetype is a string
    if (typeof imageFile.mimetype !== 'string') {
      return false;
    }

    // Validate size is a number
    if (typeof imageFile.size !== 'number') {
      return false;
    }

    // Validate size is positive (reject zero and negative)
    if (imageFile.size <= 0) {
      return false;
    }

    // Validate file format
    if (!this.VALID_MIME_TYPES.includes(imageFile.mimetype)) {
      return false;
    }

    // Validate file size (4MB max for DALL-E 2)
    if (imageFile.size > this.MAX_FILE_SIZE) {
      return false;
    }

    return true;
  }

  defaultMessage(): string {
    return 'Image file must be PNG, JPEG, or WEBP format and less than 4MB in size';
  }
}

/**
 * Decorator to validate uploaded image files
 *
 * Validates that uploaded files meet OpenAI's requirements for image editing and variations.
 *
 * **Usage in Controller**:
 * ```typescript
 * @Post('edit')
 * @UseInterceptors(FileInterceptor('image'))
 * async editImage(
 *   @UploadedFile() @IsImageFileValid() image: Express.Multer.File,
 *   @Body() dto: EditImageDto,
 * ) {
 *   // ...
 * }
 * ```
 *
 * **Usage with Multiple Files**:
 * ```typescript
 * @Post('edit')
 * @UseInterceptors(FileFieldsInterceptor([
 *   { name: 'image', maxCount: 1 },
 *   { name: 'mask', maxCount: 1 },
 * ]))
 * async editImage(
 *   @UploadedFiles() files: {
 *     image?: Express.Multer.File[];
 *     mask?: Express.Multer.File[];
 *   },
 * ) {
 *   // Validation handled by validator
 * }
 * ```
 *
 * @param validationOptions - Optional class-validator options
 */
export function IsImageFileValid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsImageFileValidConstraint,
    });
  };
}

/**
 * Type guard to check if file is a valid Multer file
 *
 * @param file - Unknown file object
 * @returns True if file has Multer file properties
 *
 * @example
 * ```typescript
 * if (isMulterFile(file)) {
 *   console.log(file.mimetype, file.size, file.buffer);
 * }
 * ```
 */
export function isMulterFile(file: unknown): file is Express.Multer.File {
  return (
    typeof file === 'object' &&
    file !== null &&
    'mimetype' in file &&
    'size' in file &&
    'buffer' in file &&
    'originalname' in file &&
    typeof (file as Record<string, unknown>).mimetype === 'string' &&
    typeof (file as Record<string, unknown>).size === 'number'
  );
}
