import { validate, ValidationError } from 'class-validator';
import { EditImageDto } from './edit-image.dto';

async function validateDto(dto: EditImageDto): Promise<ValidationError[]> {
  return await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: false,
  });
}

function createValidDto(): EditImageDto {
  const dto = new EditImageDto();
  dto.prompt = 'Add a red door to the house';
  return dto;
}

describe('EditImageDto', () => {
  describe('Valid Configurations', () => {
    it('should validate with only required field (prompt)', async () => {
      const dto = createValidDto();

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with all fields', async () => {
      const dto = createValidDto();
      dto.model = 'dall-e-2';
      dto.n = 3;
      dto.size = '1024x1024';
      dto.response_format = 'url';
      dto.user = 'user-123';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });
  });

  describe('Prompt validation', () => {
    it('should accept valid prompt', async () => {
      const dto = createValidDto();
      dto.prompt = 'Change the sky to sunset colors';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept prompt at max length (1000 chars)', async () => {
      const dto = createValidDto();
      dto.prompt = 'A'.repeat(1000);

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject prompt exceeding max length', async () => {
      const dto = createValidDto();
      dto.prompt = 'A'.repeat(1001);

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'prompt')).toBe(true);
    });

    it('should accept empty prompt (no @IsNotEmpty validator)', async () => {
      const dto = new EditImageDto();
      dto.prompt = '';

      const errors = await validateDto(dto);

      // Empty string passes @IsString() validation
      expect(errors).toHaveLength(0);
    });

    it('should reject missing prompt', async () => {
      const dto = new EditImageDto();

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'prompt')).toBe(true);
    });
  });

  describe('Model validation', () => {
    it('should accept dall-e-2', async () => {
      const dto = createValidDto();
      dto.model = 'dall-e-2';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject dall-e-3 (not supported for edits)', async () => {
      const dto = createValidDto();
      dto.model = 'dall-e-3' as any;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'model')).toBe(true);
    });

    it('should reject invalid model', async () => {
      const dto = createValidDto();
      dto.model = 'invalid-model' as any;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'model')).toBe(true);
    });
  });

  describe('Number of images (n) validation', () => {
    it('should accept n=1', async () => {
      const dto = createValidDto();
      dto.n = 1;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept n=5', async () => {
      const dto = createValidDto();
      dto.n = 5;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept n=10', async () => {
      const dto = createValidDto();
      dto.n = 10;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject n=0', async () => {
      const dto = createValidDto();
      dto.n = 0;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'n')).toBe(true);
    });

    it('should reject n=11', async () => {
      const dto = createValidDto();
      dto.n = 11;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'n')).toBe(true);
    });
  });

  describe('Size validation', () => {
    it('should accept 256x256', async () => {
      const dto = createValidDto();
      dto.size = '256x256';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept 512x512', async () => {
      const dto = createValidDto();
      dto.size = '512x512';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept 1024x1024', async () => {
      const dto = createValidDto();
      dto.size = '1024x1024';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject invalid size', async () => {
      const dto = createValidDto();
      dto.size = '2048x2048' as any;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'size')).toBe(true);
    });
  });

  describe('Response format validation', () => {
    it('should accept url format', async () => {
      const dto = createValidDto();
      dto.response_format = 'url';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept b64_json format', async () => {
      const dto = createValidDto();
      dto.response_format = 'b64_json';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject invalid format', async () => {
      const dto = createValidDto();
      dto.response_format = 'json' as any;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'response_format')).toBe(true);
    });
  });

  describe('User parameter validation', () => {
    it('should accept valid user identifier', async () => {
      const dto = createValidDto();
      dto.user = 'user-abc123';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept empty user string (no @IsNotEmpty validator)', async () => {
      const dto = createValidDto();
      dto.user = '';

      const errors = await validateDto(dto);

      // Empty string passes @IsString() validation
      expect(errors).toHaveLength(0);
    });
  });

  describe('Optional fields', () => {
    it('should allow omitting all optional fields', async () => {
      const dto = createValidDto();

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });
  });
});
