import {
  ArgumentMetadata,
  BadRequestException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { IdPipe } from '../validation/id.pipe';

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
 *
 * Path parameters are plain strings that a DTO cannot describe, so the same pipe first sends
 * every one through `IdPipe` (#224): one rule, and no route can forget it.
 */
export function createValidationPipe(): ValidationPipe {
  return new AppValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors: ValidationError[] = []) =>
      new BadRequestException({ code: 'VALIDATION_FAILED', errors: toFieldErrors(errors) }),
  });
}

class AppValidationPipe extends ValidationPipe {
  private readonly ids = new IdPipe();

  async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    return super.transform(this.ids.transform(value, metadata), metadata);
  }
}
