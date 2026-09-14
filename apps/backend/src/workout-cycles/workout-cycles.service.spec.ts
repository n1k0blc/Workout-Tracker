import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { WorkoutCyclesService } from './workout-cycles.service';
import { CreateCycleDto } from './dto';
import { resolveToday } from '../common/utils/today.util';

const exercises = [{ exerciseId: 'exercise-1', order: 1, sets: [{ order: 1, reps: 8 }] }];

/**
 * A cycle whose Monday and Wednesday are already taken. Moving the Wednesday day onto
 * Monday would make "what am I doing on Monday?" ambiguous, which the unique index on
 * (cycleId, weekday) forbids -- the service has to answer with a 400 before the write.
 */
function makeService() {
  const cycle = {
    id: 'cycle-1',
    userId: 'user-1',
    name: 'Push/Pull',
    duration: 8,
    startDate: new Date('2026-08-03T00:00:00.000Z'),
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    status: 'ACTIVE',
    completedAt: null,
    workoutDays: [
      { id: 'day-1', weekday: 1, order: 0, name: 'Push', plannedHomeGymId: null, workouts: [] },
      { id: 'day-2', weekday: 3, order: 1, name: 'Pull', plannedHomeGymId: null, workouts: [] },
    ],
  };

  const tx = {
    workoutCycle: {
      create: jest.fn().mockResolvedValue({ id: 'cycle-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    workoutDay: {
      create: jest.fn().mockResolvedValue({ id: 'day-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    workout: { create: jest.fn().mockResolvedValue({ id: 'blueprint-1' }) },
  };

  const prisma = {
    workoutCycle: {
      findUnique: jest.fn().mockResolvedValue(cycle),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    workoutDay: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const day = cycle.workoutDays.find((candidate) => candidate.id === where.id);
        return day ? { ...day, cycleId: cycle.id } : null;
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(async (cb: (client: typeof tx) => unknown) => cb(tx)),
  };

  const workoutTreeService = { replaceTree: jest.fn() };
  const exercisesService = {
    validateAccessible: jest
      .fn()
      .mockResolvedValue(new Map([['exercise-1', { isUnilateral: false, name: 'Exercise 1' }]])),
  };

  const service = new WorkoutCyclesService(
    prisma as never,
    workoutTreeService as never,
    exercisesService as never,
  );

  return { service, prisma, tx };
}

describe('WorkoutCyclesService weekday uniqueness', () => {
  it('rejects moving a workout day onto a weekday another day in the cycle already holds', async () => {
    const { service, prisma } = makeService();

    const result = service.updateWorkoutDay(
      'cycle-1',
      'day-2',
      { name: 'Pull', weekday: 1 },
      'user-1',
    );
    await expect(result).rejects.toBeInstanceOf(BadRequestException);
    await expect(result).rejects.toMatchObject({ code: 'WORKOUT_DAY_WEEKDAY_TAKEN' });

    expect(prisma.workoutDay.update).not.toHaveBeenCalled();
  });

  it('allows a workout day to be saved on the weekday it already holds', async () => {
    const { service, prisma } = makeService();

    await service.updateWorkoutDay('cycle-1', 'day-2', { name: 'Zug', weekday: 3 }, 'user-1');

    expect(prisma.workoutDay.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'day-2' },
        data: expect.objectContaining({ name: 'Zug', weekday: 3 }),
      }),
    );
  });

  it('allows moving a workout day onto a weekday no other day in the cycle holds', async () => {
    const { service, prisma } = makeService();

    await service.updateWorkoutDay('cycle-1', 'day-2', { name: 'Pull', weekday: 5 }, 'user-1');

    expect(prisma.workoutDay.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'day-2' },
        data: expect.objectContaining({ weekday: 5 }),
      }),
    );
  });

  it('answers 400, not 500, when a concurrent write wins the weekday between check and update', async () => {
    const { service, prisma } = makeService();

    // The conflict check reads the cycle and then writes, so another request can take the
    // weekday in between and leave the index to reject this one.
    prisma.workoutDay.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.2',
        meta: { target: 'WorkoutDay_cycleId_weekday_key' },
      }),
    );

    const result = service.updateWorkoutDay(
      'cycle-1',
      'day-2',
      { name: 'Pull', weekday: 5 },
      'user-1',
    );
    await expect(result).rejects.toBeInstanceOf(BadRequestException);
    await expect(result).rejects.toMatchObject({ code: 'WORKOUT_DAY_WEEKDAY_TAKEN' });
  });

  it('rethrows unrelated database errors instead of reporting them as a weekday conflict', async () => {
    const { service, prisma } = makeService();

    const unrelated = new Error('connection lost');
    prisma.workoutDay.update.mockRejectedValueOnce(unrelated);

    await expect(
      service.updateWorkoutDay('cycle-1', 'day-2', { name: 'Pull', weekday: 5 }, 'user-1'),
    ).rejects.toBe(unrelated);
  });

  it('exchanges both days weekdays atomically when the swap is confirmed', async () => {
    const { service, tx } = makeService();

    // Cycle starts Monday (weekday 1); day-1 holds Monday, day-2 holds Wednesday. Moving
    // day-2 onto Monday with day-1 confirmed as the swap partner should exchange both.
    await service.updateWorkoutDay(
      'cycle-1',
      'day-2',
      { name: 'Pull', weekday: 1, swapWithWorkoutDayId: 'day-1' },
      'user-1',
    );

    const day2Update = tx.workoutDay.update.mock.calls
      .map(([call]: [{ where: { id: string }; data: Record<string, unknown> }]) => call)
      .filter((call) => call.where.id === 'day-2')
      .pop();
    const day1Update = tx.workoutDay.update.mock.calls
      .map(([call]: [{ where: { id: string }; data: Record<string, unknown> }]) => call)
      .filter((call) => call.where.id === 'day-1')
      .pop();

    // day-2 lands on Monday (weekday 1, the start weekday -> order 0) with its own new name.
    expect(day2Update.data).toEqual(
      expect.objectContaining({ name: 'Pull', weekday: 1, order: 0 }),
    );
    // day-1 takes day-2's old weekday (Wednesday, weekday 3 -> order 2) and keeps its own name.
    expect(day1Update.data).toEqual(expect.objectContaining({ weekday: 3, order: 2 }));
    expect(day1Update.data.name).toBeUndefined();
  });

  it('rejects a move onto a taken weekday when no swap partner is confirmed', async () => {
    const { service, tx } = makeService();

    const result = service.updateWorkoutDay(
      'cycle-1',
      'day-2',
      { name: 'Pull', weekday: 1 },
      'user-1',
    );
    await expect(result).rejects.toBeInstanceOf(BadRequestException);
    await expect(result).rejects.toMatchObject({ code: 'WORKOUT_DAY_WEEKDAY_TAKEN' });

    expect(tx.workoutDay.update).not.toHaveBeenCalled();
  });

  it('rejects a swap confirmation naming the wrong partner', async () => {
    const { service, tx } = makeService();

    const result = service.updateWorkoutDay(
      'cycle-1',
      'day-2',
      { name: 'Pull', weekday: 1, swapWithWorkoutDayId: 'some-other-day' },
      'user-1',
    );
    await expect(result).rejects.toBeInstanceOf(BadRequestException);
    await expect(result).rejects.toMatchObject({ code: 'WORKOUT_DAY_WEEKDAY_TAKEN' });

    expect(tx.workoutDay.update).not.toHaveBeenCalled();
  });

  it('answers 400, not 500, when the swap loses a race to a concurrent write', async () => {
    const { service, tx } = makeService();

    tx.workoutDay.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.2',
        meta: { target: 'WorkoutDay_cycleId_weekday_key' },
      }),
    );

    await expect(
      service.updateWorkoutDay(
        'cycle-1',
        'day-2',
        { name: 'Pull', weekday: 1, swapWithWorkoutDayId: 'day-1' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('answers 400, not 500, when the swap loses a race on the (cycleId, order) index', async () => {
    const { service, tx } = makeService();

    // The sentinel-parking dance dodges a clash on this transaction's own rows, but a
    // concurrent write to a *different* day in the same cycle can still win the order index.
    tx.workoutDay.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.2',
        meta: { target: 'WorkoutDay_cycleId_order_key' },
      }),
    );

    const result = service.updateWorkoutDay(
      'cycle-1',
      'day-2',
      { name: 'Pull', weekday: 1, swapWithWorkoutDayId: 'day-1' },
      'user-1',
    );
    await expect(result).rejects.toBeInstanceOf(BadRequestException);
    await expect(result).rejects.toMatchObject({ code: 'CYCLE_CONCURRENT_MODIFICATION' });
  });

  it('rejects creating a cycle whose workout days share a weekday', async () => {
    const { service, prisma } = makeService();

    const dto = {
      name: 'Push/Pull',
      duration: 8,
      startDate: '2026-08-03',
      workoutDays: [
        { weekday: 1, name: 'Push', exercises },
        { weekday: 1, name: 'Pull', exercises },
      ],
    } as CreateCycleDto;

    const result = service.create(dto, 'user-1');
    await expect(result).rejects.toBeInstanceOf(BadRequestException);
    await expect(result).rejects.toMatchObject({ code: 'DUPLICATE_WEEKDAY_IN_CYCLE' });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('WorkoutCyclesService day ordering (#74)', () => {
  it('orders a Sunday-start cycle Sunday, Monday, Friday -- not creation-request order', async () => {
    const { service, tx } = makeService();

    // Sunday=0, Friday=5; the request lists Friday before Sunday to prove order isn't
    // taken from array position anymore.
    const dto = {
      name: 'Full Body',
      duration: 8,
      startDate: '2026-08-02', // a Sunday
      workoutDays: [
        { weekday: 5, name: 'Friday', exercises },
        { weekday: 0, name: 'Sunday', exercises },
        { weekday: 1, name: 'Monday', exercises },
      ],
    } as CreateCycleDto;

    await service.create(dto, 'user-1');

    const orderByWeekday = new Map(
      tx.workoutDay.create.mock.calls.map(
        ([call]: [{ data: { weekday: number; order: number } }]) => [
          call.data.weekday,
          call.data.order,
        ],
      ),
    );

    expect(orderByWeekday.get(0)).toBe(0); // Sunday, the start weekday
    expect(orderByWeekday.get(1)).toBe(1); // Monday
    expect(orderByWeekday.get(5)).toBe(5); // Friday
  });

  it('leaves a Monday-start cycle Monday-first, as before', async () => {
    const { service, tx } = makeService();

    const dto = {
      name: 'Push/Pull',
      duration: 8,
      startDate: '2026-08-03', // a Monday
      workoutDays: [
        { weekday: 3, name: 'Wednesday', exercises },
        { weekday: 1, name: 'Monday', exercises },
      ],
    } as CreateCycleDto;

    await service.create(dto, 'user-1');

    const orderByWeekday = new Map(
      tx.workoutDay.create.mock.calls.map(
        ([call]: [{ data: { weekday: number; order: number } }]) => [
          call.data.weekday,
          call.data.order,
        ],
      ),
    );

    expect(orderByWeekday.get(1)).toBe(0); // Monday, the start weekday
    expect(orderByWeekday.get(3)).toBe(2); // Wednesday
  });

  it('recomputes order when a workout day moves to a different weekday', async () => {
    const { service, prisma } = makeService();

    // Cycle starts Monday (weekday 1); moving day-2 to Friday (weekday 5) anchors it 4 days
    // after the start.
    await service.updateWorkoutDay('cycle-1', 'day-2', { name: 'Pull', weekday: 5 }, 'user-1');

    expect(prisma.workoutDay.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'day-2' },
        data: expect.objectContaining({ weekday: 5, order: 4 }),
      }),
    );
  });

  it('re-anchors every day when the cycle start date moves to a different weekday', async () => {
    const { service, tx } = makeService();

    // Fixture cycle starts Monday (weekday 1) with Monday (day-1) and Wednesday (day-2)
    // workouts. Moving startDate to a Wednesday re-anchors: Wednesday becomes day 0, Monday
    // becomes day 5.
    await service.update('cycle-1', { startDate: '2026-08-05' }, 'user-1');

    const updateCalls = tx.workoutDay.update.mock.calls;
    const finalUpdateForDay1 = updateCalls
      .filter((call: [{ where: { id: string } }]) => call[0].where.id === 'day-1')
      .pop();
    const finalUpdateForDay2 = updateCalls
      .filter((call: [{ where: { id: string } }]) => call[0].where.id === 'day-2')
      .pop();

    expect(finalUpdateForDay1[0].data.order).toBe(5); // Monday, 5 days after a Wednesday start
    expect(finalUpdateForDay2[0].data.order).toBe(0); // Wednesday, the new start weekday
  });

  it('skips re-anchoring when the new start date falls on the same weekday', async () => {
    const { service, tx } = makeService();

    // 2026-08-10 is also a Monday, same as the fixture cycle's original start date -- no day
    // changes its distance from the start weekday, so no order write is needed.
    await service.update('cycle-1', { startDate: '2026-08-10' }, 'user-1');

    expect(tx.workoutDay.update).not.toHaveBeenCalled();
  });
});

describe('WorkoutCyclesService start-date re-anchor conflicts (#88)', () => {
  it('answers 400, not 500, when a concurrent write wins the order index during sentinel parking', async () => {
    const { service, tx } = makeService();

    // Re-anchoring parks every day at a negative sentinel before writing its new order.
    // A concurrent write to the same cycle can take one of those slots mid-window, leaving
    // the (cycleId, order) index to reject this transaction.
    tx.workoutDay.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.2',
        meta: { target: 'WorkoutDay_cycleId_order_key' },
      }),
    );

    // The re-anchor has no single weekday to blame, so it reports the generic race.
    await expect(service.update('cycle-1', { startDate: '2026-08-05' }, 'user-1')).rejects.toThrow(
      'Eine andere Änderung an diesem Zyklus ist dazwischengekommen. Bitte versuche es erneut.',
    );
  });

  it('answers 400, not 500, when a concurrent write wins the weekday index during re-anchoring', async () => {
    const { service, tx } = makeService();

    tx.workoutDay.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.2',
        meta: { target: 'WorkoutDay_cycleId_weekday_key' },
      }),
    );

    // Same message as the order race: the re-anchor never names a weekday itself, so it
    // can't blame one -- and WEEKDAY_NAMES[undefined] must never reach the user.
    await expect(service.update('cycle-1', { startDate: '2026-08-05' }, 'user-1')).rejects.toThrow(
      'Eine andere Änderung an diesem Zyklus ist dazwischengekommen. Bitte versuche es erneut.',
    );
  });

  it('rethrows unrelated database errors raised while re-anchoring', async () => {
    const { service, tx } = makeService();

    const unrelated = new Error('connection lost');
    tx.workoutDay.update.mockRejectedValueOnce(unrelated);

    await expect(service.update('cycle-1', { startDate: '2026-08-05' }, 'user-1')).rejects.toBe(
      unrelated,
    );
  });
});

/**
 * The same instant the dashboard's cycle-progress tests are pinned to: 14:30 in the pinned
 * server zone (Europe/Berlin), already 00:30 the next day in Pacific/Auckland.
 */
const DETAILS_INSTANT = new Date('2026-08-30T12:30:00.000Z');

/** Monday, so the week boundary below falls on a whole week from the cycle start. */
const DETAILS_START = new Date('2026-08-24T00:00:00.000Z');

function makeDetailsService() {
  const prisma = {
    workoutCycle: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'cycle-1',
        userId: 'user-1',
        name: 'Hypertrophy',
        duration: 8,
        startDate: DETAILS_START,
        status: 'ACTIVE',
        completedAt: null,
        workoutDays: [],
      }),
    },
    workout: { findMany: jest.fn().mockResolvedValue([]) },
  };

  return new WorkoutCyclesService(prisma as never, {} as never, {} as never);
}

describe('WorkoutCyclesService cycle-detail week (#89 follow-up)', () => {
  it("counts the week from the client's calendar day, not the server's", async () => {
    const service = makeDetailsService();

    // Auckland has rolled into 2026-08-31 -- 7 days after the start, so week 2.
    await expect(
      service.getCycleDetails(
        'cycle-1',
        'user-1',
        resolveToday('Pacific/Auckland', DETAILS_INSTANT),
      ),
    ).resolves.toMatchObject({ currentWeek: 2, totalWeeks: 8 });

    // Berlin is still on 2026-08-30 -- 6 days after the start, so week 1.
    await expect(
      service.getCycleDetails('cycle-1', 'user-1', resolveToday('Europe/Berlin', DETAILS_INSTANT)),
    ).resolves.toMatchObject({ currentWeek: 1, totalWeeks: 8 });
  });

  it('falls back to the pinned server zone when the request carries no timezone', async () => {
    const service = makeDetailsService();

    await expect(
      service.getCycleDetails('cycle-1', 'user-1', resolveToday(undefined, DETAILS_INSTANT)),
    ).resolves.toMatchObject({ currentWeek: 1 });
  });
});

describe('WorkoutCyclesService ownership scoping (#171)', () => {
  it("findById 404s on another user's cycle", async () => {
    const { service } = makeService();

    const result = service.findById('cycle-1', 'user-2');
    await expect(result).rejects.toBeInstanceOf(NotFoundException);
    await expect(result).rejects.toMatchObject({ code: 'CYCLE_NOT_FOUND' });
  });

  it("getCycleDetails 404s on another user's cycle, with its own message", async () => {
    // getCycleDetails does its own ownership check inline instead of going through
    // findById, so it needs its own coverage rather than inheriting findById's.
    const service = makeDetailsService();
    const result = service.getCycleDetails(
      'cycle-1',
      'user-2',
      resolveToday(undefined, DETAILS_INSTANT),
    );

    await expect(result).rejects.toBeInstanceOf(NotFoundException);
    await expect(result).rejects.toThrow('Zyklus nicht gefunden');
    await expect(result).rejects.toMatchObject({ code: 'CYCLE_NOT_FOUND' });
  });

  it("update 404s on another user's cycle and writes nothing", async () => {
    const { service, prisma } = makeService();

    await expect(service.update('cycle-1', { name: 'Hijacked' }, 'user-2')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("completeCycle 404s on another user's cycle and does not complete it", async () => {
    const { service, prisma } = makeService();

    await expect(service.completeCycle('cycle-1', 'user-2')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(prisma.workoutCycle.update).not.toHaveBeenCalled();
  });

  it("delete 404s on another user's cycle and does not delete it", async () => {
    const { service, prisma } = makeService();

    await expect(service.delete('cycle-1', 'user-2')).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.workoutCycle.delete).not.toHaveBeenCalled();
  });

  it('updateWorkoutDay 404s when the workout day belongs to a different cycle', async () => {
    // day-x exists, but under cycle-2 -- not cycle-1, which the caller (user-1's own cycle)
    // names. This is the day-level lookup's own scoping check, separate from findById's.
    const { service, prisma } = makeService();
    prisma.workoutDay.findUnique.mockResolvedValueOnce({
      id: 'day-x',
      cycleId: 'cycle-2',
      weekday: 2,
      order: 0,
      name: 'Foreign day',
      plannedHomeGymId: null,
      workouts: [],
    });

    await expect(
      service.updateWorkoutDay('cycle-1', 'day-x', { name: 'Hijack', weekday: 5 }, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.workoutDay.update).not.toHaveBeenCalled();
  });

  it('updateBlueprint 404s when the workout day belongs to a different cycle', async () => {
    const { service, prisma } = makeService();
    // A non-empty workouts array so, if the cycleId check were ever removed, execution
    // would reach $transaction instead of tripping the separate "Blueprint not found"
    // guard for an unrelated reason -- that would make this test pass either way.
    prisma.workoutDay.findUnique.mockResolvedValueOnce({
      id: 'day-x',
      cycleId: 'cycle-2',
      weekday: 2,
      order: 0,
      name: 'Foreign day',
      plannedHomeGymId: null,
      workouts: [{ id: 'blueprint-x' }],
    });

    const result = service.updateBlueprint('cycle-1', 'day-x', { exercises } as never, 'user-1');
    await expect(result).rejects.toBeInstanceOf(NotFoundException);
    await expect(result).rejects.toMatchObject({ code: 'WORKOUT_DAY_NOT_FOUND' });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
