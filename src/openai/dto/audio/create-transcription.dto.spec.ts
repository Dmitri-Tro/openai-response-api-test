import { validate, ValidationError } from 'class-validator';
import { CreateTranscriptionDto } from './create-transcription.dto';

/**
 * Utility function to validate DTO and return errors
 */
async function validateDto(
  dto: CreateTranscriptionDto,
): Promise<ValidationError[]> {
  return await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: false,
  });
}

/**
 * Utility function to create a valid base DTO for testing
 */
function createValidDto(): CreateTranscriptionDto {
  const dto = new CreateTranscriptionDto();
  return dto;
}

describe('CreateTranscriptionDto', () => {
  describe('Valid Configurations', () => {
    it('should validate with default values only', async () => {
      const dto = createValidDto();

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with all whisper-1 fields', async () => {
      const dto = createValidDto();
      dto.model = 'whisper-1';
      dto.language = 'en';
      dto.prompt = 'This is a test meeting about AI.';
      dto.response_format = 'json';
      dto.temperature = 0.5;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with all gpt-4o-transcribe fields', async () => {
      const dto = createValidDto();
      dto.model = 'gpt-4o-transcribe';
      dto.language = 'es';
      dto.response_format = 'verbose_json';
      dto.timestamp_granularities = ['word', 'segment'];

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with gpt-4o-mini-transcribe', async () => {
      const dto = createValidDto();
      dto.model = 'gpt-4o-mini-transcribe';
      dto.response_format = 'srt';
      dto.temperature = 0;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with gpt-4o-transcribe-diarize', async () => {
      const dto = createValidDto();
      dto.model = 'gpt-4o-transcribe-diarize';
      dto.response_format = 'diarized_json';

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

    it('should accept gpt-4o-transcribe', async () => {
      const dto = createValidDto();
      dto.model = 'gpt-4o-transcribe';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept gpt-4o-mini-transcribe', async () => {
      const dto = createValidDto();
      dto.model = 'gpt-4o-mini-transcribe';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept gpt-4o-transcribe-diarize', async () => {
      const dto = createValidDto();
      dto.model = 'gpt-4o-transcribe-diarize';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should use whisper-1 as default', () => {
      const dto = createValidDto();

      expect(dto.model).toBe('whisper-1');
    });

    it('should reject invalid model', async () => {
      const dto = createValidDto();
      dto.model = 'whisper-turbo' as unknown as typeof dto.model;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'model')).toBe(true);
    });
  });

  describe('Language validation', () => {
    it('should accept valid 2-letter language code (en)', async () => {
      const dto = createValidDto();
      dto.language = 'en';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept valid 2-letter language code (es)', async () => {
      const dto = createValidDto();
      dto.language = 'es';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept valid 2-letter language code (fr)', async () => {
      const dto = createValidDto();
      dto.language = 'fr';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject 3-letter language code', async () => {
      const dto = createValidDto();
      dto.language = 'eng';

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'language')).toBe(true);
      expect(
        errors.some((e) =>
          JSON.stringify(e.constraints).includes('2-character'),
        ),
      ).toBe(true);
    });

    it('should reject 1-letter language code', async () => {
      const dto = createValidDto();
      dto.language = 'e';

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'language')).toBe(true);
    });

    it('should reject empty language code', async () => {
      const dto = createValidDto();
      dto.language = '';

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'language')).toBe(true);
    });

    it('should allow omitting language (optional)', async () => {
      const dto = createValidDto();

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
      expect(dto.language).toBeUndefined();
    });
  });

  describe('Prompt validation', () => {
    it('should accept valid prompt', async () => {
      const dto = createValidDto();
      dto.prompt = 'This meeting is about artificial intelligence.';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept long prompt', async () => {
      const dto = createValidDto();
      dto.prompt =
        'This is a technical discussion about machine learning, neural networks, deep learning, and artificial intelligence in general.';

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
    const validFormats = [
      'json',
      'text',
      'srt',
      'vtt',
      'verbose_json',
      'diarized_json',
    ];

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
  });

  describe('Timestamp granularities validation', () => {
    it('should accept segment only', async () => {
      const dto = createValidDto();
      dto.timestamp_granularities = ['segment'];

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept word only', async () => {
      const dto = createValidDto();
      dto.timestamp_granularities = ['word'];

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept both word and segment', async () => {
      const dto = createValidDto();
      dto.timestamp_granularities = ['word', 'segment'];

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept segment and word (reversed order)', async () => {
      const dto = createValidDto();
      dto.timestamp_granularities = ['segment', 'word'];

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should allow empty array', async () => {
      const dto = createValidDto();
      dto.timestamp_granularities = [];

      const errors = await validateDto(dto);

      // Empty array passes @IsArray() validation
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid granularity', async () => {
      const dto = createValidDto();
      dto.timestamp_granularities = ['char' as unknown as 'word' | 'segment'];

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'timestamp_granularities')).toBe(
        true,
      );
    });

    it('should reject mixed valid and invalid granularities', async () => {
      const dto = createValidDto();
      dto.timestamp_granularities = [
        'word',
        'invalid' as unknown as 'word' | 'segment',
      ];

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'timestamp_granularities')).toBe(
        true,
      );
    });

    it('should allow omitting timestamp_granularities (optional)', async () => {
      const dto = createValidDto();

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
      expect(dto.timestamp_granularities).toBeUndefined();
    });
  });

  describe('Optional fields', () => {
    it('should allow omitting all optional fields', async () => {
      const dto = createValidDto();

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should allow omitting model (defaults to whisper-1)', async () => {
      const dto = createValidDto();
      dto.language = 'en';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
      expect(dto.model).toBe('whisper-1');
    });

    it('should allow omitting response_format (defaults to json)', async () => {
      const dto = createValidDto();
      dto.model = 'gpt-4o-transcribe';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
      expect(dto.response_format).toBe('json');
    });

    it('should allow omitting temperature (defaults to 0)', async () => {
      const dto = createValidDto();
      dto.model = 'whisper-1';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
      expect(dto.temperature).toBe(0);
    });
  });
});
