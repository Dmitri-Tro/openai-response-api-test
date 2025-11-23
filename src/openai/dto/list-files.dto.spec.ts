import { validate, ValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { ListFilesDto } from './list-files.dto';

/**
 * Utility function to validate DTO and return errors
 */
async function validateDto(dto: ListFilesDto): Promise<ValidationError[]> {
  return await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: false,
  });
}

/**
 * Utility function to create a valid base DTO for testing
 */
function createValidDto(): ListFilesDto {
  return new ListFilesDto();
}

describe('ListFilesDto', () => {
  describe('Valid Configurations', () => {
    it('should validate with no fields provided', async () => {
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

    it('should validate with order=asc', async () => {
      const dto = createValidDto();
      dto.order = 'asc';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with order=desc', async () => {
      const dto = createValidDto();
      dto.order = 'desc';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with minimum limit (1)', async () => {
      const dto = createValidDto();
      dto.limit = 1;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with limit=10', async () => {
      const dto = createValidDto();
      dto.limit = 10;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with limit=100', async () => {
      const dto = createValidDto();
      dto.limit = 100;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with limit=1000', async () => {
      const dto = createValidDto();
      dto.limit = 1000;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with limit=10000', async () => {
      const dto = createValidDto();
      dto.limit = 10000;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with all fields provided', async () => {
      const dto = createValidDto();
      dto.purpose = 'assistants';
      dto.order = 'asc';
      dto.limit = 50;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with purpose and order', async () => {
      const dto = createValidDto();
      dto.purpose = 'vision';
      dto.order = 'desc';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with purpose and limit', async () => {
      const dto = createValidDto();
      dto.purpose = 'batch';
      dto.limit = 25;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with order and limit', async () => {
      const dto = createValidDto();
      dto.order = 'asc';
      dto.limit = 75;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });
  });

  describe('Invalid Purpose', () => {
    it('should fail when purpose is invalid string', async () => {
      const dto = createValidDto();
      (dto as any).purpose = 'invalid-purpose';

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const purposeError = errors.find((err) => err.property === 'purpose');
      expect(purposeError).toBeDefined();
      expect(purposeError?.constraints).toHaveProperty('isEnum');
    });

    it('should fail when purpose is empty string', async () => {
      const dto = createValidDto();
      (dto as any).purpose = '';

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const purposeError = errors.find((err) => err.property === 'purpose');
      expect(purposeError).toBeDefined();
    });

    it('should fail when purpose is not a string (number)', async () => {
      const dto = createValidDto();
      (dto as any).purpose = 123;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const purposeError = errors.find((err) => err.property === 'purpose');
      expect(purposeError).toBeDefined();
    });

    it('should fail when purpose is not a string (object)', async () => {
      const dto = createValidDto();
      (dto as any).purpose = { value: 'assistants' };

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const purposeError = errors.find((err) => err.property === 'purpose');
      expect(purposeError).toBeDefined();
    });

    it('should fail when purpose is not a string (array)', async () => {
      const dto = createValidDto();
      (dto as any).purpose = ['assistants'];

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const purposeError = errors.find((err) => err.property === 'purpose');
      expect(purposeError).toBeDefined();
    });

    it('should fail when purpose is boolean', async () => {
      const dto = createValidDto();
      (dto as any).purpose = true;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const purposeError = errors.find((err) => err.property === 'purpose');
      expect(purposeError).toBeDefined();
    });
  });

  describe('Invalid Order', () => {
    it('should fail when order is invalid string', async () => {
      const dto = createValidDto();
      (dto as any).order = 'invalid';

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const orderError = errors.find((err) => err.property === 'order');
      expect(orderError).toBeDefined();
      expect(orderError?.constraints).toHaveProperty('isEnum');
    });

    it('should fail when order is empty string', async () => {
      const dto = createValidDto();
      (dto as any).order = '';

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const orderError = errors.find((err) => err.property === 'order');
      expect(orderError).toBeDefined();
    });

    it('should fail when order is not a string (number)', async () => {
      const dto = createValidDto();
      (dto as any).order = 123;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const orderError = errors.find((err) => err.property === 'order');
      expect(orderError).toBeDefined();
    });

    it('should fail when order is not a string (object)', async () => {
      const dto = createValidDto();
      (dto as any).order = { value: 'asc' };

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const orderError = errors.find((err) => err.property === 'order');
      expect(orderError).toBeDefined();
    });

    it('should fail when order is not a string (array)', async () => {
      const dto = createValidDto();
      (dto as any).order = ['asc'];

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const orderError = errors.find((err) => err.property === 'order');
      expect(orderError).toBeDefined();
    });

    it('should fail when order is boolean', async () => {
      const dto = createValidDto();
      (dto as any).order = true;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const orderError = errors.find((err) => err.property === 'order');
      expect(orderError).toBeDefined();
    });

    it('should fail when order is uppercase ASC', async () => {
      const dto = createValidDto();
      (dto as any).order = 'ASC';

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const orderError = errors.find((err) => err.property === 'order');
      expect(orderError).toBeDefined();
    });

    it('should fail when order is uppercase DESC', async () => {
      const dto = createValidDto();
      (dto as any).order = 'DESC';

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const orderError = errors.find((err) => err.property === 'order');
      expect(orderError).toBeDefined();
    });
  });

  describe('Invalid Limit', () => {
    it('should fail when limit is zero', async () => {
      const dto = createValidDto();
      dto.limit = 0;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const limitError = errors.find((err) => err.property === 'limit');
      expect(limitError).toBeDefined();
      expect(limitError?.constraints).toHaveProperty('min');
    });

    it('should fail when limit is negative', async () => {
      const dto = createValidDto();
      dto.limit = -1;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const limitError = errors.find((err) => err.property === 'limit');
      expect(limitError).toBeDefined();
    });

    it('should fail when limit is not a number (string)', async () => {
      const dto = createValidDto();
      (dto as any).limit = '10';

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const limitError = errors.find((err) => err.property === 'limit');
      expect(limitError).toBeDefined();
      expect(limitError?.constraints).toHaveProperty('isNumber');
    });

    it('should fail when limit is not a number (object)', async () => {
      const dto = createValidDto();
      (dto as any).limit = { value: 10 };

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const limitError = errors.find((err) => err.property === 'limit');
      expect(limitError).toBeDefined();
    });

    it('should fail when limit is not a number (array)', async () => {
      const dto = createValidDto();
      (dto as any).limit = [10];

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const limitError = errors.find((err) => err.property === 'limit');
      expect(limitError).toBeDefined();
    });

    it('should fail when limit is boolean', async () => {
      const dto = createValidDto();
      (dto as any).limit = true;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const limitError = errors.find((err) => err.property === 'limit');
      expect(limitError).toBeDefined();
    });
  });

  describe('PlainToClass Transformation', () => {
    it('should transform plain object with all fields', () => {
      const plain = {
        purpose: 'assistants',
        order: 'asc',
        limit: '50',
      };

      const dto = plainToClass(ListFilesDto, plain);

      expect(dto.purpose).toBe('assistants');
      expect(dto.order).toBe('asc');
      expect(dto.limit).toBe(50);
    });

    it('should transform plain object with no fields', () => {
      const plain = {};

      const dto = plainToClass(ListFilesDto, plain);

      expect(dto.purpose).toBeUndefined();
      expect(dto.order).toBeUndefined();
      expect(dto.limit).toBeUndefined();
    });

    it('should transform plain object with only purpose', () => {
      const plain = {
        purpose: 'vision',
      };

      const dto = plainToClass(ListFilesDto, plain);

      expect(dto.purpose).toBe('vision');
      expect(dto.order).toBeUndefined();
      expect(dto.limit).toBeUndefined();
    });

    it('should transform plain object with only order', () => {
      const plain = {
        order: 'desc',
      };

      const dto = plainToClass(ListFilesDto, plain);

      expect(dto.purpose).toBeUndefined();
      expect(dto.order).toBe('desc');
      expect(dto.limit).toBeUndefined();
    });

    it('should transform plain object with only limit', () => {
      const plain = {
        limit: '25',
      };

      const dto = plainToClass(ListFilesDto, plain);

      expect(dto.purpose).toBeUndefined();
      expect(dto.order).toBeUndefined();
      expect(dto.limit).toBe(25);
    });

    it('should transform limit from string to number', async () => {
      const plain = {
        limit: '100',
      };

      const dto = plainToClass(ListFilesDto, plain);
      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
      expect(dto.limit).toBe(100);
      expect(typeof dto.limit).toBe('number');
    });

    it('should transform and validate purpose enum correctly', async () => {
      const plain = {
        purpose: 'batch',
      };

      const dto = plainToClass(ListFilesDto, plain);
      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should transform and fail with invalid purpose', async () => {
      const plain = {
        purpose: 'invalid',
      };

      const dto = plainToClass(ListFilesDto, plain);
      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should transform and fail with invalid order', async () => {
      const plain = {
        order: 'invalid',
      };

      const dto = plainToClass(ListFilesDto, plain);
      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should transform and fail with invalid limit', async () => {
      const plain = {
        limit: '0',
      };

      const dto = plainToClass(ListFilesDto, plain);
      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle boundary value limit=1', async () => {
      const dto = createValidDto();
      dto.limit = 1;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject limit just below minimum', async () => {
      const dto = createValidDto();
      dto.limit = 0;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle very large limit (10000)', async () => {
      const dto = createValidDto();
      dto.limit = 10000;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should handle all combinations of valid fields', async () => {
      const combinations = [
        { purpose: 'assistants' },
        { order: 'asc' },
        { limit: 50 },
        { purpose: 'vision', order: 'asc' },
        { purpose: 'batch', limit: 25 },
        { order: 'desc', limit: 75 },
        { purpose: 'fine-tune', order: 'desc', limit: 100 },
      ];

      for (const fields of combinations) {
        const dto = Object.assign(createValidDto(), fields);
        const errors = await validateDto(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should handle empty DTO (all fields undefined)', async () => {
      const dto = createValidDto();

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });
  });
});
