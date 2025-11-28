import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Error structure for OpenAI API interactions
 *
 * Represents error information captured from OpenAI API failures, including
 * detailed context for debugging and monitoring. Used by LoggerService to
 * record comprehensive error information in log files.
 *
 * **Fields:**
 * - `message` - Human-readable error description
 * - `type` - OpenAI error type (e.g., "rate_limit_error", "invalid_request_error")
 * - `code` - Specific error code (e.g., "invalid_image_size", "content_policy_violation")
 * - `status` - HTTP status code (400, 401, 429, 500, etc.)
 * - `response` - Raw response data from OpenAI
 * - `stack` - Stack trace for debugging
 * - `original_error` - Complete original exception object
 *
 * @see {@link OpenAILogEntry}
 */
export interface OpenAIError {
  message: string;
  type?: string;
  code?: string;
  status?: number;
  response?: unknown;
  stack?: string;
  original_error?: unknown;
}

/**
 * Type helper for SDK request parameters
 *
 * Allows SDK-typed parameter objects to be passed to the logger
 * without requiring type assertions. Accepts both indexed and non-indexed
 * object types.
 *
 * The union with `Record<string, any>` is necessary because OpenAI SDK types
 * don't have index signatures. Using `any` here is safe because the logger
 * serializes all values to JSON anyway, and we're not performing any operations
 * on the values.
 *
 * @example
 * ```typescript
 * // Before (with type assertion):
 * const params: VectorStores.VectorStoreCreateParams = { name: 'test' };
 * request: params as unknown as Record<string, unknown>
 *
 * // After (direct assignment):
 * request: params
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LoggableRequest = Record<string, unknown> | Record<string, any>;

/**
 * File counts metadata for vector stores
 *
 * Represents the status counts of files in a vector store.
 * Compatible with OpenAI SDK's VectorStore.FileCounts type
 * without requiring type assertions.
 *
 * **Fields:**
 * - `cancelled` - Number of cancelled files
 * - `completed` - Number of successfully processed files
 * - `failed` - Number of failed files
 * - `in_progress` - Number of files currently being processed
 * - `total` - Total number of files
 *
 * @example
 * ```typescript
 * // Before (with type assertion):
 * const vectorStore: VectorStores.VectorStore = await client.vectorStores.create(params);
 * file_counts: vectorStore.file_counts as unknown as Record<string, unknown>
 *
 * // After (direct assignment):
 * file_counts: vectorStore.file_counts
 * ```
 */
export interface FileCountsMetadata {
  cancelled?: number;
  completed?: number;
  failed?: number;
  in_progress?: number;
  total?: number;
}

/**
 * Structured log entry for OpenAI API interactions
 *
 * Comprehensive data structure capturing all relevant information about OpenAI API
 * requests and responses. Used by LoggerService to create detailed audit trails
 * of API interactions for debugging, monitoring, and cost analysis.
 *
 * **Core Fields:**
 * - `timestamp` - ISO 8601 timestamp (e.g., "2025-01-12T10:30:00.000Z")
 * - `api` - API type ("responses", "images", "videos")
 * - `endpoint` - Request URL path
 * - `request` - Complete request body (model, input, parameters, etc.)
 * - `response` - Complete response object (output_text, usage, etc.)
 * - `error` - Error information if request failed
 *
 * **Metadata Fields:**
 * Detailed performance, cost, and configuration metrics:
 * - `latency_ms` - Request duration in milliseconds
 * - `tokens_used` - Total tokens consumed (input + output)
 * - `cached_tokens` - Tokens served from cache (if prompt caching enabled)
 * - `reasoning_tokens` - Reasoning tokens used by o-series models
 * - `cost_estimate` - Estimated cost in USD based on token usage
 * - `rate_limit_headers` - Rate limit information from response headers
 * - `response_status` - Response status (completed, incomplete, failed)
 * - `response_error` - Error details from response object
 * - `incomplete_details` - Reason for incomplete responses
 * - `conversation` - Conversation ID for multi-turn interactions
 * - `background` - Whether request ran in background mode
 * - `max_output_tokens` - Token limit configured for response
 * - `previous_response_id` - Previous response ID for multi-turn
 *
 * **Optimization Parameters:**
 * Advanced performance and caching parameters:
 * - `prompt_cache_key` - Cache key for prompt caching optimization
 * - `service_tier` - Latency tier (auto/default/flex/scale/priority)
 * - `truncation` - Truncation strategy (auto/disabled)
 * - `safety_identifier` - User identifier for safety tracking
 * - `request_metadata` - Custom metadata key-value pairs
 * - `text_verbosity` - Text output verbosity level
 * - `stream_options_obfuscation` - Whether obfuscation is enabled for streaming
 *
 * **Streaming Fields:**
 * - `streaming` - Whether request used streaming mode
 * - `stream_events` - Array of streaming events for complete stream reconstruction
 *
 * **Log File Organization:**
 * Logs are written to: `logs/YYYY-MM-DD/{api}.log`
 * Format: JSON with pretty-printing (2-space indent) + separator line
 *
 * **Example Log Entry:**
 * ```json
 * {
 *   "timestamp": "2025-01-12T10:30:00.000Z",
 *   "api": "responses",
 *   "endpoint": "/api/responses",
 *   "request": {
 *     "model": "gpt-5",
 *     "input": "Explain quantum computing",
 *     "max_output_tokens": 1000
 *   },
 *   "response": {
 *     "id": "resp_abc123",
 *     "output_text": "Quantum computing uses...",
 *     "usage": {
 *       "input_tokens": 5,
 *       "output_tokens": 125,
 *       "total_tokens": 130
 *     }
 *   },
 *   "metadata": {
 *     "latency_ms": 1250,
 *     "tokens_used": 130,
 *     "cost_estimate": 0.0013125
 *   }
 * }
 * ```
 *
 * @see {@link LoggerService}
 * @see {@link OpenAIError}
 * @see {@link FileCountsMetadata}
 * @see {@link LoggableRequest}
 */
export interface OpenAILogEntry {
  timestamp: string;
  api: 'responses' | 'images' | 'videos' | 'files' | 'vector_stores' | 'audio';
  endpoint: string;
  request: LoggableRequest;
  response?: unknown;
  error?: OpenAIError;
  metadata: {
    latency_ms?: number;
    tokens_used?: number;
    cached_tokens?: number;
    reasoning_tokens?: number;
    cost_estimate?: number;
    rate_limit_headers?: Record<string, string>;
    response_status?: string;
    response_error?: unknown;
    incomplete_details?: unknown;
    conversation?: unknown;
    background?: boolean | null;
    max_output_tokens?: number | null;
    previous_response_id?: string | null;
    // Optimization parameters
    prompt_cache_key?: string;
    service_tier?: string | null;
    truncation?: string | null;
    safety_identifier?: string;
    request_metadata?: Record<string, string> | null;
    text_verbosity?: string | null;
    stream_options_obfuscation?: boolean;
    // Videos API specific
    video_id?: string;
    model?: string;
    status?: string;
    // Files API specific
    file_id?: string;
    filename?: string;
    bytes?: number;
    // Vector Stores API specific
    vector_store_id?: string;
    file_counts?: FileCountsMetadata;
    batch_id?: string;
    result_count?: number;
    query?: string;
    deleted?: boolean;
    purpose?: string;
    created_at?: number;
    // Images API specific
    images_generated?: number;
    has_revised_prompt?: boolean;
    image_size_bytes?: number;
    has_mask?: boolean;
    mask_size_bytes?: number;
    // Audio API specific
    voice?: string;
    character_count?: number;
    response_format?: string;
    speed?: number;
    file_size_mb?: string;
    text_length?: number;
    duration_seconds?: number;
    detected_language?: string;
    segment_count?: number;
    word_count?: number;
    average_confidence?: number;
  };
  streaming?: boolean;
  stream_events?: unknown[];
}

/**
 * Service for structured logging of OpenAI API interactions
 *
 * This NestJS service provides centralized logging for all OpenAI API requests,
 * responses, errors, and streaming events. Logs are written to date-organized
 * JSON files and optionally to console in development mode.
 *
 * **Architecture:**
 * - Singleton service injected via NestJS dependency injection
 * - Used by LoggingInterceptor, OpenAIExceptionFilter, and streaming handlers
 * - Creates daily log directories: `logs/YYYY-MM-DD/`
 * - Separate log files per API: `responses.log`, `images.log`, `videos.log`
 *
 * **Log File Structure:**
 * ```
 * logs/
 * ├── 2025-01-12/
 * │   ├── responses.log    (Text generation logs)
 * │   ├── images.log       (Image generation logs)
 * │   └── videos.log       (Video generation logs)
 * ├── 2025-01-13/
 * │   ├── responses.log
 * │   └── ...
 * ```
 *
 * **Log Entry Format:**
 * Each log entry is JSON-formatted with pretty-printing (2-space indent)
 * followed by a separator line (80 dashes) for readability:
 * ```json
 * {
 *   "timestamp": "2025-01-12T10:30:00.000Z",
 *   "api": "responses",
 *   "endpoint": "/api/responses",
 *   "request": {...},
 *   "response": {...},
 *   "metadata": {...}
 * }
 * --------------------------------------------------------------------------------
 * ```
 *
 * **Public Methods:**
 *
 * 1. **logOpenAIInteraction(entry: OpenAILogEntry): void**
 *    - Logs complete request/response/error for non-streaming requests
 *    - Captures latency, tokens, cost estimates, optimization parameters
 *    - Used by LoggingInterceptor and OpenAIExceptionFilter
 *
 * 2. **logStreamingEvent(entry: {...}): void**
 *    - Logs individual streaming events (text_delta, reasoning_delta, etc.)
 *    - Captures event type, sequence number, delta content
 *    - Used by streaming handler services for real-time event logging
 *
 * **Console Logging (Development Mode):**
 * When NODE_ENV=development, logs are also printed to console with:
 * - Formatted summary of API calls (API, endpoint, timestamp, status)
 * - Performance metrics (latency, tokens)
 * - Error details (for failed requests)
 * - Streaming event summaries (event type, sequence, delta preview)
 *
 * **Configuration:**
 * - `logging.dir` - Log directory path (default: ./logs)
 * - `nodeEnv` - Environment mode (development/production/test)
 * - Configured via ConfigService from environment variables
 *
 * **Error Handling:**
 * - Failed log writes are caught and logged to console.error
 * - Does not throw exceptions to avoid disrupting application flow
 * - Creates directories automatically if they don't exist
 *
 * **Use Cases:**
 * - **Debugging** - Trace full request/response flow for troubleshooting
 * - **Monitoring** - Track API usage patterns and performance metrics
 * - **Cost Analysis** - Calculate OpenAI API costs by aggregating token usage
 * - **Auditing** - Maintain compliance records of API interactions
 * - **Performance Tuning** - Identify slow requests and optimization opportunities
 *
 * **Integration:**
 * - LoggingInterceptor calls `logOpenAIInteraction()` for all non-streaming requests
 * - OpenAIExceptionFilter calls `logOpenAIInteraction()` with error field populated
 * - Streaming handlers call `logStreamingEvent()` for each SSE event
 * - OpenAIResponsesService calls `logOpenAIInteraction()` for complete streaming sessions
 *
 * **Performance Considerations:**
 * - Synchronous file writes (fs.appendFileSync) for reliability
 * - Log files can grow large - implement log rotation for production
 * - Consider buffering for high-throughput scenarios
 * - No sensitive data sanitization - ensure API keys are not logged
 *
 * @see {@link OpenAILogEntry}
 * @see {@link OpenAIError}
 * @see {@link LoggingInterceptor}
 */
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

  logStreamingEvent(entry: {
    timestamp: string;
    api: 'responses' | 'images' | 'videos';
    endpoint: string;
    event_type: string;
    sequence: number;
    request?: LoggableRequest;
    delta?: string;
    response?: unknown;
    error?: unknown;
    metadata?: {
      latency_ms?: number;
      tokens_used?: number;
      cost_estimate?: number;
    };
  }): void {
    try {
      const logFilePath = this.getLogFilePath(entry.api);
      const logLine =
        JSON.stringify(entry, null, 2) + '\n' + '-'.repeat(80) + '\n';

      fs.appendFileSync(logFilePath, logLine, 'utf8');

      // Also log to console in development
      if (this.configService.get('nodeEnv') === 'development') {
        console.log('\n=== Streaming Event ===');
        console.log(`Event Type: ${entry.event_type}`);
        console.log(`Sequence: ${entry.sequence}`);
        console.log(`API: ${entry.api}`);
        console.log(`Endpoint: ${entry.endpoint}`);

        if (entry.delta) {
          console.log(
            `Delta: ${entry.delta.substring(0, 100)}${entry.delta.length > 100 ? '...' : ''}`,
          );
        }

        if (entry.error) {
          console.error('Error:', entry.error);
        }

        if (entry.metadata?.latency_ms) {
          console.log(`Latency: ${entry.metadata.latency_ms}ms`);
        }

        console.log('=====================\n');
      }
    } catch (error) {
      console.error('Failed to write streaming log:', error);
    }
  }
}
