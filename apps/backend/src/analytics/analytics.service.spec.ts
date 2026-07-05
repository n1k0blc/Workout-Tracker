import { NotFoundException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsFilterDto, AnalyticsScope } from '../common/dto/analytics-filter.dto';

const baseExercise = {
  name: 'Bench Press',
  equipment: 'BARBELL',
  isUnilateral: false,
  isDoubleWeight: false,
  abdomenPercent: 0,
  latissimusPercent: 0,
  trapeziusPercent: 0,
  lowerBackPercent: 0,
  hamstringsPercent: 0,
  glutesPercent: 0,
  shouldersPercent: 20,
  bicepsPercent: 0,
  chestPercent: 80,
  quadricepsPercent: 0,
  calvesPercent: 0,
  tricepsPercent: 0,
};

function makeWorkout(overrides: Partial<any> = {}) {
  return {
    id: 'workout-1',
    date: new Date('2026-06-01T12:00:00.000Z'),
    totalDuration: 3600,
    homeGym: null,
    exercises: [
      {
        exerciseId: 'exercise-1',
        exercise: baseExercise,
        sets: [
          { setType: 'WARMUP', reps: 10, weight: 20, rir: null, rest: null, completedAt: null },
          { setType: 'WORKING', reps: 8, weight: 100, rir: 1, rest: 90, completedAt: null },
          { setType: 'WORKING', reps: 8, weight: 100, rir: 1, rest: 90, completedAt: null },
        ],
      },
    ],
    ...overrides,
  };
}

function makePrisma() {
  return {
    workout: { findMany: jest.fn() },
    workoutCycle: { findFirst: jest.fn(), findMany: jest.fn() },
  };
}

describe('AnalyticsService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: AnalyticsService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new AnalyticsService(prisma as any);
  });

  describe('loadWorkoutsForAnalytics', () => {
    it('throws NotFoundException when cycleId does not belong to the user (BOLA guard)', async () => {
      prisma.workoutCycle.findFirst.mockResolvedValue(null);

      const filter: AnalyticsFilterDto = { cycleId: 'someone-elses-cycle' } as AnalyticsFilterDto;

      await expect(service.getVolumeAnalytics('user-1', filter)).rejects.toThrow(NotFoundException);
      expect(prisma.workoutCycle.findFirst).toHaveBeenCalledWith({
        where: { id: 'someone-elses-cycle', userId: 'user-1' },
        select: { id: true, name: true, startDate: true },
      });
    });

    it('scopes to cycleId when present, without applying period/date filters', async () => {
      prisma.workoutCycle.findFirst.mockResolvedValue({
        id: 'cycle-1',
        name: 'Cycle 1',
        startDate: new Date('2026-05-01T00:00:00.000Z'),
      });
      prisma.workout.findMany.mockResolvedValue([]);

      const filter: AnalyticsFilterDto = { cycleId: 'cycle-1' } as AnalyticsFilterDto;
      await service.getVolumeAnalytics('user-1', filter);

      const whereArg = prisma.workout.findMany.mock.calls[0][0].where;
      expect(whereArg.cycleId).toBe('cycle-1');
      expect(whereArg.date).toBeUndefined();
    });

    it('applies scope=non-cycle by forcing cycleId: null when no cycleId is given', async () => {
      prisma.workout.findMany.mockResolvedValue([]);

      const filter: AnalyticsFilterDto = { scope: AnalyticsScope.NON_CYCLE, period: 'month' } as AnalyticsFilterDto;
      await service.getVolumeAnalytics('user-1', filter);

      const whereArg = prisma.workout.findMany.mock.calls[0][0].where;
      expect(whereArg.cycleId).toBeNull();
      expect(whereArg.date).toBeDefined();
    });

    it('maps gymId "andere" to homeGymId: null and "alle"/undefined to no filter', async () => {
      prisma.workout.findMany.mockResolvedValue([]);

      await service.getVolumeAnalytics('user-1', { gymId: 'andere' } as AnalyticsFilterDto);
      expect(prisma.workout.findMany.mock.calls[0][0].where.homeGymId).toBeNull();

      await service.getVolumeAnalytics('user-1', { gymId: 'alle' } as AnalyticsFilterDto);
      expect(prisma.workout.findMany.mock.calls[1][0].where).not.toHaveProperty('homeGymId');

      await service.getVolumeAnalytics('user-1', {} as AnalyticsFilterDto);
      expect(prisma.workout.findMany.mock.calls[2][0].where).not.toHaveProperty('homeGymId');

      await service.getVolumeAnalytics('user-1', { gymId: 'gym-42' } as AnalyticsFilterDto);
      expect(prisma.workout.findMany.mock.calls[3][0].where.homeGymId).toBe('gym-42');
    });
  });

  describe('getVolumeAnalytics', () => {
    it('excludes warmup sets and applies unilateral/double-weight multipliers via setWorkingVolume', async () => {
      prisma.workout.findMany.mockResolvedValue([
        makeWorkout({
          exercises: [
            {
              exerciseId: 'exercise-1',
              exercise: { ...baseExercise, isUnilateral: true, isDoubleWeight: true },
              sets: [
                { setType: 'WARMUP', reps: 100, weight: 999, rir: null, rest: null, completedAt: null },
                { setType: 'WORKING', reps: 10, weight: 50, rir: 1, rest: 90, completedAt: null },
              ],
            },
          ],
        }),
      ]);

      const result = await service.getVolumeAnalytics('user-1', {} as AnalyticsFilterDto);

      // 10 reps * 50kg * 2 (unilateral) * 2 (double weight) = 2000, warmup contributes 0
      expect(result.totalVolume).toBe(2000);
      expect(result.dataPoints).toHaveLength(1);
    });

    it('distributes volume across muscle groups by percent and filters byMuscleGroup', async () => {
      prisma.workout.findMany.mockResolvedValue([makeWorkout()]);

      const result = await service.getVolumeAnalytics('user-1', { muscleGroup: ['CHEST'] } as AnalyticsFilterDto);

      // 2 working sets * 8 reps * 100kg = 1600 total; 80% chest = 1280, 20% shoulders = 320
      expect(result.byMuscleGroup).toEqual([{ muscleGroup: 'CHEST', volume: 1280, percentage: 100 }]);
      // dataPoint volume is narrowed to only the CHEST portion when muscleGroup filter is set
      expect(result.dataPoints[0].volume).toBe(1280);
    });

    it('sets trainingDay only in cycle-anchored mode', async () => {
      prisma.workoutCycle.findFirst.mockResolvedValue({
        id: 'cycle-1',
        name: 'Cycle 1',
        startDate: new Date('2026-05-01T00:00:00.000Z'),
      });
      prisma.workout.findMany.mockResolvedValue([makeWorkout()]);

      const cycleResult = await service.getVolumeAnalytics('user-1', { cycleId: 'cycle-1' } as AnalyticsFilterDto);
      expect(cycleResult.dataPoints[0].trainingDay).toBe(1);

      prisma.workout.findMany.mockResolvedValue([makeWorkout()]);
      const periodResult = await service.getVolumeAnalytics('user-1', {} as AnalyticsFilterDto);
      expect(periodResult.dataPoints[0].trainingDay).toBeUndefined();
    });
  });

  describe('getIntensityAnalytics', () => {
    it('computes 3000 / (30 + reps + rir) per working set and averages per workout', async () => {
      prisma.workout.findMany.mockResolvedValue([
        makeWorkout({
          exercises: [
            {
              exerciseId: 'exercise-1',
              exercise: baseExercise,
              sets: [
                { setType: 'WARMUP', reps: 20, weight: 20, rir: 5, rest: null, completedAt: null },
                { setType: 'WORKING', reps: 8, weight: 100, rir: 2, rest: 90, completedAt: null }, // 3000/40 = 75
                { setType: 'WORKING', reps: 10, weight: 100, rir: 0, rest: 90, completedAt: null }, // 3000/40 = 75
              ],
            },
          ],
        }),
      ]);

      const result = await service.getIntensityAnalytics('user-1', {} as AnalyticsFilterDto);

      expect(result.dataPoints).toHaveLength(1);
      expect(result.dataPoints[0].intensity).toBeCloseTo(75, 5);
      expect(result.averageIntensity).toBeCloseTo(75, 5);
    });

    it('defaults a null rir to 0', async () => {
      prisma.workout.findMany.mockResolvedValue([
        makeWorkout({
          exercises: [
            {
              exerciseId: 'exercise-1',
              exercise: baseExercise,
              sets: [{ setType: 'WORKING', reps: 10, weight: 100, rir: null, rest: 90, completedAt: null }],
            },
          ],
        }),
      ]);

      const result = await service.getIntensityAnalytics('user-1', {} as AnalyticsFilterDto);
      // 3000 / (30 + 10 + 0) = 75
      expect(result.dataPoints[0].intensity).toBeCloseTo(75, 5);
    });

    it('is weight-independent -- changing weight alone does not change intensity', async () => {
      const buildWorkout = (weight: number) =>
        makeWorkout({
          exercises: [
            {
              exerciseId: 'exercise-1',
              exercise: baseExercise,
              sets: [{ setType: 'WORKING', reps: 8, weight, rir: 1, rest: 90, completedAt: null }],
            },
          ],
        });

      prisma.workout.findMany.mockResolvedValue([buildWorkout(40)]);
      const light = await service.getIntensityAnalytics('user-1', {} as AnalyticsFilterDto);

      prisma.workout.findMany.mockResolvedValue([buildWorkout(140)]);
      const heavy = await service.getIntensityAnalytics('user-1', {} as AnalyticsFilterDto);

      expect(light.averageIntensity).toBe(heavy.averageIntensity);
    });
  });

  describe('getRIRAnalytics', () => {
    it('buckets working sets into rir0/1/2 counts and ignores rir > 2 and non-working sets', async () => {
      prisma.workout.findMany.mockResolvedValue([
        makeWorkout({
          exercises: [
            {
              exerciseId: 'exercise-1',
              exercise: baseExercise,
              sets: [
                { setType: 'WARMUP', reps: 10, weight: 20, rir: 0, rest: null, completedAt: null },
                { setType: 'WORKING', reps: 8, weight: 100, rir: 0, rest: 90, completedAt: null },
                { setType: 'WORKING', reps: 8, weight: 100, rir: 1, rest: 90, completedAt: null },
                { setType: 'WORKING', reps: 8, weight: 100, rir: 2, rest: 90, completedAt: null },
                { setType: 'WORKING', reps: 8, weight: 100, rir: 5, rest: 90, completedAt: null },
              ],
            },
          ],
        }),
      ]);

      const result = await service.getRIRAnalytics('user-1', {} as AnalyticsFilterDto);

      expect(result.dataPoints[0]).toMatchObject({ rir0Count: 1, rir1Count: 1, rir2Count: 1 });
      expect(result.totalSets).toBe(3);
    });
  });

  describe('getPersonalRecords', () => {
    it('tracks the max weight per exercise (weight-only), applying the double-weight multiplier', async () => {
      prisma.workout.findMany.mockResolvedValue([
        makeWorkout({
          date: new Date('2026-01-01T00:00:00.000Z'),
          exercises: [
            {
              exerciseId: 'exercise-1',
              exercise: { ...baseExercise, isDoubleWeight: true },
              sets: [{ setType: 'WORKING', reps: 5, weight: 40, rir: 1, rest: 90, completedAt: null }],
            },
          ],
        }),
        makeWorkout({
          date: new Date('2026-01-08T00:00:00.000Z'),
          exercises: [
            {
              exerciseId: 'exercise-1',
              exercise: { ...baseExercise, isDoubleWeight: true },
              sets: [{ setType: 'WORKING', reps: 5, weight: 30, rir: 1, rest: 90, completedAt: null }],
            },
          ],
        }),
      ]);

      const result = await service.getPersonalRecords('user-1');

      expect(result.allTimePRs).toHaveLength(1);
      expect(result.allTimePRs[0].value).toBe(80); // 40 * 2, the higher of the two
      expect(result.allTimePRs[0].type).toBe('weight');
    });

    it('defaults gymId to home-gym-only ({ not: null }) unless explicitly "andere"/"alle"', async () => {
      prisma.workout.findMany.mockResolvedValue([]);

      await service.getPersonalRecords('user-1');
      expect(prisma.workout.findMany.mock.calls[0][0].where.homeGymId).toEqual({ not: null });

      await service.getPersonalRecords('user-1', undefined, undefined, 'andere');
      expect(prisma.workout.findMany.mock.calls[1][0].where.homeGymId).toBeNull();
    });
  });

  describe('week bucketing (timezone fix, §2.11)', () => {
    it('getCalendarWeek and getWeekBounds are UTC-based and agree with each other at midnight UTC', () => {
      // 2026-01-01 00:00:00 UTC is a Thursday.
      const date = new Date('2026-01-01T00:00:00.000Z');
      const week = (service as any).getCalendarWeek(date);
      const bounds = (service as any).getWeekBounds(date);

      expect(bounds.start.toISOString().split('T')[0]).toBe('2025-12-29'); // Monday of that week, UTC
      expect(week).toBe(1);
    });

    it('does not shift week boundaries when the instant is exactly at a UTC day boundary', () => {
      // A moment one millisecond before UTC midnight must stay in the previous UTC day's week.
      const justBeforeMidnight = new Date('2026-06-08T23:59:59.999Z'); // Monday
      const justAfterMidnight = new Date('2026-06-09T00:00:00.000Z'); // Tuesday, same ISO week

      const boundsBefore = (service as any).getWeekBounds(justBeforeMidnight);
      const boundsAfter = (service as any).getWeekBounds(justAfterMidnight);

      expect(boundsBefore.start.toISOString()).toBe(boundsAfter.start.toISOString());
    });

    it('getCycleWeekNumber is a pure epoch-ms diff, unaffected by local timezone', () => {
      const cycleStart = new Date('2026-03-02T00:00:00.000Z'); // Monday
      const dayEight = new Date('2026-03-09T00:00:00.000Z'); // start of week 2
      expect((service as any).getCycleWeekNumber(dayEight, cycleStart)).toBe(2);
    });
  });
});
