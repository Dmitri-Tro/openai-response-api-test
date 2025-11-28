import { validate, ValidationArguments } from 'class-validator';
import type { Files } from 'openai/resources/files';
import { IsFilePurposeConstraint } from './file-purpose.validator';
import { CreateFileDto } from '../dto/create-file.dto';

describe('IsFilePurposeConstraint', () => {
  let validator: IsFilePurposeConstraint;

  beforeEach(() => {
    validator = new IsFilePurposeConstraint();
  });

  describe('Valid purposes', () => {
    it('should accept "assistants"', () => {
      const result = validator.validate('assistants');
      expect(result).toBe(true);
    });

    it('should accept "vision"', () => {
      const result = validator.validate('vision');
      expect(result).toBe(true);
    });

    it('should accept "batch"', () => {
      const result = validator.validate('batch');
      expect(result).toBe(true);
    });

    it('should accept "fine-tune"', () => {
      const result = validator.validate('fine-tune');
      expect(result).toBe(true);
    });

    it('should accept "user_data"', () => {
      const result = validator.validate('user_data');
      expect(result).toBe(true);
    });

    it('should accept "evals"', () => {
      const result = validator.validate('evals');
      expect(result).toBe(true);
    });
  });

  describe('Invalid purposes - wrong type', () => {
    it('should reject number', () => {
      const result = validator.validate(123);
      expect(result).toBe(false);
    });

    it('should reject object', () => {
      const result = validator.validate({ purpose: 'assistants' });
      expect(result).toBe(false);
    });

    it('should reject array', () => {
      const result = validator.validate(['assistants']);
      expect(result).toBe(false);
    });

    it('should reject null', () => {
      const result = validator.validate(null);
      expect(result).toBe(false);
    });

    it('should reject undefined', () => {
      const result = validator.validate(undefined);
      expect(result).toBe(false);
    });

    it('should reject boolean', () => {
      const result = validator.validate(true);
      expect(result).toBe(false);
    });
  });

  describe('Invalid purposes - typos and common mistakes', () => {
    it('should reject "assistant" (missing s)', () => {
      const result = validator.validate('assistant');
      expect(result).toBe(false);
    });

    it('should reject "asistants" (missing s)', () => {
      const result = validator.validate('asistants');
      expect(result).toBe(false);
    });

    it('should reject "assitants" (typo)', () => {
      const result = validator.validate('assitants');
      expect(result).toBe(false);
    });

    it('should reject "finetune" (missing hyphen)', () => {
      const result = validator.validate('finetune');
      expect(result).toBe(false);
    });

    it('should reject "fine tune" (space instead of hyphen)', () => {
      const result = validator.validate('fine tune');
      expect(result).toBe(false);
    });

    it('should reject "finetuning" (wrong form)', () => {
      const result = validator.validate('finetuning');
      expect(result).toBe(false);
    });

    it('should reject "userdata" (missing underscore)', () => {
      const result = validator.validate('userdata');
      expect(result).toBe(false);
    });

    it('should reject "user data" (space instead of underscore)', () => {
      const result = validator.validate('user data');
      expect(result).toBe(false);
    });

    it('should reject "eval" (missing s)', () => {
      const result = validator.validate('eval');
      expect(result).toBe(false);
    });

    it('should reject "evaluation" (wrong form)', () => {
      const result = validator.validate('evaluation');
      expect(result).toBe(false);
    });

    it('should reject "image" (wrong purpose name)', () => {
      const result = validator.validate('image');
      expect(result).toBe(false);
    });

    it('should reject "images" (wrong purpose name)', () => {
      const result = validator.validate('images');
      expect(result).toBe(false);
    });

    it('should reject "document" (wrong purpose name)', () => {
      const result = validator.validate('document');
      expect(result).toBe(false);
    });

    it('should reject "documents" (wrong purpose name)', () => {
      const result = validator.validate('documents');
      expect(result).toBe(false);
    });

    it('should reject "training" (not a valid purpose)', () => {
      const result = validator.validate('training');
      expect(result).toBe(false);
    });

    it('should reject empty string', () => {
      const result = validator.validate('');
      expect(result).toBe(false);
    });

    it('should reject "ASSISTANTS" (wrong case)', () => {
      const result = validator.validate('ASSISTANTS');
      expect(result).toBe(false);
    });

    it('should reject "Vision" (wrong case)', () => {
      const result = validator.validate('Vision');
      expect(result).toBe(false);
    });
  });

  describe('Error messages', () => {
    it('should return appropriate message for non-string type', () => {
      const message = validator.defaultMessage({
        value: 123,
      } as ValidationArguments);

      expect(message).toContain('must be a string');
      expect(message).toContain('number');
      expect(message).toContain('assistants');
      expect(message).toContain('vision');
    });

    it('should suggest "assistants" for "assistant" typo', () => {
      const message = validator.defaultMessage({
        value: 'assistant',
      } as ValidationArguments);

      expect(message).toContain('Did you mean');
      expect(message).toContain('"assistants"');
    });

    it('should suggest "fine-tune" for "finetune" typo', () => {
      const message = validator.defaultMessage({
        value: 'finetune',
      } as ValidationArguments);

      expect(message).toContain('Did you mean');
      expect(message).toContain('"fine-tune"');
    });

    it('should suggest "user_data" for "userdata" typo', () => {
      const message = validator.defaultMessage({
        value: 'userdata',
      } as ValidationArguments);

      expect(message).toContain('Did you mean');
      expect(message).toContain('"user_data"');
    });

    it('should suggest "vision" for "image" typo', () => {
      const message = validator.defaultMessage({
        value: 'image',
      } as ValidationArguments);

      expect(message).toContain('Did you mean');
      expect(message).toContain('"vision"');
    });

    it('should suggest "assistants" for "document" typo', () => {
      const message = validator.defaultMessage({
        value: 'document',
      } as ValidationArguments);

      expect(message).toContain('Did you mean');
      expect(message).toContain('"assistants"');
    });

    it('should suggest "evals" for "eval" typo', () => {
      const message = validator.defaultMessage({
        value: 'eval',
      } as ValidationArguments);

      expect(message).toContain('Did you mean');
      expect(message).toContain('"evals"');
    });

    it('should return generic message for completely invalid purpose', () => {
      const message = validator.defaultMessage({
        value: 'random-invalid-purpose',
      } as ValidationArguments);

      expect(message).toContain('Invalid file purpose');
      expect(message).toContain('Purpose guide');
      expect(message).toContain('assistants');
      expect(message).toContain('vision');
      expect(message).toContain('batch');
      expect(message).toContain('fine-tune');
      expect(message).toContain('user_data');
      expect(message).toContain('evals');
    });

    it('should include format information in error message', () => {
      const message = validator.defaultMessage({
        value: 'invalid',
      } as ValidationArguments);

      expect(message).toContain('PDF, TXT, DOCX');
      expect(message).toContain('PNG, JPEG');
      expect(message).toContain('JSONL');
    });

    it('should include size limits in error message', () => {
      const message = validator.defaultMessage({
        value: 'invalid',
      } as ValidationArguments);

      expect(message).toContain('512 MB');
      expect(message).toContain('20 MB');
      expect(message).toContain('200 MB');
    });

    it('should include download permissions in error message', () => {
      const message = validator.defaultMessage({
        value: 'invalid',
      } as ValidationArguments);

      expect(message).toContain('Forbidden');
      expect(message).toContain('Allowed');
    });

    it('should include use cases in error message', () => {
      const message = validator.defaultMessage({
        value: 'invalid',
      } as ValidationArguments);

      expect(message).toContain('file_search');
      expect(message).toContain('Image understanding');
      expect(message).toContain('Batch');
      expect(message).toContain('fine-tuning');
      expect(message).toContain('Code interpreter');
    });
  });

  describe('Integration with DTO', () => {
    it('should validate "assistants" in DTO', async () => {
      const dto = new CreateFileDto();
      dto.purpose = 'assistants';

      const errors = await validate(dto);
      const purposeErrors = errors.filter((e) => e.property === 'purpose');

      expect(purposeErrors).toHaveLength(0);
    });

    it('should validate "vision" in DTO', async () => {
      const dto = new CreateFileDto();
      dto.purpose = 'vision';

      const errors = await validate(dto);
      const purposeErrors = errors.filter((e) => e.property === 'purpose');

      expect(purposeErrors).toHaveLength(0);
    });

    it('should validate "batch" in DTO', async () => {
      const dto = new CreateFileDto();
      dto.purpose = 'batch';

      const errors = await validate(dto);
      const purposeErrors = errors.filter((e) => e.property === 'purpose');

      expect(purposeErrors).toHaveLength(0);
    });

    it('should validate "fine-tune" in DTO', async () => {
      const dto = new CreateFileDto();
      dto.purpose = 'fine-tune';

      const errors = await validate(dto);
      const purposeErrors = errors.filter((e) => e.property === 'purpose');

      expect(purposeErrors).toHaveLength(0);
    });

    it('should validate "user_data" in DTO', async () => {
      const dto = new CreateFileDto();
      dto.purpose = 'user_data';

      const errors = await validate(dto);
      const purposeErrors = errors.filter((e) => e.property === 'purpose');

      expect(purposeErrors).toHaveLength(0);
    });

    it('should validate "evals" in DTO', async () => {
      const dto = new CreateFileDto();
      dto.purpose = 'evals';

      const errors = await validate(dto);
      const purposeErrors = errors.filter((e) => e.property === 'purpose');

      expect(purposeErrors).toHaveLength(0);
    });

    it('should reject invalid purpose in DTO', async () => {
      const dto = new CreateFileDto();
      dto.purpose = 'invalid-purpose' as unknown as Files.FilePurpose;

      const errors = await validate(dto);
      const purposeErrors = errors.filter((e) => e.property === 'purpose');

      expect(purposeErrors.length).toBeGreaterThan(0);
    });

    it('should reject typo "assistant" in DTO', async () => {
      const dto = new CreateFileDto();
      dto.purpose = 'assistant' as unknown as Files.FilePurpose;

      const errors = await validate(dto);
      const purposeErrors = errors.filter((e) => e.property === 'purpose');

      expect(purposeErrors.length).toBeGreaterThan(0);
    });

    it('should reject typo "finetune" in DTO', async () => {
      const dto = new CreateFileDto();
      dto.purpose = 'finetune' as unknown as Files.FilePurpose;

      const errors = await validate(dto);
      const purposeErrors = errors.filter((e) => e.property === 'purpose');

      expect(purposeErrors.length).toBeGreaterThan(0);
    });

    it('should reject typo "userdata" in DTO', async () => {
      const dto = new CreateFileDto();
      dto.purpose = 'userdata' as unknown as Files.FilePurpose;

      const errors = await validate(dto);
      const purposeErrors = errors.filter((e) => e.property === 'purpose');

      expect(purposeErrors.length).toBeGreaterThan(0);
    });
  });
});
