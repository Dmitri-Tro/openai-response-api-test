import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

/**
 * Validator constraint for video duration validation
 *
 * **Supported Durations:**
 * - '4' - 4 seconds (default, fastest, lowest cost)
 * - '8' - 8 seconds (medium duration and cost)
 * - '12' - 12 seconds (longest, highest cost)
 *
 * **IMPORTANT:** Values must be string literals, not numbers.
 *
 * **Validation Rules:**
 * - Must be string type (not number)
 * - Must match one of the 3 supported durations
 * - Format: String literal (e.g., "4", not 4)
 *
 * **Cost Implications:**
 * Cost scales linearly with duration. Examples (approximate):
 * - sora-2: 4sec ≈ $0.50, 8sec ≈ $1.00, 12sec ≈ $1.50
 * - sora-2-pro: 4sec ≈ $1.50, 8sec ≈ $3.00, 12sec ≈ $4.50
 *
 * **Use Cases:**
 * - '4': Short clips, social media stories, quick previews
 * - '8': Standard content, most use cases, balanced cost
 * - '12': Detailed scenes, complex animations, maximum length
 *
 * @example
 * ```typescript
 * // Valid durations
 * '4'  // ✓ String literal (correct)
 * '8'  // ✓ String literal
 * '12' // ✓ String literal
 *
 * // Invalid durations
 * 4    // ✗ Number (must be string)
 * '6'  // ✗ Not supported
 * '20' // ✗ Exceeds maximum
 * ```
 */
@ValidatorConstraint({ async: false })
export class IsVideoDurationConstraint implements ValidatorConstraintInterface {
  private readonly validDurations = ['4', '8', '12'];

  private readonly durationInfo: Record<
    string,
    { cost: 'low' | 'medium' | 'high'; useCase: string }
  > = {
    '4': { cost: 'low', useCase: 'Quick clips, previews, social stories' },
    '8': {
      cost: 'medium',
      useCase: 'Standard content, balanced length/cost',
    },
    '12': {
      cost: 'high',
      useCase: 'Detailed scenes, maximum length',
    },
  };

  validate(duration: unknown): boolean {
    // Duration must be a string
    if (typeof duration !== 'string') {
      return false;
    }

    // Must be one of the supported durations
    return this.validDurations.includes(duration);
  }

  defaultMessage(args: ValidationArguments): string {
    const duration = args.value as string | number;

    if (typeof duration !== 'string') {
      if (typeof duration === 'number') {
        return `Video duration must be a string literal, not a number. Use "${duration}" instead of ${duration}. Supported values: "4", "8", "12"`;
      }
      return `Video duration must be a string literal. Received: ${typeof duration}. Supported values: "4", "8", "12"`;
    }

    // Check if it's a numeric string but unsupported
    if (/^\d+$/.test(duration)) {
      const numValue = parseInt(duration, 10);
      if (numValue < 4) {
        return `Video duration "${duration}" is too short. Minimum supported duration is "4" seconds. Supported values: "4", "8", "12"`;
      }
      if (numValue > 12) {
        return `Video duration "${duration}" exceeds maximum. Maximum supported duration is "12" seconds. Supported values: "4", "8", "12"`;
      }
      return `Video duration "${duration}" is not supported. Supported values: "4" (low cost), "8" (medium cost), "12" (high cost)`;
    }

    return `Invalid video duration "${duration}". Must be a string literal: "4", "8", or "12"

Duration guide:
  - "4": 4 seconds (fastest generation, lowest cost, best for short clips)
  - "8": 8 seconds (medium generation time and cost, standard content)
  - "12": 12 seconds (longest generation time, highest cost, detailed scenes)

Note: Cost scales with duration. Use shorter durations to optimize costs.`;
  }
}

/**
 * Decorator for validating video duration
 *
 * Validates that the seconds parameter matches one of the 3 supported durations
 * and provides cost-related guidance in error messages.
 *
 * **Usage in DTO:**
 * ```typescript
 * export class CreateVideoDto {
 *   @IsOptional()
 *   @IsVideoDurationValid()
 *   seconds?: Videos.VideoSeconds;
 * }
 * ```
 *
 * @param validationOptions - Optional class-validator options
 */
export function IsVideoDurationValid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsVideoDurationConstraint,
    });
  };
}
