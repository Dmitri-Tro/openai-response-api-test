import type { Responses } from 'openai/resources/responses';

/**
 * Extended Response Create Parameters (Non-Streaming)
 *
 * Extends the official OpenAI SDK types to include newer API features
 * that may not yet be present in the current SDK version (6.8.1).
 *
 * **Added Features:**
 * - `modalities`: Output modalities (text, audio) - newer API feature
 *
 * @see {@link https://platform.openai.com/docs/api-reference/responses/create}
 */
export interface ExtendedResponseCreateParamsNonStreaming
  extends Responses.ResponseCreateParamsNonStreaming {
  /**
   * Output modalities the model should generate
   *
   * Specify which types of content to generate:
   * - 'text': Text output (default)
   * - 'audio': Audio output (voice synthesis)
   *
   * @example ['text']
   * @example ['audio']
   * @example ['text', 'audio']
   */
  modalities?: Array<'text' | 'audio'>;
}

/**
 * Extended Response Create Parameters (Streaming)
 *
 * Extends the official OpenAI SDK types to include newer API features
 * that may not yet be present in the current SDK version (6.8.1).
 *
 * **Added Features:**
 * - `modalities`: Output modalities (text, audio) - newer API feature
 *
 * @see {@link https://platform.openai.com/docs/api-reference/responses/create}
 */
export interface ExtendedResponseCreateParamsStreaming
  extends Responses.ResponseCreateParamsStreaming {
  /**
   * Output modalities the model should generate
   *
   * Specify which types of content to generate:
   * - 'text': Text output (default)
   * - 'audio': Audio output (voice synthesis)
   *
   * @example ['text']
   * @example ['audio']
   * @example ['text', 'audio']
   */
  modalities?: Array<'text' | 'audio'>;

  /**
   * Options for streaming responses
   *
   * @example { include_obfuscation: true }
   */
  stream_options?: {
    include_obfuscation?: boolean;
  };
}
