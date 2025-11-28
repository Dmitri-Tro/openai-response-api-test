import { validate, ValidationArguments } from 'class-validator';
import {
  IsAudioFormatValidConstraint,
  validateAudioFormat,
  getAudioFormatErrorMessage,
  SUPPORTED_AUDIO_FORMATS,
  IsAudioFormatValid,
} from './audio-format.validator';

// Test DTO for integration tests
class AudioUploadDto {
  @IsAudioFormatValid()
  file!: { originalname: string };
}

describe('IsAudioFormatValidConstraint', () => {
  let validator: IsAudioFormatValidConstraint;

  beforeEach(() => {
    validator = new IsAudioFormatValidConstraint();
  });

  describe('Valid audio formats', () => {
    it('should accept flac format', () => {
      const result = validator.validate({ originalname: 'audio.flac' });
      expect(result).toBe(true);
    });

    it('should accept mp3 format', () => {
      const result = validator.validate({ originalname: 'audio.mp3' });
      expect(result).toBe(true);
    });

    it('should accept mp4 format', () => {
      const result = validator.validate({ originalname: 'audio.mp4' });
      expect(result).toBe(true);
    });

    it('should accept mpeg format', () => {
      const result = validator.validate({ originalname: 'audio.mpeg' });
      expect(result).toBe(true);
    });

    it('should accept mpga format', () => {
      const result = validator.validate({ originalname: 'audio.mpga' });
      expect(result).toBe(true);
    });

    it('should accept m4a format', () => {
      const result = validator.validate({ originalname: 'audio.m4a' });
      expect(result).toBe(true);
    });

    it('should accept ogg format', () => {
      const result = validator.validate({ originalname: 'audio.ogg' });
      expect(result).toBe(true);
    });

    it('should accept wav format', () => {
      const result = validator.validate({ originalname: 'audio.wav' });
      expect(result).toBe(true);
    });

    it('should accept webm format', () => {
      const result = validator.validate({ originalname: 'audio.webm' });
      expect(result).toBe(true);
    });
  });

  describe('Case sensitivity', () => {
    it('should accept MP3 (uppercase)', () => {
      const result = validator.validate({ originalname: 'audio.MP3' });
      expect(result).toBe(true);
    });

    it('should accept WAV (uppercase)', () => {
      const result = validator.validate({ originalname: 'audio.WAV' });
      expect(result).toBe(true);
    });

    it('should accept FlAc (mixed case)', () => {
      const result = validator.validate({ originalname: 'audio.FlAc' });
      expect(result).toBe(true);
    });

    it('should accept M4A (uppercase)', () => {
      const result = validator.validate({ originalname: 'recording.M4A' });
      expect(result).toBe(true);
    });

    it('should accept WeBm (mixed case)', () => {
      const result = validator.validate({ originalname: 'video.WeBm' });
      expect(result).toBe(true);
    });
  });

  describe('Valid filenames with complex names', () => {
    it('should accept filename with spaces', () => {
      const result = validator.validate({
        originalname: 'interview recording.mp3',
      });
      expect(result).toBe(true);
    });

    it('should accept filename with multiple dots', () => {
      const result = validator.validate({
        originalname: 'audio.backup.final.wav',
      });
      expect(result).toBe(true);
    });

    it('should accept filename with numbers', () => {
      const result = validator.validate({
        originalname: 'recording_2024_01_15.m4a',
      });
      expect(result).toBe(true);
    });

    it('should accept filename with hyphens and underscores', () => {
      const result = validator.validate({
        originalname: 'podcast-episode_001.mp3',
      });
      expect(result).toBe(true);
    });

    it('should accept long filename', () => {
      const result = validator.validate({
        originalname:
          'very_long_filename_with_many_words_and_underscores_2024.flac',
      });
      expect(result).toBe(true);
    });
  });

  describe('Invalid audio formats', () => {
    it('should reject opus format (not supported via API)', () => {
      const result = validator.validate({ originalname: 'audio.opus' });
      expect(result).toBe(false);
    });

    it('should reject aac format (use m4a instead)', () => {
      const result = validator.validate({ originalname: 'audio.aac' });
      expect(result).toBe(false);
    });

    it('should reject wma format', () => {
      const result = validator.validate({ originalname: 'audio.wma' });
      expect(result).toBe(false);
    });

    it('should reject aiff format', () => {
      const result = validator.validate({ originalname: 'audio.aiff' });
      expect(result).toBe(false);
    });

    it('should reject txt format', () => {
      const result = validator.validate({ originalname: 'document.txt' });
      expect(result).toBe(false);
    });

    it('should reject pdf format', () => {
      const result = validator.validate({ originalname: 'document.pdf' });
      expect(result).toBe(false);
    });

    it('should reject json format', () => {
      const result = validator.validate({ originalname: 'data.json' });
      expect(result).toBe(false);
    });

    it('should reject mp4v format', () => {
      const result = validator.validate({ originalname: 'video.mp4v' });
      expect(result).toBe(false);
    });

    it('should reject avi format', () => {
      const result = validator.validate({ originalname: 'video.avi' });
      expect(result).toBe(false);
    });

    it('should reject mkv format', () => {
      const result = validator.validate({ originalname: 'video.mkv' });
      expect(result).toBe(false);
    });

    it('should reject mov format', () => {
      const result = validator.validate({ originalname: 'video.mov' });
      expect(result).toBe(false);
    });
  });

  describe('Invalid file objects', () => {
    it('should reject null file', () => {
      const result = validator.validate(null);
      expect(result).toBe(false);
    });

    it('should reject undefined file', () => {
      const result = validator.validate(undefined);
      expect(result).toBe(false);
    });

    it('should reject string file', () => {
      const result = validator.validate('audio.mp3');
      expect(result).toBe(false);
    });

    it('should reject number file', () => {
      const result = validator.validate(123);
      expect(result).toBe(false);
    });

    it('should reject array file', () => {
      const result = validator.validate(['audio.mp3']);
      expect(result).toBe(false);
    });

    it('should reject file object without originalname', () => {
      const result = validator.validate({ name: 'audio.mp3' });
      expect(result).toBe(false);
    });

    it('should reject file with empty originalname', () => {
      const result = validator.validate({ originalname: '' });
      expect(result).toBe(false);
    });

    it('should reject file with number originalname', () => {
      const result = validator.validate({ originalname: 123 });
      expect(result).toBe(false);
    });

    it('should reject file with null originalname', () => {
      const result = validator.validate({ originalname: null });
      expect(result).toBe(false);
    });

    it('should reject file with undefined originalname', () => {
      const result = validator.validate({ originalname: undefined });
      expect(result).toBe(false);
    });
  });

  describe('Invalid filename patterns', () => {
    it('should reject filename without extension', () => {
      const result = validator.validate({ originalname: 'audiofile' });
      expect(result).toBe(false);
    });

    it('should reject filename with only dot', () => {
      const result = validator.validate({ originalname: 'audio.' });
      expect(result).toBe(false);
    });

    it('should accept hidden file with valid extension (.mp3)', () => {
      // Hidden files (starting with dot) are valid if they have a supported extension
      const result = validator.validate({ originalname: '.mp3' });
      expect(result).toBe(true);
    });

    it('should reject empty filename', () => {
      const result = validator.validate({ originalname: '' });
      expect(result).toBe(false);
    });
  });

  describe('Default error messages', () => {
    it('should return error message for opus format', () => {
      const message = validator.defaultMessage({
        value: { originalname: 'audio.opus' },
      } as ValidationArguments);
      expect(message).toContain('opus');
      expect(message).toContain('not supported');
      expect(message).toContain('Supported formats');
    });

    it('should return error message for aac format', () => {
      const message = validator.defaultMessage({
        value: { originalname: 'audio.aac' },
      } as ValidationArguments);
      expect(message).toContain('aac');
      expect(message).toContain('not supported');
    });

    it('should list all supported formats', () => {
      const message = validator.defaultMessage({
        value: { originalname: 'audio.unknown' },
      } as ValidationArguments);
      expect(message).toContain('flac');
      expect(message).toContain('mp3');
      expect(message).toContain('wav');
      expect(message).toContain('webm');
    });

    it('should include filename in error message', () => {
      const message = validator.defaultMessage({
        value: { originalname: 'myaudio.opus' },
      } as ValidationArguments);
      expect(message).toContain('myaudio.opus');
    });

    it('should return error message for invalid file object', () => {
      const message = validator.defaultMessage({
        value: null,
      } as ValidationArguments);
      expect(message).toContain('Invalid file object');
    });

    it('should mention opus is not supported via API', () => {
      const message = validator.defaultMessage({
        value: { originalname: 'audio.opus' },
      } as ValidationArguments);
      expect(message).toContain('opus format is NOT supported via OpenAI API');
    });
  });
});

describe('validateAudioFormat helper', () => {
  describe('Valid formats', () => {
    it('should accept audio.flac', () => {
      expect(validateAudioFormat('audio.flac')).toBe(true);
    });

    it('should accept recording.mp3', () => {
      expect(validateAudioFormat('recording.mp3')).toBe(true);
    });

    it('should accept podcast.wav', () => {
      expect(validateAudioFormat('podcast.wav')).toBe(true);
    });

    it('should accept interview.m4a', () => {
      expect(validateAudioFormat('interview.m4a')).toBe(true);
    });

    it('should accept video.webm', () => {
      expect(validateAudioFormat('video.webm')).toBe(true);
    });

    it('should accept file.mp4', () => {
      expect(validateAudioFormat('file.mp4')).toBe(true);
    });

    it('should accept audio.mpeg', () => {
      expect(validateAudioFormat('audio.mpeg')).toBe(true);
    });

    it('should accept file.mpga', () => {
      expect(validateAudioFormat('file.mpga')).toBe(true);
    });

    it('should accept audio.ogg', () => {
      expect(validateAudioFormat('audio.ogg')).toBe(true);
    });
  });

  describe('Case insensitivity', () => {
    it('should accept MP3 (uppercase)', () => {
      expect(validateAudioFormat('audio.MP3')).toBe(true);
    });

    it('should accept WAV (uppercase)', () => {
      expect(validateAudioFormat('audio.WAV')).toBe(true);
    });

    it('should accept FlAc (mixed case)', () => {
      expect(validateAudioFormat('audio.FlAc')).toBe(true);
    });
  });

  describe('Invalid formats', () => {
    it('should reject opus format', () => {
      expect(validateAudioFormat('audio.opus')).toBe(false);
    });

    it('should reject aac format', () => {
      expect(validateAudioFormat('audio.aac')).toBe(false);
    });

    it('should reject txt format', () => {
      expect(validateAudioFormat('document.txt')).toBe(false);
    });

    it('should reject pdf format', () => {
      expect(validateAudioFormat('document.pdf')).toBe(false);
    });

    it('should reject wma format', () => {
      expect(validateAudioFormat('audio.wma')).toBe(false);
    });
  });

  describe('Invalid inputs', () => {
    it('should reject empty string', () => {
      expect(validateAudioFormat('')).toBe(false);
    });

    it('should reject null', () => {
      expect(validateAudioFormat(null as unknown as string)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(validateAudioFormat(undefined as unknown as string)).toBe(false);
    });

    it('should reject number', () => {
      expect(validateAudioFormat(123 as unknown as string)).toBe(false);
    });

    it('should reject filename without extension', () => {
      expect(validateAudioFormat('audiofile')).toBe(false);
    });

    it('should reject filename with only dot', () => {
      expect(validateAudioFormat('audio.')).toBe(false);
    });
  });
});

describe('getAudioFormatErrorMessage helper', () => {
  describe('Error messages for invalid formats', () => {
    it('should return error message for opus format', () => {
      const message = getAudioFormatErrorMessage('audio.opus');
      expect(message).toContain('opus');
      expect(message).toContain('not supported');
      expect(message).toContain('Supported formats');
    });

    it('should return error message for aac format', () => {
      const message = getAudioFormatErrorMessage('audio.aac');
      expect(message).toContain('aac');
      expect(message).toContain('not supported');
    });

    it('should return error message for txt format', () => {
      const message = getAudioFormatErrorMessage('document.txt');
      expect(message).toContain('txt');
      expect(message).toContain('not supported');
    });

    it('should list all supported formats', () => {
      const message = getAudioFormatErrorMessage('audio.unknown');
      expect(message).toContain('flac');
      expect(message).toContain('mp3');
      expect(message).toContain('wav');
      expect(message).toContain('m4a');
      expect(message).toContain('webm');
    });

    it('should include filename in error message', () => {
      const message = getAudioFormatErrorMessage('myrecording.opus');
      expect(message).toContain('myrecording.opus');
    });

    it('should mention opus is not supported via API', () => {
      const message = getAudioFormatErrorMessage('audio.opus');
      expect(message).toContain('opus format is NOT supported via OpenAI API');
      expect(message).toContain('open-source Whisper');
    });
  });

  describe('Error messages for invalid inputs', () => {
    it('should return error message for empty string', () => {
      const message = getAudioFormatErrorMessage('');
      expect(message).toContain('Invalid filename');
    });

    it('should return error message for null', () => {
      const message = getAudioFormatErrorMessage(null as unknown as string);
      expect(message).toContain('Invalid filename');
    });

    it('should return error message for undefined', () => {
      const message = getAudioFormatErrorMessage(
        undefined as unknown as string,
      );
      expect(message).toContain('Invalid filename');
    });

    it('should handle filename without extension', () => {
      const message = getAudioFormatErrorMessage('audiofile');
      expect(message).toContain('not supported');
    });
  });
});

describe('DTO Integration Tests', () => {
  describe('Valid DTOs', () => {
    it('should pass validation for mp3 file', async () => {
      const dto = new AudioUploadDto();
      dto.file = { originalname: 'audio.mp3' };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass validation for wav file', async () => {
      const dto = new AudioUploadDto();
      dto.file = { originalname: 'recording.wav' };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass validation for flac file', async () => {
      const dto = new AudioUploadDto();
      dto.file = { originalname: 'audio.flac' };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass validation for m4a file', async () => {
      const dto = new AudioUploadDto();
      dto.file = { originalname: 'podcast.m4a' };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass validation for uppercase extension', async () => {
      const dto = new AudioUploadDto();
      dto.file = { originalname: 'audio.MP3' };

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Invalid DTOs', () => {
    it('should fail validation for opus file', async () => {
      const dto = new AudioUploadDto();
      dto.file = { originalname: 'audio.opus' };

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(JSON.stringify(errors)).toContain('not supported');
    });

    it('should fail validation for aac file', async () => {
      const dto = new AudioUploadDto();
      dto.file = { originalname: 'audio.aac' };

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation for txt file', async () => {
      const dto = new AudioUploadDto();
      dto.file = { originalname: 'document.txt' };

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation for pdf file', async () => {
      const dto = new AudioUploadDto();
      dto.file = { originalname: 'document.pdf' };

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation for file without extension', async () => {
      const dto = new AudioUploadDto();
      dto.file = { originalname: 'audiofile' };

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});

describe('Constants', () => {
  it('should have correct number of supported formats', () => {
    expect(SUPPORTED_AUDIO_FORMATS).toHaveLength(9);
  });

  it('should include all expected formats', () => {
    expect(SUPPORTED_AUDIO_FORMATS).toContain('flac');
    expect(SUPPORTED_AUDIO_FORMATS).toContain('mp3');
    expect(SUPPORTED_AUDIO_FORMATS).toContain('mp4');
    expect(SUPPORTED_AUDIO_FORMATS).toContain('mpeg');
    expect(SUPPORTED_AUDIO_FORMATS).toContain('mpga');
    expect(SUPPORTED_AUDIO_FORMATS).toContain('m4a');
    expect(SUPPORTED_AUDIO_FORMATS).toContain('ogg');
    expect(SUPPORTED_AUDIO_FORMATS).toContain('wav');
    expect(SUPPORTED_AUDIO_FORMATS).toContain('webm');
  });

  it('should NOT include opus format', () => {
    expect(SUPPORTED_AUDIO_FORMATS).not.toContain('opus');
  });

  it('should NOT include aac format', () => {
    expect(SUPPORTED_AUDIO_FORMATS).not.toContain('aac');
  });
});
