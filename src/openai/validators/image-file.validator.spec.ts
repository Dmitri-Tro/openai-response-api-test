import { Readable } from 'stream';
import {
  IsImageFileValidConstraint,
  isMulterFile,
} from './image-file.validator';

describe('IsImageFileValidConstraint', () => {
  let validator: IsImageFileValidConstraint;

  beforeEach(() => {
    validator = new IsImageFileValidConstraint();
  });

  const createMockFile = (
    mimetype: string,
    size: number,
  ): Express.Multer.File => ({
    fieldname: 'image',
    originalname: 'test-image.png',
    encoding: '7bit',
    mimetype,
    buffer: Buffer.alloc(size),
    size,
    stream: null as unknown as Readable,
    destination: '',
    filename: '',
    path: '',
  });

  describe('Mimetype validation', () => {
    it('should accept image/png', () => {
      const file = createMockFile('image/png', 1024);
      const result = validator.validate(file);
      expect(result).toBe(true);
    });

    it('should accept image/jpeg', () => {
      const file = createMockFile('image/jpeg', 1024);
      const result = validator.validate(file);
      expect(result).toBe(true);
    });

    it('should accept image/webp', () => {
      const file = createMockFile('image/webp', 1024);
      const result = validator.validate(file);
      expect(result).toBe(true);
    });

    it('should reject image/gif', () => {
      const file = createMockFile('image/gif', 1024);
      const result = validator.validate(file);
      expect(result).toBe(false);
    });

    it('should reject image/bmp', () => {
      const file = createMockFile('image/bmp', 1024);
      const result = validator.validate(file);
      expect(result).toBe(false);
    });

    it('should reject application/pdf', () => {
      const file = createMockFile('application/pdf', 1024);
      const result = validator.validate(file);
      expect(result).toBe(false);
    });

    it('should reject text/plain', () => {
      const file = createMockFile('text/plain', 1024);
      const result = validator.validate(file);
      expect(result).toBe(false);
    });
  });

  describe('File size validation', () => {
    it('should accept file under 4MB', () => {
      const file = createMockFile('image/png', 1024 * 1024); // 1MB
      const result = validator.validate(file);
      expect(result).toBe(true);
    });

    it('should accept file exactly at 4MB', () => {
      const file = createMockFile('image/png', 4 * 1024 * 1024); // 4MB
      const result = validator.validate(file);
      expect(result).toBe(true);
    });

    it('should reject file over 4MB', () => {
      const file = createMockFile('image/png', 4 * 1024 * 1024 + 1); // 4MB + 1 byte
      const result = validator.validate(file);
      expect(result).toBe(false);
    });

    it('should reject file at 5MB', () => {
      const file = createMockFile('image/png', 5 * 1024 * 1024);
      const result = validator.validate(file);
      expect(result).toBe(false);
    });

    it('should accept small file (1KB)', () => {
      const file = createMockFile('image/png', 1024);
      const result = validator.validate(file);
      expect(result).toBe(true);
    });

    it('should accept very small file (100 bytes)', () => {
      const file = createMockFile('image/png', 100);
      const result = validator.validate(file);
      expect(result).toBe(true);
    });
  });

  describe('Combined validation', () => {
    it('should accept valid PNG at 3MB', () => {
      const file = createMockFile('image/png', 3 * 1024 * 1024);
      const result = validator.validate(file);
      expect(result).toBe(true);
    });

    it('should reject invalid mimetype even if size is ok', () => {
      const file = createMockFile('image/gif', 1024);
      const result = validator.validate(file);
      expect(result).toBe(false);
    });

    it('should reject valid mimetype if size is too large', () => {
      const file = createMockFile('image/png', 5 * 1024 * 1024);
      const result = validator.validate(file);
      expect(result).toBe(false);
    });
  });

  describe('Invalid input types', () => {
    it('should reject non-Multer file object', () => {
      const result = validator.validate({ notAFile: true });
      expect(result).toBe(false);
    });

    it('should accept null (for optional mask parameter)', () => {
      const result = validator.validate(null);
      expect(result).toBe(true);
    });

    it('should accept undefined (for optional mask parameter)', () => {
      const result = validator.validate(undefined);
      expect(result).toBe(true);
    });

    it('should reject string', () => {
      const result = validator.validate('not-a-file');
      expect(result).toBe(false);
    });

    it('should reject number', () => {
      const result = validator.validate(12345);
      expect(result).toBe(false);
    });

    it('should reject array', () => {
      const result = validator.validate([]);
      expect(result).toBe(false);
    });
  });

  describe('File object edge cases', () => {
    it('should reject file object missing mimetype', () => {
      const file = createMockFile('image/png', 1024);
      delete (file as unknown as Record<string, unknown>).mimetype;
      const result = validator.validate(file);
      expect(result).toBe(false);
    });

    it('should reject file object missing size', () => {
      const file = createMockFile('image/png', 1024);
      delete (file as unknown as Record<string, unknown>).size;
      const result = validator.validate(file);
      expect(result).toBe(false);
    });

    it('should reject file object with empty mimetype', () => {
      const file = createMockFile('', 1024);
      const result = validator.validate(file);
      expect(result).toBe(false);
    });

    it('should reject file object with zero size', () => {
      const file = createMockFile('image/png', 0);
      const result = validator.validate(file);
      expect(result).toBe(false);
    });

    it('should reject file object with negative size', () => {
      const file = {
        fieldname: 'image',
        originalname: 'test-image.png',
        encoding: '7bit',
        mimetype: 'image/png',
        buffer: Buffer.alloc(0),
        size: -1024,
        stream: null as unknown as Readable,
        destination: '',
        filename: '',
        path: '',
      };
      const result = validator.validate(file);
      expect(result).toBe(false);
    });
  });

  describe('defaultMessage', () => {
    it('should return correct error message', () => {
      const message = validator.defaultMessage();
      expect(message).toContain('Image file must be');
      expect(message).toContain('PNG, JPEG, or WEBP');
      expect(message).toContain('less than 4MB');
    });
  });
});

describe('isMulterFile type guard', () => {
  const createMockFile = (
    mimetype: string,
    size: number,
  ): Express.Multer.File => ({
    fieldname: 'image',
    originalname: 'test-image.png',
    encoding: '7bit',
    mimetype,
    buffer: Buffer.alloc(size),
    size,
    stream: null as unknown as Readable,
    destination: '',
    filename: '',
    path: '',
  });

  it('should return true for valid Multer file', () => {
    const file = createMockFile('image/png', 1024);
    expect(isMulterFile(file)).toBe(true);
  });

  it('should return false for object missing mimetype', () => {
    const file = createMockFile('image/png', 1024);
    delete (file as unknown as Record<string, unknown>).mimetype;
    expect(isMulterFile(file)).toBe(false);
  });

  it('should return false for object missing size', () => {
    const file = createMockFile('image/png', 1024);
    delete (file as unknown as Record<string, unknown>).size;
    expect(isMulterFile(file)).toBe(false);
  });

  it('should return false for object missing buffer', () => {
    const file = createMockFile('image/png', 1024);
    delete (file as unknown as Record<string, unknown>).buffer;
    expect(isMulterFile(file)).toBe(false);
  });

  it('should return false for object missing originalname', () => {
    const file = createMockFile('image/png', 1024);
    delete (file as unknown as Record<string, unknown>).originalname;
    expect(isMulterFile(file)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isMulterFile(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isMulterFile(undefined)).toBe(false);
  });

  it('should return false for string', () => {
    expect(isMulterFile('not-a-file')).toBe(false);
  });

  it('should return false for number', () => {
    expect(isMulterFile(12345)).toBe(false);
  });

  it('should return false for array', () => {
    expect(isMulterFile([])).toBe(false);
  });

  it('should return false for empty object', () => {
    expect(isMulterFile({})).toBe(false);
  });

  it('should return false for partial object', () => {
    expect(isMulterFile({ mimetype: 'image/png' })).toBe(false);
  });
});
