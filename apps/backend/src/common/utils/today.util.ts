import { getCurrentDate } from './date.util';

/**
 * The zone every request falls back to when it carries no `X-Timezone` header -- direct API
 * calls and server-side rendering. It matches the zone the `localDate` backfill assumed,
 * so a headerless request answers the same day the existing data was written in.
 */
export const SERVER_TIME_ZONE = 'Europe/Berlin';

/** Lower-cased: Node normalises incoming header names. */
export const TIME_ZONE_HEADER = 'x-timezone';

/**
 * The user's current calendar day. Recommendations are decided by weekday and "has anything
 * been logged today", both of which are questions about a calendar day rather than an
 * instant -- so this is the only form of "now" the next-workout service accepts.
 */
export interface Today {
  timeZone: string;
  /** `YYYY-MM-DD`, comparable directly against a workout's stored `localDate`. */
  localDate: string;
  /** 0 = Sunday .. 6 = Saturday, matching `WorkoutDay.weekday`. */
  weekday: number;
}

/** `header` is whatever arrived on the request -- a duplicated header comes through as an array. */
export function resolveTimeZone(header?: string | string[]): string {
  if (typeof header !== 'string' || !header) return SERVER_TIME_ZONE;

  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: header });
    return header;
  } catch {
    // A client that sends nonsense gets the fallback rather than a 500.
    return SERVER_TIME_ZONE;
  }
}

export function resolveToday(header?: string | string[], now: Date = getCurrentDate()): Today {
  const timeZone = resolveTimeZone(header);
  const localDate = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  return { timeZone, localDate, weekday: weekdayOfLocalDate(localDate) };
}

/** Read through UTC: a calendar day has no time, so any zone offset here could only mislead. */
export function localDateToInstant(localDate: string): Date {
  return new Date(`${localDate}T00:00:00.000Z`);
}

export function weekdayOfLocalDate(localDate: string): number {
  return localDateToInstant(localDate).getUTCDay();
}

export function addLocalDays(localDate: string, days: number): string {
  const shifted = localDateToInstant(localDate);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}
