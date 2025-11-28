/**
 * Metadata extracted from transcription responses
 *
 * **Purpose**: Structured metadata for logging and analysis
 *
 * **Use Cases**:
 * - Logging transcription results
 * - Cost calculation
 * - Quality analysis
 *
 * @example
 * ```typescript
 * const metadata: TranscriptionMetadata = {
 *   duration_seconds: 125.5,
 *   detected_language: 'en',
 *   text_length: 543,
 *   segment_count: 12,
 *   word_count: 98,
 *   average_confidence: -0.15
 * };
 * ```
 */
export interface TranscriptionMetadata {
  /**
   * Audio duration in seconds (from verbose_json response)
   */
  duration_seconds?: number;

  /**
   * Detected language ISO-639-1 code (from verbose_json response)
   * @example 'en', 'es', 'fr'
   */
  detected_language?: string;

  /**
   * Length of transcribed text
   */
  text_length: number;

  /**
   * Number of segments (from verbose_json response)
   */
  segment_count?: number;

  /**
   * Number of words with timestamps (from verbose_json with word granularity)
   */
  word_count?: number;

  /**
   * Average log probability confidence score (from verbose_json response)
   * Range: typically -1.0 (low confidence) to 0.0 (high confidence)
   */
  average_confidence?: number;
}
