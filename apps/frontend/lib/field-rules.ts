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
 *   backend counterpart. Keep each as a plain `export const NAME = <literal>;` line. A backend
 *   limit tagged `// server-only` (Rest and duration column maximum) is exempt and not mirrored.
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
export const TRAINING_DAY_NAME_MAX = 50;
/** Lebensmittel name and brand, Mahlzeit name, Schnelleintrag name (so "save as Lebensmittel" cannot fail on length). */
export const FOOD_NAME_MAX = 120;
/** Abschnitt name and Portionsgroesse label. */
export const SECTION_NAME_MAX = 60;
export const PORTION_LABEL_MAX = 60;
/** Search terms, everywhere: trimmed, any characters. */
export const SEARCH_MAX = 100;
/** A path or query identifier: long enough for a UUID, short enough to refuse junk. */
export const ID_MAX = 100;
export const CYCLE_DURATION_MIN = 1;
export const CYCLE_DURATION_MAX = 52;
export const WEIGHT_KG_MAX = 1000;
export const REPS_MIN = 1;
export const REPS_MAX = 100;
export const RIR_MIN = 0;
export const RIR_MAX = 10;
export const SETS_PER_EXERCISE_MAX = 20;
export const EXERCISES_PER_WORKOUT_MAX = 30;
export const TRAINING_DAYS_PER_CYCLE_MAX = 7;
export const PORTIONS_PER_FOOD_MAX = 10;
export const SECTIONS_PER_USER_MAX = 10;
/** The earliest year a performed workout may carry (`2000-01-01`). */
export const WORKOUT_DATE_MIN_YEAR = 2000;
export const KCAL_PER_100_MAX = 900;
export const KCAL_MAX_DECIMALS = 1;
export const MACRO_PER_100_MAX = 100;
export const QUICK_ENTRY_KCAL_MAX = 10000;
export const QUICK_ENTRY_MACRO_MAX = 1000;
/** Portionsgroesse grams, diary grams and quantity. */
export const AMOUNT_MIN = 0.1;
export const AMOUNT_MAX = 5000;
/** Meal factor and portion multiplier. */
export const FACTOR_MIN = 0.5;
export const FACTOR_MAX = 20;
export const TARGET_KCAL_MIN = 500;
export const TARGET_KCAL_MAX = 10000;
export const TARGET_MACRO_MIN = 1;
export const TARGET_MACRO_MAX = 1000;

export const FORBIDDEN_TEXT_PATTERN = /[\p{Cc}​-‍⁠﻿]/u;
export const PERSON_NAME_PATTERN = /^\p{L}[\p{L}\p{M} '’.-]*$/u;
export const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

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
