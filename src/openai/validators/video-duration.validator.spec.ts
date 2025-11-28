import { validate, ValidationArguments } from 'class-validator';
import { IsVideoDurationConstraint } from './video-duration.validator';
import { CreateVideoDto } from '../dto/create-video.dto';

describe('IsVideoDurationConstraint', () => {
  let validator: IsVideoDurationConstraint;

  beforeEach(() => {
    validator = new IsVideoDurationConstraint();
  });

  describe('Valid durations', () => {
    it('should accept "4" (4 seconds)', () => {
      const result = validator.validate('4');
      expect(result).toBe(true);
    });

    it('should accept "8" (8 seconds)', () => {
      const result = validator.validate('8');
      expect(result).toBe(true);
    });

    it('should accept "12" (12 seconds)', () => {
      const result = validator.validate('12');
      expect(result).toBe(true);
    });
  });

  describe('Invalid durations - wrong type', () => {
    it('should reject number 4 (must be string)', () => {
      const result = validator.validate(4);
      expect(result).toBe(false);
    });

    it('should reject number 8 (must be string)', () => {
      const result = validator.validate(8);
      expect(result).toBe(false);
    });

    it('should reject number 12 (must be string)', () => {
      const result = validator.validate(12);
      expect(result).toBe(false);
    });

    it('should reject object', () => {
      const result = validator.validate({ seconds: 4 });
      expect(result).toBe(false);
    });

    it('should reject array', () => {
      const result = validator.validate([4]);
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

  describe('Invalid durations - unsupported values', () => {
    it('should reject "2" (too short)', () => {
      const result = validator.validate('2');
      expect(result).toBe(false);
    });

    it('should reject "3" (too short)', () => {
      const result = validator.validate('3');
      expect(result).toBe(false);
    });

    it('should reject "6" (not supported)', () => {
      const result = validator.validate('6');
      expect(result).toBe(false);
    });

    it('should reject "10" (not supported)', () => {
      const result = validator.validate('10');
      expect(result).toBe(false);
    });

    it('should reject "15" (too long)', () => {
      const result = validator.validate('15');
      expect(result).toBe(false);
    });

    it('should reject "20" (too long)', () => {
      const result = validator.validate('20');
      expect(result).toBe(false);
    });

    it('should reject "100" (way too long)', () => {
      const result = validator.validate('100');
      expect(result).toBe(false);
    });
  });

  describe('Invalid durations - malformed strings', () => {
    it('should reject empty string', () => {
      const result = validator.validate('');
      expect(result).toBe(false);
    });

    it('should reject non-numeric string', () => {
      const result = validator.validate('four');
      expect(result).toBe(false);
    });

    it('should reject string with units', () => {
      const result = validator.validate('4s');
      expect(result).toBe(false);
    });

    it('should reject string with spaces', () => {
      const result = validator.validate(' 4 ');
      expect(result).toBe(false);
    });

    it('should reject decimal string', () => {
      const result = validator.validate('4.5');
      expect(result).toBe(false);
    });
  });

  describe('Error messages', () => {
    it('should return appropriate message for number type', () => {
      const message = validator.defaultMessage({
        value: 4,
      } as ValidationArguments);

      expect(message).toContain('must be a string literal');
      expect(message).toContain('not a number');
      expect(message).toContain('"4"');
      expect(message).toContain('instead of 4');
    });

    it('should return appropriate message for non-number non-string type', () => {
      const message = validator.defaultMessage({
        value: true,
      } as ValidationArguments);

      expect(message).toContain('must be a string literal');
      expect(message).toContain('boolean');
    });

    it('should return appropriate message for duration too short', () => {
      const message = validator.defaultMessage({
        value: '2',
      } as ValidationArguments);

      expect(message).toContain('too short');
      expect(message).toContain('Minimum');
      expect(message).toContain('"4"');
    });

    it('should return appropriate message for duration too long', () => {
      const message = validator.defaultMessage({
        value: '20',
      } as ValidationArguments);

      expect(message).toContain('exceeds maximum');
      expect(message).toContain('Maximum');
      expect(message).toContain('"12"');
    });

    it('should return appropriate message for unsupported in-range duration', () => {
      const message = validator.defaultMessage({
        value: '6',
      } as ValidationArguments);

      expect(message).toContain('not supported');
      expect(message).toContain('"4"');
      expect(message).toContain('"8"');
      expect(message).toContain('"12"');
      expect(message).toContain('cost');
    });

    it('should return appropriate message for malformed string', () => {
      const message = validator.defaultMessage({
        value: 'invalid',
      } as ValidationArguments);

      expect(message).toContain('Invalid video duration');
      expect(message).toContain('"4"');
      expect(message).toContain('"8"');
      expect(message).toContain('"12"');
      expect(message).toContain('Duration guide');
    });

    it('should include cost information in error messages', () => {
      const message = validator.defaultMessage({
        value: 'invalid',
      } as ValidationArguments);

      expect(message).toContain('lowest cost');
      expect(message).toContain('highest cost');
      expect(message).toContain('Cost scales');
    });
  });

  describe('Integration with DTO', () => {
    it('should validate "4" in DTO', async () => {
      const dto = new CreateVideoDto();
      dto.prompt = 'Test video';
      dto.seconds = '4';

      const errors = await validate(dto);
      const secondsErrors = errors.filter((e) => e.property === 'seconds');

      expect(secondsErrors).toHaveLength(0);
    });

    it('should validate "8" in DTO', async () => {
      const dto = new CreateVideoDto();
      dto.prompt = 'Test video';
      dto.seconds = '8';

      const errors = await validate(dto);
      const secondsErrors = errors.filter((e) => e.property === 'seconds');

      expect(secondsErrors).toHaveLength(0);
    });

    it('should validate "12" in DTO', async () => {
      const dto = new CreateVideoDto();
      dto.prompt = 'Test video';
      dto.seconds = '12';

      const errors = await validate(dto);
      const secondsErrors = errors.filter((e) => e.property === 'seconds');

      expect(secondsErrors).toHaveLength(0);
    });

    it('should reject invalid duration in DTO', async () => {
      const dto = new CreateVideoDto();
      dto.prompt = 'Test video';
      dto.seconds = '20' as unknown as typeof dto.seconds;

      const errors = await validate(dto);
      const secondsErrors = errors.filter((e) => e.property === 'seconds');

      expect(secondsErrors.length).toBeGreaterThan(0);
    });

    it('should allow omitting seconds (optional field)', async () => {
      const dto = new CreateVideoDto();
      dto.prompt = 'Test video';
      // seconds is omitted

      const errors = await validate(dto);
      const secondsErrors = errors.filter((e) => e.property === 'seconds');

      expect(secondsErrors).toHaveLength(0);
    });
  });
});
