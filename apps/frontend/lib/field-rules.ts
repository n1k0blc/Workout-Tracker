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

import { addLocalYears } from './local-date';
import { normalizeBarcode } from './barcode';
import {
  CM_PER_INCH,
  KG_PER_LB,
  heightInputString,
  heightToCm,
  weightInputString,
  weightToKg,
  type UnitSystem,
} from './units';

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

/** As `checkInteger`, plus at most `maxDecimals` decimals in the value as typed (unlimited by default). */
export function checkDecimal(raw: string, min: number, max: number, maxDecimals = Infinity): Constraint {
  if (raw.trim() === '') return 'isNotEmpty';
  const n = Number(raw);
  if (Number.isNaN(n)) return 'isNumber';
  if (n < min) return 'min';
  if (n > max) return 'max';
  const decimals = raw.split('.')[1]?.length ?? 0;
  return decimals > maxDecimals ? 'maxDecimals' : null;
}

/**
 * A nutrition amount typed into a text input (ADR-0005 keeps those as text): a German decimal
 * comma is read as a period, then judged like `checkDecimal`.
 */
export function checkAmountText(raw: string, min: number, max: number, maxDecimals = Infinity): Constraint {
  return checkDecimal(raw.trim().replace(',', '.'), min, max, maxDecimals);
}

/** Height and body weight are typed in the user's unit and judged as the centimetres / kilograms the server stores. */
export function checkHeight(raw: string, system: UnitSystem, originalCm?: number | null): Constraint {
  if (raw.trim() === '') return 'isNotEmpty';
  const cm = heightToCm(raw, system, originalCm);
  if (cm == null) return 'isNumber';
  const untouched = originalCm != null && raw === heightInputString(originalCm, system);
  if (!untouched && !Number.isInteger(Number(raw))) return 'isInt';
  if (cm < HEIGHT_CM_MIN) return 'min';
  if (cm > HEIGHT_CM_MAX) return 'max';
  return null;
}

/** As `checkHeight`; the one-decimal limit applies to the value as typed, so an untouched one is exempt. */
export function checkBodyWeight(raw: string, system: UnitSystem, originalKg?: number | null): Constraint {
  if (raw.trim() === '') return 'isNotEmpty';
  const kg = weightToKg(raw, system, originalKg);
  if (kg == null || Number.isNaN(Number(raw))) return 'isNumber';
  if (kg < BODY_WEIGHT_KG_MIN) return 'min';
  if (kg > BODY_WEIGHT_KG_MAX) return 'max';
  const untouched = originalKg != null && raw === weightInputString(originalKg, system);
  return !untouched && (raw.split('.')[1]?.length ?? 0) > 1 ? 'maxDecimals' : null;
}

/**
 * The smallest and largest value the user can type in their own unit, for the limit messages and
 * the `<input min max>`. Inches round inward and pounds to one decimal inward, so the edge a
 * message names is one `checkHeight` / `checkBodyWeight` accepts.
 */
export function bodyLimits(system: UnitSystem) {
  if (system === 'METRIC') {
    return {
      height: { min: HEIGHT_CM_MIN, max: HEIGHT_CM_MAX, unit: 'cm' },
      weight: { min: BODY_WEIGHT_KG_MIN, max: BODY_WEIGHT_KG_MAX, unit: 'kg' },
    };
  }
  return {
    height: {
      min: Math.ceil(HEIGHT_CM_MIN / CM_PER_INCH),
      max: Math.floor(HEIGHT_CM_MAX / CM_PER_INCH),
      unit: 'in',
    },
    weight: {
      min: Math.ceil((BODY_WEIGHT_KG_MIN / KG_PER_LB) * 10) / 10,
      max: Math.floor((BODY_WEIGHT_KG_MAX / KG_PER_LB) * 10) / 10,
      unit: 'lb',
    },
  };
}

/** A Zyklus starts today (the user's day) or later, at most a year ahead. Days are `YYYY-MM-DD`. */
export function checkStartDate(day: string, today: string): Constraint {
  if (day === '') return 'isNotEmpty';
  if (day < today) return 'minDate';
  return day > addLocalYears(today, 1) ? 'maxDate' : null;
}

/** A past workout is dated from `WORKOUT_DATE_MIN_YEAR` through today. Days are `YYYY-MM-DD`. */
export function checkWorkoutDate(day: string, today: string): Constraint {
  if (day === '') return 'isNotEmpty';
  if (day < `${WORKOUT_DATE_MIN_YEAR}-01-01`) return 'minDate';
  return day > today ? 'maxDate' : null;
}

/** A range ends on or after its start. An unfinished range (a blank end) is not wrong yet. */
export function checkDateRange(start: string, end: string): Constraint {
  return start !== '' && end !== '' && start > end ? 'endBeforeStart' : null;
}

/** Carbs, protein and fat together fit in 100 g per 100 g; judged once all three are numbers. */
export function checkMacroSum(raws: string[]): Constraint {
  if (raws.some((raw) => raw.trim() === '' || Number.isNaN(Number(raw)))) return null;
  const sum = raws.reduce((total, raw) => total + Number(raw), 0);
  return sum > MACRO_PER_100_MAX + 1e-9 ? 'macroSum' : null;
}

/**
 * Whether a Schnelleintrag saved "as Lebensmittel" would be a legal food: its numbers become the
 * food's per-100 values, so they need the Lebensmittel limits, not the wider Schnelleintrag ones.
 * Mirror of `fitsFoodLimits` on the server.
 */
export function checkFitsFood(values: { kcal: number; carbs: number; protein: number; fat: number }): Constraint {
  const { kcal, carbs, protein, fat } = values;
  const decimals = String(kcal).split('.')[1]?.length ?? 0;
  const fits =
    kcal <= KCAL_PER_100_MAX &&
    decimals <= KCAL_MAX_DECIMALS &&
    [carbs, protein, fat].every((macro) => macro <= MACRO_PER_100_MAX) &&
    carbs + protein + fat <= MACRO_PER_100_MAX + 1e-9;
  return fits ? null : 'notAFood';
}

/** An EAN-8, UPC-A or EAN-13 with a valid check digit: the scanner's rule (`lib/barcode.ts`) in the editor. */
export function checkEan(raw: string): Constraint {
  return normalizeBarcode(raw) === null ? 'isBarcode' : null;
}
