import { validate, ValidationArguments } from 'class-validator';
import {
  IsAudioFileSizeValidConstraint,
  validateAudioFileSize,
  getAudioFileSizeErrorMessage,
  AUDIO_MAX_SIZE_MB,
  AUDIO_MAX_SIZE_BYTES,
  IsAudioFileSizeValid,
} from './audio-file-size.validator';

// Test DTO for integration tests
class AudioUploadDto {
  @IsAudioFileSizeValid()
  file!: { size: number };
}

describe('IsAudioFileSizeValidConstraint', () => {
  let validator: IsAudioFileSizeValidConstraint;

  beforeEach(() => {
    validator = new IsAudioFileSizeValidConstraint();
  });

  describe('Valid file sizes', () => {
    it('should accept 1 KB file', () => {
      const result = validator.validate({ size: 1024 });
      expect(result).toBe(true);
    });

    it('should accept 1 MB file', () => {
      const result = validator.validate({ size: 1 * 1024 * 1024 });
      expect(result).toBe(true);
    });

    it('should accept 5 MB file', () => {
      const result = validator.validate({ size: 5 * 1024 * 1024 });
      expect(result).toBe(true);
    });

    it('should accept 10 MB file', () => {
      const result = validator.validate({ size: 10 * 1024 * 1024 });
      expect(result).toBe(true);
    });

    it('should accept 15 MB file', () => {
      const result = validator.validate({ size: 15 * 1024 * 1024 });
      expect(result).toBe(true);
    });

    it('should accept 20 MB file', () => {
      const result = validator.validate({ size: 20 * 1024 * 1024 });
      expect(result).toBe(true);
    });

    it('should accept 24 MB file', () => {
      const result = validator.validate({ size: 24 * 1024 * 1024 });
      expect(result).toBe(true);
    });

    it('should accept file size exactly at 25 MB limit', () => {
      const result = validator.validate({ size: AUDIO_MAX_SIZE_BYTES });
      expect(result).toBe(true);
    });

    it('should accept file size of 1 byte', () => {
      const result = validator.validate({ size: 1 });
      expect(result).toBe(true);
    });

    it('should accept file size of 1 byte less than limit', () => {
      const result = validator.validate({ size: AUDIO_MAX_SIZE_BYTES - 1 });
      expect(result).toBe(true);
    });
  });

  describe('Invalid file objects - wrong types', () => {
    it('should reject null file', () => {
      const result = validator.validate(null);
      expect(result).toBe(false);
    });

    it('should reject undefined file', () => {
      const result = validator.validate(undefined);
      expect(result).toBe(false);
    });

    it('should reject string file', () => {
      const result = validator.validate('not a file');
      expect(result).toBe(false);
    });

    it('should reject number file (not an object)', () => {
      const result = validator.validate(1024);
      expect(result).toBe(false);
    });

    it('should reject array file', () => {
      const result = validator.validate([1024]);
      expect(result).toBe(false);
    });

    it('should reject file object without size property', () => {
      const result = validator.validate({ name: 'audio.mp3' });
      expect(result).toBe(false);
    });

    it('should reject file with string size', () => {
      const result = validator.validate({ size: '1024' });
      expect(result).toBe(false);
    });

    it('should reject file with NaN size', () => {
      const result = validator.validate({ size: NaN });
      expect(result).toBe(false);
    });

    it('should reject file with undefined size', () => {
      const result = validator.validate({ size: undefined });
      expect(result).toBe(false);
    });

    it('should reject file with null size', () => {
      const result = validator.validate({ size: null });
      expect(result).toBe(false);
    });
  });

  describe('Invalid file sizes - exceeds limit', () => {
    it('should reject 26 MB file (exceeds 25 MB limit)', () => {
      const result = validator.validate({ size: 26 * 1024 * 1024 });
      expect(result).toBe(false);
    });

    it('should reject 30 MB file', () => {
      const result = validator.validate({ size: 30 * 1024 * 1024 });
      expect(result).toBe(false);
    });

    it('should reject 50 MB file', () => {
      const result = validator.validate({ size: 50 * 1024 * 1024 });
      expect(result).toBe(false);
    });

    it('should reject 100 MB file', () => {
      const result = validator.validate({ size: 100 * 1024 * 1024 });
      expect(result).toBe(false);
    });

    it('should reject 512 MB file', () => {
      const result = validator.validate({ size: 512 * 1024 * 1024 });
      expect(result).toBe(false);
    });

    it('should reject file size just 1 byte over limit', () => {
      const result = validator.validate({ size: AUDIO_MAX_SIZE_BYTES + 1 });
      expect(result).toBe(false);
    });

    it('should reject very large file (1 GB)', () => {
      const result = validator.validate({ size: 1024 * 1024 * 1024 });
      expect(result).toBe(false);
    });
  });

  describe('Invalid file sizes - edge cases', () => {
    it('should reject zero file size', () => {
      const result = validator.validate({ size: 0 });
      expect(result).toBe(false);
    });

    it('should reject negative file size (-1024)', () => {
      const result = validator.validate({ size: -1024 });
      expect(result).toBe(false);
    });

    it('should reject negative file size (-1)', () => {
      const result = validator.validate({ size: -1 });
      expect(result).toBe(false);
    });

    it('should reject Infinity', () => {
      const result = validator.validate({ size: Infinity });
      expect(result).toBe(false);
    });

    it('should reject -Infinity', () => {
      const result = validator.validate({ size: -Infinity });
      expect(result).toBe(false);
    });
  });

  describe('Default error messages', () => {
    it('should return error message for file exceeding limit', () => {
      const message = validator.defaultMessage({
        value: { size: 30 * 1024 * 1024 },
      } as ValidationArguments);
      expect(message).toContain('Audio file size');
      expect(message).toContain('exceeds maximum allowed size');
      expect(message).toContain('25 MB');
    });

    it('should return error message for invalid file object', () => {
      const message = validator.defaultMessage({
        value: null,
      } as ValidationArguments);
      expect(message).toContain('Invalid file object');
    });

    it('should return error message for non-number size', () => {
      const message = validator.defaultMessage({
        value: { size: '1024' },
      } as ValidationArguments);
      expect(message).toContain('File size must be a number');
    });

    it('should return error message for zero file size', () => {
      const message = validator.defaultMessage({
        value: { size: 0 },
      } as ValidationArguments);
      expect(message).toContain('File size must be positive');
    });

    it('should return error message for negative file size', () => {
      const message = validator.defaultMessage({
        value: { size: -1024 },
      } as ValidationArguments);
      expect(message).toContain('File size must be positive');
    });
  });
});

describe('validateAudioFileSize helper', () => {
  describe('Valid file sizes', () => {
    it('should accept 1 KB', () => {
      expect(validateAudioFileSize(1024)).toBe(true);
    });

    it('should accept 1 MB', () => {
      expect(validateAudioFileSize(1 * 1024 * 1024)).toBe(true);
    });

    it('should accept 10 MB', () => {
      expect(validateAudioFileSize(10 * 1024 * 1024)).toBe(true);
    });

    it('should accept 25 MB exactly', () => {
      expect(validateAudioFileSize(AUDIO_MAX_SIZE_BYTES)).toBe(true);
    });

    it('should accept 1 byte', () => {
      expect(validateAudioFileSize(1)).toBe(true);
    });

    it('should accept 1 byte less than limit', () => {
      expect(validateAudioFileSize(AUDIO_MAX_SIZE_BYTES - 1)).toBe(true);
    });
  });

  describe('Invalid file sizes', () => {
    it('should reject 26 MB', () => {
      expect(validateAudioFileSize(26 * 1024 * 1024)).toBe(false);
    });

    it('should reject 50 MB', () => {
      expect(validateAudioFileSize(50 * 1024 * 1024)).toBe(false);
    });

    it('should reject 1 byte over limit', () => {
      expect(validateAudioFileSize(AUDIO_MAX_SIZE_BYTES + 1)).toBe(false);
    });

    it('should reject zero', () => {
      expect(validateAudioFileSize(0)).toBe(false);
    });

    it('should reject negative number', () => {
      expect(validateAudioFileSize(-1024)).toBe(false);
    });

    it('should reject NaN', () => {
      expect(validateAudioFileSize(NaN)).toBe(false);
    });

    it('should reject string', () => {
      expect(validateAudioFileSize('1024' as unknown as number)).toBe(false);
    });

    it('should reject Infinity', () => {
      expect(validateAudioFileSize(Infinity)).toBe(false);
    });
  });
});

describe('getAudioFileSizeErrorMessage helper', () => {
  describe('Valid error messages', () => {
    it('should return error message for 30 MB file', () => {
      const message = getAudioFileSizeErrorMessage(30 * 1024 * 1024);
      expect(message).toContain('30.00 MB');
      expect(message).toContain('exceeds maximum allowed size');
      expect(message).toContain('25 MB');
    });

    it('should return error message for 50 MB file', () => {
      const message = getAudioFileSizeErrorMessage(50 * 1024 * 1024);
      expect(message).toContain('50.00 MB');
      expect(message).toContain('25 MB');
    });

    it('should include helpful hint for splitting audio', () => {
      const message = getAudioFileSizeErrorMessage(30 * 1024 * 1024);
      expect(message).toContain('splitting');
      expect(message).toContain('smaller chunks');
    });

    it('should format file size in MB with 2 decimals', () => {
      const message = getAudioFileSizeErrorMessage(26.5 * 1024 * 1024);
      expect(message).toMatch(/26\.5\d MB/); // 26.50 MB
    });
  });

  describe('Error messages for invalid inputs', () => {
    it('should return error message for non-number', () => {
      const message = getAudioFileSizeErrorMessage('1024' as unknown as number);
      expect(message).toContain('File size must be a number');
    });

    it('should return error message for NaN', () => {
      const message = getAudioFileSizeErrorMessage(NaN);
      expect(message).toContain('File size must be a number');
    });

    it('should return error message for zero', () => {
      const message = getAudioFileSizeErrorMessage(0);
      expect(message).toContain('File size must be positive');
    });

    it('should return error message for negative', () => {
      const message = getAudioFileSizeErrorMessage(-1024);
      expect(message).toContain('File size must be positive');
    });
  });
});

describe('DTO Integration Tests', () => {
  describe('Valid DTOs', () => {
    it('should pass validation for 10 MB file', async () => {
      const dto = new AudioUploadDto();
      dto.file = { size: 10 * 1024 * 1024 };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass validation for 25 MB file exactly', async () => {
      const dto = new AudioUploadDto();
      dto.file = { size: AUDIO_MAX_SIZE_BYTES };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass validation for 1 KB file', async () => {
      const dto = new AudioUploadDto();
      dto.file = { size: 1024 };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Invalid DTOs', () => {
    it('should fail validation for 30 MB file', async () => {
      const dto = new AudioUploadDto();
      dto.file = { size: 30 * 1024 * 1024 };

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(JSON.stringify(errors)).toContain('exceeds maximum allowed size');
    });

    it('should fail validation for 1 byte over limit', async () => {
      const dto = new AudioUploadDto();
      dto.file = { size: AUDIO_MAX_SIZE_BYTES + 1 };

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation for zero file size', async () => {
      const dto = new AudioUploadDto();
      dto.file = { size: 0 };

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(JSON.stringify(errors)).toContain('positive');
    });

    it('should fail validation for negative file size', async () => {
      const dto = new AudioUploadDto();
      dto.file = { size: -1024 };

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});

describe('Constants', () => {
  it('should have correct AUDIO_MAX_SIZE_MB constant', () => {
    expect(AUDIO_MAX_SIZE_MB).toBe(25);
  });

  it('should have correct AUDIO_MAX_SIZE_BYTES constant', () => {
    expect(AUDIO_MAX_SIZE_BYTES).toBe(25 * 1024 * 1024);
    expect(AUDIO_MAX_SIZE_BYTES).toBe(26214400);
  });
});
