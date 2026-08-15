/** `WorkoutDay.weekday` is 0 = Sunday .. 6 = Saturday, matching `Date.getDay()`. */
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
 * A cycle's own week starts on its `startDate`'s weekday, not on Monday -- this is the
 * anchoring convention shared by the analytics week-bounds calculation and by
 * `WorkoutDay.order` (#74). Returns 0 for the start weekday itself, up to 6 for the day
 * right before it, so it doubles as both a distance and a stable, unique sort key.
 */
export function getWeekdayDistanceFromCycleStart(weekday: number, startWeekday: number): number {
  return (weekday - startWeekday + 7) % 7;
}
