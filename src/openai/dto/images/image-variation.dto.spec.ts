import { validate, ValidationError } from 'class-validator';
import { ImageVariationDto } from './image-variation.dto';

async function validateDto(dto: ImageVariationDto): Promise<ValidationError[]> {
  return await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: false,
  });
}

describe('ImageVariationDto', () => {
  describe('Valid Configurations', () => {
    it('should validate with no fields (all optional)', async () => {
      const dto = new ImageVariationDto();

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with all fields', async () => {
      const dto = new ImageVariationDto();
      dto.model = 'dall-e-2';
      dto.n = 3;
      dto.size = '1024x1024';
      dto.response_format = 'url';
      dto.user = 'user-123';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });
  });

  describe('Model validation', () => {
    it('should accept dall-e-2', async () => {
      const dto = new ImageVariationDto();
      dto.model = 'dall-e-2';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject dall-e-3 (not supported for variations)', async () => {
      const dto = new ImageVariationDto();
      dto.model = 'dall-e-3' as unknown as typeof dto.model;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'model')).toBe(true);
    });

    it('should reject invalid model', async () => {
      const dto = new ImageVariationDto();
      dto.model = 'invalid-model' as unknown as typeof dto.model;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'model')).toBe(true);
    });
  });

  describe('Number of images (n) validation', () => {
    it('should accept n=1', async () => {
      const dto = new ImageVariationDto();
      dto.n = 1;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept n=5', async () => {
      const dto = new ImageVariationDto();
      dto.n = 5;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept n=10', async () => {
      const dto = new ImageVariationDto();
      dto.n = 10;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject n=0', async () => {
      const dto = new ImageVariationDto();
      dto.n = 0;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'n')).toBe(true);
    });

    it('should reject n=11', async () => {
      const dto = new ImageVariationDto();
      dto.n = 11;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'n')).toBe(true);
    });

    it('should reject negative n', async () => {
      const dto = new ImageVariationDto();
      dto.n = -1;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'n')).toBe(true);
    });
  });

  describe('Size validation', () => {
    it('should accept 256x256', async () => {
      const dto = new ImageVariationDto();
      dto.size = '256x256';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept 512x512', async () => {
      const dto = new ImageVariationDto();
      dto.size = '512x512';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept 1024x1024', async () => {
      const dto = new ImageVariationDto();
      dto.size = '1024x1024';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject invalid size', async () => {
      const dto = new ImageVariationDto();
      dto.size = '2048x2048' as unknown as typeof dto.size;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'size')).toBe(true);
    });

    it('should reject DALL-E 3 sizes', async () => {
      const dto = new ImageVariationDto();
      dto.size = '1792x1024' as unknown as typeof dto.size;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'size')).toBe(true);
    });
  });

  describe('Response format validation', () => {
    it('should accept url format', async () => {
      const dto = new ImageVariationDto();
      dto.response_format = 'url';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept b64_json format', async () => {
      const dto = new ImageVariationDto();
      dto.response_format = 'b64_json';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject invalid format', async () => {
      const dto = new ImageVariationDto();
      dto.response_format = 'json' as unknown as typeof dto.response_format;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'response_format')).toBe(true);
    });
  });

  describe('User parameter validation', () => {
    it('should accept valid user identifier', async () => {
      const dto = new ImageVariationDto();
      dto.user = 'user-abc123';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept alphanumeric user', async () => {
      const dto = new ImageVariationDto();
      dto.user = 'user123';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept empty user string (no @IsNotEmpty validator)', async () => {
      const dto = new ImageVariationDto();
      dto.user = '';

      const errors = await validateDto(dto);

      // Empty string passes @IsString() validation
      expect(errors).toHaveLength(0);
    });
  });

  describe('Optional fields', () => {
    it('should allow omitting model', async () => {
      const dto = new ImageVariationDto();
      dto.n = 3;
      dto.size = '512x512';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should allow omitting n', async () => {
      const dto = new ImageVariationDto();
      dto.model = 'dall-e-2';
      dto.size = '512x512';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should allow omitting size', async () => {
      const dto = new ImageVariationDto();
      dto.model = 'dall-e-2';
      dto.n = 2;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });
  });
});
