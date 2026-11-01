/**
 * Client mirror of the backend field rules (#222, parent #221):
 * `apps/backend/src/common/validation/field-rules.ts`. The server is the authority; this gives
 * early feedback with the same limits and the same constraint names.
 *
 * - Each `check*` function returns the name of the first rule the value breaks, or `null`. The
 *   names are the server's constraint names (`isNotEmpty`, `maxLength`, `isPersonName`, ...), so
 *   `useValidationMessage` shows the same catalogue text (`ApiErrors.validation`) whichever side
 *   caught the error. Client-only names (`maxDecimals`, `passwordsDiffer`) are in the catalogue too.
 * - The limits and patterns below must keep the backend's names and values. `field-rules.test.ts`
 *   reads the backend file as text and fails on any difference, and on a numeric limit with no
 *   backend counterpart. Keep each as a plain `export const NAME = <literal>;` line.
 * - Limits that only a message or a `<input min max step>` needs are consumed directly; no field
 *   writes its own regex.
 */

export const EMAIL_MAX = 254;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 100;
export const PERSON_NAME_MAX = 50;
export const NAME_MAX = 100;
export const AGE_MIN = 13;
export const AGE_MAX = 120;
export const HEIGHT_CM_MIN = 100;
export const HEIGHT_CM_MAX = 250;
export const BODY_WEIGHT_KG_MIN = 30;
export const BODY_WEIGHT_KG_MAX = 400;
export const HOME_GYMS_MAX = 10;

export const FORBIDDEN_TEXT_PATTERN = /[\p{Cc}​-‍⁠﻿]/u;
export const PERSON_NAME_PATTERN = /^\p{L}[\p{L}\p{M} '’.-]*$/u;

/** A rule's constraint name, or null when the value passes. */
export type Constraint = string | null;

/** Deliberately loose: the server's `isEmail` is the real check. */
const LOOSE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trimmed, non-empty, at most `max` characters, no control or zero-width characters. */
export function checkBaseText(value: string, max: number): Constraint {
  const text = value.trim();
  if (text === '') return 'isNotEmpty';
  if (text.length > max) return 'maxLength';
  if (FORBIDDEN_TEXT_PATTERN.test(text)) return 'noControlCharacters';
  return null;
}

export function checkPersonName(value: string): Constraint {
  return checkBaseText(value, PERSON_NAME_MAX) ?? (PERSON_NAME_PATTERN.test(value.trim()) ? null : 'isPersonName');
}

export function checkEmail(value: string): Constraint {
  const email = value.trim();
  if (email === '') return 'isNotEmpty';
  if (email.length > EMAIL_MAX) return 'maxLength';
  return LOOSE_EMAIL.test(email) ? null : 'isEmail';
}

/** Never trimmed: spaces are legitimate password characters. */
export function checkPassword(value: string): Constraint {
  if (value === '') return 'isNotEmpty';
  if (value.length < PASSWORD_MIN) return 'minLength';
  if (value.length > PASSWORD_MAX) return 'maxLength';
  return null;
}

/** `birthDate` and `today` are `YYYY-MM-DD`; `today` is the user's own day. */
export function checkBirthDate(birthDate: string | null, today: string): Constraint {
  if (!birthDate) return 'isNotEmpty';
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const age = ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
  if (age < AGE_MIN) return 'minAge';
  if (age > AGE_MAX) return 'maxAge';
  return null;
}

/** `raw` is an `<input type="number">` value: a period-normalised string, empty if unparseable. */
export function checkInteger(raw: string, min: number, max: number): Constraint {
  if (raw.trim() === '') return 'isNotEmpty';
  const n = Number(raw);
  if (!Number.isInteger(n)) return 'isInt';
  if (n < min) return 'min';
  if (n > max) return 'max';
  return null;
}

/** As `checkInteger`, plus at most `maxDecimals` decimals in the value as typed. */
export function checkDecimal(raw: string, min: number, max: number, maxDecimals: number): Constraint {
  if (raw.trim() === '') return 'isNotEmpty';
  const n = Number(raw);
  if (Number.isNaN(n)) return 'isNumber';
  if (n < min) return 'min';
  if (n > max) return 'max';
  const decimals = raw.split('.')[1]?.length ?? 0;
  return decimals > maxDecimals ? 'maxDecimals' : null;
}
