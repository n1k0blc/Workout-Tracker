import { checkInteger, type Constraint } from './field-rules';

/**
 * The one duration a user types: a workout tracked afterwards (#230). A client-only rule (the API
 * takes any non-negative `totalDuration`, because tracked ones are measured, not typed), so it
 * lives here and not in `field-rules.ts`, which mirrors the server's limits and nothing else.
 */
export const TYPED_DURATION_MIN_MINUTES = 1;
export const TYPED_DURATION_MAX_MINUTES = 480;

/** `raw` is the minutes field's value as typed. */
export function checkTypedDuration(raw: string): Constraint {
  return checkInteger(raw, TYPED_DURATION_MIN_MINUTES, TYPED_DURATION_MAX_MINUTES);
}
