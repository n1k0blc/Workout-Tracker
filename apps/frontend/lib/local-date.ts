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

/**
 * The other direction: a `YYYY-MM-DD` calendar day as a local `Date`, for formatting only.
 * `new Date('2026-08-17')` would read it as UTC midnight, which renders as the previous day
 * west of Greenwich -- the same confusion `toLocalDateString` exists to avoid.
 */
export function fromLocalDateString(localDate: string): Date {
  const [year, month, day] = localDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** The user's IANA timezone, sent with every request so the server can answer "what day is it?". */
export function clientTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
