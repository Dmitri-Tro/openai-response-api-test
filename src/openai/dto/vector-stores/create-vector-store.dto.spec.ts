import { validate, ValidationError } from 'class-validator';
import { CreateVectorStoreDto } from './create-vector-store.dto';

async function validateDto(
  dto: CreateVectorStoreDto,
): Promise<ValidationError[]> {
  return await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: false,
  });
}

function createValidDto(): CreateVectorStoreDto {
  return new CreateVectorStoreDto();
}

describe('CreateVectorStoreDto', () => {
  describe('Valid Configurations', () => {
    it('should validate with no fields (all optional)', async () => {
      const dto = createValidDto();
      const errors = await validateDto(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with valid name', async () => {
      const dto = createValidDto();
      dto.name = 'Test Vector Store';
      const errors = await validateDto(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with valid file_ids', async () => {
      const dto = createValidDto();
      dto.file_ids = ['file-abc123', 'file-def456'];
      const errors = await validateDto(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with auto chunking strategy', async () => {
      const dto = createValidDto();
      dto.chunking_strategy = { type: 'auto' };
      const errors = await validateDto(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with static chunking strategy', async () => {
      const dto = createValidDto();
      dto.chunking_strategy = {
        type: 'static',
        static: {
          max_chunk_size_tokens: 800,
          chunk_overlap_tokens: 400,
        },
      };
      const errors = await validateDto(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with valid metadata', async () => {
      const dto = createValidDto();
      dto.metadata = {
        category: 'documentation',
        version: '2.0',
      };
      const errors = await validateDto(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with all fields populated', async () => {
      const dto = createValidDto();
      dto.name = 'Complete Vector Store';
      dto.file_ids = ['file-abc123'];
      dto.chunking_strategy = { type: 'auto' };
      dto.metadata = { category: 'docs' };
      dto.description = 'Test description';
      const errors = await validateDto(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Invalid Configurations', () => {
    it('should reject invalid file_id format', async () => {
      const dto = createValidDto();
      dto.file_ids = ['invalid-id'];
      const errors = await validateDto(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid chunking strategy (delegates to validator)', async () => {
      const dto = createValidDto();
      dto.chunking_strategy = {
        type: 'invalid',
      } as unknown as typeof dto.chunking_strategy;
      const errors = await validateDto(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid metadata (delegates to validator)', async () => {
      const dto = createValidDto();
      // More than 16 key-value pairs
      dto.metadata = {};
      for (let i = 0; i < 17; i++) {
        dto.metadata[`key${i}`] = `value${i}`;
      }
      const errors = await validateDto(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
