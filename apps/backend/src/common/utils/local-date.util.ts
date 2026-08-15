import { registerDecorator } from 'class-validator';

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A workout's `localDate` is the calendar day it happened on in the user's own timezone --
 * a plain `YYYY-MM-DD` string, never an instant. Anything carrying a time or a zone is
 * rejected: reintroducing either is exactly the ambiguity the field exists to remove.
 */
export function isLocalDate(value: unknown): boolean {
  if (typeof value !== 'string') return false;

  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) return false;

  const [, year, month, day] = match.map(Number);
  // Round-tripping through UTC catches days that do not exist in their month
  // (2026-02-30 rolls forward to March 2nd).
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function IsLocalDate() {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isLocalDate',
      target: object.constructor,
      propertyName,
      validator: {
        validate: (value: unknown) => isLocalDate(value),
        defaultMessage: () => `${propertyName} must be a calendar date in YYYY-MM-DD form`,
      },
    });
  };
}
