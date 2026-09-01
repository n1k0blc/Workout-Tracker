import { WorkoutsService } from './workouts.service';
import { SetType } from '../../generated/prisma/client';

/**
 * Covers the gym cascade (issue #112): each step it can land on, the exclusion of the
 * currently-open workout, and that a workout dated today still qualifies.
 */
function makeService() {
  const prisma = {
    workout: {
      findFirst: jest.fn(),
    },
  };
  const service = new WorkoutsService(
    prisma as never,
    { replaceTree: jest.fn() } as never,
    { validateAccessible: jest.fn() } as never,
  );
  return { service, prisma };
}

const performedExercise = (over: Partial<Record<string, unknown>> = {}) => ({
  exerciseId: 'ex-1',
  sets: [
    {
      order: 1,
      setType: SetType.WORKING,
      reps: 8,
      weight: 100,
      rir: 2,
      repsLeft: null,
      repsRight: null,
      weightLeft: null,
      weightRight: null,
      rirLeft: null,
      rirRight: null,
    },
  ],
  ...over,
});

const workoutRow = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'w-1',
  localDate: '2026-08-20',
  homeGymId: 'gym-1',
  homeGym: { id: 'gym-1', name: 'Home Gym' },
  exercises: [performedExercise()],
  ...over,
});

describe('WorkoutsService.findExerciseLastPerformance', () => {
  it('returns the gym-of-context match as CURRENT_GYM and does not run later cascade steps', async () => {
    const { service, prisma } = makeService();
    prisma.workout.findFirst.mockResolvedValueOnce(workoutRow());

    const result = await service.findExerciseLastPerformance('user-1', 'ex-1', 'gym-1');

    expect(result).toEqual({
      exerciseId: 'ex-1',
      source: 'CURRENT_GYM',
      performedOn: '2026-08-20',
      gymId: 'gym-1',
      gymName: 'Home Gym',
      sets: [
        {
          setType: SetType.WORKING,
          reps: 8,
          weight: 100,
          rir: 2,
          repsLeft: undefined,
          repsRight: undefined,
          weightLeft: undefined,
          weightRight: undefined,
          rirLeft: undefined,
          rirRight: undefined,
        },
      ],
    });
    expect(prisma.workout.findFirst).toHaveBeenCalledTimes(1);
    const args = prisma.workout.findFirst.mock.calls[0][0];
    expect(args.where).toMatchObject({ userId: 'user-1', kind: 'WORKOUT', homeGymId: 'gym-1', exercises: { some: { exerciseId: 'ex-1' } } });
    expect(args.orderBy).toEqual({ date: 'desc' });
  });

  it('falls back to another home gym as HOME_GYM when the context gym has nothing', async () => {
    const { service, prisma } = makeService();
    prisma.workout.findFirst
      .mockResolvedValueOnce(null) // CURRENT_GYM miss
      .mockResolvedValueOnce(workoutRow({ homeGymId: 'gym-2', homeGym: { id: 'gym-2', name: 'Other Home' } }));

    const result = await service.findExerciseLastPerformance('user-1', 'ex-1', 'gym-1');

    expect(result?.source).toBe('HOME_GYM');
    expect(result?.gymName).toBe('Other Home');
    expect(prisma.workout.findFirst).toHaveBeenCalledTimes(2);
    expect(prisma.workout.findFirst.mock.calls[1][0].where.homeGymId).toEqual({ not: null });
  });

  it('falls back to any workout as ANY_GYM, reporting a null gym name for "Anderes Gym"', async () => {
    const { service, prisma } = makeService();
    prisma.workout.findFirst
      .mockResolvedValueOnce(null) // CURRENT_GYM
      .mockResolvedValueOnce(null) // HOME_GYM
      .mockResolvedValueOnce(workoutRow({ homeGymId: null, homeGym: null }));

    const result = await service.findExerciseLastPerformance('user-1', 'ex-1', 'gym-1');

    expect(result?.source).toBe('ANY_GYM');
    expect(result?.gymId).toBeNull();
    expect(result?.gymName).toBeNull();
    expect(prisma.workout.findFirst.mock.calls[2][0].where).not.toHaveProperty('homeGymId');
  });

  it('starts the cascade at "any home gym" when no context gym is given', async () => {
    const { service, prisma } = makeService();
    prisma.workout.findFirst.mockResolvedValueOnce(workoutRow());

    const result = await service.findExerciseLastPerformance('user-1', 'ex-1');

    expect(result?.source).toBe('HOME_GYM');
    expect(prisma.workout.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.workout.findFirst.mock.calls[0][0].where.homeGymId).toEqual({ not: null });
  });

  it('returns null when the exercise was never performed', async () => {
    const { service, prisma } = makeService();
    prisma.workout.findFirst.mockResolvedValue(null);

    const result = await service.findExerciseLastPerformance('user-1', 'ex-1', 'gym-1');

    expect(result).toBeNull();
    expect(prisma.workout.findFirst).toHaveBeenCalledTimes(3);
  });

  it('excludes the currently-open workout from every cascade step', async () => {
    const { service, prisma } = makeService();
    prisma.workout.findFirst.mockResolvedValueOnce(workoutRow());

    await service.findExerciseLastPerformance('user-1', 'ex-1', 'gym-1', 'open-workout-id');

    expect(prisma.workout.findFirst.mock.calls[0][0].where.id).toEqual({ not: 'open-workout-id' });
  });

  it('includes a workout dated today -- no upper bound on the date', async () => {
    const { service, prisma } = makeService();
    const today = new Date().toISOString().slice(0, 10);
    prisma.workout.findFirst.mockResolvedValueOnce(workoutRow({ localDate: today }));

    const result = await service.findExerciseLastPerformance('user-1', 'ex-1', 'gym-1');

    expect(result?.performedOn).toBe(today);
    const args = prisma.workout.findFirst.mock.calls[0][0];
    expect(args.where).not.toHaveProperty('date');
    expect(args.where).not.toHaveProperty('localDate');
  });

  it('keys on WorkoutExercise.exerciseId only, so a soft-deleted exercise still counts as a source', async () => {
    const { service, prisma } = makeService();
    prisma.workout.findFirst.mockResolvedValueOnce(workoutRow());

    await service.findExerciseLastPerformance('user-1', 'ex-1', 'gym-1');

    // No `Exercise`/`deletedAt` predicate anywhere in the filter -- the lookup never inspects
    // the catalogue row, so a since-deleted exercise is found exactly like a live one.
    const where = prisma.workout.findFirst.mock.calls[0][0].where;
    expect(where.exercises).toEqual({ some: { exerciseId: 'ex-1' } });
    expect(JSON.stringify(where)).not.toContain('deletedAt');
  });
});
