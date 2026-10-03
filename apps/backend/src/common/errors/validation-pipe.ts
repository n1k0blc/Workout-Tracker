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
 * The app-wide ValidationPipe (#190). Nest's default turns a failure into `message: string[]` of
 * generated English text, which is all a client can read -- and the English never reaches a user.
 * This keeps that body byte-for-byte (the expand half of the migration) and adds `code` plus
 * `errors: [{ property, constraints }]`, so the frontend can key a catalogue message off the
 * constraint name exactly as it does off an error code.
 */
export function createValidationPipe(): ValidationPipe {
  const options = { whitelist: true, forbidNonWhitelisted: true, transform: true };
  const defaultFactory = new ValidationPipe(options).createExceptionFactory();

  return new ValidationPipe({
    ...options,
    exceptionFactory: (errors: ValidationError[] = []) => {
      const base = defaultFactory(errors) as BadRequestException;
      return new BadRequestException({
        ...(base.getResponse() as object),
        code: 'VALIDATION_FAILED',
        errors: toFieldErrors(errors),
      });
    },
  });
}
