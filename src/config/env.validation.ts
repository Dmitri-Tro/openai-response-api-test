import { z } from 'zod';

/**
 * Environment validation schema using Zod
 *
 * Provides compile-time and runtime type safety for environment variables using Zod,
 * a TypeScript-first schema validation library. This schema validates all environment
 * variables at application startup, failing fast with clear error messages if any
 * required variables are missing or invalid.
 *
 * **Key Features:**
 * - ✅ **Type Inference**: TypeScript types automatically inferred from schema
 * - ✅ **Runtime Validation**: Validates actual environment values at startup
 * - ✅ **Fail Fast**: Application refuses to start with invalid config
 * - ✅ **Clear Errors**: Detailed error messages showing which variables failed and why
 * - ✅ **Default Values**: Sensible defaults for optional variables
 * - ✅ **Type Coercion**: Automatic string-to-number conversion with validation
 *
 * **Validation Rules:**
 *
 * **Application Settings:**
 * - `NODE_ENV` - Must be "development", "production", or "test" (default: development)
 * - `PORT` - Must be positive number (default: 3000)
 *
 * **OpenAI Configuration:**
 * - `OPENAI_API_KEY` - Required, must start with "sk-", minimum 1 character
 * - `OPENAI_API_BASE_URL` - Must be valid URL (default: https://api.openai.com/v1)
 * - `OPENAI_DEFAULT_MODEL` - String (default: gpt-4o)
 * - `OPENAI_TIMEOUT` - Positive number in milliseconds (default: 60000)
 * - `OPENAI_MAX_RETRIES` - Integer 0-10 (default: 3)
 * - `OPENAI_RETRY_DELAY` - Positive number in milliseconds (default: 1000)
 *
 * **Logging Configuration:**
 * - `LOG_LEVEL` - Must be error, warn, info, debug, or verbose (default: debug)
 * - `LOG_DIR` - String path (default: ./logs)
 *
 * **Example Valid .env File:**
 * ```
 * OPENAI_API_KEY=sk-proj-abc123...
 * NODE_ENV=development
 * PORT=3000
 * OPENAI_DEFAULT_MODEL=gpt-5
 * LOG_LEVEL=debug
 * ```
 *
 * **Example Validation Errors:**
 * ```
 * Environment validation failed:
 * OPENAI_API_KEY: OPENAI_API_KEY must start with "sk-"
 * PORT: Expected positive number, received "abc"
 * NODE_ENV: Invalid enum value. Expected 'development' | 'production' | 'test'
 * ```
 *
 * **Integration:**
 * Used by NestJS ConfigModule via the `validate` function:
 * ```typescript
 * ConfigModule.forRoot({
 *   isGlobal: true,
 *   load: [configuration],
 *   validate: validate, // <-- Zod validation applied here
 * })
 * ```
 *
 * **Type Safety Benefits:**
 * - ConfigService automatically knows the types of all config values
 * - TypeScript errors if you try to access non-existent config keys
 * - IntelliSense autocomplete for all config paths
 * - No runtime surprises from invalid environment variables
 *
 * @see {@link https://zod.dev}
 * @see {@link https://docs.nestjs.com/techniques/configuration#custom-validate-function}
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
