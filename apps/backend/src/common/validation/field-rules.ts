import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidationArguments,
  registerDecorator,
} from 'class-validator';
import { resolveToday } from '../utils/today.util';

/**
 * Field rules (#222, parent #221). The single place a text or range rule is defined on the
 * server; DTOs compose the decorators below and never write their own regex.
 *
 * Two contracts keep the client honest:
 *  - Every violated rule surfaces as a stable constraint name (`maxLength`, `noControlCharacters`,
 *    `isPersonName`, `minAge`, ...). The frontend catalogue has a de + en entry for each under
 *    `ApiErrors.validation`, and the client mirror (`apps/frontend/lib/field-rules.ts`) returns the
 *    same names, so the user reads the same text whichever side caught the error.
 *  - Limits and patterns are plain `export const NAME = <literal>;` lines so the frontend's drift
 *    test (`field-rules.test.ts`) can read this file as text and fail when a value differs. Keep
 *    them in that shape, and give a new one the same name on both sides.
 */

// --- Limits -----------------------------------------------------------------------------------

export const EMAIL_MAX = 254;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 100;
export const PERSON_NAME_MAX = 50;
/** Gym, Uebung, Vorlage, Zyklus and "save as Vorlage" names. */
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
/** The largest value of an `Int` column. Rest and tracked `totalDuration` are bounded by it and nothing else. */
export const INT_COLUMN_MAX = 2147483647; // server-only
export const SETS_PER_EXERCISE_MAX = 20;
export const EXERCISES_PER_WORKOUT_MAX = 30;
export const TRAINING_DAYS_PER_CYCLE_MAX = 7;
export const PORTIONS_PER_FOOD_MAX = 10;
export const SECTIONS_PER_USER_MAX = 10;
/** The earliest year a performed workout may carry (`2000-01-01`). */
export const WORKOUT_DATE_MIN_YEAR = 2000;
/** A performed workout's instant may be this far ahead of the server clock: zone and clock slack. */
export const WORKOUT_DATE_FUTURE_GRACE_HOURS = 24; // server-only
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

// --- Patterns ---------------------------------------------------------------------------------

/** Control characters (tab and newline included) and zero-width characters. */
export const FORBIDDEN_TEXT_PATTERN = /[\p{Cc}​-‍⁠﻿]/u;
/** A letter first, then letters, combining marks, spaces, apostrophes (' and U+2019), periods, hyphens. */
export const PERSON_NAME_PATTERN = /^\p{L}[\p{L}\p{M} '’.-]*$/u;
/** Letters, digits, hyphen and underscore: UUIDs and `seed-...` ids both fit; it is not a UUID check. */
export const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

// --- Decorators -------------------------------------------------------------------------------

function trimmed({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

function constraint(name: string, validate: (value: unknown) => boolean): PropertyDecorator {
  return (object, propertyKey) => {
    registerDecorator({
      name,
      target: object.constructor,
      propertyName: String(propertyKey),
      validator: { validate, defaultMessage: () => `${String(propertyKey)}: ${name}` },
    });
  };
}

/**
 * The base rule every text field shares: trimmed (the one change made to input, stored trimmed),
 * non-empty, at most `max` characters, and free of control and zero-width characters. Such
 * characters are rejected, never stripped. Constraints: `isString`, `isNotEmpty`, `maxLength`,
 * `noControlCharacters`. `allowEmpty` drops the non-empty rule for an optional text such as a
 * brand; combine it with `IsOptional()` to also let the field be absent.
 */
export function BaseText(max: number, { allowEmpty = false }: { allowEmpty?: boolean } = {}) {
  return applyDecorators(
    Transform(trimmed),
    IsString(),
    ...(allowEmpty ? [] : [IsNotEmpty()]),
    MaxLength(max),
    constraint(
      'noControlCharacters',
      (value) => typeof value !== 'string' || !FORBIDDEN_TEXT_PATTERN.test(value),
    ),
  );
}

/**
 * A search term: trimmed and capped at `SEARCH_MAX`, any characters (`T-Bar Row`, `7UP`,
 * `M&M's`). May be empty; the caller decides what an empty search means. Constraints:
 * `isString`, `maxLength`.
 */
export function SearchTerm() {
  return applyDecorators(Transform(trimmed), IsString(), MaxLength(SEARCH_MAX));
}

/** Whether `value` is an identifier: 1-`ID_MAX` characters of `ID_PATTERN`. Seeded `seed-...` ids qualify. */
export function isId(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0 && value.length <= ID_MAX && ID_PATTERN.test(value);
}

/** An identifier in a query or body. Constraint: `isId`. Path parameters use the same rule through `IdPipe`. */
export function Id() {
  return constraint('isId', isId);
}

/** At most `places` decimals. Constraint: `maxDecimals`. */
export function MaxDecimals(places: number) {
  return constraint('maxDecimals', (value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return true; // IsNumber reports that
    return (String(value).split('.')[1]?.length ?? 0) <= places;
  });
}

/**
 * Carbs, protein and fat together cannot exceed `MACRO_PER_100_MAX` g per 100 g. Put it on the
 * last of the three so the error lands under the field the user typed last. Constraint: `macroSum`.
 */
export function MacroSum(others: [string, string]) {
  return (object: object, propertyKey: string | symbol) => {
    registerDecorator({
      name: 'macroSum',
      target: object.constructor,
      propertyName: String(propertyKey),
      validator: {
        validate: (value: unknown, args: ValidationArguments) => {
          const parts = [value, ...others.map((key) => (args.object as Record<string, unknown>)[key])];
          if (!parts.every((n) => typeof n === 'number' && Number.isFinite(n))) return true; // IsNumber reports that
          // Tolerance: 33.3 + 33.3 + 33.4 is 100 to the user but not to a float.
          return (parts as number[]).reduce((a, b) => a + b, 0) <= MACRO_PER_100_MAX + 1e-9;
        },
        defaultMessage: () => `${String(propertyKey)}: macroSum`,
      },
    });
  };
}

/**
 * The instant a performed workout happened: not before `WORKOUT_DATE_MIN_YEAR`, not more than
 * `WORKOUT_DATE_FUTURE_GRACE_HOURS` ahead of the server clock. Constraints: `minDate`, `maxDate`.
 */
export function WorkoutDate() {
  const parsed = (value: unknown) =>
    typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? Date.parse(value) : null;
  return applyDecorators(
    constraint('minDate', (value) => {
      const time = parsed(value);
      return time === null || time >= Date.UTC(WORKOUT_DATE_MIN_YEAR, 0, 1);
    }),
    constraint('maxDate', (value) => {
      const time = parsed(value);
      return time === null || time <= Date.now() + WORKOUT_DATE_FUTURE_GRACE_HOURS * 3_600_000;
    }),
  );
}

/** The date range's end must not precede its start (`startKey` on the same object). Constraint: `endBeforeStart`. */
export function EndNotBeforeStart(startKey: string) {
  return (object: object, propertyKey: string | symbol) => {
    registerDecorator({
      name: 'endBeforeStart',
      target: object.constructor,
      propertyName: String(propertyKey),
      validator: {
        validate: (value: unknown, args: ValidationArguments) => {
          const start = Date.parse(String((args.object as Record<string, unknown>)[startKey]));
          const end = typeof value === 'string' ? Date.parse(value) : NaN;
          return Number.isNaN(start) || Number.isNaN(end) || start <= end;
        },
        defaultMessage: () => `${String(propertyKey)}: endBeforeStart`,
      },
    });
  };
}

/** Base text, 1-`PERSON_NAME_MAX`, shaped like a person's name. Adds the constraint `isPersonName`. */
export function PersonName() {
  return applyDecorators(
    BaseText(PERSON_NAME_MAX),
    constraint(
      'isPersonName',
      (value) => typeof value !== 'string' || PERSON_NAME_PATTERN.test(value),
    ),
  );
}

/** Whole years between a `YYYY-MM-DD` birth date and `today` (negative before birth). */
export function ageOn(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

function ageRule(name: string, ok: (age: number) => boolean) {
  return constraint(name, (value) => {
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return true; // IsDateString reports that
    return ok(ageOn(value, resolveToday().localDate));
  });
}

/** Birth date at least `years` old today (server zone). A future date fails here. Constraint: `minAge`. */
export function MinAge(years: number) {
  return ageRule('minAge', (age) => age >= years);
}

/** Birth date at most `years` old today (server zone). Constraint: `maxAge`. */
export function MaxAge(years: number) {
  return ageRule('maxAge', (age) => age <= years);
}
