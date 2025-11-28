import { validate, ValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { CreateFileDto } from './create-file.dto';

/**
 * Utility function to validate DTO and return errors
 */
async function validateDto(dto: CreateFileDto): Promise<ValidationError[]> {
  return await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: false,
  });
}

/**
 * Utility function to create a valid base DTO for testing
 */
function createValidDto(): CreateFileDto {
  const dto = new CreateFileDto();
  dto.purpose = 'assistants';
  return dto;
}

describe('CreateFileDto', () => {
  describe('Valid Configurations', () => {
    it('should validate with only required field (purpose)', async () => {
      const dto = createValidDto();

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with purpose=assistants', async () => {
      const dto = createValidDto();
      dto.purpose = 'assistants';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with purpose=vision', async () => {
      const dto = createValidDto();
      dto.purpose = 'vision';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with purpose=batch', async () => {
      const dto = createValidDto();
      dto.purpose = 'batch';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with purpose=fine-tune', async () => {
      const dto = createValidDto();
      dto.purpose = 'fine-tune';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with purpose=user_data', async () => {
      const dto = createValidDto();
      dto.purpose = 'user_data';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with purpose=evals', async () => {
      const dto = createValidDto();
      dto.purpose = 'evals';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with all fields provided', async () => {
      const plain = {
        purpose: 'assistants',
        expires_after: {
          anchor: 'created_at',
          seconds: 86400,
        },
      };

      const dto = plainToClass(CreateFileDto, plain);
      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with minimum expiration (3600 seconds)', async () => {
      const plain = {
        purpose: 'assistants',
        expires_after: {
          anchor: 'created_at',
          seconds: 3600,
        },
      };

      const dto = plainToClass(CreateFileDto, plain);
      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with maximum expiration (2592000 seconds)', async () => {
      const plain = {
        purpose: 'assistants',
        expires_after: {
          anchor: 'created_at',
          seconds: 2592000,
        },
      };

      const dto = plainToClass(CreateFileDto, plain);
      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate when expires_after is undefined', async () => {
      const dto = createValidDto();
      dto.expires_after = undefined;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with mid-range expiration (86400 seconds)', async () => {
      const plain = {
        purpose: 'assistants',
        expires_after: {
          anchor: 'created_at',
          seconds: 86400,
        },
      };

      const dto = plainToClass(CreateFileDto, plain);
      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });
  });

  describe('Invalid Purpose', () => {
    it('should fail when purpose is invalid string', async () => {
      const dto = createValidDto();
      (dto as unknown as Record<string, unknown>).purpose = 'invalid-purpose';

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const purposeError = errors.find((err) => err.property === 'purpose');
      expect(purposeError).toBeDefined();
      expect(purposeError?.constraints).toHaveProperty('isEnum');
    });

    it('should fail when purpose is empty string', async () => {
      const dto = createValidDto();
      (dto as unknown as Record<string, unknown>).purpose = '';

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const purposeError = errors.find((err) => err.property === 'purpose');
      expect(purposeError).toBeDefined();
    });

    it('should fail when purpose is not a string (number)', async () => {
      const dto = createValidDto();
      (dto as unknown as Record<string, unknown>).purpose = 123;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const purposeError = errors.find((err) => err.property === 'purpose');
      expect(purposeError).toBeDefined();
    });

    it('should fail when purpose is not a string (object)', async () => {
      const dto = createValidDto();
      (dto as unknown as Record<string, unknown>).purpose = {
        value: 'assistants',
      };

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const purposeError = errors.find((err) => err.property === 'purpose');
      expect(purposeError).toBeDefined();
    });

    it('should fail when purpose is not a string (array)', async () => {
      const dto = createValidDto();
      (dto as unknown as Record<string, unknown>).purpose = ['assistants'];

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const purposeError = errors.find((err) => err.property === 'purpose');
      expect(purposeError).toBeDefined();
    });

    it('should fail when purpose is null', async () => {
      const dto = createValidDto();
      (dto as unknown as Record<string, unknown>).purpose = null;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const purposeError = errors.find((err) => err.property === 'purpose');
      expect(purposeError).toBeDefined();
    });

    it('should fail when purpose is undefined', async () => {
      const dto = new CreateFileDto();
      // Don't set purpose

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const purposeError = errors.find((err) => err.property === 'purpose');
      expect(purposeError).toBeDefined();
    });

    it('should fail when purpose is boolean', async () => {
      const dto = createValidDto();
      (dto as unknown as Record<string, unknown>).purpose = true;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const purposeError = errors.find((err) => err.property === 'purpose');
      expect(purposeError).toBeDefined();
    });
  });

  describe('Invalid ExpiresAfter', () => {
    it('should fail when anchor is invalid', async () => {
      const dto = createValidDto();
      (dto as unknown as Record<string, unknown>).expires_after = {
        anchor: 'invalid_anchor',
        seconds: 86400,
      };

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail when anchor is missing', async () => {
      const dto = createValidDto();
      (dto as unknown as Record<string, unknown>).expires_after = {
        seconds: 86400,
      };

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail when anchor is not a string', async () => {
      const dto = createValidDto();
      (dto as unknown as Record<string, unknown>).expires_after = {
        anchor: 123,
        seconds: 86400,
      };

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail when seconds is below minimum (3599)', async () => {
      const dto = createValidDto();
      (dto as unknown as Record<string, unknown>).expires_after = {
        anchor: 'created_at',
        seconds: 3599,
      };

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail when seconds is above maximum (2592001)', async () => {
      const dto = createValidDto();
      (dto as unknown as Record<string, unknown>).expires_after = {
        anchor: 'created_at',
        seconds: 2592001,
      };

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail when seconds is zero', async () => {
      const dto = createValidDto();
      (dto as unknown as Record<string, unknown>).expires_after = {
        anchor: 'created_at',
        seconds: 0,
      };

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail when seconds is negative', async () => {
      const dto = createValidDto();
      (dto as unknown as Record<string, unknown>).expires_after = {
        anchor: 'created_at',
        seconds: -100,
      };

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail when seconds is not a number (string)', async () => {
      const dto = createValidDto();
      (dto as unknown as Record<string, unknown>).expires_after = {
        anchor: 'created_at',
        seconds: '86400',
      };

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail when seconds is missing', async () => {
      const dto = createValidDto();
      (dto as unknown as Record<string, unknown>).expires_after = {
        anchor: 'created_at',
      };

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail when seconds is null', async () => {
      const dto = createValidDto();
      (dto as unknown as Record<string, unknown>).expires_after = {
        anchor: 'created_at',
        seconds: null,
      };

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail when expires_after is empty object', async () => {
      const dto = createValidDto();
      (dto as unknown as Record<string, unknown>).expires_after = {};

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail when expires_after is not an object (string)', async () => {
      const dto = createValidDto();
      (dto as unknown as Record<string, unknown>).expires_after = 'invalid';

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail when expires_after is not an object (number)', async () => {
      const dto = createValidDto();
      (dto as unknown as Record<string, unknown>).expires_after = 86400;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail when expires_after is an array', async () => {
      const dto = createValidDto();
      (dto as unknown as Record<string, unknown>).expires_after = [
        { anchor: 'created_at', seconds: 86400 },
      ];

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail when seconds is a decimal (3600.5)', async () => {
      const dto = createValidDto();
      (dto as unknown as Record<string, unknown>).expires_after = {
        anchor: 'created_at',
        seconds: 3600.5,
      };

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('PlainToClass Transformation', () => {
    it('should transform plain object with valid data', () => {
      const plain = {
        purpose: 'assistants',
        expires_after: {
          anchor: 'created_at',
          seconds: 86400,
        },
      };

      const dto = plainToClass(CreateFileDto, plain);

      expect(dto.purpose).toBe('assistants');
      expect(dto.expires_after).toBeDefined();
      expect(dto.expires_after?.anchor).toBe('created_at');
      expect(dto.expires_after?.seconds).toBe(86400);
    });

    it('should transform plain object without expires_after', () => {
      const plain = {
        purpose: 'vision',
      };

      const dto = plainToClass(CreateFileDto, plain);

      expect(dto.purpose).toBe('vision');
      expect(dto.expires_after).toBeUndefined();
    });

    it('should transform and validate purpose enum correctly', async () => {
      const plain = {
        purpose: 'batch',
      };

      const dto = plainToClass(CreateFileDto, plain);
      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should transform and fail with invalid purpose', async () => {
      const plain = {
        purpose: 'invalid',
      };

      const dto = plainToClass(CreateFileDto, plain);
      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle expires_after with boundary value 3600', async () => {
      const plain = {
        purpose: 'assistants',
        expires_after: {
          anchor: 'created_at',
          seconds: 3600,
        },
      };

      const dto = plainToClass(CreateFileDto, plain);
      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should handle expires_after with boundary value 2592000', async () => {
      const plain = {
        purpose: 'assistants',
        expires_after: {
          anchor: 'created_at',
          seconds: 2592000,
        },
      };

      const dto = plainToClass(CreateFileDto, plain);
      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject expires_after with seconds just below minimum', async () => {
      const dto = createValidDto();
      (dto as unknown as Record<string, unknown>).expires_after = {
        anchor: 'created_at',
        seconds: 3599,
      };

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject expires_after with seconds just above maximum', async () => {
      const dto = createValidDto();
      (dto as unknown as Record<string, unknown>).expires_after = {
        anchor: 'created_at',
        seconds: 2592001,
      };

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
