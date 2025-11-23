import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

/**
 * Validator constraint for video size validation
 *
 * **Supported Sizes:**
 * - '720x1280' - Portrait (9:16) for mobile/social media
 * - '1280x720' - Landscape (16:9) for desktop/YouTube
 * - '1024x1792' - Hi-res portrait (9:16) for premium content
 * - '1792x1024' - Hi-res landscape (16:9) for premium content
 *
 * **Validation Rules:**
 * - Must be string type
 * - Must match one of the 4 supported resolutions
 * - Format: WIDTHxHEIGHT (e.g., "720x1280")
 *
 * **Aspect Ratios:**
 * - 9:16 (portrait): 720x1280, 1024x1792
 * - 16:9 (landscape): 1280x720, 1792x1024
 *
 * @example
 * ```typescript
 * // Valid sizes
 * '720x1280'  // ✓ Portrait (mobile)
 * '1280x720'  // ✓ Landscape (desktop)
 * '1024x1792' // ✓ Hi-res portrait
 * '1792x1024' // ✓ Hi-res landscape
 *
 * // Invalid sizes
 * '1920x1080' // ✗ Not supported
 * '512x512'   // ✗ Square not supported
 * 1280        // ✗ Must be string
 * ```
 */
@ValidatorConstraint({ async: false })
export class IsVideoSizeConstraint implements ValidatorConstraintInterface {
  private readonly validSizes = [
    '720x1280', // Portrait (9:16)
    '1280x720', // Landscape (16:9)
    '1024x1792', // Hi-res portrait (9:16)
    '1792x1024', // Hi-res landscape (16:9)
  ];

  private readonly sizeInfo: Record<
    string,
    { orientation: 'portrait' | 'landscape'; resolution: 'standard' | 'hi-res' }
  > = {
    '720x1280': { orientation: 'portrait', resolution: 'standard' },
    '1280x720': { orientation: 'landscape', resolution: 'standard' },
    '1024x1792': { orientation: 'portrait', resolution: 'hi-res' },
    '1792x1024': { orientation: 'landscape', resolution: 'hi-res' },
  };

  validate(size: unknown): boolean {
    // Size must be a string
    if (typeof size !== 'string') {
      return false;
    }

    // Must be one of the supported sizes
    return this.validSizes.includes(size);
  }

  defaultMessage(args: ValidationArguments): string {
    const size = args.value;

    if (typeof size !== 'string') {
      return `Video size must be a string in format "WIDTHxHEIGHT". Received: ${typeof size}`;
    }

    // Check if it's a valid size format but unsupported
    if (/^\d+x\d+$/.test(size)) {
      return `Video size "${size}" is not supported. Supported sizes:
  Portrait (9:16): "720x1280" (mobile), "1024x1792" (hi-res)
  Landscape (16:9): "1280x720" (desktop), "1792x1024" (hi-res)

Choose based on target platform: portrait for mobile/social, landscape for desktop/YouTube.`;
    }

    return `Invalid video size format "${size}". Must be in format "WIDTHxHEIGHT", e.g., "720x1280". Supported sizes:
  - "720x1280" (portrait, mobile)
  - "1280x720" (landscape, desktop)
  - "1024x1792" (hi-res portrait)
  - "1792x1024" (hi-res landscape)`;
  }
}

/**
 * Decorator for validating video size
 *
 * Validates that the size parameter matches one of the 4 supported video resolutions.
 *
 * **Usage in DTO:**
 * ```typescript
 * export class CreateVideoDto {
 *   @IsOptional()
 *   @IsVideoSizeValid()
 *   size?: Videos.VideoSize;
 * }
 * ```
 *
 * @param validationOptions - Optional class-validator options
 */
export function IsVideoSizeValid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsVideoSizeConstraint,
    });
  };
}
