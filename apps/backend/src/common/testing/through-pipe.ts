import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../errors/validation-pipe';

export interface PipeErrors {
  property: string;
  constraints: string[];
}

/**
 * Sends `value` through the app's real global ValidationPipe, exactly as Nest does for a
 * controller argument of the given kind, and returns the transformed value or the
 * `{ property, constraints }` list the client receives.
 */
export async function throughPipe<T>(
  metatype: (new () => T) | undefined,
  value: unknown,
  type: ArgumentMetadata['type'] = 'body',
  data?: string,
): Promise<{ ok: T | null; errors: PipeErrors[] }> {
  try {
    return {
      ok: (await createValidationPipe().transform(value, { type, metatype, data })) as T,
      errors: [],
    };
  } catch (e) {
    if (!(e instanceof BadRequestException)) throw e;
    const response = e.getResponse() as { errors: PipeErrors[] };
    return { ok: null, errors: response.errors };
  }
}

/** The constraint names reported for one property (empty when it passed). */
export function constraintsOf(errors: PipeErrors[], property: string): string[] {
  return errors.filter((e) => e.property === property).flatMap((e) => e.constraints);
}
