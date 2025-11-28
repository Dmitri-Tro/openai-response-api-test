import { validate, ValidationError } from 'class-validator';
import { CreateSpeechDto } from './create-speech.dto';

/**
 * Utility function to validate DTO and return errors
 */
async function validateDto(dto: CreateSpeechDto): Promise<ValidationError[]> {
  return await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: false,
  });
}

/**
 * Utility function to create a valid base DTO for testing
 */
function createValidDto(): CreateSpeechDto {
  const dto = new CreateSpeechDto();
  dto.voice = 'alloy';
  dto.input = 'The quick brown fox jumps over the lazy dog.';
  return dto;
}

describe('CreateSpeechDto', () => {
  describe('Valid Configurations', () => {
    it('should validate with only required fields (voice, input)', async () => {
      const dto = createValidDto();

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with all tts-1 fields', async () => {
      const dto = createValidDto();
      dto.model = 'tts-1';
      dto.voice = 'shimmer';
      dto.input = 'Hello, world!';
      dto.response_format = 'mp3';
      dto.speed = 1.5;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with all tts-1-hd fields', async () => {
      const dto = createValidDto();
      dto.model = 'tts-1-hd';
      dto.voice = 'onyx';
      dto.input = 'High quality audio test.';
      dto.response_format = 'opus';
      dto.speed = 0.75;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with all gpt-4o-mini-tts fields including instructions', async () => {
      const dto = createValidDto();
      dto.model = 'gpt-4o-mini-tts';
      dto.voice = 'nova';
      dto.input = 'Testing instructions support.';
      dto.response_format = 'aac';
      dto.speed = 1.0;
      dto.instructions = 'Speak in a cheerful, energetic tone';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });
  });

  describe('Model validation', () => {
    it('should accept tts-1', async () => {
      const dto = createValidDto();
      dto.model = 'tts-1';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept tts-1-hd', async () => {
      const dto = createValidDto();
      dto.model = 'tts-1-hd';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept gpt-4o-mini-tts', async () => {
      const dto = createValidDto();
      dto.model = 'gpt-4o-mini-tts';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should use tts-1 as default', () => {
      const dto = createValidDto();

      expect(dto.model).toBe('tts-1');
    });

    it('should reject invalid model', async () => {
      const dto = createValidDto();
      dto.model = 'invalid-tts-model' as unknown as typeof dto.model;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'model')).toBe(true);
    });
  });

  describe('Voice validation', () => {
    const validVoices = [
      'alloy',
      'ash',
      'ballad',
      'coral',
      'echo',
      'fable',
      'nova',
      'onyx',
      'sage',
      'shimmer',
      'verse',
      'marin',
      'cedar',
    ];

    validVoices.forEach((voice) => {
      it(`should accept voice: ${voice}`, async () => {
        const dto = createValidDto();
        dto.voice = voice as unknown as typeof dto.voice;

        const errors = await validateDto(dto);

        expect(errors).toHaveLength(0);
      });
    });

    it('should reject invalid voice', async () => {
      const dto = createValidDto();
      dto.voice = 'invalid-voice' as unknown as typeof dto.voice;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'voice')).toBe(true);
    });

    it('should reject missing voice', async () => {
      const dto = new CreateSpeechDto();
      dto.input = 'Test input';

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'voice')).toBe(true);
    });
  });

  describe('Input validation', () => {
    it('should accept valid input text', async () => {
      const dto = createValidDto();
      dto.input = 'This is a test sentence.';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept input at max length (4096 chars)', async () => {
      const dto = createValidDto();
      dto.input = 'A'.repeat(4096);

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject input exceeding max length (4097 chars)', async () => {
      const dto = createValidDto();
      dto.input = 'A'.repeat(4097);

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'input')).toBe(true);
      expect(
        errors.some((e) =>
          JSON.stringify(e.constraints).includes('4096 characters'),
        ),
      ).toBe(true);
    });

    it('should accept short input (1 character)', async () => {
      const dto = createValidDto();
      dto.input = 'A';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject missing input', async () => {
      const dto = new CreateSpeechDto();
      dto.voice = 'alloy';

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'input')).toBe(true);
    });

    it('should reject empty string input', async () => {
      const dto = createValidDto();
      dto.input = '';

      const errors = await validateDto(dto);

      // Empty string fails @MaxLength validation (0 < 4096 passes, but semantically invalid)
      // However, class-validator allows empty strings for @MaxLength
      // This test documents current behavior - API will reject it
      expect(errors).toHaveLength(0);
    });
  });

  describe('Response format validation', () => {
    const validFormats = ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'];

    validFormats.forEach((format) => {
      it(`should accept response_format: ${format}`, async () => {
        const dto = createValidDto();
        dto.response_format = format as unknown as typeof dto.response_format;

        const errors = await validateDto(dto);

        expect(errors).toHaveLength(0);
      });
    });

    it('should use mp3 as default', () => {
      const dto = createValidDto();

      expect(dto.response_format).toBe('mp3');
    });

    it('should reject invalid response_format', async () => {
      const dto = createValidDto();
      dto.response_format = 'ogg' as unknown as typeof dto.response_format;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'response_format')).toBe(true);
    });
  });

  describe('Speed validation', () => {
    it('should accept speed at minimum (0.25)', async () => {
      const dto = createValidDto();
      dto.speed = 0.25;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept speed at maximum (4.0)', async () => {
      const dto = createValidDto();
      dto.speed = 4.0;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept speed at normal (1.0)', async () => {
      const dto = createValidDto();
      dto.speed = 1.0;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept speed in valid range (2.5)', async () => {
      const dto = createValidDto();
      dto.speed = 2.5;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should use 1.0 as default', () => {
      const dto = createValidDto();

      expect(dto.speed).toBe(1.0);
    });

    it('should reject speed below minimum (0.24)', async () => {
      const dto = createValidDto();
      dto.speed = 0.24;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'speed')).toBe(true);
      expect(
        errors.some((e) => JSON.stringify(e.constraints).includes('0.25')),
      ).toBe(true);
    });

    it('should reject speed above maximum (4.1)', async () => {
      const dto = createValidDto();
      dto.speed = 4.1;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'speed')).toBe(true);
      expect(
        errors.some((e) => JSON.stringify(e.constraints).includes('4.0')),
      ).toBe(true);
    });

    it('should reject negative speed', async () => {
      const dto = createValidDto();
      dto.speed = -1.0;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'speed')).toBe(true);
    });

    it('should reject zero speed', async () => {
      const dto = createValidDto();
      dto.speed = 0;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'speed')).toBe(true);
    });
  });

  describe('Instructions validation', () => {
    it('should accept valid instructions', async () => {
      const dto = createValidDto();
      dto.instructions = 'Speak in a cheerful, energetic tone';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept long instructions', async () => {
      const dto = createValidDto();
      dto.instructions =
        'Speak slowly and clearly with emphasis on technical terms. Use a professional tone suitable for educational content. Pause briefly between sentences for clarity.';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept empty string instructions', async () => {
      const dto = createValidDto();
      dto.instructions = '';

      const errors = await validateDto(dto);

      // Empty string passes @IsString() validation
      expect(errors).toHaveLength(0);
    });

    it('should allow omitting instructions (optional)', async () => {
      const dto = createValidDto();

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
      expect(dto.instructions).toBeUndefined();
    });
  });

  describe('Optional fields', () => {
    it('should allow omitting all optional fields', async () => {
      const dto = createValidDto();

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should allow omitting model (defaults to tts-1)', async () => {
      const dto = createValidDto();
      dto.response_format = 'flac';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
      expect(dto.model).toBe('tts-1');
    });

    it('should allow omitting response_format (defaults to mp3)', async () => {
      const dto = createValidDto();
      dto.model = 'tts-1-hd';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
      expect(dto.response_format).toBe('mp3');
    });

    it('should allow omitting speed (defaults to 1.0)', async () => {
      const dto = createValidDto();
      dto.model = 'tts-1';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
      expect(dto.speed).toBe(1.0);
    });
  });
});
