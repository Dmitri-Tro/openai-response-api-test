import { validate } from 'class-validator';
import { IsImageModelSizeValidConstraint } from './image-model-size.validator';
import { CreateImagesDto } from '../dto/images/create-images.dto';

describe('IsImageModelSizeValidConstraint', () => {
  let validator: IsImageModelSizeValidConstraint;

  beforeEach(() => {
    validator = new IsImageModelSizeValidConstraint();
  });

  describe('gpt-image-1 validation', () => {
    it('should accept 1024x1024 for gpt-image-1', () => {
      const result = validator.validate('1024x1024', {
        object: { model: 'gpt-image-1' },
      } as any);
      expect(result).toBe(true);
    });

    it('should accept 1024x1536 for gpt-image-1', () => {
      const result = validator.validate('1024x1536', {
        object: { model: 'gpt-image-1' },
      } as any);
      expect(result).toBe(true);
    });

    it('should accept 1536x1024 for gpt-image-1', () => {
      const result = validator.validate('1536x1024', {
        object: { model: 'gpt-image-1' },
      } as any);
      expect(result).toBe(true);
    });

    it('should accept auto for gpt-image-1', () => {
      const result = validator.validate('auto', {
        object: { model: 'gpt-image-1' },
      } as any);
      expect(result).toBe(true);
    });

    it('should reject 256x256 for gpt-image-1', () => {
      const result = validator.validate('256x256', {
        object: { model: 'gpt-image-1' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject 512x512 for gpt-image-1', () => {
      const result = validator.validate('512x512', {
        object: { model: 'gpt-image-1' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject 1792x1024 for gpt-image-1', () => {
      const result = validator.validate('1792x1024', {
        object: { model: 'gpt-image-1' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject 1024x1792 for gpt-image-1', () => {
      const result = validator.validate('1024x1792', {
        object: { model: 'gpt-image-1' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject invalid size for gpt-image-1', () => {
      const result = validator.validate('2048x2048', {
        object: { model: 'gpt-image-1' },
      } as any);
      expect(result).toBe(false);
    });
  });

  describe('DALL-E 3 validation', () => {
    it('should accept 1024x1024 for DALL-E 3', () => {
      const result = validator.validate('1024x1024', {
        object: { model: 'dall-e-3' },
      } as any);
      expect(result).toBe(true);
    });

    it('should accept 1792x1024 for DALL-E 3', () => {
      const result = validator.validate('1792x1024', {
        object: { model: 'dall-e-3' },
      } as any);
      expect(result).toBe(true);
    });

    it('should accept 1024x1792 for DALL-E 3', () => {
      const result = validator.validate('1024x1792', {
        object: { model: 'dall-e-3' },
      } as any);
      expect(result).toBe(true);
    });

    it('should reject 512x512 for DALL-E 3', () => {
      const result = validator.validate('512x512', {
        object: { model: 'dall-e-3' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject 256x256 for DALL-E 3', () => {
      const result = validator.validate('256x256', {
        object: { model: 'dall-e-3' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject invalid size for DALL-E 3', () => {
      const result = validator.validate('2048x2048', {
        object: { model: 'dall-e-3' },
      } as any);
      expect(result).toBe(false);
    });
  });

  describe('DALL-E 2 validation', () => {
    it('should accept 256x256 for DALL-E 2', () => {
      const result = validator.validate('256x256', {
        object: { model: 'dall-e-2' },
      } as any);
      expect(result).toBe(true);
    });

    it('should accept 512x512 for DALL-E 2', () => {
      const result = validator.validate('512x512', {
        object: { model: 'dall-e-2' },
      } as any);
      expect(result).toBe(true);
    });

    it('should accept 1024x1024 for DALL-E 2', () => {
      const result = validator.validate('1024x1024', {
        object: { model: 'dall-e-2' },
      } as any);
      expect(result).toBe(true);
    });

    it('should reject 1792x1024 for DALL-E 2', () => {
      const result = validator.validate('1792x1024', {
        object: { model: 'dall-e-2' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject 1024x1792 for DALL-E 2', () => {
      const result = validator.validate('1024x1792', {
        object: { model: 'dall-e-2' },
      } as any);
      expect(result).toBe(false);
    });

    it('should reject invalid size for DALL-E 2', () => {
      const result = validator.validate('128x128', {
        object: { model: 'dall-e-2' },
      } as any);
      expect(result).toBe(false);
    });
  });

  describe('Default model (DALL-E 2)', () => {
    it('should accept 256x256 when model is undefined', () => {
      const result = validator.validate('256x256', {
        object: {},
      } as any);
      expect(result).toBe(true);
    });

    it('should accept 512x512 when model is undefined', () => {
      const result = validator.validate('512x512', {
        object: {},
      } as any);
      expect(result).toBe(true);
    });

    it('should accept 1024x1024 when model is undefined', () => {
      const result = validator.validate('1024x1024', {
        object: {},
      } as any);
      expect(result).toBe(true);
    });

    it('should reject 1792x1024 when model is undefined', () => {
      const result = validator.validate('1792x1024', {
        object: {},
      } as any);
      expect(result).toBe(false);
    });
  });

  describe('Invalid input types', () => {
    it('should allow non-string size (let @IsString() handle it)', () => {
      const result = validator.validate(1024, {
        object: { model: 'dall-e-2' },
      } as any);
      expect(result).toBe(true);
    });

    it('should allow null size (let @IsString() handle it)', () => {
      const result = validator.validate(null, {
        object: { model: 'dall-e-2' },
      } as any);
      expect(result).toBe(true);
    });

    it('should allow undefined size (let @IsOptional() handle it)', () => {
      const result = validator.validate(undefined, {
        object: { model: 'dall-e-2' },
      } as any);
      expect(result).toBe(true);
    });
  });

  describe('defaultMessage', () => {
    it('should return correct message for gpt-image-1', () => {
      const message = validator.defaultMessage({
        object: { model: 'gpt-image-1' },
        value: '256x256',
      } as any);
      expect(message).toContain('gpt-image-1');
      expect(message).toContain('1024x1024, 1024x1536, 1536x1024, auto');
    });

    it('should return correct message for DALL-E 3', () => {
      const message = validator.defaultMessage({
        object: { model: 'dall-e-3' },
      } as any);
      expect(message).toContain('DALL-E 3');
      expect(message).toContain('1024x1024, 1792x1024, 1024x1792');
    });

    it('should return correct message for DALL-E 2', () => {
      const message = validator.defaultMessage({
        object: { model: 'dall-e-2' },
      } as any);
      expect(message).toContain('DALL-E 2');
      expect(message).toContain('256x256, 512x512, 1024x1024');
    });

    it('should return DALL-E 2 message when model is undefined', () => {
      const message = validator.defaultMessage({
        object: {},
      } as any);
      expect(message).toContain('DALL-E 2');
    });
  });

  describe('Integration with DTO', () => {
    it('should validate gpt-image-1 size 1024x1024 in DTO', async () => {
      const dto = new CreateImagesDto();
      dto.model = 'gpt-image-1';
      dto.prompt = 'Test';
      dto.size = '1024x1024';

      const errors = await validate(dto);
      const sizeErrors = errors.filter((e) => e.property === 'size');
      expect(sizeErrors).toHaveLength(0);
    });

    it('should validate gpt-image-1 size auto in DTO', async () => {
      const dto = new CreateImagesDto();
      dto.model = 'gpt-image-1';
      dto.prompt = 'Test';
      dto.size = 'auto';

      const errors = await validate(dto);
      const sizeErrors = errors.filter((e) => e.property === 'size');
      expect(sizeErrors).toHaveLength(0);
    });

    it('should validate gpt-image-1 size 1024x1536 in DTO', async () => {
      const dto = new CreateImagesDto();
      dto.model = 'gpt-image-1';
      dto.prompt = 'Test';
      dto.size = '1024x1536';

      const errors = await validate(dto);
      const sizeErrors = errors.filter((e) => e.property === 'size');
      expect(sizeErrors).toHaveLength(0);
    });

    it('should reject invalid gpt-image-1 size in DTO', async () => {
      const dto = new CreateImagesDto();
      dto.model = 'gpt-image-1';
      dto.prompt = 'Test';
      dto.size = '512x512' as any;

      const errors = await validate(dto);
      const sizeErrors = errors.filter((e) => e.property === 'size');
      expect(sizeErrors.length).toBeGreaterThan(0);
    });

    it('should validate DALL-E 3 size in DTO', async () => {
      const dto = new CreateImagesDto();
      dto.model = 'dall-e-3';
      dto.prompt = 'Test';
      dto.size = '1792x1024';

      const errors = await validate(dto);
      const sizeErrors = errors.filter((e) => e.property === 'size');
      expect(sizeErrors).toHaveLength(0);
    });

    it('should reject invalid DALL-E 3 size in DTO', async () => {
      const dto = new CreateImagesDto();
      dto.model = 'dall-e-3';
      dto.prompt = 'Test';
      dto.size = '512x512' as any;

      const errors = await validate(dto);
      const sizeErrors = errors.filter((e) => e.property === 'size');
      expect(sizeErrors.length).toBeGreaterThan(0);
    });

    it('should validate DALL-E 2 size in DTO', async () => {
      const dto = new CreateImagesDto();
      dto.model = 'dall-e-2';
      dto.prompt = 'Test';
      dto.size = '512x512';

      const errors = await validate(dto);
      const sizeErrors = errors.filter((e) => e.property === 'size');
      expect(sizeErrors).toHaveLength(0);
    });

    it('should reject invalid DALL-E 2 size in DTO', async () => {
      const dto = new CreateImagesDto();
      dto.model = 'dall-e-2';
      dto.prompt = 'Test';
      dto.size = '1792x1024' as any;

      const errors = await validate(dto);
      const sizeErrors = errors.filter((e) => e.property === 'size');
      expect(sizeErrors.length).toBeGreaterThan(0);
    });
  });
});
