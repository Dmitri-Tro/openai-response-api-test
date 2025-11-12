import configuration from './configuration';

describe('Configuration Factory', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Default configuration', () => {
    it('should return default configuration when no environment variables are set', () => {
      // Clear relevant environment variables
      delete process.env.PORT;
      delete process.env.NODE_ENV;
      delete process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_BASE_URL;
      delete process.env.OPENAI_DEFAULT_MODEL;
      delete process.env.OPENAI_TIMEOUT;
      delete process.env.OPENAI_MAX_RETRIES;
      delete process.env.OPENAI_RETRY_DELAY;
      delete process.env.LOG_LEVEL;
      delete process.env.LOG_DIR;

      const config = configuration();

      expect(config).toEqual({
        port: 3000,
        nodeEnv: 'development',
        openai: {
          apiKey: undefined,
          baseUrl: 'https://api.openai.com/v1',
          defaultModel: 'gpt-5',
          timeout: 60000,
          maxRetries: 3,
          retryDelay: 1000,
        },
        logging: {
          level: 'debug',
          dir: './logs',
        },
      });
    });

    it('should use default port when PORT is not set', () => {
      delete process.env.PORT;

      const config = configuration();

      expect(config.port).toBe(3000);
    });

    it('should use default NODE_ENV when not set', () => {
      delete process.env.NODE_ENV;

      const config = configuration();

      expect(config.nodeEnv).toBe('development');
    });

    it('should use default OpenAI base URL when not set', () => {
      delete process.env.OPENAI_API_BASE_URL;

      const config = configuration();

      expect(config.openai.baseUrl).toBe('https://api.openai.com/v1');
    });

    it('should use default model when not set', () => {
      delete process.env.OPENAI_DEFAULT_MODEL;

      const config = configuration();

      expect(config.openai.defaultModel).toBe('gpt-5');
    });

    it('should use default timeout when not set', () => {
      delete process.env.OPENAI_TIMEOUT;

      const config = configuration();

      expect(config.openai.timeout).toBe(60000);
    });

    it('should use default max retries when not set', () => {
      delete process.env.OPENAI_MAX_RETRIES;

      const config = configuration();

      expect(config.openai.maxRetries).toBe(3);
    });

    it('should use default retry delay when not set', () => {
      delete process.env.OPENAI_RETRY_DELAY;

      const config = configuration();

      expect(config.openai.retryDelay).toBe(1000);
    });

    it('should use default log level when not set', () => {
      delete process.env.LOG_LEVEL;

      const config = configuration();

      expect(config.logging.level).toBe('debug');
    });

    it('should use default log directory when not set', () => {
      delete process.env.LOG_DIR;

      const config = configuration();

      expect(config.logging.dir).toBe('./logs');
    });
  });

  describe('Environment variable overrides', () => {
    it('should use environment PORT when set', () => {
      process.env.PORT = '8080';

      const config = configuration();

      expect(config.port).toBe(8080);
    });

    it('should use environment NODE_ENV when set', () => {
      process.env.NODE_ENV = 'production';

      const config = configuration();

      expect(config.nodeEnv).toBe('production');
    });

    it('should use environment OPENAI_API_KEY when set', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key-123';

      const config = configuration();

      expect(config.openai.apiKey).toBe('sk-test-key-123');
    });

    it('should use environment OPENAI_API_BASE_URL when set', () => {
      process.env.OPENAI_API_BASE_URL = 'https://custom.openai.com/v1';

      const config = configuration();

      expect(config.openai.baseUrl).toBe('https://custom.openai.com/v1');
    });

    it('should use environment OPENAI_DEFAULT_MODEL when set', () => {
      process.env.OPENAI_DEFAULT_MODEL = 'gpt-4o';

      const config = configuration();

      expect(config.openai.defaultModel).toBe('gpt-4o');
    });

    it('should use environment OPENAI_TIMEOUT when set', () => {
      process.env.OPENAI_TIMEOUT = '30000';

      const config = configuration();

      expect(config.openai.timeout).toBe(30000);
    });

    it('should use environment OPENAI_MAX_RETRIES when set', () => {
      process.env.OPENAI_MAX_RETRIES = '5';

      const config = configuration();

      expect(config.openai.maxRetries).toBe(5);
    });

    it('should use environment OPENAI_RETRY_DELAY when set', () => {
      process.env.OPENAI_RETRY_DELAY = '2000';

      const config = configuration();

      expect(config.openai.retryDelay).toBe(2000);
    });

    it('should use environment LOG_LEVEL when set', () => {
      process.env.LOG_LEVEL = 'info';

      const config = configuration();

      expect(config.logging.level).toBe('info');
    });

    it('should use environment LOG_DIR when set', () => {
      process.env.LOG_DIR = '/var/logs/app';

      const config = configuration();

      expect(config.logging.dir).toBe('/var/logs/app');
    });
  });

  describe('Complete configuration', () => {
    it('should return complete configuration with all environment variables set', () => {
      process.env.PORT = '4000';
      process.env.NODE_ENV = 'production';
      process.env.OPENAI_API_KEY = 'sk-prod-key';
      process.env.OPENAI_API_BASE_URL = 'https://api.openai.com/v2';
      process.env.OPENAI_DEFAULT_MODEL = 'gpt-4-turbo';
      process.env.OPENAI_TIMEOUT = '120000';
      process.env.OPENAI_MAX_RETRIES = '10';
      process.env.OPENAI_RETRY_DELAY = '3000';
      process.env.LOG_LEVEL = 'error';
      process.env.LOG_DIR = '/custom/logs';

      const config = configuration();

      expect(config).toEqual({
        port: 4000,
        nodeEnv: 'production',
        openai: {
          apiKey: 'sk-prod-key',
          baseUrl: 'https://api.openai.com/v2',
          defaultModel: 'gpt-4-turbo',
          timeout: 120000,
          maxRetries: 10,
          retryDelay: 3000,
        },
        logging: {
          level: 'error',
          dir: '/custom/logs',
        },
      });
    });
  });

  describe('Type coercion', () => {
    it('should parse PORT as integer', () => {
      process.env.PORT = '3500';

      const config = configuration();

      expect(typeof config.port).toBe('number');
      expect(config.port).toBe(3500);
    });

    it('should parse OPENAI_TIMEOUT as integer', () => {
      process.env.OPENAI_TIMEOUT = '45000';

      const config = configuration();

      expect(typeof config.openai.timeout).toBe('number');
      expect(config.openai.timeout).toBe(45000);
    });

    it('should parse OPENAI_MAX_RETRIES as integer', () => {
      process.env.OPENAI_MAX_RETRIES = '7';

      const config = configuration();

      expect(typeof config.openai.maxRetries).toBe('number');
      expect(config.openai.maxRetries).toBe(7);
    });

    it('should parse OPENAI_RETRY_DELAY as integer', () => {
      process.env.OPENAI_RETRY_DELAY = '1500';

      const config = configuration();

      expect(typeof config.openai.retryDelay).toBe('number');
      expect(config.openai.retryDelay).toBe(1500);
    });

    it('should handle invalid PORT gracefully with NaN', () => {
      process.env.PORT = 'invalid';

      const config = configuration();

      expect(config.port).toBeNaN();
    });

    it('should handle empty PORT string', () => {
      process.env.PORT = '';

      const config = configuration();

      expect(config.port).toBe(3000);
    });
  });

  describe('Configuration structure', () => {
    it('should have correct top-level keys', () => {
      const config = configuration();

      expect(Object.keys(config)).toEqual([
        'port',
        'nodeEnv',
        'openai',
        'logging',
      ]);
    });

    it('should have correct openai configuration keys', () => {
      const config = configuration();

      expect(Object.keys(config.openai)).toEqual([
        'apiKey',
        'baseUrl',
        'defaultModel',
        'timeout',
        'maxRetries',
        'retryDelay',
      ]);
    });

    it('should have correct logging configuration keys', () => {
      const config = configuration();

      expect(Object.keys(config.logging)).toEqual(['level', 'dir']);
    });

    it('should be callable multiple times with consistent results', () => {
      process.env.PORT = '5000';
      process.env.NODE_ENV = 'test';

      const config1 = configuration();
      const config2 = configuration();

      expect(config1).toEqual(config2);
    });
  });
});
