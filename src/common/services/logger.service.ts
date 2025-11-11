import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export interface OpenAIError {
  message: string;
  type?: string;
  code?: string;
  status?: number;
  response?: unknown;
  stack?: string;
  original_error?: unknown;
}

export interface OpenAILogEntry {
  timestamp: string;
  api: 'responses' | 'images' | 'videos';
  endpoint: string;
  request: Record<string, unknown>;
  response?: unknown;
  error?: OpenAIError;
  metadata: {
    latency_ms?: number;
    tokens_used?: number;
    cost_estimate?: number;
    rate_limit_headers?: Record<string, string>;
  };
  streaming?: boolean;
  stream_events?: unknown[];
}

@Injectable()
export class LoggerService {
  private logDir: string;

  constructor(private configService: ConfigService) {
    this.logDir = this.configService.get<string>('logging.dir') || './logs';
    this.ensureLogDirectory();
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getLogFilePath(api: string): string {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const dateDir = path.join(this.logDir, date);

    if (!fs.existsSync(dateDir)) {
      fs.mkdirSync(dateDir, { recursive: true });
    }

    return path.join(dateDir, `${api}.log`);
  }

  logOpenAIInteraction(entry: OpenAILogEntry): void {
    try {
      const logFilePath = this.getLogFilePath(entry.api);
      const logLine =
        JSON.stringify(entry, null, 2) + '\n' + '-'.repeat(80) + '\n';

      fs.appendFileSync(logFilePath, logLine, 'utf8');

      // Also log to console in development
      if (this.configService.get('nodeEnv') === 'development') {
        console.log('\n=== OpenAI API Call ===');
        console.log(`API: ${entry.api}`);
        console.log(`Endpoint: ${entry.endpoint}`);
        console.log(`Timestamp: ${entry.timestamp}`);

        if (entry.error) {
          console.error('Error:', JSON.stringify(entry.error, null, 2));
        } else {
          console.log('Status: Success');
          if (entry.metadata.latency_ms) {
            console.log(`Latency: ${entry.metadata.latency_ms}ms`);
          }
          if (entry.metadata.tokens_used) {
            console.log(`Tokens: ${entry.metadata.tokens_used}`);
          }
        }
        console.log('=======================\n');
      }
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  logStreamingEvent(
    api: 'responses' | 'images' | 'videos',
    endpoint: string,
    event: unknown,
    request: Record<string, unknown>,
  ): void {
    const entry: OpenAILogEntry = {
      timestamp: new Date().toISOString(),
      api,
      endpoint,
      request,
      streaming: true,
      stream_events: [event],
      metadata: {},
    };

    this.logOpenAIInteraction(entry);
  }
}
