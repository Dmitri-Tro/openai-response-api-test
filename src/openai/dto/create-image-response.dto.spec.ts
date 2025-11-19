import { validate } from 'class-validator';
import { CreateImageResponseDto } from './create-image-response.dto';

describe('CreateImageResponseDto', () => {
  describe('required fields', () => {
    it('should pass validation with only required fields', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A beautiful sunset over mountains';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation without input', async () => {
      const dto = new CreateImageResponseDto();
      // input is missing

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('input');
    });

    it('should fail validation with non-string input', async () => {
      const dto = new CreateImageResponseDto();
      (dto as any).input = { prompt: 'test' };

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('input');
    });
  });

  describe('model field', () => {
    it('should accept valid model string', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.model = 'gpt-image-1';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should use default model value', () => {
      const dto = new CreateImageResponseDto();
      expect(dto.model).toBe('gpt-5');
    });

    it('should fail with non-string model', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      (dto as any).model = 123;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('modalities field', () => {
    it('should accept valid modalities with text only', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.modalities = ['text'];

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept valid modalities with audio only', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.modalities = ['audio'];

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept valid modalities with both text and audio', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.modalities = ['text', 'audio'];

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should allow modalities to be undefined', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with empty modalities array', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.modalities = [];

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('modalities');
      expect(errors[0].constraints).toHaveProperty('arrayNotEmpty');
    });

    it('should fail with invalid modality value', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      (dto as any).modalities = ['video'];

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('modalities');
    });

    it('should fail with non-array modalities', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      (dto as any).modalities = 'text';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('modalities');
    });
  });

  describe('image_model field', () => {
    it('should accept gpt-image-1', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.image_model = 'gpt-image-1';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept gpt-image-1-mini', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.image_model = 'gpt-image-1-mini';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid image_model', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      (dto as any).image_model = 'dall-e-3';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const error = errors.find((e) => e.property === 'image_model');
      expect(error).toBeDefined();
    });
  });

  describe('image_quality field', () => {
    it('should accept low quality', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.image_quality = 'low';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept medium quality', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.image_quality = 'medium';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept high quality', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.image_quality = 'high';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept auto quality', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.image_quality = 'auto';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid quality', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      (dto as any).image_quality = 'ultra';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const error = errors.find((e) => e.property === 'image_quality');
      expect(error).toBeDefined();
    });
  });

  describe('image_format field', () => {
    it('should accept png format', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.image_format = 'png';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept webp format', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.image_format = 'webp';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept jpeg format', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.image_format = 'jpeg';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid format', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      (dto as any).image_format = 'gif';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const error = errors.find((e) => e.property === 'image_format');
      expect(error).toBeDefined();
    });
  });

  describe('image_size field', () => {
    it('should accept 1024x1024 size', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.image_size = '1024x1024';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept 1024x1536 size (portrait)', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.image_size = '1024x1536';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept 1536x1024 size (landscape)', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.image_size = '1536x1024';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept auto size', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.image_size = 'auto';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid size', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      (dto as any).image_size = '512x512';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const error = errors.find((e) => e.property === 'image_size');
      expect(error).toBeDefined();
    });
  });

  describe('image_moderation field', () => {
    it('should accept auto moderation', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.image_moderation = 'auto';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept low moderation', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.image_moderation = 'low';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid moderation', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      (dto as any).image_moderation = 'strict';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const error = errors.find((e) => e.property === 'image_moderation');
      expect(error).toBeDefined();
    });
  });

  describe('image_background field', () => {
    it('should accept transparent background', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A logo';
      dto.image_background = 'transparent';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept opaque background', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A logo';
      dto.image_background = 'opaque';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept auto background', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A logo';
      dto.image_background = 'auto';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid background', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A logo';
      (dto as any).image_background = 'gradient';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const error = errors.find((e) => e.property === 'image_background');
      expect(error).toBeDefined();
    });
  });

  describe('input_fidelity field', () => {
    it('should accept high fidelity', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.input_fidelity = 'high';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept low fidelity', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.input_fidelity = 'low';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid fidelity', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      (dto as any).input_fidelity = 'medium';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const error = errors.find((e) => e.property === 'input_fidelity');
      expect(error).toBeDefined();
    });
  });

  describe('output_compression field', () => {
    it('should accept compression of 0', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.output_compression = 0;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept compression of 100', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.output_compression = 100;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept compression of 75', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.output_compression = 75;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with compression below 0', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.output_compression = -1;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const error = errors.find((e) => e.property === 'output_compression');
      expect(error).toBeDefined();
    });

    it('should fail with compression above 100', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.output_compression = 101;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const error = errors.find((e) => e.property === 'output_compression');
      expect(error).toBeDefined();
    });

    it('should fail with non-integer compression', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.output_compression = 75.5;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const error = errors.find((e) => e.property === 'output_compression');
      expect(error).toBeDefined();
    });
  });

  describe('partial_images field', () => {
    it('should accept partial_images of 0', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.partial_images = 0;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept partial_images of 3', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.partial_images = 3;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept partial_images of 2', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.partial_images = 2;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with partial_images below 0', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.partial_images = -1;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const error = errors.find((e) => e.property === 'partial_images');
      expect(error).toBeDefined();
    });

    it('should fail with partial_images above 3', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.partial_images = 4;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const error = errors.find((e) => e.property === 'partial_images');
      expect(error).toBeDefined();
    });

    it('should fail with non-integer partial_images', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.partial_images = 1.5;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const error = errors.find((e) => e.property === 'partial_images');
      expect(error).toBeDefined();
    });
  });

  describe('boolean and string fields', () => {
    it('should accept instructions', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.instructions = 'Generate high-quality, realistic images';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept store', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.store = true;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept previous_response_id', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.previous_response_id = 'resp_abc123';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept parallel_tool_calls', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.parallel_tool_calls = true;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept background', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.background = true;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('performance and safety parameters', () => {
    it('should accept prompt_cache_key', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.prompt_cache_key = 'user-123-hashed';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept safety_identifier', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.safety_identifier = 'hashed-user-id';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept metadata', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.metadata = { request_id: '123', user_tier: 'premium' };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept max_output_tokens', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.max_output_tokens = 1000;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid max_output_tokens', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      dto.max_output_tokens = 0;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const error = errors.find((e) => e.property === 'max_output_tokens');
      expect(error).toBeDefined();
    });

    it('should fail with non-object metadata', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'A sunset';
      (dto as any).metadata = 'not an object';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const error = errors.find((e) => e.property === 'metadata');
      expect(error).toBeDefined();
    });
  });

  describe('complex scenarios', () => {
    it('should validate complete image generation request', async () => {
      const dto = new CreateImageResponseDto();
      dto.model = 'gpt-image-1';
      dto.input = 'A serene mountain landscape at sunset';
      dto.instructions = 'Generate high-quality realistic image';
      dto.image_model = 'gpt-image-1';
      dto.image_quality = 'high';
      dto.image_format = 'png';
      dto.image_size = '1536x1024';
      dto.image_background = 'opaque';
      dto.input_fidelity = 'high';
      dto.output_compression = 95;
      dto.partial_images = 2;
      dto.store = true;
      dto.safety_identifier = 'hashed-user-id';
      dto.metadata = { request_id: 'req-123' };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate fast image generation with mini model', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'Quick sketch of a cat';
      dto.image_model = 'gpt-image-1-mini';
      dto.image_quality = 'low';
      dto.image_format = 'webp';
      dto.output_compression = 80;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate transparent logo generation', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'Company logo with text';
      dto.image_format = 'png';
      dto.image_background = 'transparent';
      dto.image_size = '1024x1024';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate streaming with progressive rendering', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'Complex detailed artwork';
      dto.partial_images = 3;
      dto.image_quality = 'high';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  // Advanced Features: Advanced Features Tests
  describe('Advanced Features - prompt parameter', () => {
    it('should accept valid prompt template object', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'Test image';
      dto.prompt = {
        id: 'pmpt_abc123',
        version: '1',
        variables: { style: 'photorealistic', subject: 'mountain landscape' },
      };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept prompt with minimal fields', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'Test image';
      dto.prompt = {
        id: 'pmpt_xyz789',
      };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept null prompt', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'Test image';
      dto.prompt = null;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should allow prompt to be undefined', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'Test image';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with non-object prompt', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'Test image';
      (dto as any).prompt = 'not-an-object';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Advanced Features - include parameter', () => {
    it('should accept valid include array with single value', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'Test image';
      dto.include = ['message.input_image.image_url'];

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept include array with multiple values', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'Test image';
      dto.include = [
        'message.input_image.image_url',
        'code_interpreter_call.outputs',
      ];

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept all 8 include options', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'Test image';
      dto.include = [
        'file_search_call.results',
        'web_search_call.results',
        'web_search_call.action.sources',
        'message.input_image.image_url',
        'computer_call_output.output.image_url',
        'code_interpreter_call.outputs',
        'reasoning.encrypted_content',
        'message.output_text.logprobs',
      ];

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept empty include array', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'Test image';
      dto.include = [];

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept null include', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'Test image';
      dto.include = null;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should allow include to be undefined', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'Test image';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with non-array include', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'Test image';
      (dto as any).include = 'not-an-array';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Advanced Features - combined advanced features', () => {
    it('should validate with all Advanced Features parameters', async () => {
      const dto = new CreateImageResponseDto();
      dto.input = 'Test all advanced features';
      dto.prompt = {
        id: 'pmpt_combined',
        version: '2',
        variables: { style: 'abstract', colors: 'vibrant' },
      };
      dto.include = [
        'message.input_image.image_url',
        'computer_call_output.output.image_url',
      ];

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate Advanced Features parameters with image-specific options', async () => {
      const dto = new CreateImageResponseDto();
      dto.model = 'gpt-image-1';
      dto.input = 'Advanced image generation';
      dto.image_model = 'gpt-image-1';
      dto.image_quality = 'high';
      dto.image_format = 'png';
      dto.image_size = '1536x1024';
      dto.prompt = { id: 'pmpt_img', version: '1' };
      dto.include = ['message.input_image.image_url'];
      dto.store = true;
      dto.metadata = { test: 'phase-2.11-image' };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should not include reasoning parameter for images', () => {
      const dto = new CreateImageResponseDto();
      expect((dto as any).reasoning).toBeUndefined();
    });
  });
});
