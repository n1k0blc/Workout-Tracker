import { WorkoutsService } from './workouts.service';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { UpdateWorkoutDto } from './dto/update-workout.dto';
import { SetType } from '../../generated/prisma/client';

const exercises = [
  {
    exerciseId: 'exercise-1',
    order: 1,
    sets: [{ order: 1, setType: SetType.WORKING, reps: 8, weight: 100 }],
  },
];

/**
 * A late-night session: logged Friday 23:30 in Berlin, which is already Saturday in UTC.
 * The instant and the calendar day genuinely disagree here, which is the whole point of
 * storing the day the client observed instead of deriving it on read.
 */
const lateNight = {
  date: '2026-08-15T21:30:00.000Z',
  localDate: '2026-08-15',
};

function makeService() {
  const created = { id: 'workout-1' };
  const tx = {
    workout: {
      create: jest.fn().mockResolvedValue(created),
      update: jest.fn().mockResolvedValue(created),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };
  const prisma = {
    workout: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'workout-1',
        kind: 'WORKOUT',
        userId: 'user-1',
        date: new Date(lateNight.date),
        localDate: lateNight.localDate,
        isFreeWorkout: true,
        totalDuration: 3600,
        exercises: [],
      }),
    },
    workoutDay: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'day-1',
        cycleId: 'cycle-1',
        plannedHomeGymId: null,
        cycle: { userId: 'user-1', startDate: new Date('2026-08-01T00:00:00.000Z') },
      }),
    },
    $transaction: jest.fn(async (cb: (client: typeof tx) => unknown) => cb(tx)),
  };
  const workoutTreeService = { replaceTree: jest.fn() };
  const exercisesService = {
    validateAccessible: jest
      .fn()
      .mockResolvedValue(new Map([['exercise-1', { isUnilateral: false, name: 'Exercise 1' }]])),
  };

  const service = new WorkoutsService(
    prisma as never,
    workoutTreeService as never,
    exercisesService as never,
  );

  return { service, prisma, tx, workoutTreeService, exercisesService };
}

describe('WorkoutsService localDate', () => {
  it('stores the local calendar day the client reported, not the day of the instant', async () => {
    const { service, tx } = makeService();

    const dto: CreateWorkoutDto = {
      ...lateNight,
      isFreeWorkout: true,
      exercises,
    } as CreateWorkoutDto;

    await service.create(dto, 'user-1');

    expect(tx.workout.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          localDate: '2026-08-15',
          date: new Date('2026-08-15T21:30:00.000Z'),
        }),
      }),
    );
  });

  it('stores a past workout\'s picked date verbatim, with no timezone arithmetic', async () => {
    const { service, tx } = makeService();

    const dto: CreateWorkoutDto = {
      date: '2026-07-02T00:00:00.000Z',
      localDate: '2026-07-02',
      isFreeWorkout: true,
      exercises,
    } as CreateWorkoutDto;

    await service.create(dto, 'user-1');

    expect(tx.workout.create.mock.calls[0][0].data.localDate).toBe('2026-07-02');
  });

  it('returns the stored localDate so a history edit can send it back unchanged', async () => {
    const { service } = makeService();

    const workout = await service.findById('workout-1', 'user-1');

    expect(workout.localDate).toBe('2026-08-15');
  });

  it('updates localDate when the edit supplies one', async () => {
    const { service, tx } = makeService();

    await service.update('workout-1', { localDate: '2026-07-02' } as UpdateWorkoutDto, 'user-1');

    expect(tx.workout.update.mock.calls[0][0].data.localDate).toBe('2026-07-02');
  });

  it('leaves the stored localDate alone when the edit omits it', async () => {
    const { service, tx } = makeService();

    await service.update('workout-1', { totalDuration: 1800 } as UpdateWorkoutDto, 'user-1');

    expect(tx.workout.update.mock.calls[0][0].data).not.toHaveProperty('localDate');
  });
});

describe('WorkoutsService per-side aggregates (#100)', () => {
  it('hands replaceTree the server-derived reps/weight/rir for a unilateral set, not the client values', async () => {
    const { service, workoutTreeService, exercisesService } = makeService();
    exercisesService.validateAccessible.mockResolvedValue(
      new Map([['exercise-1', { isUnilateral: true, name: 'Split Squat' }]]),
    );

    const dto: CreateWorkoutDto = {
      ...lateNight,
      isFreeWorkout: true,
      exercises: [
        {
          exerciseId: 'exercise-1',
          order: 1,
          sets: [
            {
              order: 1,
              setType: SetType.WORKING,
              reps: 999,
              weight: 999,
              rir: 9,
              repsLeft: 10,
              repsRight: 9,
              weightLeft: 40,
              weightRight: 45,
              rirLeft: 3,
              rirRight: 1,
            },
          ],
        },
      ],
    } as CreateWorkoutDto;

    await service.create(dto, 'user-1');

    // replaceTree is the one write that persists the tree; the aggregates it receives are what
    // every analytics endpoint later reads.
    const [, , exerciseInputs] = workoutTreeService.replaceTree.mock.calls[0];
    expect(exerciseInputs[0].sets[0]).toMatchObject({
      reps: 10, // round(avg(10, 9))
      weight: 42.5, // avg(40, 45)
      rir: 1, // min(3, 1)
    });
  });

  it('rejects a bilateral exercise whose set carries per-side data', async () => {
    const { service } = makeService(); // validateAccessible defaults exercise-1 to bilateral

    const dto: CreateWorkoutDto = {
      ...lateNight,
      isFreeWorkout: true,
      exercises: [
        {
          exerciseId: 'exercise-1',
          order: 1,
          sets: [
            { order: 1, setType: SetType.WORKING, reps: 10, weight: 40, repsLeft: 10, repsRight: 10 },
          ],
        },
      ],
    } as CreateWorkoutDto;

    await expect(service.create(dto, 'user-1')).rejects.toThrow(/bilateral/);
  });
});

describe('WorkoutsService cycle start boundary', () => {
  it('refuses to start a cycle workout dated before the cycle begins', async () => {
    const { service, prisma } = makeService();
    prisma.workoutDay.findUnique.mockResolvedValue({
      id: 'day-1',
      cycleId: 'cycle-1',
      plannedHomeGymId: null,
      // Built Thursday for a cycle starting the following Monday.
      cycle: { userId: 'user-1', startDate: new Date('2026-08-24T00:00:00.000Z') },
    });

    const dto: CreateWorkoutDto = {
      date: '2026-08-20T12:00:00.000Z',
      localDate: '2026-08-20',
      cycleId: 'cycle-1',
      workoutDayId: 'day-1',
      exercises,
    } as CreateWorkoutDto;

    await expect(service.create(dto, 'user-1')).rejects.toThrow(
      'Dieser Zyklus hat noch nicht begonnen.',
    );
  });

  it('allows starting a cycle workout dated on the cycle start date', async () => {
    const { service, tx, prisma } = makeService();
    prisma.workoutDay.findUnique.mockResolvedValue({
      id: 'day-1',
      cycleId: 'cycle-1',
      plannedHomeGymId: null,
      cycle: { userId: 'user-1', startDate: new Date('2026-08-24T00:00:00.000Z') },
    });

    const dto: CreateWorkoutDto = {
      date: '2026-08-24T12:00:00.000Z',
      localDate: '2026-08-24',
      cycleId: 'cycle-1',
      workoutDayId: 'day-1',
      exercises,
    } as CreateWorkoutDto;

    await service.create(dto, 'user-1');

    expect(tx.workout.create).toHaveBeenCalled();
  });

  it('refuses a history edit that moves a cycle workout to a date before the cycle begins', async () => {
    const { service, prisma } = makeService();
    prisma.workoutDay.findUnique.mockResolvedValue({
      id: 'day-1',
      cycleId: 'cycle-1',
      plannedHomeGymId: null,
      cycle: { userId: 'user-1', startDate: new Date('2026-08-24T00:00:00.000Z') },
    });

    const dto: UpdateWorkoutDto = {
      workoutDayId: 'day-1',
      cycleId: 'cycle-1',
    } as UpdateWorkoutDto;

    // The existing workout's own localDate (2026-08-15) is what's left to compare
    // once the edit doesn't supply a new one.
    await expect(service.update('workout-1', dto, 'user-1')).rejects.toThrow(
      'Dieser Zyklus hat noch nicht begonnen.',
    );
  });
});
