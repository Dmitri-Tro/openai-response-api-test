import { validate } from 'class-validator';
import {
  IsFileSizeValidConstraint,
  validateFileSize,
  getFileSizeErrorMessage,
  FILE_SIZE_LIMITS_BYTES,
  FILE_SIZE_LIMITS_MB,
} from './file-size.validator';
import { IsNumber } from 'class-validator';
import { IsFileSizeValid } from './file-size.validator';

// Test DTO for integration tests
class FileUploadDto {
  purpose!: string;

  @IsNumber()
  @IsFileSizeValid()
  fileSize!: number;
}

describe('IsFileSizeValidConstraint', () => {
  let validator: IsFileSizeValidConstraint;

  beforeEach(() => {
    validator = new IsFileSizeValidConstraint();
  });

  describe('Valid file sizes', () => {
    it('should accept 10 MB for assistants (within 512 MB limit)', () => {
      const result = validator.validate(10 * 1024 * 1024, {
        object: { purpose: 'assistants' },
      } as any);
      expect(result).toBe(true);
    });

    it('should accept 15 MB for vision (within 20 MB limit)', () => {
      const result = validator.validate(15 * 1024 * 1024, {
        object: { purpose: 'vision' },
      } as any);
      expect(result).toBe(true);
    });

    it('should accept 100 MB for batch (within 200 MB limit)', () => {
      const result = validator.validate(100 * 1024 * 1024, {
        object: { purpose: 'batch' },
      } as any);
      expect(result).toBe(true);
    });

    it('should accept 256 MB for fine-tune (within 512 MB limit)', () => {
      const result = validator.validate(256 * 1024 * 1024, {
        object: { purpose: 'fine-tune' },
      } as any);
      expect(result).toBe(true);
    });

    it('should accept 400 MB for user_data (within 512 MB limit)', () => {
      const result = validator.validate(400 * 1024 * 1024, {
        object: { purpose: 'user_data' },
      } as any);
      expect(result).toBe(true);
    });

    it('should accept 500 MB for evals (within 512 MB limit)', () => {
      const result = validator.validate(500 * 1024 * 1024, {
        object: { purpose: 'evals' },
      } as any);
      expect(result).toBe(true);
    });

    it('should accept file size exactly at limit (512 MB for assistants)', () => {
      const result = validator.validate(512 * 1024 * 1024, {
        object: { purpose: 'assistants' },
      } as any);
      expect(result).toBe(true);
    });

    it('should accept file size exactly at limit (20 MB for vision)', () => {
      const result = validator.validate(20 * 1024 * 1024, {
        object: { purpose: 'vision' },
      } as any);
      expect(result).toBe(true);
    });

    it('should accept file size exactly at limit (200 MB for batch)', () => {
      const result = validator.validate(200 * 1024 * 1024, {
        object: { purpose: 'batch' },
      } as any);
      expect(result).toBe(true);
    });
  });

  describe('Invalid file sizes - wrong type', () => {
    it('should reject string file size', () => {
      const result = validator.validate('10485760', {
        object: { purpose: 'vision' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject object file size', () => {
      const result = validator.validate({ size: 10485760 }, {
        object: { purpose: 'vision' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject array file size', () => {
      const result = validator.validate([10485760], {
        object: { purpose: 'vision' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject null file size', () => {
      const result = validator.validate(null, {
        object: { purpose: 'vision' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject undefined file size', () => {
      const result = validator.validate(undefined, {
        object: { purpose: 'vision' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject NaN file size', () => {
      const result = validator.validate(NaN, {
        object: { purpose: 'vision' },
      } as any);
      expect(result).toBe(false);
    });
  });

  describe('Invalid file sizes - exceeds limits', () => {
    it('should reject 25 MB for vision (exceeds 20 MB limit)', () => {
      const result = validator.validate(25 * 1024 * 1024, {
        object: { purpose: 'vision' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject 250 MB for batch (exceeds 200 MB limit)', () => {
      const result = validator.validate(250 * 1024 * 1024, {
        object: { purpose: 'batch' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject 600 MB for assistants (exceeds 512 MB limit)', () => {
      const result = validator.validate(600 * 1024 * 1024, {
        object: { purpose: 'assistants' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject 600 MB for fine-tune (exceeds 512 MB limit)', () => {
      const result = validator.validate(600 * 1024 * 1024, {
        object: { purpose: 'fine-tune' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject 1 GB for user_data (exceeds 512 MB limit)', () => {
      const result = validator.validate(1024 * 1024 * 1024, {
        object: { purpose: 'user_data' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject 700 MB for evals (exceeds 512 MB limit)', () => {
      const result = validator.validate(700 * 1024 * 1024, {
        object: { purpose: 'evals' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject size just 1 byte over limit (vision)', () => {
      const result = validator.validate(20 * 1024 * 1024 + 1, {
        object: { purpose: 'vision' },
      } as any);
      expect(result).toBe(false);
    });
  });

  describe('Invalid file sizes - edge cases', () => {
    it('should reject zero file size', () => {
      const result = validator.validate(0, {
        object: { purpose: 'vision' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject negative file size', () => {
      const result = validator.validate(-1024, {
        object: { purpose: 'vision' },
      } as any);
      expect(result).toBe(false);
    });
  });

  describe('Invalid purpose', () => {
    it('should reject file size when purpose is missing', () => {
      const result = validator.validate(10 * 1024 * 1024, {
        object: {},
      } as any);
      expect(result).toBe(false);
    });

    it('should reject file size when purpose is null', () => {
      const result = validator.validate(10 * 1024 * 1024, {
        object: { purpose: null },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject file size when purpose is invalid', () => {
      const result = validator.validate(10 * 1024 * 1024, {
        object: { purpose: 'invalid-purpose' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject file size when purpose is number', () => {
      const result = validator.validate(10 * 1024 * 1024, {
        object: { purpose: 123 },
      } as any);
      expect(result).toBe(false);
    });
  });

  describe('Error messages', () => {
    it('should return appropriate message for non-number file size', () => {
      const message = validator.defaultMessage({
        value: '10485760',
        object: { purpose: 'vision' },
      } as any);

      expect(message).toContain('must be a number');
      expect(message).toContain('string');
    });

    it('should return appropriate message for zero file size', () => {
      const message = validator.defaultMessage({
        value: 0,
        object: { purpose: 'vision' },
      } as any);

      expect(message).toContain('must be positive');
    });

    it('should return appropriate message for negative file size', () => {
      const message = validator.defaultMessage({
        value: -1024,
        object: { purpose: 'vision' },
      } as any);

      expect(message).toContain('must be positive');
    });

    it('should return appropriate message for missing purpose', () => {
      const message = validator.defaultMessage({
        value: 10 * 1024 * 1024,
        object: {},
      } as any);

      expect(message).toContain('Cannot validate file size');
      expect(message).toContain('without a valid purpose');
    });

    it('should return appropriate message for invalid purpose', () => {
      const message = validator.defaultMessage({
        value: 10 * 1024 * 1024,
        object: { purpose: 'invalid-purpose' },
      } as any);

      expect(message).toContain('Unknown file purpose');
      expect(message).toContain('invalid-purpose');
    });

    it('should return appropriate message for file exceeding vision limit', () => {
      const message = validator.defaultMessage({
        value: 25 * 1024 * 1024,
        object: { purpose: 'vision' },
      } as any);

      expect(message).toContain('exceeds maximum');
      expect(message).toContain('vision');
      expect(message).toContain('20 MB');
    });

    it('should return appropriate message for file exceeding batch limit', () => {
      const message = validator.defaultMessage({
        value: 250 * 1024 * 1024,
        object: { purpose: 'batch' },
      } as any);

      expect(message).toContain('exceeds maximum');
      expect(message).toContain('batch');
      expect(message).toContain('200 MB');
    });

    it('should return appropriate message for file exceeding assistants limit', () => {
      const message = validator.defaultMessage({
        value: 600 * 1024 * 1024,
        object: { purpose: 'assistants' },
      } as any);

      expect(message).toContain('exceeds maximum');
      expect(message).toContain('assistants');
      expect(message).toContain('512 MB');
    });

    it('should include all size limits in error message', () => {
      const message = validator.defaultMessage({
        value: 600 * 1024 * 1024,
        object: { purpose: 'assistants' },
      } as any);

      expect(message).toContain('assistants');
      expect(message).toContain('vision');
      expect(message).toContain('batch');
      expect(message).toContain('fine-tune');
      expect(message).toContain('user_data');
      expect(message).toContain('evals');
    });
  });

  describe('Helper function: validateFileSize', () => {
    it('should return true for valid file size', () => {
      expect(validateFileSize(10 * 1024 * 1024, 'vision')).toBe(true);
    });

    it('should return false for file size exceeding limit', () => {
      expect(validateFileSize(25 * 1024 * 1024, 'vision')).toBe(false);
    });

    it('should return false for negative file size', () => {
      expect(validateFileSize(-1024, 'vision')).toBe(false);
    });

    it('should return false for zero file size', () => {
      expect(validateFileSize(0, 'vision')).toBe(false);
    });

    it('should return false for invalid purpose', () => {
      expect(validateFileSize(10 * 1024 * 1024, 'invalid-purpose')).toBe(
        false,
      );
    });

    it('should return false for NaN file size', () => {
      expect(validateFileSize(NaN, 'vision')).toBe(false);
    });

    it('should return true for file size exactly at limit', () => {
      expect(validateFileSize(20 * 1024 * 1024, 'vision')).toBe(true);
    });

    it('should return false for file size 1 byte over limit', () => {
      expect(validateFileSize(20 * 1024 * 1024 + 1, 'vision')).toBe(false);
    });
  });

  describe('Helper function: getFileSizeErrorMessage', () => {
    it('should return error message for file exceeding limit', () => {
      const message = getFileSizeErrorMessage(25 * 1024 * 1024, 'vision');

      expect(message).toContain('exceeds maximum');
      expect(message).toContain('vision');
      expect(message).toContain('20 MB');
    });

    it('should return error message for invalid file size type', () => {
      const message = getFileSizeErrorMessage(NaN, 'vision');

      expect(message).toContain('must be a number');
    });

    it('should return error message for negative file size', () => {
      const message = getFileSizeErrorMessage(-1024, 'vision');

      expect(message).toContain('must be positive');
    });

    it('should return error message for unknown purpose', () => {
      const message = getFileSizeErrorMessage(
        10 * 1024 * 1024,
        'unknown-purpose',
      );

      expect(message).toContain('Unknown file purpose');
    });
  });

  describe('Integration with DTO', () => {
    it('should validate file size within limit in DTO', async () => {
      const dto = new FileUploadDto();
      dto.purpose = 'vision';
      dto.fileSize = 10 * 1024 * 1024; // 10 MB

      const errors = await validate(dto);
      const sizeErrors = errors.filter((e) => e.property === 'fileSize');

      expect(sizeErrors).toHaveLength(0);
    });

    it('should reject file size exceeding limit in DTO', async () => {
      const dto = new FileUploadDto();
      dto.purpose = 'vision';
      dto.fileSize = 25 * 1024 * 1024; // 25 MB (exceeds 20 MB limit)

      const errors = await validate(dto);
      const sizeErrors = errors.filter((e) => e.property === 'fileSize');

      expect(sizeErrors.length).toBeGreaterThan(0);
    });

    it('should validate file size at exact limit in DTO', async () => {
      const dto = new FileUploadDto();
      dto.purpose = 'vision';
      dto.fileSize = 20 * 1024 * 1024; // Exactly 20 MB

      const errors = await validate(dto);
      const sizeErrors = errors.filter((e) => e.property === 'fileSize');

      expect(sizeErrors).toHaveLength(0);
    });

    it('should reject file size 1 byte over limit in DTO', async () => {
      const dto = new FileUploadDto();
      dto.purpose = 'vision';
      dto.fileSize = 20 * 1024 * 1024 + 1; // 1 byte over 20 MB limit

      const errors = await validate(dto);
      const sizeErrors = errors.filter((e) => e.property === 'fileSize');

      expect(sizeErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Constants', () => {
    it('should have correct size limits in MB', () => {
      expect(FILE_SIZE_LIMITS_MB['assistants']).toBe(512);
      expect(FILE_SIZE_LIMITS_MB['vision']).toBe(20);
      expect(FILE_SIZE_LIMITS_MB['batch']).toBe(200);
      expect(FILE_SIZE_LIMITS_MB['fine-tune']).toBe(512);
      expect(FILE_SIZE_LIMITS_MB['user_data']).toBe(512);
      expect(FILE_SIZE_LIMITS_MB['evals']).toBe(512);
    });

    it('should have correct size limits in bytes', () => {
      expect(FILE_SIZE_LIMITS_BYTES['assistants']).toBe(512 * 1024 * 1024);
      expect(FILE_SIZE_LIMITS_BYTES['vision']).toBe(20 * 1024 * 1024);
      expect(FILE_SIZE_LIMITS_BYTES['batch']).toBe(200 * 1024 * 1024);
      expect(FILE_SIZE_LIMITS_BYTES['fine-tune']).toBe(512 * 1024 * 1024);
      expect(FILE_SIZE_LIMITS_BYTES['user_data']).toBe(512 * 1024 * 1024);
      expect(FILE_SIZE_LIMITS_BYTES['evals']).toBe(512 * 1024 * 1024);
    });
  });
});
