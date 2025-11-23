import { validate, ValidationError } from 'class-validator';
import { CreateImagesDto } from './create-images.dto';

/**
 * Utility function to validate DTO and return errors
 */
async function validateDto(dto: CreateImagesDto): Promise<ValidationError[]> {
  return await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: false,
  });
}

/**
 * Utility function to create a valid base DTO for testing
 */
function createValidDto(): CreateImagesDto {
  const dto = new CreateImagesDto();
  dto.prompt = 'A cute baby sea otter';
  return dto;
}

describe('CreateImagesDto', () => {
  describe('Valid Configurations', () => {
    it('should validate with only required field (prompt)', async () => {
      const dto = createValidDto();

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with all DALL-E 2 fields', async () => {
      const dto = createValidDto();
      dto.model = 'dall-e-2';
      dto.n = 5;
      dto.size = '512x512';
      dto.response_format = 'url';
      dto.user = 'user-123';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with all DALL-E 3 fields', async () => {
      const dto = createValidDto();
      dto.model = 'dall-e-3';
      dto.size = '1792x1024';
      dto.quality = 'hd';
      dto.style = 'natural';
      dto.response_format = 'b64_json';
      dto.user = 'user-456';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });
  });

  describe('Model validation', () => {
    it('should accept dall-e-2', async () => {
      const dto = createValidDto();
      dto.model = 'dall-e-2';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept dall-e-3', async () => {
      const dto = createValidDto();
      dto.model = 'dall-e-3';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept gpt-image-1', async () => {
      const dto = createValidDto();
      dto.model = 'gpt-image-1';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject invalid model', async () => {
      const dto = createValidDto();
      dto.model = 'invalid-model' as any;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'model')).toBe(true);
    });
  });

  describe('Prompt validation', () => {
    it('should accept valid prompt', async () => {
      const dto = createValidDto();
      dto.prompt = 'A serene mountain landscape';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept prompt at max length (4000 chars)', async () => {
      const dto = createValidDto();
      dto.prompt = 'A'.repeat(4000);

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject prompt exceeding max length', async () => {
      const dto = createValidDto();
      dto.prompt = 'A'.repeat(4001);

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'prompt')).toBe(true);
    });

    it('should accept empty prompt (no @IsNotEmpty validator)', async () => {
      const dto = new CreateImagesDto();
      dto.prompt = '';

      const errors = await validateDto(dto);

      // Empty string passes @IsString() validation
      expect(errors).toHaveLength(0);
    });

    it('should reject missing prompt', async () => {
      const dto = new CreateImagesDto();

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'prompt')).toBe(true);
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

    it('should reject negative n', async () => {
      const dto = createValidDto();
      dto.n = -1;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'n')).toBe(true);
    });
  });

  describe('Size validation', () => {
    describe('gpt-image-1 sizes', () => {
      it('should accept 1024x1024 for gpt-image-1', async () => {
        const dto = createValidDto();
        dto.model = 'gpt-image-1';
        dto.size = '1024x1024';

        const errors = await validateDto(dto);

        expect(errors).toHaveLength(0);
      });

      it('should accept 1024x1536 for gpt-image-1', async () => {
        const dto = createValidDto();
        dto.model = 'gpt-image-1';
        dto.size = '1024x1536';

        const errors = await validateDto(dto);

        expect(errors).toHaveLength(0);
      });

      it('should accept 1536x1024 for gpt-image-1', async () => {
        const dto = createValidDto();
        dto.model = 'gpt-image-1';
        dto.size = '1536x1024';

        const errors = await validateDto(dto);

        expect(errors).toHaveLength(0);
      });

      it('should accept auto for gpt-image-1', async () => {
        const dto = createValidDto();
        dto.model = 'gpt-image-1';
        dto.size = 'auto';

        const errors = await validateDto(dto);

        expect(errors).toHaveLength(0);
      });

      it('should reject 512x512 for gpt-image-1 (invalid model-size combination)', async () => {
        const dto = createValidDto();
        dto.model = 'gpt-image-1';
        dto.size = '512x512' as any;

        const errors = await validateDto(dto);

        // @IsImageModelSizeValid() should reject this invalid combination
        const sizeErrors = errors.filter((e) => e.property === 'size');
        expect(sizeErrors.length).toBeGreaterThan(0);
        expect(sizeErrors[0].constraints).toHaveProperty('IsImageModelSizeValidConstraint');
      });
    });

    describe('DALL-E 2 sizes', () => {
      it('should accept 256x256 for dall-e-2', async () => {
        const dto = createValidDto();
        dto.model = 'dall-e-2';
        dto.size = '256x256';

        const errors = await validateDto(dto);

        expect(errors).toHaveLength(0);
      });

      it('should accept 512x512 for dall-e-2', async () => {
        const dto = createValidDto();
        dto.model = 'dall-e-2';
        dto.size = '512x512';

        const errors = await validateDto(dto);

        expect(errors).toHaveLength(0);
      });

      it('should accept 1024x1024 for dall-e-2', async () => {
        const dto = createValidDto();
        dto.model = 'dall-e-2';
        dto.size = '1024x1024';

        const errors = await validateDto(dto);

        expect(errors).toHaveLength(0);
      });

      it('should reject 1792x1024 for dall-e-2 (invalid model-size combination)', async () => {
        const dto = createValidDto();
        dto.model = 'dall-e-2';
        dto.size = '1792x1024' as any;

        const errors = await validateDto(dto);

        // @IsImageModelSizeValid() should reject this invalid combination
        const sizeErrors = errors.filter((e) => e.property === 'size');
        expect(sizeErrors.length).toBeGreaterThan(0);
        expect(sizeErrors[0].constraints).toHaveProperty('IsImageModelSizeValidConstraint');
      });
    });

    describe('DALL-E 3 sizes', () => {
      it('should accept 1024x1024 for dall-e-3', async () => {
        const dto = createValidDto();
        dto.model = 'dall-e-3';
        dto.size = '1024x1024';

        const errors = await validateDto(dto);

        expect(errors).toHaveLength(0);
      });

      it('should accept 1792x1024 for dall-e-3', async () => {
        const dto = createValidDto();
        dto.model = 'dall-e-3';
        dto.size = '1792x1024';

        const errors = await validateDto(dto);

        expect(errors).toHaveLength(0);
      });

      it('should accept 1024x1792 for dall-e-3', async () => {
        const dto = createValidDto();
        dto.model = 'dall-e-3';
        dto.size = '1024x1792';

        const errors = await validateDto(dto);

        expect(errors).toHaveLength(0);
      });

      it('should reject 512x512 for dall-e-3 (invalid model-size combination)', async () => {
        const dto = createValidDto();
        dto.model = 'dall-e-3';
        dto.size = '512x512' as any;

        const errors = await validateDto(dto);

        // @IsImageModelSizeValid() should reject this invalid combination
        const sizeErrors = errors.filter((e) => e.property === 'size');
        expect(sizeErrors.length).toBeGreaterThan(0);
        expect(sizeErrors[0].constraints).toHaveProperty('IsImageModelSizeValidConstraint');
      });
    });
  });

  describe('Quality validation', () => {
    it('should accept standard quality', async () => {
      const dto = createValidDto();
      dto.quality = 'standard';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept hd quality', async () => {
      const dto = createValidDto();
      dto.quality = 'hd';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject invalid quality', async () => {
      const dto = createValidDto();
      dto.quality = 'ultra' as any;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'quality')).toBe(true);
    });
  });

  describe('Style validation', () => {
    it('should accept vivid style', async () => {
      const dto = createValidDto();
      dto.style = 'vivid';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept natural style', async () => {
      const dto = createValidDto();
      dto.style = 'natural';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject invalid style', async () => {
      const dto = createValidDto();
      dto.style = 'artistic' as any;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'style')).toBe(true);
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

    it('should accept alphanumeric user', async () => {
      const dto = createValidDto();
      dto.user = 'user123';

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

    it('should allow omitting model (defaults to dall-e-2)', async () => {
      const dto = createValidDto();
      dto.n = 3;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should allow omitting n (defaults to 1)', async () => {
      const dto = createValidDto();
      dto.model = 'dall-e-2';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });
  });
});
