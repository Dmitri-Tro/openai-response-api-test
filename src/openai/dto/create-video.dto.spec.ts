import { validate, ValidationError } from 'class-validator';
import { CreateVideoDto } from './create-video.dto';
import type { Videos } from 'openai/resources/videos';

/**
 * Utility function to validate DTO and return errors
 */
async function validateDto(dto: CreateVideoDto): Promise<ValidationError[]> {
  return await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: false,
  });
}

/**
 * Utility function to create a valid base DTO for testing
 */
function createValidDto(): CreateVideoDto {
  const dto = new CreateVideoDto();
  dto.prompt = 'A serene mountain landscape at sunset';
  return dto;
}

describe('CreateVideoDto', () => {
  describe('Valid Configurations', () => {
    it('should validate with only required field (prompt)', async () => {
      const dto = createValidDto();

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with all fields provided', async () => {
      const dto = createValidDto();
      dto.model = 'sora-2-pro';
      dto.seconds = '12';
      dto.size = '1792x1024';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with sora-2 model', async () => {
      const dto = createValidDto();
      dto.model = 'sora-2';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with sora-2-pro model', async () => {
      const dto = createValidDto();
      dto.model = 'sora-2-pro';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with 4 seconds duration', async () => {
      const dto = createValidDto();
      dto.seconds = '4';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with 8 seconds duration', async () => {
      const dto = createValidDto();
      dto.seconds = '8';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with 12 seconds duration', async () => {
      const dto = createValidDto();
      dto.seconds = '12';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with 720x1280 portrait resolution', async () => {
      const dto = createValidDto();
      dto.size = '720x1280';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with 1280x720 landscape resolution', async () => {
      const dto = createValidDto();
      dto.size = '1280x720';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with 1024x1792 high-res portrait resolution', async () => {
      const dto = createValidDto();
      dto.size = '1024x1792';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate with 1792x1024 high-res landscape resolution', async () => {
      const dto = createValidDto();
      dto.size = '1792x1024';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate maximum length prompt (500 characters)', async () => {
      const dto = createValidDto();
      dto.prompt = 'a'.repeat(500);

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate prompt at 1 character (minimum length)', async () => {
      const dto = createValidDto();
      dto.prompt = 'a';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });
  });

  describe('Invalid Prompt', () => {
    it('should fail when prompt is empty string', async () => {
      const dto = createValidDto();
      dto.prompt = '';

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const promptError = errors.find((err) => err.property === 'prompt');
      expect(promptError).toBeDefined();
      expect(promptError?.constraints).toHaveProperty('isLength');
    });

    it('should fail when prompt exceeds 500 characters', async () => {
      const dto = createValidDto();
      dto.prompt = 'a'.repeat(501);

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const promptError = errors.find((err) => err.property === 'prompt');
      expect(promptError).toBeDefined();
      expect(promptError?.constraints).toHaveProperty('isLength');
    });

    it('should fail when prompt is not a string (number)', async () => {
      const dto = createValidDto();
      (dto as any).prompt = 12345;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const promptError = errors.find((err) => err.property === 'prompt');
      expect(promptError).toBeDefined();
      expect(promptError?.constraints).toHaveProperty('isString');
    });

    it('should fail when prompt is not a string (object)', async () => {
      const dto = createValidDto();
      (dto as any).prompt = { text: 'video prompt' };

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const promptError = errors.find((err) => err.property === 'prompt');
      expect(promptError).toBeDefined();
      expect(promptError?.constraints).toHaveProperty('isString');
    });

    it('should fail when prompt is not a string (array)', async () => {
      const dto = createValidDto();
      (dto as any).prompt = ['video', 'prompt'];

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const promptError = errors.find((err) => err.property === 'prompt');
      expect(promptError).toBeDefined();
      expect(promptError?.constraints).toHaveProperty('isString');
    });

    it('should fail when prompt is null', async () => {
      const dto = createValidDto();
      (dto as any).prompt = null;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const promptError = errors.find((err) => err.property === 'prompt');
      expect(promptError).toBeDefined();
    });

    it('should fail when prompt is undefined', async () => {
      const dto = new CreateVideoDto();
      // Don't set prompt at all

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const promptError = errors.find((err) => err.property === 'prompt');
      expect(promptError).toBeDefined();
    });
  });

  describe('Invalid Model', () => {
    it('should fail with unsupported model name', async () => {
      const dto = createValidDto();
      (dto as any).model = 'sora-3';

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const modelError = errors.find((err) => err.property === 'model');
      expect(modelError).toBeDefined();
      expect(modelError?.constraints).toHaveProperty('isEnum');
    });

    it('should fail with wrong model format (typo)', async () => {
      const dto = createValidDto();
      (dto as any).model = 'sora_2';

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const modelError = errors.find((err) => err.property === 'model');
      expect(modelError).toBeDefined();
      expect(modelError?.constraints).toHaveProperty('isEnum');
    });

    it('should fail with model as number', async () => {
      const dto = createValidDto();
      (dto as any).model = 2;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const modelError = errors.find((err) => err.property === 'model');
      expect(modelError).toBeDefined();
      expect(modelError?.constraints).toHaveProperty('isEnum');
    });

    it('should fail with model as object', async () => {
      const dto = createValidDto();
      (dto as any).model = { name: 'sora-2' };

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const modelError = errors.find((err) => err.property === 'model');
      expect(modelError).toBeDefined();
      expect(modelError?.constraints).toHaveProperty('isEnum');
    });

    it('should fail with empty string model', async () => {
      const dto = createValidDto();
      (dto as any).model = '';

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const modelError = errors.find((err) => err.property === 'model');
      expect(modelError).toBeDefined();
      expect(modelError?.constraints).toHaveProperty('isEnum');
    });
  });

  describe('Invalid Seconds (Duration)', () => {
    it('should fail when seconds is a number instead of string', async () => {
      const dto = createValidDto();
      (dto as any).seconds = 4; // Number, not string

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const secondsError = errors.find((err) => err.property === 'seconds');
      expect(secondsError).toBeDefined();
      expect(secondsError?.constraints).toHaveProperty('isEnum');
    });

    it('should fail with unsupported string duration', async () => {
      const dto = createValidDto();
      (dto as any).seconds = '6';

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const secondsError = errors.find((err) => err.property === 'seconds');
      expect(secondsError).toBeDefined();
      expect(secondsError?.constraints).toHaveProperty('isEnum');
    });

    it('should fail with seconds as "10" (unsupported)', async () => {
      const dto = createValidDto();
      (dto as any).seconds = '10';

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const secondsError = errors.find((err) => err.property === 'seconds');
      expect(secondsError).toBeDefined();
      expect(secondsError?.constraints).toHaveProperty('isEnum');
    });

    it('should fail with seconds as "0"', async () => {
      const dto = createValidDto();
      (dto as any).seconds = '0';

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const secondsError = errors.find((err) => err.property === 'seconds');
      expect(secondsError).toBeDefined();
      expect(secondsError?.constraints).toHaveProperty('isEnum');
    });

    it('should fail with seconds as empty string', async () => {
      const dto = createValidDto();
      (dto as any).seconds = '';

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const secondsError = errors.find((err) => err.property === 'seconds');
      expect(secondsError).toBeDefined();
      expect(secondsError?.constraints).toHaveProperty('isEnum');
    });

    it('should fail with seconds as object', async () => {
      const dto = createValidDto();
      (dto as any).seconds = { value: '4' };

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const secondsError = errors.find((err) => err.property === 'seconds');
      expect(secondsError).toBeDefined();
      expect(secondsError?.constraints).toHaveProperty('isEnum');
    });

    it('should fail with seconds as array', async () => {
      const dto = createValidDto();
      (dto as any).seconds = ['4'];

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const secondsError = errors.find((err) => err.property === 'seconds');
      expect(secondsError).toBeDefined();
      expect(secondsError?.constraints).toHaveProperty('isEnum');
    });
  });

  describe('Invalid Size (Resolution)', () => {
    it('should fail with unsupported resolution', async () => {
      const dto = createValidDto();
      (dto as any).size = '1920x1080';

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const sizeError = errors.find((err) => err.property === 'size');
      expect(sizeError).toBeDefined();
      expect(sizeError?.constraints).toHaveProperty('isEnum');
    });

    it('should fail with wrong resolution format (space)', async () => {
      const dto = createValidDto();
      (dto as any).size = '720 x 1280';

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const sizeError = errors.find((err) => err.property === 'size');
      expect(sizeError).toBeDefined();
      expect(sizeError?.constraints).toHaveProperty('isEnum');
    });

    it('should fail with reversed dimensions', async () => {
      const dto = createValidDto();
      (dto as any).size = '1280x720p'; // Has 'p' suffix

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const sizeError = errors.find((err) => err.property === 'size');
      expect(sizeError).toBeDefined();
      expect(sizeError?.constraints).toHaveProperty('isEnum');
    });

    it('should fail with size as number', async () => {
      const dto = createValidDto();
      (dto as any).size = 720;

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const sizeError = errors.find((err) => err.property === 'size');
      expect(sizeError).toBeDefined();
      expect(sizeError?.constraints).toHaveProperty('isEnum');
    });

    it('should fail with size as object', async () => {
      const dto = createValidDto();
      (dto as any).size = { width: 720, height: 1280 };

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const sizeError = errors.find((err) => err.property === 'size');
      expect(sizeError).toBeDefined();
      expect(sizeError?.constraints).toHaveProperty('isEnum');
    });

    it('should fail with size as array', async () => {
      const dto = createValidDto();
      (dto as any).size = [720, 1280];

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const sizeError = errors.find((err) => err.property === 'size');
      expect(sizeError).toBeDefined();
      expect(sizeError?.constraints).toHaveProperty('isEnum');
    });

    it('should fail with empty string size', async () => {
      const dto = createValidDto();
      (dto as any).size = '';

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const sizeError = errors.find((err) => err.property === 'size');
      expect(sizeError).toBeDefined();
      expect(sizeError?.constraints).toHaveProperty('isEnum');
    });

    it('should fail with case-sensitive resolution mismatch', async () => {
      const dto = createValidDto();
      (dto as any).size = '720X1280'; // Uppercase X

      const errors = await validateDto(dto);

      expect(errors.length).toBeGreaterThan(0);
      const sizeError = errors.find((err) => err.property === 'size');
      expect(sizeError).toBeDefined();
      expect(sizeError?.constraints).toHaveProperty('isEnum');
    });
  });

  describe('Optional Parameters', () => {
    it('should validate when model is omitted', async () => {
      const dto = createValidDto();
      // Don't set model

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate when seconds is omitted', async () => {
      const dto = createValidDto();
      // Don't set seconds

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate when size is omitted', async () => {
      const dto = createValidDto();
      // Don't set size

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate when all optional parameters are omitted', async () => {
      const dto = createValidDto();
      // Only prompt is set

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should allow undefined for optional model', async () => {
      const dto = createValidDto();
      dto.model = undefined;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should allow undefined for optional seconds', async () => {
      const dto = createValidDto();
      dto.seconds = undefined;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should allow undefined for optional size', async () => {
      const dto = createValidDto();
      dto.size = undefined;

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });
  });

  describe('Type Safety', () => {
    it('should accept Videos.VideoModel type for model', () => {
      const dto = createValidDto();
      const model: Videos.VideoModel = 'sora-2';
      dto.model = model;

      expect(dto.model).toBe('sora-2');
    });

    it('should accept Videos.VideoSeconds type for seconds', () => {
      const dto = createValidDto();
      const seconds: Videos.VideoSeconds = '8';
      dto.seconds = seconds;

      expect(dto.seconds).toBe('8');
    });

    it('should accept Videos.VideoSize type for size', () => {
      const dto = createValidDto();
      const size: Videos.VideoSize = '1280x720';
      dto.size = size;

      expect(dto.size).toBe('1280x720');
    });

    it('should maintain type compatibility with OpenAI SDK', () => {
      const dto = createValidDto();
      dto.model = 'sora-2-pro';
      dto.seconds = '12';
      dto.size = '1792x1024';

      // Verify types match SDK expectations
      const params: Partial<Videos.VideoCreateParams> = {
        prompt: dto.prompt,
        model: dto.model,
        seconds: dto.seconds,
        size: dto.size,
      };

      expect(params.prompt).toBe(dto.prompt);
      expect(params.model).toBe(dto.model);
      expect(params.seconds).toBe(dto.seconds);
      expect(params.size).toBe(dto.size);
    });
  });

  describe('Edge Cases', () => {
    it('should handle prompt with special characters', async () => {
      const dto = createValidDto();
      dto.prompt = 'A scene with "quotes", & symbols, and 100% reality!';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should handle prompt with newlines', async () => {
      const dto = createValidDto();
      dto.prompt = 'Line 1\nLine 2\nLine 3';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should handle prompt with unicode characters', async () => {
      const dto = createValidDto();
      dto.prompt = '美丽的山景 with emojis 🌄🏔️';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });
  });

  describe('Combination Tests', () => {
    it('should validate combination: sora-2 + 4s + portrait', async () => {
      const dto = createValidDto();
      dto.model = 'sora-2';
      dto.seconds = '4';
      dto.size = '720x1280';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate combination: sora-2-pro + 12s + landscape', async () => {
      const dto = createValidDto();
      dto.model = 'sora-2-pro';
      dto.seconds = '12';
      dto.size = '1792x1024';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate combination: sora-2 + 8s + high-res portrait', async () => {
      const dto = createValidDto();
      dto.model = 'sora-2';
      dto.seconds = '8';
      dto.size = '1024x1792';

      const errors = await validateDto(dto);

      expect(errors).toHaveLength(0);
    });

    it('should validate all possible model + duration combinations', async () => {
      const models: Videos.VideoModel[] = ['sora-2', 'sora-2-pro'];
      const durations: Videos.VideoSeconds[] = ['4', '8', '12'];

      for (const model of models) {
        for (const seconds of durations) {
          const dto = createValidDto();
          dto.model = model;
          dto.seconds = seconds;

          const errors = await validateDto(dto);

          expect(errors).toHaveLength(0);
        }
      }
    });

    it('should validate all possible resolution options', async () => {
      const sizes: Videos.VideoSize[] = [
        '720x1280',
        '1280x720',
        '1024x1792',
        '1792x1024',
      ];

      for (const size of sizes) {
        const dto = createValidDto();
        dto.size = size;

        const errors = await validateDto(dto);

        expect(errors).toHaveLength(0);
      }
    });
  });
});
