import {
  SERVER_TIME_ZONE,
  addLocalDays,
  resolveTimeZone,
  resolveToday,
  weekdayOfLocalDate,
} from './today.util';

describe('resolveTimeZone', () => {
  it('accepts an IANA zone sent by the client', () => {
    expect(resolveTimeZone('Pacific/Auckland')).toBe('Pacific/Auckland');
  });

  it('falls back to the pinned server zone when the header is absent', () => {
    expect(resolveTimeZone(undefined)).toBe(SERVER_TIME_ZONE);
  });

  it('falls back to the pinned server zone when the header is not a real zone', () => {
    expect(resolveTimeZone('Mars/Olympus_Mons')).toBe(SERVER_TIME_ZONE);
  });

  it('falls back when the header arrived more than once', () => {
    expect(resolveTimeZone(['Europe/Berlin', 'Pacific/Auckland'])).toBe(SERVER_TIME_ZONE);
  });
});

describe('resolveToday', () => {
  // 20:30 UTC on Sunday: already Monday in Auckland, still Sunday evening in Berlin.
  const sundayNight = new Date('2026-08-16T20:30:00.000Z');

  it('answers in the client zone', () => {
    expect(resolveToday('Pacific/Auckland', sundayNight)).toEqual({
      timeZone: 'Pacific/Auckland',
      localDate: '2026-08-17',
      weekday: 1,
    });
  });

  it('answers in the pinned server zone without a header', () => {
    expect(resolveToday(undefined, sundayNight)).toEqual({
      timeZone: SERVER_TIME_ZONE,
      localDate: '2026-08-16',
      weekday: 0,
    });
  });
});

describe('weekdayOfLocalDate', () => {
  it('numbers weekdays like Date.getDay(), 0 = Sunday', () => {
    expect(weekdayOfLocalDate('2026-08-16')).toBe(0);
    expect(weekdayOfLocalDate('2026-08-17')).toBe(1);
    expect(weekdayOfLocalDate('2026-08-22')).toBe(6);
  });
});

describe('addLocalDays', () => {
  it('walks the calendar without going through an instant', () => {
    expect(addLocalDays('2026-08-16', 0)).toBe('2026-08-16');
    expect(addLocalDays('2026-08-30', 7)).toBe('2026-09-06');
  });

  it('crosses a DST change without losing or gaining a day', () => {
    // Europe/Berlin turns the clocks back on 2026-10-25.
    expect(addLocalDays('2026-10-24', 2)).toBe('2026-10-26');
  });
});
