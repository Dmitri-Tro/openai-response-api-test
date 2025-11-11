import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsObject,
} from 'class-validator';
import type { Responses } from 'openai/resources/responses';

/**
 * DTO for creating text responses via OpenAI Responses API
 */
export class CreateTextResponseDto {
  @ApiProperty({
    description: 'The model to use for text generation',
    example: 'gpt-4o',
    default: 'gpt-4o',
  })
  @IsString()
  @IsOptional()
  model?: string = 'gpt-4o';

  @ApiProperty({
    description: 'The input text or conversation messages',
    example: 'Explain quantum computing in simple terms',
  })
  @IsString()
  input: string;

  @ApiPropertyOptional({
    description: 'System instructions for the model',
    example: 'You are a helpful assistant that explains complex topics simply',
  })
  @IsString()
  @IsOptional()
  instructions?: string;

  @ApiPropertyOptional({
    description: 'Whether to stream the response',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  stream?: boolean = false;

  @ApiPropertyOptional({
    description: 'Tools available for the model to use',
    example: [],
  })
  @IsArray()
  @IsOptional()
  tools?: Responses.ResponseCreateParamsNonStreaming['tools'];

  @ApiPropertyOptional({
    description: 'Response format specification',
    example: { type: 'text' },
  })
  @IsObject()
  @IsOptional()
  response_format?: Responses.ResponseCreateParamsNonStreaming['text'];
}
