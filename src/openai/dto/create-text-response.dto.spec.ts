import { validate } from 'class-validator';
import { CreateTextResponseDto } from './create-text-response.dto';

describe('CreateTextResponseDto', () => {
  describe('required fields', () => {
    it('should pass validation with only required fields', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test input';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation without input', async () => {
      const dto = new CreateTextResponseDto();
      // input is missing

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('input');
    });

    it('should fail validation with non-string input', async () => {
      const dto = new CreateTextResponseDto();
      (dto as any).input = 123;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('input');
    });
  });

  describe('model field', () => {
    it('should accept valid model string', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.model = 'gpt-5';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should use default model value', () => {
      const dto = new CreateTextResponseDto();
      expect(dto.model).toBe('gpt-5');
    });

    it('should fail with non-string model', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      (dto as any).model = 123;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('instructions field', () => {
    it('should accept valid instructions', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.instructions = 'Be helpful and concise';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should allow instructions to be undefined', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with non-string instructions', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      (dto as any).instructions = { text: 'invalid' };

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('temperature field', () => {
    it('should accept temperature of 0', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.temperature = 0;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept temperature of 2', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.temperature = 2;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept temperature of 1', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.temperature = 1;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with temperature below 0', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.temperature = -0.1;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const tempError = errors.find((e) => e.property === 'temperature');
      expect(tempError).toBeDefined();
    });

    it('should fail with temperature above 2', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.temperature = 2.1;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const tempError = errors.find((e) => e.property === 'temperature');
      expect(tempError).toBeDefined();
    });

    it('should fail with non-number temperature', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      (dto as any).temperature = 'hot';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('top_p field', () => {
    it('should accept top_p of 0', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.top_p = 0;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept top_p of 1', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.top_p = 1;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept top_p of 0.5', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.top_p = 0.5;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with top_p below 0', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.top_p = -0.1;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const error = errors.find((e) => e.property === 'top_p');
      expect(error).toBeDefined();
    });

    it('should fail with top_p above 1', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.top_p = 1.1;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const error = errors.find((e) => e.property === 'top_p');
      expect(error).toBeDefined();
    });
  });

  describe('max_output_tokens field', () => {
    it('should accept valid max_output_tokens', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.max_output_tokens = 1000;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept minimum max_output_tokens of 1', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.max_output_tokens = 1;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with max_output_tokens of 0', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.max_output_tokens = 0;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const error = errors.find((e) => e.property === 'max_output_tokens');
      expect(error).toBeDefined();
    });

    it('should fail with negative max_output_tokens', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.max_output_tokens = -10;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const error = errors.find((e) => e.property === 'max_output_tokens');
      expect(error).toBeDefined();
    });
  });

  describe('boolean fields', () => {
    it('should accept stream as boolean', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.stream = true;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept store as boolean', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.store = true;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept parallel_tool_calls as boolean', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.parallel_tool_calls = false;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept background as boolean', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.background = true;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with non-boolean stream', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      (dto as any).stream = 'true';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('string fields', () => {
    it('should accept previous_response_id', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.previous_response_id = 'resp_abc123';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept prompt_cache_key', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.prompt_cache_key = 'user-123-hashed';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept safety_identifier', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.safety_identifier = 'hashed-user-id';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with non-string previous_response_id', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      (dto as any).previous_response_id = 123;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('object fields', () => {
    it('should accept text object', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.text = { format: { type: 'text' } };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept metadata object', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.metadata = { request_id: '123', user_tier: 'premium' };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept stream_options object', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.stream_options = { include_obfuscation: true };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with non-object text', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      (dto as any).text = 'not an object';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail with non-object metadata', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      (dto as any).metadata = 'not an object';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('array fields', () => {
    it('should accept tools array', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.tools = [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get weather',
            parameters: {},
          },
        },
      ];

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept empty tools array', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.tools = [];

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with non-array tools', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      (dto as any).tools = { type: 'function' };

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('complex scenarios', () => {
    it('should validate all fields together', async () => {
      const dto = new CreateTextResponseDto();
      dto.model = 'gpt-5';
      dto.input = 'Explain quantum computing';
      dto.instructions = 'Be concise';
      dto.temperature = 0.7;
      dto.top_p = 0.9;
      dto.max_output_tokens = 500;
      dto.store = true;
      dto.parallel_tool_calls = true;
      dto.prompt_cache_key = 'user-123';
      dto.service_tier = 'auto';
      dto.safety_identifier = 'hashed-user';
      dto.metadata = { request_id: 'req-123' };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with conversation parameters', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Continue the conversation';
      dto.previous_response_id = 'resp_abc123';
      dto.store = true;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with streaming options', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test streaming';
      dto.stream = true;
      dto.stream_options = { include_obfuscation: false };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with background processing', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Long running task';
      dto.background = true;
      dto.store = true;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  // Advanced Features: Advanced Features Tests
  describe('Advanced Features - prompt parameter', () => {
    it('should accept valid prompt template object', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.prompt = {
        id: 'pmpt_abc123',
        version: '2',
        variables: { customer_name: 'Jane Doe', product: '40oz juice box' },
      };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept prompt with minimal fields', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.prompt = {
        id: 'pmpt_xyz789',
      };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept null prompt', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.prompt = null;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should allow prompt to be undefined', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with non-object prompt', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      (dto as any).prompt = 'not-an-object';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Advanced Features - include parameter', () => {
    it('should accept valid include array with single value', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.include = ['message.output_text.logprobs'];

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept include array with multiple values', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.include = [
        'code_interpreter_call.outputs',
        'message.output_text.logprobs',
        'reasoning.encrypted_content',
      ];

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept all 8 include options', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
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
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.include = [];

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept null include', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.include = null;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should allow include to be undefined', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with non-array include', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      (dto as any).include = 'not-an-array';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Advanced Features - reasoning parameter', () => {
    it('should accept valid reasoning object with effort', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.reasoning = { effort: 'medium' };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept reasoning with summary', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.reasoning = { summary: 'detailed' };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept reasoning with both effort and summary', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.reasoning = { effort: 'high', summary: 'concise' };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept reasoning with effort minimal', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.reasoning = { effort: 'minimal' };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept reasoning with effort low', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.reasoning = { effort: 'low' };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept reasoning with effort high', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.reasoning = { effort: 'high' };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept reasoning with summary auto', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.reasoning = { summary: 'auto' };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept null reasoning', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      dto.reasoning = null;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should allow reasoning to be undefined', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with non-object reasoning', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test';
      (dto as any).reasoning = 'not-an-object';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Advanced Features - combined advanced features', () => {
    it('should validate with all Advanced Features parameters', async () => {
      const dto = new CreateTextResponseDto();
      dto.input = 'Test all advanced features';
      dto.prompt = {
        id: 'pmpt_combined',
        version: '1',
        variables: { topic: 'quantum physics' },
      };
      dto.include = [
        'message.output_text.logprobs',
        'reasoning.encrypted_content',
      ];
      dto.reasoning = { effort: 'medium', summary: 'auto' };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate Advanced Features parameters with other optional fields', async () => {
      const dto = new CreateTextResponseDto();
      dto.model = 'gpt-5-preview';
      dto.input = 'Complex reasoning task';
      dto.instructions = 'Think carefully';
      dto.temperature = 0.8;
      dto.max_output_tokens = 2000;
      dto.prompt = { id: 'pmpt_abc' };
      dto.include = ['code_interpreter_call.outputs'];
      dto.reasoning = { effort: 'high', summary: 'detailed' };
      dto.store = true;
      dto.metadata = { test: 'phase-2.11' };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });
});
