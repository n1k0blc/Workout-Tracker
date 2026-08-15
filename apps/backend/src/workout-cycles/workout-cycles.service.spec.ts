import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WorkoutCyclesService } from './workout-cycles.service';
import { CreateCycleDto } from './dto';

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
  const exercisesService = { validateAccessible: jest.fn() };

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

    await expect(
      service.updateWorkoutDay('cycle-1', 'day-2', { name: 'Pull', weekday: 1 }, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

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

    await expect(
      service.updateWorkoutDay('cycle-1', 'day-2', { name: 'Pull', weekday: 5 }, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
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

    await expect(
      service.updateWorkoutDay('cycle-1', 'day-2', { name: 'Pull', weekday: 1 }, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.workoutDay.update).not.toHaveBeenCalled();
  });

  it('rejects a swap confirmation naming the wrong partner', async () => {
    const { service, tx } = makeService();

    await expect(
      service.updateWorkoutDay(
        'cycle-1',
        'day-2',
        { name: 'Pull', weekday: 1, swapWithWorkoutDayId: 'some-other-day' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

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

    await expect(
      service.updateWorkoutDay(
        'cycle-1',
        'day-2',
        { name: 'Pull', weekday: 1, swapWithWorkoutDayId: 'day-1' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
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

    await expect(service.create(dto, 'user-1')).rejects.toBeInstanceOf(BadRequestException);

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
      tx.workoutDay.create.mock.calls.map(([call]: [{ data: { weekday: number; order: number } }]) => [
        call.data.weekday,
        call.data.order,
      ]),
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
      tx.workoutDay.create.mock.calls.map(([call]: [{ data: { weekday: number; order: number } }]) => [
        call.data.weekday,
        call.data.order,
      ]),
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
    const finalUpdateForDay1 = updateCalls.filter((call: [{ where: { id: string } }]) => call[0].where.id === 'day-1').pop();
    const finalUpdateForDay2 = updateCalls.filter((call: [{ where: { id: string } }]) => call[0].where.id === 'day-2').pop();

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
