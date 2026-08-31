import { DashboardService } from './dashboard.service';
import { Today, resolveToday } from '../common/utils/today.util';

/**
 * The one instant these tests are written against: 2026-08-30 14:30 in the pinned server zone
 * (Europe/Berlin, UTC+2 in summer), which is already 2026-08-31 00:30 in Pacific/Auckland.
 * A client just past its own midnight and a server still on the previous day must not
 * disagree about which cycle week it is.
 */
const INSTANT = new Date('2026-08-30T12:30:00.000Z');

/** Monday, so the week boundaries below fall on whole weeks from the cycle start. */
const CYCLE_START = new Date('2026-08-24T00:00:00.000Z');

function today(timeZone?: string): Today {
  return resolveToday(timeZone, INSTANT);
}

type Cycle = { name: string; startDate: Date; duration: number | null };

function makeService(cycles: Cycle[]) {
  const prisma = {
    workoutCycle: {
      // Mirrors the `startDate: { lte }` filter the service issues, so the lookup boundary
      // is exercised rather than stubbed away.
      findFirst: jest.fn(async ({ where }: { where: { startDate: { lte: Date } } }) => {
        return (
          cycles.find((cycle) => cycle.startDate.getTime() <= where.startDate.lte.getTime()) ?? null
        );
      }),
    },
  };

  return new DashboardService(prisma as never, {} as never);
}

describe('getCycleProgress', () => {
  it("counts the week from the client's calendar day, not the server's", async () => {
    const service = makeService([{ name: 'Hypertrophy', startDate: CYCLE_START, duration: 8 }]);

    // Auckland has rolled into 2026-08-31 -- 7 days after the start, so week 2.
    expect(await service.getCycleProgress('user-1', today('Pacific/Auckland'))).toMatchObject({
      currentWeek: 2,
      totalWeeks: 8,
    });

    // Berlin is still on 2026-08-30 -- 6 days after the start, so week 1.
    expect(await service.getCycleProgress('user-1', today('Europe/Berlin'))).toMatchObject({
      currentWeek: 1,
      totalWeeks: 8,
    });
  });

  it("finds a cycle that has started on the client's day but not on the server's", async () => {
    const service = makeService([
      { name: 'Hypertrophy', startDate: new Date('2026-08-31T00:00:00.000Z'), duration: 8 },
    ]);

    expect(await service.getCycleProgress('user-1', today('Pacific/Auckland'))).toMatchObject({
      currentWeek: 1,
      cycleName: 'Hypertrophy',
    });
    expect(await service.getCycleProgress('user-1', today('Europe/Berlin'))).toBeNull();
  });

  it('falls back to the pinned server zone when the request carries no timezone', async () => {
    const service = makeService([{ name: 'Hypertrophy', startDate: CYCLE_START, duration: 8 }]);

    expect(await service.getCycleProgress('user-1', today(undefined))).toMatchObject({
      currentWeek: 1,
    });
  });

  it('reports no progress for a cycle without a duration', async () => {
    const service = makeService([{ name: 'Open-ended', startDate: CYCLE_START, duration: null }]);

    expect(await service.getCycleProgress('user-1', today('Pacific/Auckland'))).toBeNull();
  });
});
