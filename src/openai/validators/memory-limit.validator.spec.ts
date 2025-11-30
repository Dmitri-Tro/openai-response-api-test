import { validate } from 'class-validator';
import {
  IsMemoryLimitConstraint,
  IsMemoryLimitValid,
} from './memory-limit.validator';
import type { MemoryLimit } from './memory-limit.validator';
import { IsOptional } from 'class-validator';

// Test DTO for integration tests
class CodeInterpreterConfigDto {
  @IsOptional()
  @IsMemoryLimitValid()
  memory_limit?: MemoryLimit;
}

describe('IsMemoryLimitConstraint', () => {
  let validator: IsMemoryLimitConstraint;

  beforeEach(() => {
    validator = new IsMemoryLimitConstraint();
  });

  describe('Valid memory limits', () => {
    it('should accept "1g" memory limit', () => {
      const result = validator.validate('1g');
      expect(result).toBe(true);
    });

    it('should accept "4g" memory limit', () => {
      const result = validator.validate('4g');
      expect(result).toBe(true);
    });

    it('should accept "16g" memory limit', () => {
      const result = validator.validate('16g');
      expect(result).toBe(true);
    });

    it('should accept "64g" memory limit', () => {
      const result = validator.validate('64g');
      expect(result).toBe(true);
    });

    it('should accept undefined (optional field)', () => {
      const result = validator.validate(undefined);
      expect(result).toBe(true);
    });

    it('should accept null (optional field)', () => {
      const result = validator.validate(null);
      expect(result).toBe(true);
    });
  });

  describe('Invalid memory limits - wrong format', () => {
    it('should reject "2g" (not a supported size)', () => {
      const result = validator.validate('2g');
      expect(result).toBe(false);
    });

    it('should reject "8g" (not a supported size)', () => {
      const result = validator.validate('8g');
      expect(result).toBe(false);
    });

    it('should reject "32g" (not a supported size)', () => {
      const result = validator.validate('32g');
      expect(result).toBe(false);
    });

    it('should reject "128g" (not a supported size)', () => {
      const result = validator.validate('128g');
      expect(result).toBe(false);
    });

    it('should reject "1G" (uppercase)', () => {
      const result = validator.validate('1G');
      expect(result).toBe(false);
    });

    it('should reject "4G" (uppercase)', () => {
      const result = validator.validate('4G');
      expect(result).toBe(false);
    });

    it('should reject "1gb" (wrong suffix)', () => {
      const result = validator.validate('1gb');
      expect(result).toBe(false);
    });

    it('should reject "1024m" (MB notation)', () => {
      const result = validator.validate('1024m');
      expect(result).toBe(false);
    });

    it('should reject "4096m" (MB notation)', () => {
      const result = validator.validate('4096m');
      expect(result).toBe(false);
    });

    it('should reject empty string', () => {
      const result = validator.validate('');
      expect(result).toBe(false);
    });

    it('should reject "auto"', () => {
      const result = validator.validate('auto');
      expect(result).toBe(false);
    });

    it('should reject "default"', () => {
      const result = validator.validate('default');
      expect(result).toBe(false);
    });
  });

  describe('Invalid memory limits - wrong types', () => {
    it('should reject number 1', () => {
      const result = validator.validate(1);
      expect(result).toBe(false);
    });

    it('should reject number 4', () => {
      const result = validator.validate(4);
      expect(result).toBe(false);
    });

    it('should reject object { value: "4g" }', () => {
      const result = validator.validate({ value: '4g' });
      expect(result).toBe(false);
    });

    it('should reject array ["4g"]', () => {
      const result = validator.validate(['4g']);
      expect(result).toBe(false);
    });

    it('should reject boolean true', () => {
      const result = validator.validate(true);
      expect(result).toBe(false);
    });

    it('should reject boolean false', () => {
      const result = validator.validate(false);
      expect(result).toBe(false);
    });
  });

  describe('Default error messages', () => {
    it('should return correct error message', () => {
      const message = validator.defaultMessage();
      expect(message).toBe('memory_limit must be one of: 1g, 4g, 16g, 64g');
    });

    it('should contain all valid options', () => {
      const message = validator.defaultMessage();
      expect(message).toContain('1g');
      expect(message).toContain('4g');
      expect(message).toContain('16g');
      expect(message).toContain('64g');
    });
  });
});

describe('DTO Integration Tests', () => {
  describe('Valid DTOs', () => {
    it('should pass validation for "1g"', async () => {
      const dto = new CodeInterpreterConfigDto();
      dto.memory_limit = '1g';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass validation for "4g"', async () => {
      const dto = new CodeInterpreterConfigDto();
      dto.memory_limit = '4g';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass validation for "16g"', async () => {
      const dto = new CodeInterpreterConfigDto();
      dto.memory_limit = '16g';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass validation for "64g"', async () => {
      const dto = new CodeInterpreterConfigDto();
      dto.memory_limit = '64g';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass validation for undefined (optional field)', async () => {
      const dto = new CodeInterpreterConfigDto();
      // memory_limit is undefined by default

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Invalid DTOs', () => {
    it('should fail validation for "2g"', async () => {
      const dto = new CodeInterpreterConfigDto();
      dto.memory_limit = '2g' as MemoryLimit;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(JSON.stringify(errors)).toContain(
        'memory_limit must be one of: 1g, 4g, 16g, 64g',
      );
    });

    it('should fail validation for "8g"', async () => {
      const dto = new CodeInterpreterConfigDto();
      dto.memory_limit = '8g' as MemoryLimit;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation for "1G" (uppercase)', async () => {
      const dto = new CodeInterpreterConfigDto();
      dto.memory_limit = '1G' as MemoryLimit;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation for empty string', async () => {
      const dto = new CodeInterpreterConfigDto();
      dto.memory_limit = '' as MemoryLimit;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation for number type', async () => {
      const dto = new CodeInterpreterConfigDto();
      dto.memory_limit = 4 as unknown as MemoryLimit;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});

describe('MemoryLimit Type', () => {
  it('should allow "1g" type', () => {
    const limit: MemoryLimit = '1g';
    expect(limit).toBe('1g');
  });

  it('should allow "4g" type', () => {
    const limit: MemoryLimit = '4g';
    expect(limit).toBe('4g');
  });

  it('should allow "16g" type', () => {
    const limit: MemoryLimit = '16g';
    expect(limit).toBe('16g');
  });

  it('should allow "64g" type', () => {
    const limit: MemoryLimit = '64g';
    expect(limit).toBe('64g');
  });
});
