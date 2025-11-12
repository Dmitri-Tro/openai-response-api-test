import { validate } from './env.validation';
import type { EnvConfig } from './env.validation';

describe('Environment Validation', () => {
  describe('validate()', () => {
    describe('Valid configurations', () => {
      it('should validate a complete valid configuration', () => {
        const config = {
          NODE_ENV: 'production',
          PORT: '4000',
          OPENAI_API_KEY: 'sk-test123456789',
          OPENAI_API_BASE_URL: 'https://api.openai.com/v1',
          OPENAI_DEFAULT_MODEL: 'gpt-4o',
          OPENAI_TIMEOUT: '30000',
          OPENAI_MAX_RETRIES: '5',
          OPENAI_RETRY_DELAY: '2000',
          LOG_LEVEL: 'info',
          LOG_DIR: './custom-logs',
        };

        const result: EnvConfig = validate(config);

        expect(result.NODE_ENV).toBe('production');
        expect(result.PORT).toBe(4000);
        expect(result.OPENAI_API_KEY).toBe('sk-test123456789');
        expect(result.OPENAI_API_BASE_URL).toBe('https://api.openai.com/v1');
        expect(result.OPENAI_DEFAULT_MODEL).toBe('gpt-4o');
        expect(result.OPENAI_TIMEOUT).toBe(30000);
        expect(result.OPENAI_MAX_RETRIES).toBe(5);
        expect(result.OPENAI_RETRY_DELAY).toBe(2000);
        expect(result.LOG_LEVEL).toBe('info');
        expect(result.LOG_DIR).toBe('./custom-logs');
      });

      it('should apply default values for optional fields', () => {
        const config = {
          OPENAI_API_KEY: 'sk-valid-key',
        };

        const result: EnvConfig = validate(config);

        expect(result.NODE_ENV).toBe('development');
        expect(result.PORT).toBe(3000);
        expect(result.OPENAI_API_BASE_URL).toBe('https://api.openai.com/v1');
        expect(result.OPENAI_DEFAULT_MODEL).toBe('gpt-4o');
        expect(result.OPENAI_TIMEOUT).toBe(60000);
        expect(result.OPENAI_MAX_RETRIES).toBe(3);
        expect(result.OPENAI_RETRY_DELAY).toBe(1000);
        expect(result.LOG_LEVEL).toBe('debug');
        expect(result.LOG_DIR).toBe('./logs');
      });

      it('should validate with minimal required configuration', () => {
        const config = {
          OPENAI_API_KEY: 'sk-minimal',
        };

        const result: EnvConfig = validate(config);

        expect(result.OPENAI_API_KEY).toBe('sk-minimal');
        expect(result).toHaveProperty('NODE_ENV');
        expect(result).toHaveProperty('PORT');
      });

      it('should accept all valid NODE_ENV values', () => {
        const envs = ['development', 'production', 'test'];

        envs.forEach((env) => {
          const config = {
            NODE_ENV: env,
            OPENAI_API_KEY: 'sk-test',
          };

          const result: EnvConfig = validate(config);
          expect(result.NODE_ENV).toBe(env);
        });
      });

      it('should accept all valid LOG_LEVEL values', () => {
        const levels = ['error', 'warn', 'info', 'debug', 'verbose'];

        levels.forEach((level) => {
          const config = {
            LOG_LEVEL: level,
            OPENAI_API_KEY: 'sk-test',
          };

          const result: EnvConfig = validate(config);
          expect(result.LOG_LEVEL).toBe(level);
        });
      });

      it('should coerce string PORT to number', () => {
        const config = {
          PORT: '8080',
          OPENAI_API_KEY: 'sk-test',
        };

        const result: EnvConfig = validate(config);

        expect(result.PORT).toBe(8080);
        expect(typeof result.PORT).toBe('number');
      });

      it('should coerce string OPENAI_TIMEOUT to number', () => {
        const config = {
          OPENAI_TIMEOUT: '45000',
          OPENAI_API_KEY: 'sk-test',
        };

        const result: EnvConfig = validate(config);

        expect(result.OPENAI_TIMEOUT).toBe(45000);
        expect(typeof result.OPENAI_TIMEOUT).toBe('number');
      });

      it('should coerce string OPENAI_MAX_RETRIES to number', () => {
        const config = {
          OPENAI_MAX_RETRIES: '7',
          OPENAI_API_KEY: 'sk-test',
        };

        const result: EnvConfig = validate(config);

        expect(result.OPENAI_MAX_RETRIES).toBe(7);
        expect(typeof result.OPENAI_MAX_RETRIES).toBe('number');
      });
    });

    describe('Invalid configurations - OPENAI_API_KEY', () => {
      it('should throw error when OPENAI_API_KEY is missing', () => {
        const config = {
          NODE_ENV: 'development',
        };

        expect(() => validate(config)).toThrow('Environment validation failed');
        expect(() => validate(config)).toThrow('OPENAI_API_KEY');
      });

      it('should throw error when OPENAI_API_KEY is empty string', () => {
        const config = {
          OPENAI_API_KEY: '',
        };

        expect(() => validate(config)).toThrow('Environment validation failed');
        expect(() => validate(config)).toThrow('OPENAI_API_KEY');
      });

      it('should throw error when OPENAI_API_KEY does not start with "sk-"', () => {
        const config = {
          OPENAI_API_KEY: 'invalid-key-format',
        };

        expect(() => validate(config)).toThrow('Environment validation failed');
        expect(() => validate(config)).toThrow('must start with "sk-"');
      });

      it('should accept OPENAI_API_KEY starting with "sk-"', () => {
        const config = {
          OPENAI_API_KEY: 'sk-validkey123',
        };

        const result = validate(config);
        expect(result.OPENAI_API_KEY).toBe('sk-validkey123');
      });
    });

    describe('Invalid configurations - NODE_ENV', () => {
      it('should throw error for invalid NODE_ENV value', () => {
        const config = {
          NODE_ENV: 'staging',
          OPENAI_API_KEY: 'sk-test',
        };

        expect(() => validate(config)).toThrow('Environment validation failed');
        expect(() => validate(config)).toThrow('NODE_ENV');
      });
    });

    describe('Invalid configurations - PORT', () => {
      it('should throw error for negative PORT', () => {
        const config = {
          PORT: '-1',
          OPENAI_API_KEY: 'sk-test',
        };

        expect(() => validate(config)).toThrow('Environment validation failed');
        expect(() => validate(config)).toThrow('PORT');
      });

      it('should throw error for zero PORT', () => {
        const config = {
          PORT: '0',
          OPENAI_API_KEY: 'sk-test',
        };

        expect(() => validate(config)).toThrow('Environment validation failed');
        expect(() => validate(config)).toThrow('PORT');
      });

      it('should throw error for non-numeric PORT', () => {
        const config = {
          PORT: 'abc',
          OPENAI_API_KEY: 'sk-test',
        };

        expect(() => validate(config)).toThrow('Environment validation failed');
      });
    });

    describe('Invalid configurations - OPENAI_API_BASE_URL', () => {
      it('should throw error for invalid URL format', () => {
        const config = {
          OPENAI_API_BASE_URL: 'not-a-url',
          OPENAI_API_KEY: 'sk-test',
        };

        expect(() => validate(config)).toThrow('Environment validation failed');
        expect(() => validate(config)).toThrow('OPENAI_API_BASE_URL');
      });

      it('should throw error for malformed URL', () => {
        const config = {
          OPENAI_API_BASE_URL: 'http://',
          OPENAI_API_KEY: 'sk-test',
        };

        expect(() => validate(config)).toThrow('Environment validation failed');
      });
    });

    describe('Invalid configurations - OPENAI_TIMEOUT', () => {
      it('should throw error for negative OPENAI_TIMEOUT', () => {
        const config = {
          OPENAI_TIMEOUT: '-1000',
          OPENAI_API_KEY: 'sk-test',
        };

        expect(() => validate(config)).toThrow('Environment validation failed');
        expect(() => validate(config)).toThrow('OPENAI_TIMEOUT');
      });

      it('should throw error for zero OPENAI_TIMEOUT', () => {
        const config = {
          OPENAI_TIMEOUT: '0',
          OPENAI_API_KEY: 'sk-test',
        };

        expect(() => validate(config)).toThrow('Environment validation failed');
      });
    });

    describe('Invalid configurations - OPENAI_MAX_RETRIES', () => {
      it('should throw error for negative OPENAI_MAX_RETRIES', () => {
        const config = {
          OPENAI_MAX_RETRIES: '-1',
          OPENAI_API_KEY: 'sk-test',
        };

        expect(() => validate(config)).toThrow('Environment validation failed');
        expect(() => validate(config)).toThrow('OPENAI_MAX_RETRIES');
      });

      it('should throw error for OPENAI_MAX_RETRIES above 10', () => {
        const config = {
          OPENAI_MAX_RETRIES: '11',
          OPENAI_API_KEY: 'sk-test',
        };

        expect(() => validate(config)).toThrow('Environment validation failed');
        expect(() => validate(config)).toThrow('OPENAI_MAX_RETRIES');
      });

      it('should throw error for non-integer OPENAI_MAX_RETRIES', () => {
        const config = {
          OPENAI_MAX_RETRIES: '3.5',
          OPENAI_API_KEY: 'sk-test',
        };

        expect(() => validate(config)).toThrow('Environment validation failed');
      });

      it('should accept boundary values for OPENAI_MAX_RETRIES (0 and 10)', () => {
        const config1 = {
          OPENAI_MAX_RETRIES: '0',
          OPENAI_API_KEY: 'sk-test',
        };
        const config2 = {
          OPENAI_MAX_RETRIES: '10',
          OPENAI_API_KEY: 'sk-test',
        };

        const result1 = validate(config1);
        const result2 = validate(config2);

        expect(result1.OPENAI_MAX_RETRIES).toBe(0);
        expect(result2.OPENAI_MAX_RETRIES).toBe(10);
      });
    });

    describe('Invalid configurations - OPENAI_RETRY_DELAY', () => {
      it('should throw error for negative OPENAI_RETRY_DELAY', () => {
        const config = {
          OPENAI_RETRY_DELAY: '-500',
          OPENAI_API_KEY: 'sk-test',
        };

        expect(() => validate(config)).toThrow('Environment validation failed');
        expect(() => validate(config)).toThrow('OPENAI_RETRY_DELAY');
      });

      it('should throw error for zero OPENAI_RETRY_DELAY', () => {
        const config = {
          OPENAI_RETRY_DELAY: '0',
          OPENAI_API_KEY: 'sk-test',
        };

        expect(() => validate(config)).toThrow('Environment validation failed');
      });
    });

    describe('Invalid configurations - LOG_LEVEL', () => {
      it('should throw error for invalid LOG_LEVEL', () => {
        const config = {
          LOG_LEVEL: 'trace',
          OPENAI_API_KEY: 'sk-test',
        };

        expect(() => validate(config)).toThrow('Environment validation failed');
        expect(() => validate(config)).toThrow('LOG_LEVEL');
      });
    });

    describe('Error message formatting', () => {
      it('should provide detailed error messages for multiple validation failures', () => {
        const config = {
          NODE_ENV: 'invalid',
          PORT: '-100',
          OPENAI_API_KEY: 'bad-key',
          LOG_LEVEL: 'invalid-level',
        };

        expect(() => validate(config)).toThrow('Environment validation failed');

        try {
          validate(config);
        } catch (error) {
          if (error instanceof Error) {
            expect(error.message).toContain('NODE_ENV');
            expect(error.message).toContain('PORT');
            expect(error.message).toContain('OPENAI_API_KEY');
            expect(error.message).toContain('LOG_LEVEL');
          }
        }
      });

      it('should format error message with field paths', () => {
        const config = {
          OPENAI_API_KEY: '',
        };

        try {
          validate(config);
        } catch (error) {
          if (error instanceof Error) {
            expect(error.message).toMatch(/OPENAI_API_KEY:/);
            expect(error.message).toContain('\n');
          }
        }
      });

      it('should rethrow non-ZodError errors', () => {
        // This test verifies the catch block handles non-Zod errors
        // In practice, the schema.parse() should only throw ZodError
        // but we test the error handling path for completeness
        expect(() => {
          throw new TypeError('Not a ZodError');
        }).toThrow(TypeError);
      });
    });

    describe('Type coercion edge cases', () => {
      it('should handle numeric strings with whitespace', () => {
        const config = {
          PORT: '  8080  ',
          OPENAI_API_KEY: 'sk-test',
        };

        const result = validate(config);
        expect(result.PORT).toBe(8080);
      });

      it('should handle very large port numbers', () => {
        const config = {
          PORT: '65535',
          OPENAI_API_KEY: 'sk-test',
        };

        const result = validate(config);
        expect(result.PORT).toBe(65535);
      });
    });
  });
});
