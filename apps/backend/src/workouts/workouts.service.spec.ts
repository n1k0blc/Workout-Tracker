import { WorkoutsService } from './workouts.service';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { UpdateWorkoutDto } from './dto/update-workout.dto';
import { SetType } from '@prisma/client';

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
    $transaction: jest.fn(async (cb: (client: typeof tx) => unknown) => cb(tx)),
  };
  const workoutTreeService = { replaceTree: jest.fn() };
  const exercisesService = { validateAccessible: jest.fn() };

  const service = new WorkoutsService(
    prisma as never,
    workoutTreeService as never,
    exercisesService as never,
  );

  return { service, prisma, tx };
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
