/**
 * The calendar day a `Date` falls on according to the local clock, as `YYYY-MM-DD`.
 *
 * The client is the only party that knows the user's local day, so it is the client that
 * stamps a workout's `localDate`. Deriving it from `toISOString()` would silently answer in
 * UTC instead, which is a different day for anyone logging late at night east of Greenwich
 * or early in the morning west of it.
 */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
