import { validate, ValidationArguments } from 'class-validator';
import { IsVideoSizeConstraint } from './video-size.validator';
import { CreateVideoDto } from '../dto/create-video.dto';

describe('IsVideoSizeConstraint', () => {
  let validator: IsVideoSizeConstraint;

  beforeEach(() => {
    validator = new IsVideoSizeConstraint();
  });

  describe('Valid sizes', () => {
    it('should accept 720x1280 (portrait standard)', () => {
      const result = validator.validate('720x1280');
      expect(result).toBe(true);
    });

    it('should accept 1280x720 (landscape standard)', () => {
      const result = validator.validate('1280x720');
      expect(result).toBe(true);
    });

    it('should accept 1024x1792 (portrait hi-res)', () => {
      const result = validator.validate('1024x1792');
      expect(result).toBe(true);
    });

    it('should accept 1792x1024 (landscape hi-res)', () => {
      const result = validator.validate('1792x1024');
      expect(result).toBe(true);
    });
  });

  describe('Invalid sizes - wrong format', () => {
    it('should reject non-string size (number)', () => {
      const result = validator.validate(1280);
      expect(result).toBe(false);
    });

    it('should reject non-string size (object)', () => {
      const result = validator.validate({ width: 1280, height: 720 });
      expect(result).toBe(false);
    });

    it('should reject non-string size (array)', () => {
      const result = validator.validate([1280, 720]);
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
  });

  describe('Invalid sizes - unsupported resolutions', () => {
    it('should reject 1920x1080 (16:9 but unsupported)', () => {
      const result = validator.validate('1920x1080');
      expect(result).toBe(false);
    });

    it('should reject 512x512 (square)', () => {
      const result = validator.validate('512x512');
      expect(result).toBe(false);
    });

    it('should reject 1024x1024 (square)', () => {
      const result = validator.validate('1024x1024');
      expect(result).toBe(false);
    });

    it('should reject 1080x1920 (portrait but unsupported)', () => {
      const result = validator.validate('1080x1920');
      expect(result).toBe(false);
    });

    it('should reject 640x480 (4:3)', () => {
      const result = validator.validate('640x480');
      expect(result).toBe(false);
    });

    it('should reject 3840x2160 (4K)', () => {
      const result = validator.validate('3840x2160');
      expect(result).toBe(false);
    });
  });

  describe('Invalid sizes - malformed strings', () => {
    it('should reject empty string', () => {
      const result = validator.validate('');
      expect(result).toBe(false);
    });

    it('should reject malformed string (missing height)', () => {
      const result = validator.validate('1280x');
      expect(result).toBe(false);
    });

    it('should reject malformed string (missing width)', () => {
      const result = validator.validate('x720');
      expect(result).toBe(false);
    });

    it('should reject malformed string (no x separator)', () => {
      const result = validator.validate('1280-720');
      expect(result).toBe(false);
    });

    it('should reject malformed string (space separator)', () => {
      const result = validator.validate('1280 720');
      expect(result).toBe(false);
    });

    it('should reject malformed string (non-numeric)', () => {
      const result = validator.validate('widthxheight');
      expect(result).toBe(false);
    });
  });

  describe('Error messages', () => {
    it('should return appropriate message for non-string type', () => {
      const message = validator.defaultMessage({
        value: 1280,
      } as ValidationArguments);

      expect(message).toContain('must be a string');
      expect(message).toContain('WIDTHxHEIGHT');
      expect(message).toContain('number');
    });

    it('should return appropriate message for unsupported valid-format size', () => {
      const message = validator.defaultMessage({
        value: '1920x1080',
      } as ValidationArguments);

      expect(message).toContain('not supported');
      expect(message).toContain('720x1280');
      expect(message).toContain('1280x720');
      expect(message).toContain('portrait');
      expect(message).toContain('landscape');
    });

    it('should return appropriate message for malformed string', () => {
      const message = validator.defaultMessage({
        value: 'invalid-size',
      } as ValidationArguments);

      expect(message).toContain('Invalid video size format');
      expect(message).toContain('WIDTHxHEIGHT');
      expect(message).toContain('720x1280');
    });
  });

  describe('Integration with DTO', () => {
    it('should validate 720x1280 in DTO', async () => {
      const dto = new CreateVideoDto();
      dto.prompt = 'Test video';
      dto.size = '720x1280';

      const errors = await validate(dto);
      const sizeErrors = errors.filter((e) => e.property === 'size');

      expect(sizeErrors).toHaveLength(0);
    });

    it('should validate 1280x720 in DTO', async () => {
      const dto = new CreateVideoDto();
      dto.prompt = 'Test video';
      dto.size = '1280x720';

      const errors = await validate(dto);
      const sizeErrors = errors.filter((e) => e.property === 'size');

      expect(sizeErrors).toHaveLength(0);
    });

    it('should validate 1024x1792 in DTO', async () => {
      const dto = new CreateVideoDto();
      dto.prompt = 'Test video';
      dto.size = '1024x1792';

      const errors = await validate(dto);
      const sizeErrors = errors.filter((e) => e.property === 'size');

      expect(sizeErrors).toHaveLength(0);
    });

    it('should validate 1792x1024 in DTO', async () => {
      const dto = new CreateVideoDto();
      dto.prompt = 'Test video';
      dto.size = '1792x1024';

      const errors = await validate(dto);
      const sizeErrors = errors.filter((e) => e.property === 'size');

      expect(sizeErrors).toHaveLength(0);
    });

    it('should reject invalid size in DTO', async () => {
      const dto = new CreateVideoDto();
      dto.prompt = 'Test video';
      dto.size = '1920x1080' as unknown as typeof dto.size;

      const errors = await validate(dto);
      const sizeErrors = errors.filter((e) => e.property === 'size');

      expect(sizeErrors.length).toBeGreaterThan(0);
    });

    it('should allow omitting size (optional field)', async () => {
      const dto = new CreateVideoDto();
      dto.prompt = 'Test video';
      // size is omitted

      const errors = await validate(dto);
      const sizeErrors = errors.filter((e) => e.property === 'size');

      expect(sizeErrors).toHaveLength(0);
    });
  });
});
