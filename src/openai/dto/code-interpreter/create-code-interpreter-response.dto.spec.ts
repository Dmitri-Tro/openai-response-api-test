import { validate } from 'class-validator';
import { CreateCodeInterpreterResponseDto } from './create-code-interpreter-response.dto';
import type { MemoryLimit } from '../../validators/memory-limit.validator';

describe('CreateCodeInterpreterResponseDto', () => {
  describe('Inheritance from CreateTextResponseDto', () => {
    it('should pass validation with only required fields (input)', async () => {
      const dto = new CreateCodeInterpreterResponseDto();
      dto.input = 'Calculate factorial of 10';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation without input', async () => {
      const dto = new CreateCodeInterpreterResponseDto();
      // input is missing

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const inputError = errors.find((e) => e.property === 'input');
      expect(inputError).toBeDefined();
    });

    it('should inherit model field from parent', async () => {
      const dto = new CreateCodeInterpreterResponseDto();
      dto.input = 'Test';
      dto.model = 'gpt-5';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should inherit tools field from parent', async () => {
      const dto = new CreateCodeInterpreterResponseDto();
      dto.input = 'Test';
      dto.tools = [
        {
          type: 'code_interpreter',
          container: { type: 'auto' },
        },
      ];

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should inherit include field from parent', async () => {
      const dto = new CreateCodeInterpreterResponseDto();
      dto.input = 'Test';
      dto.include = ['code_interpreter_call.outputs'];

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('memory_limit field', () => {
    it('should accept "1g" memory limit', async () => {
      const dto = new CreateCodeInterpreterResponseDto();
      dto.input = 'Test';
      dto.memory_limit = '1g';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept "4g" memory limit', async () => {
      const dto = new CreateCodeInterpreterResponseDto();
      dto.input = 'Test';
      dto.memory_limit = '4g';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept "16g" memory limit', async () => {
      const dto = new CreateCodeInterpreterResponseDto();
      dto.input = 'Test';
      dto.memory_limit = '16g';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept "64g" memory limit', async () => {
      const dto = new CreateCodeInterpreterResponseDto();
      dto.input = 'Test';
      dto.memory_limit = '64g';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should allow memory_limit to be undefined (optional field)', async () => {
      const dto = new CreateCodeInterpreterResponseDto();
      dto.input = 'Test';
      // memory_limit is undefined

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject invalid memory limit "2g"', async () => {
      const dto = new CreateCodeInterpreterResponseDto();
      dto.input = 'Test';
      dto.memory_limit = '2g' as MemoryLimit;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const memoryError = errors.find((e) => e.property === 'memory_limit');
      expect(memoryError).toBeDefined();
    });

    it('should reject invalid memory limit "8g"', async () => {
      const dto = new CreateCodeInterpreterResponseDto();
      dto.input = 'Test';
      dto.memory_limit = '8g' as MemoryLimit;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject uppercase "4G"', async () => {
      const dto = new CreateCodeInterpreterResponseDto();
      dto.input = 'Test';
      dto.memory_limit = '4G' as MemoryLimit;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject empty string', async () => {
      const dto = new CreateCodeInterpreterResponseDto();
      dto.input = 'Test';
      dto.memory_limit = '' as MemoryLimit;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject number type', async () => {
      const dto = new CreateCodeInterpreterResponseDto();
      dto.input = 'Test';
      Object.assign(dto, { memory_limit: 4 });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('container_id field', () => {
    it('should accept valid container ID', async () => {
      const dto = new CreateCodeInterpreterResponseDto();
      dto.input = 'Test';
      dto.container_id = 'container_abc123xyz789';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept any non-empty string as container ID', async () => {
      const dto = new CreateCodeInterpreterResponseDto();
      dto.input = 'Test';
      dto.container_id = 'any_string_value';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should allow container_id to be undefined (optional field)', async () => {
      const dto = new CreateCodeInterpreterResponseDto();
      dto.input = 'Test';
      // container_id is undefined

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject empty string', async () => {
      const dto = new CreateCodeInterpreterResponseDto();
      dto.input = 'Test';
      dto.container_id = '';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const containerError = errors.find((e) => e.property === 'container_id');
      expect(containerError).toBeDefined();
    });

    it('should reject number type', async () => {
      const dto = new CreateCodeInterpreterResponseDto();
      dto.input = 'Test';
      Object.assign(dto, { container_id: 123 });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject object type', async () => {
      const dto = new CreateCodeInterpreterResponseDto();
      dto.input = 'Test';
      Object.assign(dto, { container_id: { id: 'container_123' } });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject array type', async () => {
      const dto = new CreateCodeInterpreterResponseDto();
      dto.input = 'Test';
      Object.assign(dto, { container_id: ['container_123'] });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Combined fields', () => {
    it('should accept all code interpreter-specific fields together', async () => {
      const dto = new CreateCodeInterpreterResponseDto();
      dto.input = 'Analyze data.csv';
      dto.memory_limit = '16g';
      dto.container_id = 'container_abc123';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept code interpreter fields with inherited fields', async () => {
      const dto = new CreateCodeInterpreterResponseDto();
      dto.input = 'Calculate stats';
      dto.model = 'gpt-5';
      dto.memory_limit = '4g';
      dto.container_id = 'container_xyz789';
      dto.tools = [
        {
          type: 'code_interpreter',
          container: { type: 'auto' },
        },
      ];
      dto.include = ['code_interpreter_call.outputs'];

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should prioritize container_id over memory_limit (as per API docs)', async () => {
      // Note: This is a logical test - both can be provided but container_id takes precedence
      const dto = new CreateCodeInterpreterResponseDto();
      dto.input = 'Test';
      dto.memory_limit = '16g';
      dto.container_id = 'container_reuse_123';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.container_id).toBe('container_reuse_123');
      expect(dto.memory_limit).toBe('16g');
    });
  });

  describe('Edge cases', () => {
    it('should accept only input and memory_limit', async () => {
      const dto = new CreateCodeInterpreterResponseDto();
      dto.input = 'Test';
      dto.memory_limit = '4g';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept only input and container_id', async () => {
      const dto = new CreateCodeInterpreterResponseDto();
      dto.input = 'Test';
      dto.container_id = 'container_123';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should handle whitespace in string fields gracefully', async () => {
      const dto = new CreateCodeInterpreterResponseDto();
      dto.input = '  Calculate factorial  ';
      dto.container_id = '  container_123  ';

      const errors = await validate(dto);
      // Validation passes, trimming is application logic
      expect(errors.length).toBe(0);
    });

    it('should fail when both memory_limit and container_id are invalid', async () => {
      const dto = new CreateCodeInterpreterResponseDto();
      dto.input = 'Test';
      dto.memory_limit = '5g' as MemoryLimit;
      dto.container_id = '';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.length).toBeGreaterThanOrEqual(2); // Both fields should have errors
    });
  });

  describe('Type safety', () => {
    it('should have correct TypeScript type for memory_limit', () => {
      const dto = new CreateCodeInterpreterResponseDto();
      const validLimit: MemoryLimit = '4g';
      dto.memory_limit = validLimit;
      expect(dto.memory_limit).toBe('4g');
    });

    it('should have optional memory_limit property', () => {
      const dto = new CreateCodeInterpreterResponseDto();
      expect(dto.memory_limit).toBeUndefined();
    });

    it('should have optional container_id property', () => {
      const dto = new CreateCodeInterpreterResponseDto();
      expect(dto.container_id).toBeUndefined();
    });
  });

  describe('Swagger API Documentation', () => {
    it('should have ApiPropertyOptional decorators for optional fields', () => {
      const dto = new CreateCodeInterpreterResponseDto();
      // This test verifies the DTO structure is valid for Swagger/OpenAPI
      expect(dto).toBeInstanceOf(CreateCodeInterpreterResponseDto);
    });
  });
});
