import { validate, ValidationError } from 'class-validator';
import { CreateTranslationDto } from './create-translation.dto';

/**
 * Utility function to validate DTO and return errors
 */
async function validateDto(
  dto: CreateTranslationDto,
): Promise<ValidationError[]> {
  return await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: false,
  });
}

/**
 * Utility function to create a valid base DTO for testing
 */
function createValidDto(): CreateTranslationDto {
  const dto = new CreateTranslationDto();
  return dto;
}

describe('CreateTranslationDto', () => {
  describe('Valid Configurations', () => {
    it('should validate with default values only', async () => {
      const dto = createValidDto();

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with all whisper-1 fields', async () => {
      const dto = createValidDto();
      dto.model = 'whisper-1';
      dto.prompt = 'This is a medical conference discussion.';
      dto.response_format = 'json';
      dto.temperature = 0.5;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with verbose_json response format', async () => {
      const dto = createValidDto();
      dto.model = 'whisper-1';
      dto.response_format = 'verbose_json';
      dto.temperature = 0;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with subtitle formats (srt, vtt)', async () => {
      const dto = createValidDto();
      dto.model = 'whisper-1';
      dto.response_format = 'srt';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });
  });

  describe('Model validation', () => {
    it('should accept whisper-1', async () => {
      const dto = createValidDto();
      dto.model = 'whisper-1';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should use whisper-1 as default', () => {
      const dto = createValidDto();

      expect(dto.model).toBe('whisper-1');
    });

    it('should reject whisper-turbo (not recommended)', async () => {
      const dto = createValidDto();
      dto.model = 'whisper-turbo' as unknown as typeof dto.model;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'model')).toBe(true);
    });

    it('should reject gpt-4o-transcribe (transcription model)', async () => {
      const dto = createValidDto();
      dto.model = 'gpt-4o-transcribe' as unknown as typeof dto.model;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'model')).toBe(true);
    });

    it('should reject invalid model', async () => {
      const dto = createValidDto();
      dto.model = 'invalid-model' as unknown as typeof dto.model;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'model')).toBe(true);
    });
  });

  describe('Prompt validation', () => {
    it('should accept valid prompt', async () => {
      const dto = createValidDto();
      dto.prompt = 'This is a medical conference discussion about cardiology.';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept long prompt with specialized vocabulary', async () => {
      const dto = createValidDto();
      dto.prompt =
        'This is a technical discussion about quantum physics, including topics like quantum entanglement, superposition, and wave-particle duality.';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept empty string prompt', async () => {
      const dto = createValidDto();
      dto.prompt = '';

      const errors = await validateDto(dto);

      // Empty string passes @IsString() validation
      expect(errors).toHaveLength(0);
    });

    it('should allow omitting prompt (optional)', async () => {
      const dto = createValidDto();

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
      expect(dto.prompt).toBeUndefined();
    });
  });

  describe('Response format validation', () => {
    const validFormats = ['json', 'text', 'srt', 'vtt', 'verbose_json'];

    validFormats.forEach((format) => {
      it(`should accept response_format: ${format}`, async () => {
        const dto = createValidDto();
        dto.response_format = format as unknown as typeof dto.response_format;

        const errors = await validateDto(dto);

        expect(errors).toHaveLength(0);
      });
    });

    it('should use json as default', () => {
      const dto = createValidDto();

      expect(dto.response_format).toBe('json');
    });

    it('should reject diarized_json (transcription-only format)', async () => {
      const dto = createValidDto();
      dto.response_format =
        'diarized_json' as unknown as typeof dto.response_format;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'response_format')).toBe(true);
    });

    it('should reject invalid response_format', async () => {
      const dto = createValidDto();
      dto.response_format = 'xml' as unknown as typeof dto.response_format;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'response_format')).toBe(true);
    });
  });

  describe('Temperature validation', () => {
    it('should accept temperature at minimum (0)', async () => {
      const dto = createValidDto();
      dto.temperature = 0;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept temperature at maximum (1)', async () => {
      const dto = createValidDto();
      dto.temperature = 1;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept temperature in valid range (0.5)', async () => {
      const dto = createValidDto();
      dto.temperature = 0.5;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept temperature in valid range (0.3)', async () => {
      const dto = createValidDto();
      dto.temperature = 0.3;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should use 0 as default', () => {
      const dto = createValidDto();

      expect(dto.temperature).toBe(0);
    });

    it('should reject temperature below minimum (-0.1)', async () => {
      const dto = createValidDto();
      dto.temperature = -0.1;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'temperature')).toBe(true);
    });

    it('should reject temperature above maximum (1.1)', async () => {
      const dto = createValidDto();
      dto.temperature = 1.1;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'temperature')).toBe(true);
    });

    it('should reject temperature of 2', async () => {
      const dto = createValidDto();
      dto.temperature = 2;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'temperature')).toBe(true);
    });

    it('should reject negative temperature', async () => {
      const dto = createValidDto();
      dto.temperature = -1;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'temperature')).toBe(true);
    });
  });

  describe('Optional fields', () => {
    it('should allow omitting all optional fields', async () => {
      const dto = createValidDto();

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should allow omitting response_format (defaults to json)', async () => {
      const dto = createValidDto();
      dto.prompt = 'Test prompt';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
      expect(dto.response_format).toBe('json');
    });

    it('should allow omitting temperature (defaults to 0)', async () => {
      const dto = createValidDto();
      dto.response_format = 'text';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
      expect(dto.temperature).toBe(0);
    });

    it('should allow omitting prompt (optional)', async () => {
      const dto = createValidDto();
      dto.temperature = 0.7;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
      expect(dto.prompt).toBeUndefined();
    });
  });
});
