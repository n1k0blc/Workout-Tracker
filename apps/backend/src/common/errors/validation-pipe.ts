import {
  ArgumentMetadata,
  BadRequestException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { IdPipe } from '../validation/id.pipe';
import { AppBadRequestException } from './app-exceptions';
import type { ErrorCode } from './error-codes';

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
 * A constraint can carry an API error code in its validation `context` (`{ context: { code } }`),
 * for a parameter whose clients already key a message off that code. The first one found wins.
 */
function contextCode(errors: ValidationError[]): ErrorCode | undefined {
  for (const error of errors) {
    for (const name of Object.keys(error.constraints ?? {})) {
      const code = (error.contexts?.[name] as { code?: ErrorCode } | undefined)?.code;
      if (code) return code;
    }
    const nested = contextCode(error.children ?? []);
    if (nested) return nested;
  }
  return undefined;
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
    exceptionFactory: (errors: ValidationError[] = []) => {
      const code = contextCode(errors);
      return code
        ? new AppBadRequestException(code)
        : new BadRequestException({ code: 'VALIDATION_FAILED', errors: toFieldErrors(errors) });
    },
  });
}

class AppValidationPipe extends ValidationPipe {
  private readonly ids = new IdPipe();

  async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    return super.transform(this.ids.transform(value, metadata), metadata);
  }
}
