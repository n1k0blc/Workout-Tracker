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
    workoutCycle: { create: jest.fn().mockResolvedValue({ id: 'cycle-1' }) },
    workoutDay: { create: jest.fn().mockResolvedValue({ id: 'day-1' }) },
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

  return { service, prisma };
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
