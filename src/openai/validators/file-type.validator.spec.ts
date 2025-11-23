import { validate } from 'class-validator';
import { IsString } from 'class-validator';
import {
  IsFileTypeValidConstraint,
  IsFileTypeValid,
  validateFileType,
  getFileTypeErrorMessage,
  ALLOWED_MIME_TYPES,
  EXTENSION_TO_MIME,
} from './file-type.validator';

// Test DTO for integration tests
class FileUploadDto {
  purpose!: string;

  @IsString()
  @IsFileTypeValid()
  mimeType!: string;
}

describe('IsFileTypeValidConstraint', () => {
  let validator: IsFileTypeValidConstraint;

  beforeEach(() => {
    validator = new IsFileTypeValidConstraint();
  });

  describe('Valid file types - assistants purpose', () => {
    it('should accept PDF for assistants', () => {
      const result = validator.validate('application/pdf', {
        object: { purpose: 'assistants' },
      } as any);
      expect(result).toBe(true);
    });

    it('should accept TXT for assistants', () => {
      const result = validator.validate('text/plain', {
        object: { purpose: 'assistants' },
      } as any);
      expect(result).toBe(true);
    });

    it('should accept DOCX for assistants', () => {
      const result = validator.validate(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        {
          object: { purpose: 'assistants' },
        } as any,
      );
      expect(result).toBe(true);
    });

    it('should accept JSON for assistants', () => {
      const result = validator.validate('application/json', {
        object: { purpose: 'assistants' },
      } as any);
      expect(result).toBe(true);
    });

    it('should accept CSV for assistants', () => {
      const result = validator.validate('text/csv', {
        object: { purpose: 'assistants' },
      } as any);
      expect(result).toBe(true);
    });

    it('should accept Python file for assistants', () => {
      const result = validator.validate('text/x-python', {
        object: { purpose: 'assistants' },
      } as any);
      expect(result).toBe(true);
    });
  });

  describe('Valid file types - vision purpose', () => {
    it('should accept PNG for vision', () => {
      const result = validator.validate('image/png', {
        object: { purpose: 'vision' },
      } as any);
      expect(result).toBe(true);
    });

    it('should accept JPEG for vision', () => {
      const result = validator.validate('image/jpeg', {
        object: { purpose: 'vision' },
      } as any);
      expect(result).toBe(true);
    });

    it('should accept GIF for vision', () => {
      const result = validator.validate('image/gif', {
        object: { purpose: 'vision' },
      } as any);
      expect(result).toBe(true);
    });

    it('should accept WEBP for vision', () => {
      const result = validator.validate('image/webp', {
        object: { purpose: 'vision' },
      } as any);
      expect(result).toBe(true);
    });
  });

  describe('Valid file types - batch/fine-tune/evals purposes', () => {
    it('should accept JSONL for batch', () => {
      const result = validator.validate('application/jsonl', {
        object: { purpose: 'batch' },
      } as any);
      expect(result).toBe(true);
    });

    it('should accept JSONL for fine-tune', () => {
      const result = validator.validate('application/jsonl', {
        object: { purpose: 'fine-tune' },
      } as any);
      expect(result).toBe(true);
    });

    it('should accept JSONL for evals', () => {
      const result = validator.validate('application/jsonl', {
        object: { purpose: 'evals' },
      } as any);
      expect(result).toBe(true);
    });
  });

  describe('Valid file types - user_data purpose', () => {
    it('should accept PDF for user_data', () => {
      const result = validator.validate('application/pdf', {
        object: { purpose: 'user_data' },
      } as any);
      expect(result).toBe(true);
    });

    it('should accept Excel (XLSX) for user_data', () => {
      const result = validator.validate(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        {
          object: { purpose: 'user_data' },
        } as any,
      );
      expect(result).toBe(true);
    });

    it('should accept octet-stream for user_data', () => {
      const result = validator.validate('application/octet-stream', {
        object: { purpose: 'user_data' },
      } as any);
      expect(result).toBe(true);
    });
  });

  describe('Invalid file types - wrong type', () => {
    it('should reject number file type', () => {
      const result = validator.validate(123, {
        object: { purpose: 'vision' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject object file type', () => {
      const result = validator.validate({ type: 'image/png' }, {
        object: { purpose: 'vision' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject array file type', () => {
      const result = validator.validate(['image/png'], {
        object: { purpose: 'vision' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject null file type', () => {
      const result = validator.validate(null, {
        object: { purpose: 'vision' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject undefined file type', () => {
      const result = validator.validate(undefined, {
        object: { purpose: 'vision' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject boolean file type', () => {
      const result = validator.validate(true, {
        object: { purpose: 'vision' },
      } as any);
      expect(result).toBe(false);
    });
  });

  describe('Invalid file types - unsupported for purpose', () => {
    it('should reject image for batch purpose', () => {
      const result = validator.validate('image/png', {
        object: { purpose: 'batch' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject PDF for vision purpose', () => {
      const result = validator.validate('application/pdf', {
        object: { purpose: 'vision' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject JSON for batch purpose (must be JSONL)', () => {
      const result = validator.validate('application/json', {
        object: { purpose: 'batch' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject JSON for fine-tune purpose (must be JSONL)', () => {
      const result = validator.validate('application/json', {
        object: { purpose: 'fine-tune' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject image for assistants purpose', () => {
      const result = validator.validate('image/png', {
        object: { purpose: 'assistants' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject Excel for vision purpose', () => {
      const result = validator.validate(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        {
          object: { purpose: 'vision' },
        } as any,
      );
      expect(result).toBe(false);
    });

    it('should reject video for any purpose', () => {
      const result = validator.validate('video/mp4', {
        object: { purpose: 'user_data' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject audio for any purpose', () => {
      const result = validator.validate('audio/mp3', {
        object: { purpose: 'user_data' },
      } as any);
      expect(result).toBe(false);
    });
  });

  describe('Filename handling', () => {
    it('should accept filename with .pdf extension for assistants', () => {
      const result = validator.validate('document.pdf', {
        object: { purpose: 'assistants' },
      } as any);
      expect(result).toBe(true);
    });

    it('should accept filename with .png extension for vision', () => {
      const result = validator.validate('image.png', {
        object: { purpose: 'vision' },
      } as any);
      expect(result).toBe(true);
    });

    it('should accept filename with .jsonl extension for batch', () => {
      const result = validator.validate('data.jsonl', {
        object: { purpose: 'batch' },
      } as any);
      expect(result).toBe(true);
    });

    it('should reject filename with .json extension for batch', () => {
      const result = validator.validate('data.json', {
        object: { purpose: 'batch' },
      } as any);
      expect(result).toBe(false);
    });

    it('should handle uppercase extensions', () => {
      const result = validator.validate('IMAGE.PNG', {
        object: { purpose: 'vision' },
      } as any);
      expect(result).toBe(true);
    });

    it('should handle mixed case extensions', () => {
      const result = validator.validate('Document.PdF', {
        object: { purpose: 'assistants' },
      } as any);
      expect(result).toBe(true);
    });
  });

  describe('Invalid purpose', () => {
    it('should reject file type when purpose is missing', () => {
      const result = validator.validate('image/png', {
        object: {},
      } as any);
      expect(result).toBe(false);
    });

    it('should reject file type when purpose is null', () => {
      const result = validator.validate('image/png', {
        object: { purpose: null },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject file type when purpose is invalid', () => {
      const result = validator.validate('image/png', {
        object: { purpose: 'invalid-purpose' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject file type when purpose is number', () => {
      const result = validator.validate('image/png', {
        object: { purpose: 123 },
      } as any);
      expect(result).toBe(false);
    });
  });

  describe('Error messages', () => {
    it('should return appropriate message for non-string file type', () => {
      const message = validator.defaultMessage({
        value: 123,
        object: { purpose: 'vision' },
      } as any);

      expect(message).toContain('must be a string');
      expect(message).toContain('number');
    });

    it('should return appropriate message for missing purpose', () => {
      const message = validator.defaultMessage({
        value: 'image/png',
        object: {},
      } as any);

      expect(message).toContain('Cannot validate file type');
      expect(message).toContain('without a valid purpose');
    });

    it('should return appropriate message for invalid purpose', () => {
      const message = validator.defaultMessage({
        value: 'image/png',
        object: { purpose: 'invalid-purpose' },
      } as any);

      expect(message).toContain('Unknown file purpose');
      expect(message).toContain('invalid-purpose');
    });

    it('should return appropriate message for image on batch purpose', () => {
      const message = validator.defaultMessage({
        value: 'image/png',
        object: { purpose: 'batch' },
      } as any);

      expect(message).toContain('not allowed');
      expect(message).toContain('batch');
      expect(message).toContain('JSONL');
    });

    it('should return appropriate message for PDF on vision purpose', () => {
      const message = validator.defaultMessage({
        value: 'application/pdf',
        object: { purpose: 'vision' },
      } as any);

      expect(message).toContain('not allowed');
      expect(message).toContain('vision');
      expect(message).toContain('Images');
    });

    it('should include common fixes for JSON vs JSONL confusion', () => {
      const message = validator.defaultMessage({
        value: 'application/json',
        object: { purpose: 'batch' },
      } as any);

      expect(message).toContain('JSONL format instead of JSON');
      expect(message).toContain('.jsonl');
    });

    it('should include common fixes for image on non-vision purpose', () => {
      const message = validator.defaultMessage({
        value: 'image/png',
        object: { purpose: 'assistants' },
      } as any);

      expect(message).toContain('Change purpose to "vision"');
    });

    it('should include common fixes for PDF on vision purpose', () => {
      const message = validator.defaultMessage({
        value: 'application/pdf',
        object: { purpose: 'vision' },
      } as any);

      expect(message).toContain('Change purpose to "assistants"');
    });
  });

  describe('Helper function: validateFileType', () => {
    it('should return true for valid MIME type', () => {
      expect(validateFileType('image/png', 'vision')).toBe(true);
    });

    it('should return true for valid filename', () => {
      expect(validateFileType('document.pdf', 'assistants')).toBe(true);
    });

    it('should return false for invalid MIME type', () => {
      expect(validateFileType('image/png', 'batch')).toBe(false);
    });

    it('should return false for invalid purpose', () => {
      expect(validateFileType('image/png', 'invalid-purpose')).toBe(false);
    });

    it('should return false for non-string file type', () => {
      expect(validateFileType(123 as any, 'vision')).toBe(false);
    });

    it('should handle case insensitivity', () => {
      expect(validateFileType('IMAGE/PNG', 'vision')).toBe(true);
    });

    it('should handle filename extensions', () => {
      expect(validateFileType('data.jsonl', 'batch')).toBe(true);
    });
  });

  describe('Helper function: getFileTypeErrorMessage', () => {
    it('should return error message for invalid file type', () => {
      const message = getFileTypeErrorMessage('image/png', 'batch');

      expect(message).toContain('not allowed');
      expect(message).toContain('batch');
    });

    it('should return error message for non-string type', () => {
      const message = getFileTypeErrorMessage(123 as any, 'vision');

      expect(message).toContain('must be a string');
    });

    it('should return error message for unknown purpose', () => {
      const message = getFileTypeErrorMessage('image/png', 'unknown-purpose');

      expect(message).toContain('Unknown file purpose');
    });
  });

  describe('Integration with DTO', () => {
    it('should validate valid MIME type in DTO', async () => {
      const dto = new FileUploadDto();
      dto.purpose = 'vision';
      dto.mimeType = 'image/png';

      const errors = await validate(dto);
      const typeErrors = errors.filter((e) => e.property === 'mimeType');

      expect(typeErrors).toHaveLength(0);
    });

    it('should reject invalid MIME type in DTO', async () => {
      const dto = new FileUploadDto();
      dto.purpose = 'batch';
      dto.mimeType = 'image/png';

      const errors = await validate(dto);
      const typeErrors = errors.filter((e) => e.property === 'mimeType');

      expect(typeErrors.length).toBeGreaterThan(0);
    });

    it('should validate filename in DTO', async () => {
      const dto = new FileUploadDto();
      dto.purpose = 'assistants';
      dto.mimeType = 'document.pdf';

      const errors = await validate(dto);
      const typeErrors = errors.filter((e) => e.property === 'mimeType');

      expect(typeErrors).toHaveLength(0);
    });

    it('should reject wrong filename extension in DTO', async () => {
      const dto = new FileUploadDto();
      dto.purpose = 'vision';
      dto.mimeType = 'document.pdf';

      const errors = await validate(dto);
      const typeErrors = errors.filter((e) => e.property === 'mimeType');

      expect(typeErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Constants', () => {
    it('should have MIME types for all purposes', () => {
      expect(ALLOWED_MIME_TYPES['assistants']).toBeDefined();
      expect(ALLOWED_MIME_TYPES['vision']).toBeDefined();
      expect(ALLOWED_MIME_TYPES['batch']).toBeDefined();
      expect(ALLOWED_MIME_TYPES['fine-tune']).toBeDefined();
      expect(ALLOWED_MIME_TYPES['user_data']).toBeDefined();
      expect(ALLOWED_MIME_TYPES['evals']).toBeDefined();
    });

    it('should have vision MIME types as image types', () => {
      const visionTypes = ALLOWED_MIME_TYPES['vision'];
      expect(visionTypes.every((type) => type.startsWith('image/'))).toBe(
        true,
      );
    });

    it('should have batch/fine-tune/evals with only JSONL', () => {
      expect(ALLOWED_MIME_TYPES['batch']).toEqual(['application/jsonl']);
      expect(ALLOWED_MIME_TYPES['fine-tune']).toEqual(['application/jsonl']);
      expect(ALLOWED_MIME_TYPES['evals']).toEqual(['application/jsonl']);
    });

    it('should have extension to MIME type mappings', () => {
      expect(EXTENSION_TO_MIME['pdf']).toBe('application/pdf');
      expect(EXTENSION_TO_MIME['png']).toBe('image/png');
      expect(EXTENSION_TO_MIME['jsonl']).toBe('application/jsonl');
      expect(EXTENSION_TO_MIME['csv']).toBe('text/csv');
    });
  });
});
