import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, registerDecorator } from 'class-validator';
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

// --- Patterns ---------------------------------------------------------------------------------

/** Control characters (tab and newline included) and zero-width characters. */
export const FORBIDDEN_TEXT_PATTERN = /[\p{Cc}​-‍⁠﻿]/u;
/** A letter first, then letters, combining marks, spaces, apostrophes (' and U+2019), periods, hyphens. */
export const PERSON_NAME_PATTERN = /^\p{L}[\p{L}\p{M} '’.-]*$/u;

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
 * `noControlCharacters`.
 */
export function BaseText(max: number) {
  return applyDecorators(
    Transform(trimmed),
    IsString(),
    IsNotEmpty(),
    MaxLength(max),
    constraint(
      'noControlCharacters',
      (value) => typeof value !== 'string' || !FORBIDDEN_TEXT_PATTERN.test(value),
    ),
  );
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
function ageOn(birthDate: string, today: string): number {
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
