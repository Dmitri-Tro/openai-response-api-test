import { z } from 'zod';

/**
 * Environment validation schema using Zod
 * Provides type-safe environment variables with automatic type inference
 */
const envSchema = z.object({
  // Application settings
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().positive().default(3000),

  // OpenAI API configuration
  OPENAI_API_KEY: z
    .string()
    .min(1, 'OPENAI_API_KEY is required')
    .startsWith('sk-', 'OPENAI_API_KEY must start with "sk-"'),

  OPENAI_API_BASE_URL: z.string().url().default('https://api.openai.com/v1'),

  OPENAI_DEFAULT_MODEL: z.string().default('gpt-4o'),

  OPENAI_TIMEOUT: z.coerce.number().positive().default(60000),

  OPENAI_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),

  OPENAI_RETRY_DELAY: z.coerce.number().positive().default(1000),

  // Logging configuration
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'debug', 'verbose'])
    .default('debug'),

  LOG_DIR: z.string().default('./logs'),
});

/**
 * Automatically inferred TypeScript type from Zod schema
 * No need to manually maintain types!
 */
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validates environment variables against the schema
 * @param config - Raw environment variables from process.env
 * @returns Validated and typed environment configuration
 * @throws Error if validation fails with detailed error messages
 */
export function validate(config: Record<string, unknown>): EnvConfig {
  try {
    return envSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map(
        (err) => `${err.path.join('.')}: ${err.message}`,
      );
      throw new Error(
        `Environment validation failed:\n${errorMessages.join('\n')}`,
      );
    }
    throw error;
  }
}
