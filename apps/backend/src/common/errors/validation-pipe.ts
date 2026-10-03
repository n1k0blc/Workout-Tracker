import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';

/** One failing property and the class-validator constraint names it broke (`isEmail`, `min`, ...). */
export interface FieldError {
  property: string;
  constraints: string[];
}

function toFieldErrors(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((error) => {
    const property = parent ? `${parent}.${error.property}` : error.property;
    return [
      ...(error.constraints ? [{ property, constraints: Object.keys(error.constraints) }] : []),
      ...toFieldErrors(error.children ?? [], property),
    ];
  });
}

/**
 * The app-wide ValidationPipe (#190, #191). Nest's default turns a failure into `message: string[]`
 * of generated English text, which never reaches a user and is no longer sent at all. The body is
 * `code` plus `errors: [{ property, constraints }]`, so the frontend keys a catalogue message off
 * the constraint name exactly as it does off an error code.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors: ValidationError[] = []) =>
      new BadRequestException({ code: 'VALIDATION_FAILED', errors: toFieldErrors(errors) }),
  });
}
