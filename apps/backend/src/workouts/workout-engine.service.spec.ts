import { WorkoutEngineService } from './workout-engine.service';
import { Today, resolveToday } from '../common/utils/today.util';

/** Monday/Wednesday/Saturday, the cycle shape the acceptance criteria are written against. */
function cycleDays() {
  return [
    { id: 'day-mon', name: 'Push', weekday: 1, order: 1, plannedHomeGymId: null, workouts: [{ exercises: [] }] },
    { id: 'day-wed', name: 'Pull', weekday: 3, order: 2, plannedHomeGymId: null, workouts: [{ exercises: [] }] },
    { id: 'day-sat', name: 'Legs', weekday: 6, order: 3, plannedHomeGymId: null, workouts: [{ exercises: [] }] },
  ];
}

function makeService(options: { workoutDays?: ReturnType<typeof cycleDays>; loggedDates?: string[] } = {}) {
  const loggedDates = options.loggedDates ?? [];
  const prisma = {
    workoutCycle: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'cycle-1',
        name: 'Hypertrophy',
        // Started well before the dates under test, long enough not to expire during them.
        startDate: new Date('2026-06-01T00:00:00.000Z'),
        duration: 52,
        workoutDays: options.workoutDays ?? cycleDays(),
      }),
    },
    workout: {
      count: jest.fn(async ({ where }: { where: { localDate: string } }) =>
        loggedDates.filter((date) => date === where.localDate).length,
      ),
    },
  };

  return { service: new WorkoutEngineService(prisma as never), prisma };
}

/** A local day in the pinned server zone -- the tests care about the weekday, not the zone. */
function today(localDate: string): Today {
  return resolveToday(undefined, new Date(`${localDate}T12:00:00.000Z`));
}

const MONDAY = '2026-08-17';
const TUESDAY = '2026-08-18';
const THURSDAY = '2026-08-20';
const SATURDAY = '2026-08-22';
const SUNDAY = '2026-08-23';

describe('getSuggestedWorkout', () => {
  it('recommends the cycle day whose weekday is today', async () => {
    const { service } = makeService();

    const suggested = await service.getSuggestedWorkout('user-1', today(MONDAY));

    expect(suggested).toMatchObject({ workoutDayId: 'day-mon', weekday: 1 });
  });

  it('recommends nothing on a day with no workout planned', async () => {
    const { service } = makeService();

    expect(await service.getSuggestedWorkout('user-1', today(TUESDAY))).toBeNull();
  });

  it("recommends nothing once any workout carries today's local date", async () => {
    const { service } = makeService({ loggedDates: [MONDAY] });

    expect(await service.getSuggestedWorkout('user-1', today(MONDAY))).toBeNull();
  });

  it('counts the day as done regardless of which workout was logged', async () => {
    const { service, prisma } = makeService({ loggedDates: [MONDAY] });

    await service.getSuggestedWorkout('user-1', today(MONDAY));

    expect(prisma.workout.count).toHaveBeenCalledWith({
      where: { userId: 'user-1', kind: 'WORKOUT', localDate: MONDAY },
    });
  });

  it('never re-offers a skipped day on a later weekday', async () => {
    const { service } = makeService();

    // Saturday was skipped; Sunday plans nothing, and Monday is Monday's workout.
    expect(await service.getSuggestedWorkout('user-1', today(SUNDAY))).toBeNull();
    expect(await service.getSuggestedWorkout('user-1', today(MONDAY))).toMatchObject({
      workoutDayId: 'day-mon',
    });
  });

  it('recommends nothing when the cycle day has no blueprint yet', async () => {
    const { service } = makeService({
      workoutDays: [{ ...cycleDays()[0], workouts: [] }],
    });

    expect(await service.getSuggestedWorkout('user-1', today(MONDAY))).toBeNull();
  });

  it('recommends nothing once the cycle has run out', async () => {
    const { service, prisma } = makeService();
    prisma.workoutCycle.findFirst.mockResolvedValue({
      id: 'cycle-1',
      name: 'Hypertrophy',
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      duration: 4, // ends 2026-06-29, long before the Monday under test
      workoutDays: cycleDays(),
    });

    expect(await service.getSuggestedWorkout('user-1', today(MONDAY))).toBeNull();
  });

  it('recommends nothing when there is no active cycle', async () => {
    const { service, prisma } = makeService();
    prisma.workoutCycle.findFirst.mockResolvedValue(null);

    expect(await service.getSuggestedWorkout('user-1', today(MONDAY))).toBeNull();
  });

  it("is decided in the client timezone, not the server's", async () => {
    const { service } = makeService();
    // Sunday 20:30 UTC: still Sunday in Berlin, already Monday in Auckland.
    const sundayNight = new Date('2026-08-16T20:30:00.000Z');

    expect(await service.getSuggestedWorkout('user-1', resolveToday(undefined, sundayNight))).toBeNull();
    expect(
      await service.getSuggestedWorkout('user-1', resolveToday('Pacific/Auckland', sundayNight)),
    ).toMatchObject({ workoutDayId: 'day-mon' });
  });
});

describe('getCurrentCycleWorkouts', () => {
  it("highlights today's day and lists every other day unhighlighted", async () => {
    const { service } = makeService();

    const cycle = await service.getCurrentCycleWorkouts('user-1', today(MONDAY));

    expect(cycle!.workoutDays.map((day) => [day.workoutDayId, day.isSuggested])).toEqual([
      ['day-mon', true],
      ['day-wed', false],
      ['day-sat', false],
    ]);
  });

  it("highlights nothing on a day with nothing planned, while still listing every day", async () => {
    const { service } = makeService();

    const cycle = await service.getCurrentCycleWorkouts('user-1', today(TUESDAY));

    expect(cycle!.workoutDays).toHaveLength(3);
    expect(cycle!.workoutDays.some((day) => day.isSuggested)).toBe(false);
  });

  it("highlights nothing once today's workout is done", async () => {
    const { service } = makeService({ loggedDates: [MONDAY] });

    const cycle = await service.getCurrentCycleWorkouts('user-1', today(MONDAY));

    expect(cycle!.workoutDays.some((day) => day.isSuggested)).toBe(false);
  });
});

describe('getNextScheduledWorkout', () => {
  it('looks ahead to the next scheduled weekday when nothing is planned today', async () => {
    const { service } = makeService();

    expect(await service.getNextScheduledWorkout('user-1', today(THURSDAY))).toMatchObject({
      workoutDayId: 'day-sat',
      localDate: SATURDAY,
    });
  });

  it('wraps into the following week after a skipped day', async () => {
    const { service } = makeService();

    // Saturday the 22nd was skipped; the Sunday after it looks ahead to the coming Monday.
    expect(await service.getNextScheduledWorkout('user-1', today(SUNDAY))).toMatchObject({
      workoutDayId: 'day-mon',
      localDate: '2026-08-24',
    });
  });

  it('agrees with the workout page on a day whose workout is still open', async () => {
    const { service } = makeService();

    expect(await service.getNextScheduledWorkout('user-1', today(MONDAY))).toMatchObject({
      workoutDayId: 'day-mon',
      localDate: MONDAY,
    });
  });

  it("advances past today once today's workout is logged", async () => {
    const { service } = makeService({ loggedDates: [MONDAY] });

    expect(await service.getNextScheduledWorkout('user-1', today(MONDAY))).toMatchObject({
      workoutDayId: 'day-wed',
      localDate: '2026-08-19',
    });
  });

  it('wraps a full week when the cycle plans only the day just logged', async () => {
    const { service } = makeService({ workoutDays: [cycleDays()[0]], loggedDates: [MONDAY] });

    expect(await service.getNextScheduledWorkout('user-1', today(MONDAY))).toMatchObject({
      workoutDayId: 'day-mon',
      localDate: '2026-08-24',
    });
  });

  it('looks past a scheduled weekday that has no blueprint to start from', async () => {
    const days = cycleDays();
    days[2].workouts = []; // Saturday is scheduled but not authored yet
    const { service } = makeService({ workoutDays: days });

    expect(await service.getNextScheduledWorkout('user-1', today(THURSDAY))).toMatchObject({
      workoutDayId: 'day-mon',
      localDate: '2026-08-24',
    });
  });

  it('returns nothing when no cycle day has a blueprint yet', async () => {
    const { service } = makeService({
      workoutDays: cycleDays().map((day) => ({ ...day, workouts: [] })),
    });

    expect(await service.getNextScheduledWorkout('user-1', today(MONDAY))).toBeNull();
  });
});
