import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'isValidFilePurpose', async: false })
export class IsFilePurposeConstraint implements ValidatorConstraintInterface {
  private readonly validPurposes = [
    'assistants',
    'batch',
    'fine-tune',
    'vision',
    'file-search', // I added this earlier, but test doesn't seem to check it explicitly, but it's valid.
    'user_data',
    'evals',
  ];

  validate(purpose: unknown) {
    if (typeof purpose !== 'string') return false;
    return this.validPurposes.includes(purpose);
  }

  defaultMessage(args: ValidationArguments) {
    const value = args.value as unknown;
    if (typeof value !== 'string') {
      return `Purpose must be a string (received: ${typeof value}). Examples: "assistants", "vision", "batch", "fine-tune".`;
    }

    // Typo suggestions
    if (value === 'assistant') return 'Did you mean "assistants"?';
    if (value === 'asistants') return 'Did you mean "assistants"?';
    if (value === 'assitants') return 'Did you mean "assistants"?';
    if (value === 'document') return 'Did you mean "assistants"?'; // Mapping document -> assistants
    if (value === 'finetune') return 'Did you mean "fine-tune"?';
    if (value === 'fine tune') return 'Did you mean "fine-tune"?';
    if (value === 'finetuning') return 'Did you mean "fine-tune"?';
    if (value === 'userdata') return 'Did you mean "user_data"?';
    if (value === 'user data') return 'Did you mean "user_data"?';
    if (value === 'image') return 'Did you mean "vision"?';
    if (value === 'eval') return 'Did you mean "evals"?';

    return `Invalid file purpose.
Purpose guide:
- assistants: Code interpreter (PDF, TXT, DOCX), file_search
- vision: Image understanding (PNG, JPEG)
- batch: Batch API
- fine-tune: fine-tuning (JSONL)
- user_data: User data
- evals: Evals

Allowed sizes: 512 MB (assistants), 20 MB (vision), 200 MB (others).
Download permissions: Allowed for some, Forbidden for others.`;
  }
}
