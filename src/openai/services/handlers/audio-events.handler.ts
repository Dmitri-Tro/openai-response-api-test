import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../../common/services/logger.service';
import {
  StreamState,
  SSEEvent,
} from '../../interfaces/streaming-events.interface';

/**
 * Handler service for audio streaming events (TTS/Voice output)
 *
 * Processes 4 events related to audio generation and transcription in the Responses API.
 * Handles text-to-speech (TTS) output with voice models and provides synchronized
 * transcripts for accessibility and subtitle generation.
 *
 * **Events Handled:**
 * - `response.output_audio.delta` - Incremental audio chunks (base64-encoded)
 * - `response.output_audio.done` - Complete audio output
 * - `response.output_audio.transcript.delta` - Incremental transcript text
 * - `response.output_audio.transcript.done` - Complete transcript
 *
 * Audio data is accumulated in state.audio as base64-encoded chunks, while
 * transcript text is accumulated in state.audioTranscript. Supports various
 * audio formats (pcm16, mp3, opus) and voice options (alloy, echo, fable, etc.).
 *
 * @see {@link https://platform.openai.com/docs/guides/text-to-speech}
 */
@Injectable()
export class AudioEventsHandler {
  constructor(private readonly loggerService: LoggerService) {}

  /**
   * Handle audio delta - Audio chunk streaming
   *
   * Emitted during audio generation, delivering incremental base64-encoded audio chunks.
   * Audio chunks can be decoded and played back progressively for real-time audio output.
   * Accumulates in state.audio for complete audio reconstruction.
   *
   * @param event - Raw event data with delta (base64 audio chunk)
   * @param state - Shared streaming state for accumulating audio data
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with audio chunk
   * @yields SSEEvent with event='audio_delta' and base64-encoded audio delta
   */
  *handleAudioDelta(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData = (event as { delta?: string }) || {};
    const delta = eventData.delta || '';
    state.audio += delta;

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'audio_delta',
      sequence,
      delta,
    });

    yield {
      event: 'audio_delta',
      data: JSON.stringify({ delta, sequence }),
      sequence,
    };
  }

  /**
   * Handle audio done - Audio complete
   *
   * Emitted when audio generation finishes. Contains the complete base64-encoded
   * audio accumulated from all deltas. Audio is ready for playback or storage.
   * Can be decoded and saved as audio file in specified format.
   *
   * @param event - Raw event data (audio available in state)
   * @param state - Shared streaming state with complete audio data
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with complete audio
   * @yields SSEEvent with event='audio_done' and full base64-encoded audio
   */
  *handleAudioDone(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'audio_done',
      sequence,
      response: { audio: state.audio },
    });

    yield {
      event: 'audio_done',
      data: JSON.stringify({ audio: state.audio, sequence }),
      sequence,
    };
  }

  /**
   * Handle audio transcript delta
   *
   * Emitted during transcript generation, delivering incremental text chunks
   * representing what the audio is saying. Synchronized with audio output for
   * real-time subtitles or closed captions. Useful for accessibility.
   *
   * @param event - Raw event data with delta (transcript text chunk)
   * @param state - Shared streaming state for accumulating transcript
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with transcript chunk
   * @yields SSEEvent with event='audio_transcript_delta' and text delta
   */
  *handleAudioTranscriptDelta(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    const eventData = (event as { delta?: string }) || {};
    const delta = eventData.delta || '';
    state.audioTranscript += delta;

    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'audio_transcript_delta',
      sequence,
      delta,
    });

    yield {
      event: 'audio_transcript_delta',
      data: JSON.stringify({ delta, sequence }),
      sequence,
    };
  }

  /**
   * Handle audio transcript done
   *
   * Emitted when transcript generation finishes. Contains the complete transcript
   * text accumulated from all deltas. Provides full textual representation of
   * audio content for subtitles, captions, or text search.
   *
   * @param event - Raw event data (transcript available in state)
   * @param state - Shared streaming state with complete transcript
   * @param sequence - Event sequence number for ordering
   * @returns Generator yielding SSE event with complete transcript
   * @yields SSEEvent with event='audio_transcript_done' and full transcript text
   */
  *handleAudioTranscriptDone(
    event: unknown,
    state: StreamState,
    sequence: number,
  ): Iterable<SSEEvent> {
    this.loggerService.logStreamingEvent({
      timestamp: new Date().toISOString(),
      api: 'responses',
      endpoint: '/v1/responses (stream)',
      event_type: 'audio_transcript_done',
      sequence,
      response: { transcript: state.audioTranscript },
    });

    yield {
      event: 'audio_transcript_done',
      data: JSON.stringify({ transcript: state.audioTranscript, sequence }),
      sequence,
    };
  }
}
