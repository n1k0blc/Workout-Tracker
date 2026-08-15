import { describe, expect, it } from 'vitest';
import { getWeekdayDistanceFromCycleStart, sortByCycleWeekday } from './weekday';

describe('getWeekdayDistanceFromCycleStart', () => {
  it('anchors a Sunday-start week Sunday-first, ahead of Monday and Friday', () => {
    expect(getWeekdayDistanceFromCycleStart(0, 0)).toBe(0); // Sunday
    expect(getWeekdayDistanceFromCycleStart(1, 0)).toBe(1); // Monday
    expect(getWeekdayDistanceFromCycleStart(5, 0)).toBe(5); // Friday
  });

  it('leaves a Monday-start week Monday-first', () => {
    expect(getWeekdayDistanceFromCycleStart(1, 1)).toBe(0); // Monday
    expect(getWeekdayDistanceFromCycleStart(3, 1)).toBe(2); // Wednesday
    expect(getWeekdayDistanceFromCycleStart(0, 1)).toBe(6); // Sunday
  });
});

describe('sortByCycleWeekday', () => {
  it('reads Sunday, Monday, Friday for a Sunday-anchored cycle', () => {
    const days = [
      { weekday: 5, name: 'Friday' },
      { weekday: 0, name: 'Sunday' },
      { weekday: 1, name: 'Monday' },
    ];

    expect(sortByCycleWeekday(days, '2026-08-02').map((d) => d.name)).toEqual([
      'Sunday',
      'Monday',
      'Friday',
    ]);
  });

  it('reads Monday-first for a Monday-anchored cycle, unaffected', () => {
    const days = [
      { weekday: 3, name: 'Wednesday' },
      { weekday: 1, name: 'Monday' },
    ];

    expect(sortByCycleWeekday(days, '2026-08-03').map((d) => d.name)).toEqual([
      'Monday',
      'Wednesday',
    ]);
  });

  it('does not mutate the input array', () => {
    const days = [{ weekday: 5, name: 'Friday' }, { weekday: 0, name: 'Sunday' }];
    const original = [...days];

    sortByCycleWeekday(days, '2026-08-02');

    expect(days).toEqual(original);
  });
});
