import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

/**
 * Injection token for OpenAI client singleton
 *
 * Use this token to inject the shared OpenAI client instance across services.
 *
 * @example
 * ```typescript
 * constructor(
 *   @Inject(OPENAI_CLIENT) private readonly client: OpenAI,
 * ) {}
 * ```
 */
export const OPENAI_CLIENT = Symbol('OPENAI_CLIENT');

/**
 * Factory provider for OpenAI client singleton
 *
 * **Purpose**: Creates a single shared instance of the OpenAI client to be used across all services.
 *
 * **Benefits:**
 * - Single connection pool (resource efficiency)
 * - Centralized configuration
 * - Easier testing (mock once at provider level)
 * - Follows NestJS best practices for shared resources
 *
 * **Configuration:**
 * - `openai.apiKey` - OpenAI API key (required)
 * - `openai.baseURL` - Custom base URL (optional)
 * - `openai.timeout` - Request timeout in milliseconds
 * - `openai.maxRetries` - Maximum number of retry attempts
 *
 * @throws {Error} If OpenAI API key is not configured
 */
export const OpenAIClientProvider: Provider = {
  provide: OPENAI_CLIENT,
  useFactory: (configService: ConfigService): OpenAI => {
    const apiKey = configService.get<string>('openai.apiKey');
    const baseURL = configService.get<string>('openai.baseURL');

    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    return new OpenAI({
      apiKey,
      baseURL,
      timeout: configService.get<number>('openai.timeout'),
      maxRetries: configService.get<number>('openai.maxRetries'),
    });
  },
  inject: [ConfigService],
};
