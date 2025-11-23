import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

/**
 * Allowed MIME types by file purpose
 *
 * **Purpose-Specific Formats:**
 *
 * **assistants** (Documents for file_search):
 * - Documents: PDF, TXT, DOCX, MD, HTML
 * - Code: JS, TS, PY, JAVA, C, CPP
 * - Data: JSON, JSONL, CSV, XML
 *
 * **vision** (Images for vision models):
 * - Images: PNG, JPEG, JPG, GIF, WEBP
 *
 * **batch** (Batch API input):
 * - JSONL only
 *
 * **fine-tune** (Training data):
 * - JSONL only (strict format)
 *
 * **user_data** (General purpose):
 * - Wide variety: All assistants formats + Excel (XLS, XLSX)
 *
 * **evals** (Evaluation datasets):
 * - JSONL only
 */
export const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  assistants: [
    // Documents
    'application/pdf',
    'text/plain',
    'text/markdown',
    'text/html',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    // Code
    'application/javascript',
    'application/typescript',
    'text/x-python',
    'text/x-java',
    'text/x-c',
    'text/x-c++',
    // Data
    'application/json',
    'application/jsonl',
    'text/csv',
    'application/xml',
    'text/xml',
  ],
  vision: [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
  ],
  batch: ['application/jsonl'],
  'fine-tune': ['application/jsonl'],
  user_data: [
    // All assistants formats
    'application/pdf',
    'text/plain',
    'text/markdown',
    'text/html',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/javascript',
    'application/typescript',
    'text/x-python',
    'text/x-java',
    'text/x-c',
    'text/x-c++',
    'application/json',
    'application/jsonl',
    'text/csv',
    'application/xml',
    'text/xml',
    // Additional formats
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // Binary formats
    'application/octet-stream',
  ],
  evals: ['application/jsonl'],
};

/**
 * File extension to MIME type mapping
 *
 * Used for detecting MIME type from filename when Content-Type header is not available
 */
export const EXTENSION_TO_MIME: Record<string, string> = {
  // Documents
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  html: 'text/html',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Code
  js: 'application/javascript',
  ts: 'application/typescript',
  py: 'text/x-python',
  java: 'text/x-java',
  c: 'text/x-c',
  cpp: 'text/x-c++',
  // Data
  json: 'application/json',
  jsonl: 'application/jsonl',
  csv: 'text/csv',
  xml: 'application/xml',
  // Images
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  // Excel
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/**
 * Validator constraint for file type validation based on purpose
 *
 * Validates that a file's MIME type is compatible with its purpose.
 * This validator requires access to both the file type (MIME type or filename) and purpose.
 *
 * **Validation Rules:**
 * - File type must be a string (MIME type)
 * - File type must be in allowed list for the purpose
 * - Purpose must be valid
 *
 * **Format Requirements by Purpose:**
 *
 * **assistants** (file_search):
 * - Documents: PDF, TXT, DOCX, MD, HTML
 * - Code: JS, TS, PY, JAVA, C, CPP
 * - Data: JSON, JSONL, CSV, XML
 *
 * **vision** (vision models):
 * - Images: PNG, JPEG, GIF, WEBP
 *
 * **batch** (Batch API):
 * - JSONL only (one API request per line)
 *
 * **fine-tune** (fine-tuning):
 * - JSONL only (strict format with prompts/completions)
 *
 * **user_data** (code_interpreter):
 * - All assistants formats + Excel (XLS, XLSX)
 * - Binary formats (application/octet-stream)
 *
 * **evals** (evaluations):
 * - JSONL only
 *
 * @example
 * ```typescript
 * // Valid file types
 * { mimeType: 'application/pdf', purpose: 'assistants' }  // ✓ PDF for assistants
 * { mimeType: 'image/png', purpose: 'vision' }            // ✓ PNG for vision
 * { mimeType: 'application/jsonl', purpose: 'batch' }     // ✓ JSONL for batch
 *
 * // Invalid file types
 * { mimeType: 'image/png', purpose: 'batch' }            // ✗ Image not allowed for batch
 * { mimeType: 'application/pdf', purpose: 'vision' }     // ✗ PDF not allowed for vision
 * { mimeType: 'application/json', purpose: 'batch' }     // ✗ JSON not allowed (must be JSONL)
 * ```
 */
@ValidatorConstraint({ async: false })
export class IsFileTypeValidConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown, args: ValidationArguments): boolean {
    // Value must be a string (MIME type or filename)
    if (typeof value !== 'string') {
      return false;
    }

    // Get purpose from validation context
    const object = args.object as any;
    const purpose = object.purpose;

    // If no purpose, cannot validate file type
    if (!purpose || typeof purpose !== 'string') {
      return false;
    }

    // Check if purpose is valid
    if (!(purpose in ALLOWED_MIME_TYPES)) {
      return false;
    }

    // Normalize MIME type (handle filename or MIME type)
    const mimeType = this.normalizeMimeType(value);

    // Check if MIME type is allowed for this purpose
    const allowedTypes = ALLOWED_MIME_TYPES[purpose];
    return allowedTypes.includes(mimeType);
  }

  defaultMessage(args: ValidationArguments): string {
    const fileType = args.value;
    const object = args.object as any;
    const purpose = object.purpose;

    // Handle invalid file type
    if (typeof fileType !== 'string') {
      return `File type must be a string (MIME type or filename). Received: ${typeof fileType}`;
    }

    // Handle missing or invalid purpose
    if (!purpose || typeof purpose !== 'string') {
      return `Cannot validate file type without a valid purpose. Received purpose: ${purpose}`;
    }

    // Handle invalid purpose (not in allowed types map)
    if (!(purpose in ALLOWED_MIME_TYPES)) {
      return `Unknown file purpose "${purpose}". Cannot determine allowed file types. Valid purposes: assistants, vision, batch, fine-tune, user_data, evals`;
    }

    // File type not allowed for this purpose
    const mimeType = this.normalizeMimeType(fileType);
    const allowedTypes = ALLOWED_MIME_TYPES[purpose];

    return `File type "${mimeType}" is not allowed for purpose "${purpose}".

Allowed file types for "${purpose}":
${this.getFormattedAllowedTypes(purpose)}

Your file type: ${mimeType}

Common fixes:
${this.getCommonFixes(mimeType, purpose)}`;
  }

  /**
   * Normalize MIME type from filename or MIME type string
   * @param input - MIME type or filename
   * @returns Normalized MIME type
   */
  private normalizeMimeType(input: string): string {
    // If input looks like a MIME type (contains '/'), return as-is
    if (input.includes('/')) {
      return input.toLowerCase();
    }

    // Otherwise, treat as filename and extract extension
    const ext = input.split('.').pop()?.toLowerCase();
    if (ext && ext in EXTENSION_TO_MIME) {
      return EXTENSION_TO_MIME[ext];
    }

    // Default to input if we can't determine MIME type
    return input.toLowerCase();
  }

  /**
   * Get formatted list of allowed types for a purpose
   * @param purpose - File purpose
   * @returns Formatted string of allowed types
   */
  private getFormattedAllowedTypes(purpose: string): string {
    const allowedTypes = ALLOWED_MIME_TYPES[purpose];

    if (purpose === 'assistants') {
      return `  - Documents: PDF, TXT, DOCX, MD, HTML
  - Code: JS, TS, PY, JAVA, C, CPP
  - Data: JSON, JSONL, CSV, XML`;
    }

    if (purpose === 'vision') {
      return `  - Images: PNG, JPEG, GIF, WEBP`;
    }

    if (purpose === 'batch' || purpose === 'fine-tune' || purpose === 'evals') {
      return `  - JSONL only (${allowedTypes[0]})`;
    }

    if (purpose === 'user_data') {
      return `  - All assistants formats (PDF, TXT, DOCX, etc.)
  - Excel: XLS, XLSX
  - Binary formats (octet-stream)`;
    }

    return allowedTypes.map((type) => `  - ${type}`).join('\n');
  }

  /**
   * Get common fixes for file type issues
   * @param mimeType - Detected MIME type
   * @param purpose - File purpose
   * @returns Suggestions for fixing the issue
   */
  private getCommonFixes(mimeType: string, purpose: string): string {
    const fixes: string[] = [];

    // JSON vs JSONL confusion
    if (
      mimeType === 'application/json' &&
      ['batch', 'fine-tune', 'evals'].includes(purpose)
    ) {
      fixes.push(
        `  - Use JSONL format instead of JSON (one object per line, no array wrapper)`,
      );
      fixes.push(`  - Rename file extension from .json to .jsonl`);
    }

    // Image for non-vision purpose
    if (mimeType.startsWith('image/') && purpose !== 'vision') {
      fixes.push(`  - Change purpose to "vision" for image files`);
      fixes.push(
        `  - Or convert image to supported format for "${purpose}" purpose`,
      );
    }

    // PDF for vision
    if (mimeType === 'application/pdf' && purpose === 'vision') {
      fixes.push(`  - Change purpose to "assistants" for PDF files`);
      fixes.push(`  - Or extract images from PDF for vision analysis`);
    }

    // No specific fixes
    if (fixes.length === 0) {
      fixes.push(
        `  - Check that file format matches purpose requirements`,
      );
      fixes.push(`  - Consider using purpose "user_data" for general files`);
    }

    return fixes.join('\n');
  }
}

/**
 * Decorator for validating file type based on purpose
 *
 * This decorator validates that a file type (MIME type or filename) is allowed
 * for the file's purpose. It requires access to both the file type and purpose fields.
 *
 * **Usage Example:**
 * ```typescript
 * export class UploadValidationDto {
 *   @IsEnum(['assistants', 'vision', 'batch', 'fine-tune', 'user_data', 'evals'])
 *   purpose: string;
 *
 *   @IsString()
 *   @IsFileTypeValid()
 *   mimeType: string;  // MIME type or filename
 * }
 * ```
 *
 * **Note:** This validator requires the `purpose` field to be present in the same object.
 *
 * @param validationOptions - Optional class-validator options
 */
export function IsFileTypeValid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsFileTypeValidConstraint,
    });
  };
}

/**
 * Helper function to validate file type against purpose
 *
 * Use this as a standalone validator in controllers or services where
 * you have both file type and purpose available.
 *
 * @param mimeType - File MIME type or filename
 * @param purpose - File purpose
 * @returns True if file type is valid for the purpose, false otherwise
 *
 * @example
 * ```typescript
 * // In a controller
 * if (!validateFileType(file.mimetype, dto.purpose)) {
 *   throw new BadRequestException(
 *     getFileTypeErrorMessage(file.mimetype, dto.purpose)
 *   );
 * }
 * ```
 */
export function validateFileType(
  mimeTypeOrFilename: string,
  purpose: string,
): boolean {
  if (typeof mimeTypeOrFilename !== 'string') {
    return false;
  }

  if (!(purpose in ALLOWED_MIME_TYPES)) {
    return false;
  }

  // Normalize MIME type
  const mimeType = mimeTypeOrFilename.includes('/')
    ? mimeTypeOrFilename.toLowerCase()
    : EXTENSION_TO_MIME[
        mimeTypeOrFilename.split('.').pop()?.toLowerCase() || ''
      ] || mimeTypeOrFilename.toLowerCase();

  const allowedTypes = ALLOWED_MIME_TYPES[purpose];
  return allowedTypes.includes(mimeType);
}

/**
 * Helper function to get detailed error message for file type validation
 *
 * @param mimeType - File MIME type or filename
 * @param purpose - File purpose
 * @returns Detailed error message
 *
 * @example
 * ```typescript
 * if (!validateFileType(file.mimetype, dto.purpose)) {
 *   const errorMessage = getFileTypeErrorMessage(file.mimetype, dto.purpose);
 *   throw new BadRequestException(errorMessage);
 * }
 * ```
 */
export function getFileTypeErrorMessage(
  mimeTypeOrFilename: string,
  purpose: string,
): string {
  if (typeof mimeTypeOrFilename !== 'string') {
    return `File type must be a string (MIME type or filename). Received: ${typeof mimeTypeOrFilename}`;
  }

  if (!(purpose in ALLOWED_MIME_TYPES)) {
    return `Unknown file purpose "${purpose}". Cannot determine allowed file types.`;
  }

  const mimeType = mimeTypeOrFilename.includes('/')
    ? mimeTypeOrFilename.toLowerCase()
    : EXTENSION_TO_MIME[
        mimeTypeOrFilename.split('.').pop()?.toLowerCase() || ''
      ] || mimeTypeOrFilename.toLowerCase();

  return `File type "${mimeType}" is not allowed for purpose "${purpose}".`;
}
