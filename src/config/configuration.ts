/**
 * Configuration factory for NestJS ConfigModule
 *
 * This factory function loads and structures environment variables for the application.
 * Used by ConfigModule.forRoot() to provide type-safe configuration throughout the app.
 *
 * **Configuration Structure:**
 *
 * **Application Settings:**
 * - `port` - HTTP server port (default: 3000)
 * - `nodeEnv` - Environment mode: development, production, or test (default: development)
 *
 * **OpenAI Configuration:**
 * - `openai.apiKey` - OpenAI API key (required, must start with "sk-")
 * - `openai.baseUrl` - OpenAI API base URL (default: https://api.openai.com/v1)
 * - `openai.defaultModel` - Default model for requests (default: gpt-5)
 * - `openai.timeout` - Request timeout in milliseconds (default: 60000 = 1 minute)
 * - `openai.maxRetries` - Maximum retry attempts (default: 3)
 * - `openai.retryDelay` - Delay between retries in milliseconds (default: 1000 = 1 second)
 *
 * **Logging Configuration:**
 * - `logging.level` - Log level: error, warn, info, debug, verbose (default: debug)
 * - `logging.dir` - Log directory path (default: ./logs)
 *
 * **Environment Variables:**
 * All configuration values are loaded from environment variables:
 * - PORT, NODE_ENV, OPENAI_API_KEY, OPENAI_API_BASE_URL
 * - OPENAI_DEFAULT_MODEL, OPENAI_TIMEOUT, OPENAI_MAX_RETRIES
 * - OPENAI_RETRY_DELAY, LOG_LEVEL, LOG_DIR
 *
 * **Type Safety:**
 * Environment variables are validated at startup using Zod schema (see env.validation.ts).
 * Application will fail fast if required variables are missing or invalid.
 *
 * **Usage:**
 * Configuration is accessed throughout the app via ConfigService:
 * ```typescript
 * constructor(private configService: ConfigService) {
 *   const apiKey = this.configService.get<string>('openai.apiKey');
 *   const port = this.configService.get<number>('port');
 * }
 * ```
 *
 * **Development:**
 * Create a `.env` file in project root with required variables:
 * ```
 * OPENAI_API_KEY=sk-...
 * PORT=3000
 * NODE_ENV=development
 * ```
 *
 * @returns Configuration object with nested structure for app, OpenAI, and logging settings
 * @see {@link https://docs.nestjs.com/techniques/configuration}
 * @see env.validation.ts for validation schema
 */
export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
    defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-5',
    timeout: parseInt(process.env.OPENAI_TIMEOUT || '60000', 10),
    maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3', 10),
    retryDelay: parseInt(process.env.OPENAI_RETRY_DELAY || '1000', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
    dir: process.env.LOG_DIR || './logs',
  },
});
