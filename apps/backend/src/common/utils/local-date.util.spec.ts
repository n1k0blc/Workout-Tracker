import { isLocalDate } from './local-date.util';

describe('isLocalDate', () => {
  it('accepts a plain YYYY-MM-DD calendar date', () => {
    expect(isLocalDate('2026-08-15')).toBe(true);
  });

  it('accepts a leap day in a leap year', () => {
    expect(isLocalDate('2024-02-29')).toBe(true);
  });

  it('rejects a day that does not exist in its month', () => {
    expect(isLocalDate('2026-02-30')).toBe(false);
    expect(isLocalDate('2025-02-29')).toBe(false);
    expect(isLocalDate('2026-04-31')).toBe(false);
  });

  it('rejects an out-of-range month or day', () => {
    expect(isLocalDate('2026-13-01')).toBe(false);
    expect(isLocalDate('2026-00-10')).toBe(false);
    expect(isLocalDate('2026-08-00')).toBe(false);
  });

  it('rejects an instant -- the point of the field is that it carries no time or zone', () => {
    expect(isLocalDate('2026-08-15T10:00:00.000Z')).toBe(false);
    expect(isLocalDate('2026-08-15 10:00:00')).toBe(false);
  });

  it('rejects unpadded, empty and non-string input', () => {
    expect(isLocalDate('2026-8-15')).toBe(false);
    expect(isLocalDate('')).toBe(false);
    expect(isLocalDate(undefined)).toBe(false);
    expect(isLocalDate(null)).toBe(false);
    expect(isLocalDate(20260815)).toBe(false);
  });
});
