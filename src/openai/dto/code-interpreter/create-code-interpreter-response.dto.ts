import { IsOptional, IsString, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateTextResponseDto } from '../create-text-response.dto';
import { IsMemoryLimitValid } from '../../validators/memory-limit.validator';
import type { MemoryLimit } from '../../validators/memory-limit.validator';

/**
 * DTO for creating code interpreter responses with advanced configuration
 * Extends CreateTextResponseDto with code interpreter-specific parameters
 *
 * @example
 * ```typescript
 * {
 *   model: 'gpt-4o',
 *   input: 'Calculate the factorial of 10 using Python',
 *   tools: [{
 *     type: 'code_interpreter',
 *     container: {
 *       type: 'auto',
 *       file_ids: ['file-abc123...']
 *     }
 *   }],
 *   memory_limit: '4g',
 *   include: ['code_interpreter_call.outputs']
 * }
 * ```
 */
export class CreateCodeInterpreterResponseDto extends CreateTextResponseDto {
  /**
   * Memory limit for the code interpreter container
   *
   * Options:
   * - `1g`: 1 GB RAM (suitable for light data processing, simple calculations)
   * - `4g`: 4 GB RAM (standard data analysis, pandas operations) - **Default**
   * - `16g`: 16 GB RAM (large dataset processing, complex visualizations)
   * - `64g`: 64 GB RAM (intensive computations, machine learning tasks)
   *
   * Higher memory limits may incur additional costs.
   * If not specified, OpenAI uses default container configuration (~4g).
   *
   * @example '4g'
   */
  @ApiPropertyOptional({
    description: 'Memory limit for code interpreter container',
    enum: ['1g', '4g', '16g', '64g'],
    example: '4g',
  })
  @IsOptional()
  @IsMemoryLimitValid()
  memory_limit?: MemoryLimit;

  /**
   * Container ID to reuse from a previous response (cost optimization)
   *
   * Reusing containers saves $0.03 per request and maintains session state.
   * Containers remain active for up to 1 hour or 20 minutes of idle time.
   *
   * If provided, this overrides any container configuration in tools array.
   *
   * @example 'container_abc123xyz789'
   */
  @ApiPropertyOptional({
    description: 'Container ID to reuse (saves $0.03 per request)',
    example: 'container_abc123xyz789',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  container_id?: string;
}
