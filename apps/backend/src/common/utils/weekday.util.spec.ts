import { cycleStartWeekday, getWeekdayDistanceFromCycleStart } from './weekday.util';

describe('getWeekdayDistanceFromCycleStart', () => {
  it('returns 0 for the start weekday itself', () => {
    expect(getWeekdayDistanceFromCycleStart(1, 1)).toBe(0);
  });

  it('anchors a Monday-start week Monday-first (0..6)', () => {
    // Monday=1 .. Sunday=0
    expect(getWeekdayDistanceFromCycleStart(1, 1)).toBe(0); // Monday
    expect(getWeekdayDistanceFromCycleStart(5, 1)).toBe(4); // Friday
    expect(getWeekdayDistanceFromCycleStart(0, 1)).toBe(6); // Sunday
  });

  it('anchors a Sunday-start week Sunday-first, ahead of Monday and Friday', () => {
    // Sunday=0, Monday=1, Friday=5
    expect(getWeekdayDistanceFromCycleStart(0, 0)).toBe(0); // Sunday
    expect(getWeekdayDistanceFromCycleStart(1, 0)).toBe(1); // Monday
    expect(getWeekdayDistanceFromCycleStart(5, 0)).toBe(5); // Friday
  });

  it('produces a unique value per weekday for a fixed start, so it is safe as a sort key', () => {
    const startWeekday = 3;
    const distances = [0, 1, 2, 3, 4, 5, 6].map((weekday) =>
      getWeekdayDistanceFromCycleStart(weekday, startWeekday),
    );
    expect(new Set(distances).size).toBe(7);
  });
});

describe('cycleStartWeekday', () => {
  // 2026-08-23 is a Sunday.
  it('returns the UTC weekday of a stored Date startDate', () => {
    expect(cycleStartWeekday(new Date('2026-08-23T00:00:00.000Z'))).toBe(0);
    expect(cycleStartWeekday(new Date('2026-08-24T00:00:00.000Z'))).toBe(1);
  });

  it('accepts the @IsDateString form a create/update DTO carries', () => {
    expect(cycleStartWeekday('2026-08-23')).toBe(0);
    expect(cycleStartWeekday('2026-08-28T00:00:00.000Z')).toBe(5);
  });

  it('matches the old inline new Date(startDate).getUTCDay()', () => {
    for (const iso of ['2026-01-01', '2026-06-15T12:00:00.000Z', '2026-12-31']) {
      expect(cycleStartWeekday(iso)).toBe(new Date(iso).getUTCDay());
    }
  });
});
