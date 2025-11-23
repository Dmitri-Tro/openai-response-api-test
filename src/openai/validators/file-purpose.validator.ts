import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

/**
 * Validator constraint for file purpose validation
 *
 * **Supported Purposes:**
 * - 'assistants' - Documents for Assistants API (file_search tool)
 * - 'vision' - Images for vision models
 * - 'batch' - Input files for Batch API (JSONL)
 * - 'fine-tune' - Training data for fine-tuning (JSONL)
 * - 'user_data' - General purpose files (code_interpreter)
 * - 'evals' - Evaluation datasets (JSONL)
 *
 * **Purpose Details:**
 *
 * **assistants**:
 * - Formats: PDF, TXT, DOCX, MD, HTML, JS, PY, JSON, CSV, XML
 * - Max size: 512 MB
 * - Download: ❌ Forbidden (API restriction)
 * - Use case: Semantic search with file_search tool
 * - Integration: Vector stores (Phase 8)
 *
 * **vision**:
 * - Formats: PNG, JPEG, JPG, GIF, WEBP
 * - Max size: 20 MB
 * - Download: ✅ Allowed
 * - Use case: Image understanding, vision models
 *
 * **batch**:
 * - Formats: JSONL only
 * - Max size: 200 MB
 * - Download: ✅ Allowed
 * - Use case: Batch API input (one request per line)
 *
 * **fine-tune**:
 * - Formats: JSONL only (strict format)
 * - Max size: 512 MB
 * - Download: ✅ Allowed
 * - Use case: Model fine-tuning training data
 *
 * **user_data**:
 * - Formats: Wide variety (CSV, JSON, Excel, TXT, etc.)
 * - Max size: 512 MB
 * - Download: ✅ Allowed
 * - Use case: General purpose, code_interpreter tool
 * - Integration: Code interpreter (Phase 2.16)
 *
 * **evals**:
 * - Formats: JSONL
 * - Max size: 512 MB
 * - Download: ✅ Allowed
 * - Use case: Model evaluation datasets
 *
 * @example
 * ```typescript
 * // Valid purposes
 * 'assistants'  // ✓ For file_search tool
 * 'vision'      // ✓ For image understanding
 * 'user_data'   // ✓ For code_interpreter
 *
 * // Invalid purposes
 * 'assistant'   // ✗ Missing 's' (typo)
 * 'finetune'    // ✗ Missing hyphen
 * 'documents'   // ✗ Not a valid purpose
 * ```
 */
@ValidatorConstraint({ async: false })
export class IsFilePurposeConstraint
  implements ValidatorConstraintInterface
{
  private readonly validPurposes = [
    'assistants',
    'vision',
    'batch',
    'fine-tune',
    'user_data',
    'evals',
  ];

  private readonly purposeInfo: Record<
    string,
    {
      formats: string;
      maxSize: string;
      downloadable: boolean;
      useCase: string;
      integration?: string;
    }
  > = {
    assistants: {
      formats: 'PDF, TXT, DOCX, MD, HTML, JS, PY, JSON, CSV, XML',
      maxSize: '512 MB',
      downloadable: false,
      useCase: 'Semantic search with file_search tool',
      integration: 'Vector stores (Phase 8)',
    },
    vision: {
      formats: 'PNG, JPEG, JPG, GIF, WEBP',
      maxSize: '20 MB',
      downloadable: true,
      useCase: 'Image understanding, vision models',
    },
    batch: {
      formats: 'JSONL only',
      maxSize: '200 MB',
      downloadable: true,
      useCase: 'Batch API input (one request per line)',
    },
    'fine-tune': {
      formats: 'JSONL only (strict format)',
      maxSize: '512 MB',
      downloadable: true,
      useCase: 'Model fine-tuning training data',
    },
    user_data: {
      formats: 'Wide variety (CSV, JSON, Excel, TXT, etc.)',
      maxSize: '512 MB',
      downloadable: true,
      useCase: 'General purpose, code_interpreter tool',
      integration: 'Code interpreter (Phase 2.16)',
    },
    evals: {
      formats: 'JSONL',
      maxSize: '512 MB',
      downloadable: true,
      useCase: 'Model evaluation datasets',
    },
  };

  validate(purpose: unknown): boolean {
    // Purpose must be a string
    if (typeof purpose !== 'string') {
      return false;
    }

    // Must be one of the supported purposes
    return this.validPurposes.includes(purpose);
  }

  defaultMessage(args: ValidationArguments): string {
    const purpose = args.value;

    if (typeof purpose !== 'string') {
      return `File purpose must be a string. Received: ${typeof purpose}. Valid purposes: "assistants", "vision", "batch", "fine-tune", "user_data", "evals"`;
    }

    // Check for common typos and provide suggestions
    const suggestions = this.getSuggestions(purpose);
    if (suggestions.length > 0) {
      return `File purpose "${purpose}" is not valid. Did you mean: ${suggestions.map((s) => `"${s}"`).join(', ')}?

Valid purposes and their use cases:
  - "assistants": Documents for file_search (PDF, TXT, DOCX, MD, etc.) - Max: 512 MB
  - "vision": Images for vision models (PNG, JPEG, GIF, WEBP) - Max: 20 MB
  - "batch": Batch API input (JSONL only) - Max: 200 MB
  - "fine-tune": Fine-tuning training data (JSONL only) - Max: 512 MB
  - "user_data": General purpose, code_interpreter (various formats) - Max: 512 MB
  - "evals": Evaluation datasets (JSONL) - Max: 512 MB`;
    }

    // Generic error message
    return `Invalid file purpose "${purpose}". Must be one of: "assistants", "vision", "batch", "fine-tune", "user_data", "evals"

Purpose guide:
  - "assistants": Documents for Assistants API (file_search tool)
    • Formats: PDF, TXT, DOCX, MD, HTML, JS, PY, JSON, CSV, XML
    • Max size: 512 MB
    • Download: Forbidden
    • Use case: Semantic search with vector stores

  - "vision": Images for vision models
    • Formats: PNG, JPEG, JPG, GIF, WEBP
    • Max size: 20 MB
    • Download: Allowed
    • Use case: Image understanding and analysis

  - "batch": Input files for Batch API
    • Formats: JSONL only
    • Max size: 200 MB
    • Download: Allowed
    • Use case: Asynchronous batch processing

  - "fine-tune": Training data for fine-tuning
    • Formats: JSONL only (strict format)
    • Max size: 512 MB
    • Download: Allowed
    • Use case: Model customization

  - "user_data": General purpose files
    • Formats: Wide variety (CSV, JSON, Excel, TXT, etc.)
    • Max size: 512 MB
    • Download: Allowed
    • Use case: Code interpreter, general analysis

  - "evals": Evaluation datasets
    • Formats: JSONL
    • Max size: 512 MB
    • Download: Allowed
    • Use case: Model evaluation and testing`;
  }

  /**
   * Get suggestions for common typos and similar strings
   * @param input - User's invalid input
   * @returns Array of suggested purposes
   */
  private getSuggestions(input: string): string[] {
    const normalized = input.toLowerCase().trim();
    const suggestions: string[] = [];

    // Check for common typos
    const typoMap: Record<string, string> = {
      assistant: 'assistants',
      asistants: 'assistants',
      assitants: 'assistants',
      finetune: 'fine-tune',
      'fine tune': 'fine-tune',
      finetuning: 'fine-tune',
      userdata: 'user_data',
      'user data': 'user_data',
      eval: 'evals',
      evaluation: 'evals',
      evaluations: 'evals',
      image: 'vision',
      images: 'vision',
      img: 'vision',
      document: 'assistants',
      documents: 'assistants',
      docs: 'assistants',
    };

    if (typoMap[normalized]) {
      suggestions.push(typoMap[normalized]);
    }

    // If no specific typo match, suggest based on partial match
    if (suggestions.length === 0) {
      for (const validPurpose of this.validPurposes) {
        if (
          validPurpose.includes(normalized) ||
          normalized.includes(validPurpose.replace('_', '').replace('-', ''))
        ) {
          suggestions.push(validPurpose);
        }
      }
    }

    return suggestions;
  }
}

/**
 * Decorator for validating file purpose
 *
 * Validates that the purpose parameter matches one of the 6 supported file purposes
 * and provides context-aware guidance in error messages.
 *
 * **Usage in DTO:**
 * ```typescript
 * export class CreateFileDto {
 *   @IsFilePurposeValid()
 *   purpose: Files.FilePurpose;
 * }
 * ```
 *
 * @param validationOptions - Optional class-validator options
 */
export function IsFilePurposeValid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsFilePurposeConstraint,
    });
  };
}
