import { ArgumentMetadata, BadRequestException, PipeTransform } from '@nestjs/common';
import { isId } from './field-rules';

/**
 * The one pipe every path parameter goes through (#224). Wired into the app-wide
 * ValidationPipe (`createValidationPipe`), so a new route cannot forget it.
 *
 * It cannot require a UUID: seeded Uebungen carry ids such as `seed-bayesian-curl`. It only
 * refuses what no id ever looks like (empty, over 100 characters, anything beyond letters,
 * digits, `-` and `_`), so a malformed id answers 400 instead of reaching a query or a 500.
 * The failure has the same body as any other validation failure, keyed by the parameter's name.
 */
export class IdPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type !== 'param' || !metadata.data) return value;
    if (isId(value)) return value;
    throw new BadRequestException({
      code: 'VALIDATION_FAILED',
      errors: [{ property: metadata.data, constraints: ['isId'] }],
    });
  }
}
