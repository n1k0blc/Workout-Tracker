import { describe, it, expect, afterAll } from 'vitest';
import { fromLocalDateString, toLocalDateString } from './local-date';

const originalTz = process.env.TZ;

afterAll(() => {
  process.env.TZ = originalTz;
});

describe('toLocalDateString', () => {
  it('reports the calendar day of the local clock', () => {
    process.env.TZ = 'Europe/Berlin';
    expect(toLocalDateString(new Date(2026, 7, 15, 14, 0))).toBe('2026-08-15');
  });

  it('pads month and day to a fixed YYYY-MM-DD shape', () => {
    process.env.TZ = 'Europe/Berlin';
    expect(toLocalDateString(new Date(2026, 0, 5, 9, 0))).toBe('2026-01-05');
  });

  it('follows the local day for a late-night session, not the UTC day', () => {
    // 2026-08-15 23:30 in Berlin is already 2026-08-15 21:30 UTC -- same day. Sydney is the
    // case that actually diverges: 00:30 local on the 16th is still the 15th in UTC.
    process.env.TZ = 'Australia/Sydney';
    const afterMidnight = new Date('2026-08-15T15:30:00.000Z');

    expect(afterMidnight.toISOString().slice(0, 10)).toBe('2026-08-15');
    expect(toLocalDateString(afterMidnight)).toBe('2026-08-16');
  });

  it('follows the local day when it lags the UTC day', () => {
    process.env.TZ = 'America/Los_Angeles';
    const lateEvening = new Date('2026-08-16T04:30:00.000Z');

    expect(lateEvening.toISOString().slice(0, 10)).toBe('2026-08-16');
    expect(toLocalDateString(lateEvening)).toBe('2026-08-15');
  });
});

describe('fromLocalDateString', () => {
  it('lands on the named day, not the UTC instant behind it', () => {
    process.env.TZ = 'America/Los_Angeles';
    const date = fromLocalDateString('2026-08-17');

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(7);
    expect(date.getDate()).toBe(17);
    // Parsing the same string as an instant would have shown the 16th here.
    expect(new Date('2026-08-17').getDate()).toBe(16);
  });

  it('round-trips with toLocalDateString', () => {
    process.env.TZ = 'Europe/Berlin';
    expect(toLocalDateString(fromLocalDateString('2026-01-05'))).toBe('2026-01-05');
  });
});
