export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
    defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o',
    timeout: parseInt(process.env.OPENAI_TIMEOUT || '60000', 10),
    maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3', 10),
    retryDelay: parseInt(process.env.OPENAI_RETRY_DELAY || '1000', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
    dir: process.env.LOG_DIR || './logs',
  },
});
