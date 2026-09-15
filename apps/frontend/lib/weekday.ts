/**
 * A UTC reference date that falls on the given weekday (0 = Sunday .. 6 = Saturday, matching
 * `Date.getDay()`) -- 2023-01-01 was a Sunday. Feed it to `Intl.DateTimeFormat`/next-intl's
 * `format.dateTime` with `{ weekday: 'long' | 'short', timeZone: 'UTC' }` to get a
 * locale-correct weekday name for a bare weekday number. UTC avoids DST edge cases.
 */
export function weekdayReferenceDate(weekday: number): Date {
  return new Date(Date.UTC(2023, 0, 1 + weekday));
}

/** `weekday` is 0 = Sunday .. 6 = Saturday, matching `Date.getDay()`. Mirrors the backend's `WEEKDAY_NAMES`. */
export const WEEKDAY_NAMES = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
];

/**
 * A cycle's own week starts on its `startDate`'s weekday, not on Monday -- days sort by
 * their distance from that weekday so a Sunday-anchored cycle reads Sunday, Monday, Friday
 * instead of whatever order they were created in. Mirrors the backend's
 * `getWeekdayDistanceFromCycleStart` (weekday.util.ts).
 */
export function getWeekdayDistanceFromCycleStart(weekday: number, startWeekday: number): number {
  return (weekday - startWeekday + 7) % 7;
}

/**
 * Sorts days by their distance from `startDate`'s weekday, without mutating the input.
 * `startDate` is a `YYYY-MM-DD` string, parsed the same way the backend does.
 */
export function sortByCycleWeekday<T extends { weekday: number }>(days: T[], startDate: string): T[] {
  const startWeekday = new Date(startDate).getUTCDay();
  return [...days].sort(
    (a, b) =>
      getWeekdayDistanceFromCycleStart(a.weekday, startWeekday) -
      getWeekdayDistanceFromCycleStart(b.weekday, startWeekday),
  );
}
