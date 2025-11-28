import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'isValidVideoSize', async: false })
export class IsVideoSizeConstraint implements ValidatorConstraintInterface {
  private readonly validSizes = [
    '720x1280', // Portrait standard
    '1280x720', // Landscape standard
    '1024x1792', // Portrait hi-res
    '1792x1024', // Landscape hi-res
  ];

  validate(size: unknown) {
    if (typeof size !== 'string') return false;
    return this.validSizes.includes(size);
  }

  defaultMessage(args: ValidationArguments) {
    const value = args.value as unknown;
    if (typeof value !== 'string') {
      return `Size must be a string (received: ${typeof value}). Format: WIDTHxHEIGHT.`;
    }

    if (!/^\d+x\d+$/.test(value)) {
      return 'Invalid video size format. Expected: WIDTHxHEIGHT (e.g., 720x1280).';
    }

    return `Size "${value}" is not supported.
Supported sizes:
- 720x1280 (portrait standard)
- 1280x720 (landscape standard)
- 1024x1792 (portrait hi-res)
- 1792x1024 (landscape hi-res)`;
  }
}
