import { BadRequestException } from '@nestjs/common';
import { NutritionAnalyticsService } from './nutrition-analytics.service';

/**
 * The Ernährungs-Analytics daily series (#153), driven through the service with a mocked
 * Prisma client (the same seam as the other nutrition specs). Covered here:
 *
 *  - entries are summed per `localDate` into one day total
 *  - every calendar day in [start, end] is present, days with no entries as zeros (no gaps)
 *  - entries outside [start, end] do not leak into the series
 *  - each day carries its weekday (0 = Sunday)
 *  - the Tagesziele ride along, null unless at least one is set
 *  - an inverted or over-long range is a 400
 */

type EntryRow = {
  localDate: string;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
};

function makeService(
  entries: EntryRow[],
  targets: {
    targetKcal: number | null;
    targetCarbs: number | null;
    targetProtein: number | null;
    targetFat: number | null;
  } | null = null,
) {
  const prisma = {
    diaryEntry: {
      findMany: jest.fn().mockResolvedValue(entries),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(
        targets ?? {
          targetKcal: null,
          targetCarbs: null,
          targetProtein: null,
          targetFat: null,
        },
      ),
    },
  };
  return {
    service: new NutritionAnalyticsService(prisma as never),
    prisma,
  };
}

describe('NutritionAnalyticsService.getTrend — aggregation by localDate', () => {
  it('sums every entry that shares a localDate into that day', async () => {
    const { service } = makeService([
      { localDate: '2026-09-07', kcal: 500, carbs: 40, protein: 20, fat: 15 },
      { localDate: '2026-09-07', kcal: 300, carbs: 10, protein: 25, fat: 8 },
      { localDate: '2026-09-08', kcal: 900, carbs: 90, protein: 40, fat: 30 },
    ]);

    const result = await service.getTrend('user-1', '2026-09-07', '2026-09-08');

    expect(result.days).toEqual([
      { date: '2026-09-07', weekday: 1, kcal: 800, carbs: 50, protein: 45, fat: 23 },
      { date: '2026-09-08', weekday: 2, kcal: 900, carbs: 90, protein: 40, fat: 30 },
    ]);
  });

  it('queries only the requested user and range', async () => {
    const { service, prisma } = makeService([]);

    await service.getTrend('user-1', '2026-09-01', '2026-09-07');

    expect(prisma.diaryEntry.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', localDate: { gte: '2026-09-01', lte: '2026-09-07' } },
      select: { localDate: true, kcal: true, carbs: true, protein: true, fat: true },
    });
  });
});

describe('NutritionAnalyticsService.getTrend — range boundaries', () => {
  it('emits one row per calendar day in the inclusive range, zero-filled', async () => {
    const { service } = makeService([
      { localDate: '2026-09-03', kcal: 1800, carbs: 150, protein: 100, fat: 60 },
    ]);

    const result = await service.getTrend('user-1', '2026-09-01', '2026-09-05');

    expect(result.days.map((d) => d.date)).toEqual([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
    ]);
    expect(result.days[0]).toEqual({
      date: '2026-09-01',
      weekday: 2,
      kcal: 0,
      carbs: 0,
      protein: 0,
      fat: 0,
    });
    expect(result.days[2].kcal).toBe(1800);
    expect(result.start).toBe('2026-09-01');
    expect(result.end).toBe('2026-09-05');
  });

  it('is inclusive of both endpoints for a single-day range', async () => {
    const { service } = makeService([
      { localDate: '2026-09-04', kcal: 2000, carbs: 200, protein: 120, fat: 70 },
    ]);

    const result = await service.getTrend('user-1', '2026-09-04', '2026-09-04');

    expect(result.days).toHaveLength(1);
    expect(result.days[0]).toEqual({
      date: '2026-09-04',
      weekday: 5,
      kcal: 2000,
      carbs: 200,
      protein: 120,
      fat: 70,
    });
  });

  it('crosses a month boundary without dropping or duplicating a day', async () => {
    const { service } = makeService([]);

    const result = await service.getTrend('user-1', '2026-01-30', '2026-02-02');

    expect(result.days.map((d) => d.date)).toEqual([
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
      '2026-02-02',
    ]);
  });

  it('rejects an end before the start', async () => {
    const { service } = makeService([]);

    await expect(
      service.getTrend('user-1', '2026-09-10', '2026-09-01'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a range longer than a year', async () => {
    const { service } = makeService([]);

    await expect(
      service.getTrend('user-1', '2025-01-01', '2026-06-01'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('NutritionAnalyticsService.getTrend — Tagesziele', () => {
  it('returns null targets when the user has set none', async () => {
    const { service } = makeService([]);

    const result = await service.getTrend('user-1', '2026-09-01', '2026-09-02');

    expect(result.targets).toBeNull();
  });

  it('returns the whole object when at least one target is set', async () => {
    const { service } = makeService([], {
      targetKcal: 2400,
      targetCarbs: null,
      targetProtein: 150,
      targetFat: null,
    });

    const result = await service.getTrend('user-1', '2026-09-01', '2026-09-02');

    expect(result.targets).toEqual({
      kcal: 2400,
      carbs: null,
      protein: 150,
      fat: null,
    });
  });
});
