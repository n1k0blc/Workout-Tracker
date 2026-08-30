import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { derivePrimaryMuscle } from '../common/muscle.util';
import { getCurrentDate } from '../common/utils/date.util';
import { setWorkingVolume } from '../common/utils/volume.util';
import { getWeekdayDistanceFromCycleStart } from '../common/utils/weekday.util';
import { AnalyticsFilterDto, AnalyticsScope } from '../common/dto/analytics-filter.dto';
import {
  VolumeAnalyticsDto,
  VolumeDataPoint,
  VolumeByMuscleGroup,
  PersonalRecordsDto,
  PersonalRecord,
  MuscleDistributionDto,
  MuscleDistributionItem,
  CycleListDto,
  RIRAnalyticsDto,
  RIRDataPoint,
  DurationAnalyticsDto,
  DurationDataPoint,
  RestTimeAnalyticsDto,
  RestTimeDataPoint,
  RepsAnalyticsDto,
  RepsDataPoint,
  SetsAnalyticsDto,
  SetsDataPoint,
  IntensityAnalyticsDto,
  IntensityDataPoint,
} from './dto';

const MUSCLE_PERCENT_SELECT = {
  abdomenPercent: true,
  latissimusPercent: true,
  trapeziusPercent: true,
  lowerBackPercent: true,
  hamstringsPercent: true,
  glutesPercent: true,
  shouldersPercent: true,
  bicepsPercent: true,
  chestPercent: true,
  quadricepsPercent: true,
  calvesPercent: true,
  tricepsPercent: true,
} as const;

const ANALYTICS_EXERCISE_SELECT = {
  name: true,
  equipment: true,
  isUnilateral: true,
  isDoubleWeight: true,
  ...MUSCLE_PERCENT_SELECT,
} as const;

interface AnalyticsCycleContext {
  id: string;
  name: string;
  startDate: Date;
}

interface AnalyticsWorkoutRow {
  id: string;
  date: Date;
  localDate: string;
  totalDuration: number | null;
  homeGym?: { id: string; name: string } | null;
  exercises: Array<{
    exerciseId: string;
    exercise: {
      name: string;
      equipment: string;
      isUnilateral: boolean;
      isDoubleWeight: boolean;
    } & Record<string, number>;
    sets: Array<{
      setType: string;
      reps: number;
      weight: number;
      rir: number | null;
      rest: number | null;
      completedAt: Date | null;
    }>;
  }>;
}

interface AnalyticsContext {
  workouts: AnalyticsWorkoutRow[];
  cycle: AnalyticsCycleContext | null;
}

function toDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * PR3 (§3.9): one endpoint per metric, driven by the shared `AnalyticsFilterDto` +
 * `loadWorkoutsForAnalytics`. Replaces the old 9 `-by-cycle` twins -- `filter.cycleId`
 * presence alone switches a metric into cycle-anchored mode (cycle-relative weeks +
 * `trainingDay`); its absence uses `period`/`startDate`/`endDate` instead.
 */
@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  private matchesMuscleFilter(muscleGroup: string, filter: string[]): boolean {
    if (filter.length === 0) return true;
    return filter.includes(muscleGroup);
  }

  private matchesEquipmentFilter(equipment: string, filter: string[]): boolean {
    if (filter.length === 0) return true;
    return filter.includes(equipment);
  }

  /** Splits a set's working volume across the muscles it touches (§3.7/§4.5). */
  private distributeVolumeByMuscleGroups(
    totalVolume: number,
    exercise: Record<string, number>,
  ): Map<string, number> {
    const distribution = new Map<string, number>();
    const percentToMuscleGroup = [
      { percent: exercise.abdomenPercent, group: 'ABDOMEN' },
      { percent: exercise.latissimusPercent, group: 'LATISSIMUS' },
      { percent: exercise.trapeziusPercent, group: 'TRAPEZIUS' },
      { percent: exercise.lowerBackPercent, group: 'LOWER_BACK' },
      { percent: exercise.hamstringsPercent, group: 'HAMSTRINGS' },
      { percent: exercise.glutesPercent, group: 'GLUTES' },
      { percent: exercise.shouldersPercent, group: 'SHOULDERS' },
      { percent: exercise.bicepsPercent, group: 'BICEPS' },
      { percent: exercise.chestPercent, group: 'CHEST' },
      { percent: exercise.quadricepsPercent, group: 'QUADRICEPS' },
      { percent: exercise.calvesPercent, group: 'CALVES' },
      { percent: exercise.tricepsPercent, group: 'TRICEPS' },
    ];
    for (const { percent, group } of percentToMuscleGroup) {
      if (percent > 0) {
        distribution.set(group, (totalVolume * percent) / 100);
      }
    }
    return distribution;
  }

  /**
   * Canonical week-number/bounds helpers (#76). Every data point is keyed by the workout's
   * stored `localDate` -- the user's own calendar day, `YYYY-MM-DD` -- which these helpers
   * read as a UTC-midnight instant so the day- and week-bucketing math stays internally
   * consistent. `cycleStartDate` is likewise a UTC-anchored calendar date. A late-night
   * session now buckets into the day (and week) the user experienced it as, matching its
   * displayed date, rather than the UTC instant it was stored at.
   */
  private getCycleWeekNumber(date: Date, cycleStartDate: Date): number {
    const diffDays = Math.floor((date.getTime() - cycleStartDate.getTime()) / 86_400_000);
    return Math.floor(diffDays / 7) + 1;
  }

  private getCalendarWeek(date: Date): number {
    const tempDate = new Date(date.valueOf());
    const dayNum = (tempDate.getUTCDay() + 6) % 7;
    tempDate.setUTCDate(tempDate.getUTCDate() - dayNum + 3);
    const firstThursday = tempDate.valueOf();
    tempDate.setUTCMonth(0, 1);
    if (tempDate.getUTCDay() !== 4) {
      tempDate.setUTCMonth(0, 1 + ((4 - tempDate.getUTCDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - tempDate.valueOf()) / 604_800_000);
  }

  private getWeekBounds(date: Date, cycleStartDate?: Date): { start: Date; end: Date } {
    const referenceDay = cycleStartDate ? cycleStartDate.getUTCDay() : 1; // Monday for calendar mode
    const currentDay = date.getUTCDay();
    const daysSinceWeekStart = cycleStartDate
      ? getWeekdayDistanceFromCycleStart(currentDay, referenceDay)
      : (currentDay + 6) % 7;

    const weekStart = new Date(date);
    weekStart.setUTCDate(date.getUTCDate() - daysSinceWeekStart);
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
    weekEnd.setUTCHours(23, 59, 59, 999);
    return { start: weekStart, end: weekEnd };
  }

  private aggregateByWeek<T extends { date: string; workoutId?: string }>(
    dataPoints: T[],
    aggregationType: 'sum' | 'average',
    metricKey: keyof T,
    cycleStartDate?: Date,
  ): T[] {
    if (dataPoints.length === 0) return [];

    const weekMap = new Map<string, T[]>();
    for (const point of dataPoints) {
      const pointDate = new Date(point.date);
      const weekBounds = this.getWeekBounds(pointDate, cycleStartDate);
      const weekKey = weekBounds.start.toISOString();
      if (!weekMap.has(weekKey)) weekMap.set(weekKey, []);
      weekMap.get(weekKey)!.push(point);
    }

    const aggregated: T[] = [];
    for (const [weekKey, points] of weekMap.entries()) {
      const weekStart = new Date(weekKey);
      const weekEnd = new Date(weekStart);
      weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

      const sum = points.reduce((s, p) => s + (p[metricKey] as number), 0);
      const metricValue = aggregationType === 'sum' ? sum : sum / points.length;

      const weekNumber = cycleStartDate
        ? this.getCycleWeekNumber(weekStart, cycleStartDate)
        : this.getCalendarWeek(weekStart);
      const weekLabel = cycleStartDate ? `Woche ${weekNumber}` : `KW${weekNumber}`;

      aggregated.push({
        ...points[0],
        date: toDateKey(weekStart),
        [metricKey]: metricValue,
        weekNumber,
        weekLabel,
        weekStartDate: toDateKey(weekStart),
        weekEndDate: toDateKey(weekEnd),
        workoutCount: points.length,
      });
    }

    return aggregated.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  private getDateFilter(period: 'week' | 'month' | 'all' = 'month', customStart?: Date, customEnd?: Date) {
    if (customStart || customEnd) {
      return {
        ...(customStart && { gte: customStart }),
        ...(customEnd && { lte: customEnd }),
      };
    }
    if (period === 'all') return undefined;

    const now = getCurrentDate();
    const daysToSubtract = period === 'week' ? 7 : 30;
    const startDate = new Date(now);
    startDate.setUTCDate(startDate.getUTCDate() - daysToSubtract);
    return { gte: startDate };
  }

  private matchesTimeOfDay(hour: number, timeOfDayFilter: string): boolean {
    switch (timeOfDayFilter) {
      case 'morning':
        return hour >= 6 && hour < 12;
      case 'afternoon':
        return hour >= 12 && hour < 18;
      case 'evening':
        return hour >= 18 && hour < 24;
      default:
        return true;
    }
  }

  /**
   * The shared loader (§3.9): resolves the gym filter, the cycle-anchored-vs-period date
   * range, and the optional non-cycle narrowing, then returns the workout tree ready for
   * per-metric reduction. `filter.cycleId` presence is what makes a metric cycle-anchored --
   * there's no separate "-by-cycle" code path anymore.
   */
  async loadWorkoutsForAnalytics(
    userId: string,
    filter: AnalyticsFilterDto,
    options: { includeHomeGym?: boolean } = {},
  ): Promise<AnalyticsContext> {
    const gymFilter =
      filter.gymId === 'andere' ? null : filter.gymId === 'alle' || filter.gymId === undefined ? undefined : filter.gymId;

    const where: Record<string, unknown> = { userId, kind: 'WORKOUT' };
    let cycle: AnalyticsCycleContext | null = null;

    if (filter.cycleId) {
      const found = await this.prisma.workoutCycle.findFirst({
        where: { id: filter.cycleId, userId },
        select: { id: true, name: true, startDate: true },
      });
      if (!found) {
        throw new NotFoundException('Cycle not found');
      }
      cycle = found;
      where.cycleId = filter.cycleId;
    } else {
      where.date = this.getDateFilter(
        filter.period,
        filter.startDate ? new Date(filter.startDate) : undefined,
        filter.endDate ? new Date(filter.endDate) : undefined,
      );
      if (filter.scope === AnalyticsScope.NON_CYCLE) {
        where.cycleId = null;
      }
    }

    if (gymFilter !== undefined) {
      where.homeGymId = gymFilter;
    }

    const workouts = await this.prisma.workout.findMany({
      where,
      include: {
        exercises: {
          include: {
            exercise: { select: ANALYTICS_EXERCISE_SELECT },
            sets: true,
          },
        },
        ...(options.includeHomeGym && { homeGym: { select: { id: true, name: true } } }),
      },
      orderBy: { date: 'asc' },
    });

    return { workouts: workouts as unknown as AnalyticsWorkoutRow[], cycle };
  }

  /**
   * Volume Analytics (§4.5: one volume primitive via `setWorkingVolume`, distributed across
   * muscles for the byMuscleGroup breakdown per §3.7).
   */
  async getVolumeAnalytics(userId: string, filter: AnalyticsFilterDto): Promise<VolumeAnalyticsDto> {
    const muscleGroups = filter.muscleGroup ?? [];
    const equipments = filter.equipment ?? [];
    const { workouts, cycle } = await this.loadWorkoutsForAnalytics(userId, filter);

    const dataPoints: VolumeDataPoint[] = [];
    const volumeByMuscleGroup = new Map<string, number>();
    let totalVolume = 0;
    let trainingDayCounter = 1;

    for (const workout of workouts) {
      const workoutVolumeByMuscle = new Map<string, number>();

      for (const ex of workout.exercises) {
        if (filter.exerciseId) {
          if (ex.exerciseId !== filter.exerciseId) continue;
        } else if (!this.matchesEquipmentFilter(ex.exercise.equipment, equipments)) {
          continue;
        }

        for (const set of ex.sets) {
          if (set.setType === 'WARMUP') continue;
          const setVolume = setWorkingVolume(set as any, ex.exercise);
          const distribution = this.distributeVolumeByMuscleGroups(setVolume, ex.exercise);
          for (const [mg, vol] of distribution) {
            volumeByMuscleGroup.set(mg, (volumeByMuscleGroup.get(mg) || 0) + vol);
            workoutVolumeByMuscle.set(mg, (workoutVolumeByMuscle.get(mg) || 0) + vol);
          }
        }
      }

      const workoutVolume =
        muscleGroups.length > 0
          ? Array.from(workoutVolumeByMuscle.entries())
              .filter(([mg]) => muscleGroups.includes(mg))
              .reduce((sum, [, vol]) => sum + vol, 0)
          : Array.from(workoutVolumeByMuscle.values()).reduce((sum, vol) => sum + vol, 0);

      totalVolume += workoutVolume;
      const dataPoint: VolumeDataPoint = {
        date: workout.localDate,
        volume: workoutVolume,
        workoutId: workout.id,
      };
      if (cycle) dataPoint.trainingDay = trainingDayCounter;
      dataPoints.push(dataPoint);
      trainingDayCounter++;
    }

    const finalDataPoints =
      filter.aggregation === 'week' ? this.aggregateByWeek(dataPoints, 'sum', 'volume', cycle?.startDate) : dataPoints;

    let byMuscleGroup: VolumeByMuscleGroup[] = Array.from(volumeByMuscleGroup.entries()).map(([muscleGroup, volume]) => ({
      muscleGroup,
      volume,
      percentage: totalVolume > 0 ? (volume / totalVolume) * 100 : 0,
    }));
    if (muscleGroups.length > 0) {
      byMuscleGroup = byMuscleGroup.filter((item) => muscleGroups.includes(item.muscleGroup));
    }

    return {
      cycleId: cycle?.id,
      cycleName: cycle?.name,
      totalVolume,
      period: cycle ? undefined : filter.period,
      dataPoints: finalDataPoints,
      byMuscleGroup,
    };
  }

  /** Muscle Distribution -- same distribution primitive as volume, no timeline (a snapshot). */
  async getMuscleDistribution(userId: string, filter: AnalyticsFilterDto): Promise<MuscleDistributionDto> {
    const { workouts, cycle } = await this.loadWorkoutsForAnalytics(userId, filter);

    const distributionMap = new Map<string, { volume: number; workoutCount: Set<string> }>();
    let totalVolume = 0;

    for (const workout of workouts) {
      for (const ex of workout.exercises) {
        for (const set of ex.sets) {
          if (set.setType === 'WARMUP') continue;
          const setVolume = setWorkingVolume(set as any, ex.exercise);
          totalVolume += setVolume;

          const distribution = this.distributeVolumeByMuscleGroups(setVolume, ex.exercise);
          for (const [muscleGroup, volume] of distribution) {
            if (!distributionMap.has(muscleGroup)) {
              distributionMap.set(muscleGroup, { volume: 0, workoutCount: new Set() });
            }
            const data = distributionMap.get(muscleGroup)!;
            data.volume += volume;
            data.workoutCount.add(workout.id);
          }
        }
      }
    }

    const distribution: MuscleDistributionItem[] = Array.from(distributionMap.entries()).map(([muscleGroup, data]) => ({
      muscleGroup,
      volume: data.volume,
      percentage: totalVolume > 0 ? (data.volume / totalVolume) * 100 : 0,
      workoutCount: data.workoutCount.size,
    }));

    return {
      cycleId: cycle?.id,
      cycleName: cycle?.name,
      period: cycle ? undefined : filter.period,
      distribution: distribution.sort((a, b) => b.volume - a.volume),
    };
  }

  /**
   * Personal Records -- unchanged scope (§3.9: weight-only, home-gym-only by default), not
   * routed through the shared loader since it has no period/cycle concept at all (all-time scan).
   */
  async getPersonalRecords(
    userId: string,
    muscleGroup?: string | string[],
    equipment?: string | string[],
    gymId?: string,
  ): Promise<PersonalRecordsDto> {
    const muscleGroups = Array.isArray(muscleGroup) ? muscleGroup : muscleGroup ? [muscleGroup] : [];
    const equipments = Array.isArray(equipment) ? equipment : equipment ? [equipment] : [];

    const gymFilter = gymId === 'andere' ? null : gymId === 'alle' || gymId === undefined ? { not: null } : gymId;

    const workouts = await this.prisma.workout.findMany({
      where: {
        userId,
        kind: 'WORKOUT' as any,
        ...(gymFilter !== undefined && { homeGymId: gymFilter }),
      },
      include: {
        homeGym: { select: { id: true, name: true } },
        exercises: {
          include: {
            exercise: { select: { name: true, equipment: true, isUnilateral: true, isDoubleWeight: true, ...MUSCLE_PERCENT_SELECT } },
            sets: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    const prsByExercise = new Map<string, PersonalRecord>();

    for (const workout of workouts) {
      for (const exerciseLog of workout.exercises) {
        const exerciseId = exerciseLog.exerciseId;
        const exerciseName = exerciseLog.exercise.name;

        if (!this.matchesMuscleFilter(derivePrimaryMuscle(exerciseLog.exercise as any), muscleGroups)) continue;
        if (!this.matchesEquipmentFilter(exerciseLog.exercise.equipment, equipments)) continue;

        for (const set of exerciseLog.sets) {
          if (set.setType === 'WARMUP') continue;

          const currentPR = prsByExercise.get(exerciseId);
          const adjustedWeight = set.weight * (exerciseLog.exercise.isDoubleWeight ? 2 : 1);

          if (!currentPR || adjustedWeight > currentPR.value) {
            prsByExercise.set(exerciseId, {
              exerciseId,
              exerciseName,
              isUnilateral: exerciseLog.exercise.isUnilateral,
              isDoubleWeight: exerciseLog.exercise.isDoubleWeight,
              type: 'weight',
              value: adjustedWeight,
              date: workout.date!,
              workoutId: workout.id,
              details: { weight: adjustedWeight, reps: set.reps },
              homeGym: workout.homeGym ? { id: workout.homeGym.id, name: workout.homeGym.name } : null,
            });
          }
        }
      }
    }

    const allPRs = Array.from(prsByExercise.values());

    const thirtyDaysAgo = getCurrentDate();
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
    const recentPRs = allPRs.filter((pr) => new Date(pr.date) >= thirtyDaysAgo);

    return {
      recentPRs: recentPRs.sort((a, b) => b.date.getTime() - a.date.getTime()),
      allTimePRs: allPRs.sort((a, b) => b.value - a.value),
    };
  }

  /** Get list of user's cycles (active + completed) -- unaffected by this consolidation. */
  async getCycles(userId: string): Promise<CycleListDto> {
    const cycles = await this.prisma.workoutCycle.findMany({
      where: { userId },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
      select: { id: true, name: true, duration: true, startDate: true, status: true, completedAt: true, createdAt: true },
    });

    return {
      activeCycle: cycles.find((c) => c.status === 'ACTIVE'),
      completedCycles: cycles.filter((c) => c.status === 'COMPLETED'),
    };
  }

  /** RIR: counts working sets by RIR bucket (0/1/2, §3.9 -- intentional near-failure tracking). */
  async getRIRAnalytics(userId: string, filter: AnalyticsFilterDto): Promise<RIRAnalyticsDto> {
    const muscleGroups = filter.muscleGroup ?? [];
    const equipments = filter.equipment ?? [];
    const { workouts, cycle } = await this.loadWorkoutsForAnalytics(userId, filter);

    const dataPoints: RIRDataPoint[] = [];
    let totalSets = 0;
    let trainingDayCounter = 1;

    for (const workout of workouts) {
      if (filter.timeOfDay) {
        const workoutHour = workout.date.getUTCHours();
        if (!this.matchesTimeOfDay(workoutHour, filter.timeOfDay)) {
          trainingDayCounter++;
          continue;
        }
      }

      let rir0Count = 0;
      let rir1Count = 0;
      let rir2Count = 0;

      for (const ex of workout.exercises) {
        if (filter.exerciseId) {
          if (ex.exerciseId !== filter.exerciseId) continue;
        } else {
          if (!this.matchesMuscleFilter(derivePrimaryMuscle(ex.exercise as any), muscleGroups)) continue;
          if (!this.matchesEquipmentFilter(ex.exercise.equipment, equipments)) continue;
        }

        for (const set of ex.sets) {
          if (set.setType !== 'WORKING') continue;
          if (set.rir === 0) rir0Count++;
          else if (set.rir === 1) rir1Count++;
          else if (set.rir === 2) rir2Count++;
        }
      }

      const totalSetsThisWorkout = rir0Count + rir1Count + rir2Count;
      if (totalSetsThisWorkout > 0) {
        const dataPoint: RIRDataPoint = {
          date: workout.localDate,
          rir0Count,
          rir1Count,
          rir2Count,
          workoutId: workout.id,
        };
        if (cycle) dataPoint.trainingDay = trainingDayCounter;
        dataPoints.push(dataPoint);
        totalSets += totalSetsThisWorkout;
      }
      trainingDayCounter++;
    }

    // RIR needs 3 independently-summed counters, so it doesn't reuse the generic
    // single-metric `aggregateByWeek` -- same bespoke grouping as before, just UTC-based now.
    let finalDataPoints = dataPoints;
    if (filter.aggregation === 'week' && dataPoints.length > 0) {
      const weekMap = new Map<string, RIRDataPoint[]>();
      for (const point of dataPoints) {
        const weekBounds = this.getWeekBounds(new Date(point.date), cycle?.startDate);
        const weekKey = weekBounds.start.toISOString();
        if (!weekMap.has(weekKey)) weekMap.set(weekKey, []);
        weekMap.get(weekKey)!.push(point);
      }

      finalDataPoints = [];
      for (const [weekKey, points] of weekMap.entries()) {
        const weekStart = new Date(weekKey);
        const weekEnd = new Date(weekStart);
        weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

        const weekNumber = cycle ? this.getCycleWeekNumber(weekStart, cycle.startDate) : this.getCalendarWeek(weekStart);
        const weekLabel = cycle ? `Woche ${weekNumber}` : `KW${weekNumber}`;

        finalDataPoints.push({
          date: toDateKey(weekStart),
          trainingDay: points[0].trainingDay,
          rir0Count: points.reduce((sum, p) => sum + p.rir0Count, 0),
          rir1Count: points.reduce((sum, p) => sum + p.rir1Count, 0),
          rir2Count: points.reduce((sum, p) => sum + p.rir2Count, 0),
          workoutId: points[0].workoutId,
          weekNumber,
          weekLabel,
          weekStartDate: toDateKey(weekStart),
          weekEndDate: toDateKey(weekEnd),
          workoutCount: points.length,
        });
      }
      finalDataPoints.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    return {
      cycleId: cycle?.id,
      cycleName: cycle?.name,
      totalSets,
      period: cycle ? undefined : filter.period,
      totalWorkouts: workouts.length,
      dataPoints: finalDataPoints,
    };
  }

  /** Duration -- merges the old separate "time-tracking" endpoint (§3.9: workout-level metric). */
  async getDurationAnalytics(userId: string, filter: AnalyticsFilterDto): Promise<DurationAnalyticsDto> {
    const muscleGroups = filter.muscleGroup ?? [];
    const equipments = filter.equipment ?? [];
    const { workouts, cycle } = await this.loadWorkoutsForAnalytics(userId, filter);

    const dataPoints: DurationDataPoint[] = [];
    let totalDuration = 0;
    let validWorkoutsCount = 0;
    let trainingDayCounter = 1;

    for (const workout of workouts) {
      if (workout.totalDuration === null) {
        trainingDayCounter++;
        continue;
      }

      if (muscleGroups.length > 0 || equipments.length > 0 || filter.exerciseId) {
        const hasMatchingExercise = workout.exercises.some((ex) => {
          if (filter.exerciseId) return ex.exerciseId === filter.exerciseId;
          if (!this.matchesMuscleFilter(derivePrimaryMuscle(ex.exercise as any), muscleGroups)) return false;
          if (!this.matchesEquipmentFilter(ex.exercise.equipment, equipments)) return false;
          return true;
        });
        if (!hasMatchingExercise) {
          trainingDayCounter++;
          continue;
        }
      }

      const durationInMinutes = Math.round(workout.totalDuration / 60);
      const dataPoint: DurationDataPoint = {
        date: workout.localDate,
        duration: durationInMinutes,
        workoutId: workout.id,
      };
      if (cycle) dataPoint.trainingDay = trainingDayCounter;
      dataPoints.push(dataPoint);

      totalDuration += durationInMinutes;
      validWorkoutsCount++;
      trainingDayCounter++;
    }

    const finalDataPoints =
      filter.aggregation === 'week' ? this.aggregateByWeek(dataPoints, 'average', 'duration', cycle?.startDate) : dataPoints;

    return {
      cycleId: cycle?.id,
      cycleName: cycle?.name,
      averageDuration: validWorkoutsCount > 0 ? Math.round(totalDuration / validWorkoutsCount) : 0,
      period: cycle ? undefined : filter.period,
      totalWorkouts: validWorkoutsCount,
      dataPoints: finalDataPoints,
    };
  }

  /** Rest time -- averages the seconds rested after each set that recorded one. */
  async getRestTimeAnalytics(userId: string, filter: AnalyticsFilterDto): Promise<RestTimeAnalyticsDto> {
    const muscleGroups = filter.muscleGroup ?? [];
    const equipments = filter.equipment ?? [];
    const { workouts, cycle } = await this.loadWorkoutsForAnalytics(userId, filter);

    const dataPoints: RestTimeDataPoint[] = [];
    let overallSum = 0;
    let overallCount = 0;
    let trainingDayCounter = 1;

    for (const workout of workouts) {
      let workoutRestSum = 0;
      let workoutRestCount = 0;

      for (const ex of workout.exercises) {
        if (filter.exerciseId) {
          if (ex.exerciseId !== filter.exerciseId) continue;
        } else {
          if (!this.matchesMuscleFilter(derivePrimaryMuscle(ex.exercise as any), muscleGroups)) continue;
          if (!this.matchesEquipmentFilter(ex.exercise.equipment, equipments)) continue;
        }

        for (const set of ex.sets) {
          if (set.rest === null || set.rest === undefined) continue;
          workoutRestSum += set.rest;
          workoutRestCount++;
        }
      }

      if (workoutRestCount > 0) {
        const dataPoint: RestTimeDataPoint = {
          date: workout.localDate,
          averageRestTime: Math.round(workoutRestSum / workoutRestCount),
          workoutId: workout.id,
        };
        if (cycle) dataPoint.trainingDay = trainingDayCounter;
        dataPoints.push(dataPoint);
        overallSum += workoutRestSum;
        overallCount += workoutRestCount;
      }
      trainingDayCounter++;
    }

    const finalDataPoints =
      filter.aggregation === 'week'
        ? this.aggregateByWeek(dataPoints, 'average', 'averageRestTime', cycle?.startDate)
        : dataPoints;

    return {
      cycleId: cycle?.id,
      cycleName: cycle?.name,
      overallAverage: overallCount > 0 ? Math.round(overallSum / overallCount) : 0,
      period: cycle ? undefined : filter.period,
      totalWorkouts: dataPoints.length,
      dataPoints: finalDataPoints,
    };
  }

  /** Reps -- total working reps per workout. */
  async getRepsAnalytics(userId: string, filter: AnalyticsFilterDto): Promise<RepsAnalyticsDto> {
    const muscleGroups = filter.muscleGroup ?? [];
    const equipments = filter.equipment ?? [];
    const { workouts, cycle } = await this.loadWorkoutsForAnalytics(userId, filter);

    const dataPoints: RepsDataPoint[] = [];
    let totalReps = 0;
    let validWorkoutsCount = 0;
    let trainingDayCounter = 1;

    for (const workout of workouts) {
      let workoutReps = 0;

      for (const ex of workout.exercises) {
        if (filter.exerciseId) {
          if (ex.exerciseId !== filter.exerciseId) continue;
        } else {
          if (!this.matchesMuscleFilter(derivePrimaryMuscle(ex.exercise as any), muscleGroups)) continue;
          if (!this.matchesEquipmentFilter(ex.exercise.equipment, equipments)) continue;
        }

        for (const set of ex.sets) {
          if (set.setType === 'WARMUP') continue;
          workoutReps += set.reps;
        }
      }

      if (workoutReps > 0 || (muscleGroups.length === 0 && equipments.length === 0 && !filter.exerciseId)) {
        const dataPoint: RepsDataPoint = { date: workout.localDate, reps: workoutReps, workoutId: workout.id };
        if (cycle) dataPoint.trainingDay = trainingDayCounter;
        dataPoints.push(dataPoint);
        totalReps += workoutReps;
        validWorkoutsCount++;
      }
      trainingDayCounter++;
    }

    const finalDataPoints =
      filter.aggregation === 'week' ? this.aggregateByWeek(dataPoints, 'sum', 'reps', cycle?.startDate) : dataPoints;

    return {
      cycleId: cycle?.id,
      cycleName: cycle?.name,
      totalReps,
      averageReps: validWorkoutsCount > 0 ? Math.round(totalReps / validWorkoutsCount) : 0,
      period: cycle ? undefined : filter.period,
      totalWorkouts: validWorkoutsCount,
      dataPoints: finalDataPoints,
    };
  }

  /** Sets -- total working sets per workout. */
  async getSetsAnalytics(userId: string, filter: AnalyticsFilterDto): Promise<SetsAnalyticsDto> {
    const muscleGroups = filter.muscleGroup ?? [];
    const equipments = filter.equipment ?? [];
    const { workouts, cycle } = await this.loadWorkoutsForAnalytics(userId, filter);

    const dataPoints: SetsDataPoint[] = [];
    let totalSets = 0;
    let validWorkoutsCount = 0;
    let trainingDayCounter = 1;

    for (const workout of workouts) {
      let workoutSets = 0;

      for (const ex of workout.exercises) {
        if (filter.exerciseId) {
          if (ex.exerciseId !== filter.exerciseId) continue;
        } else {
          if (!this.matchesMuscleFilter(derivePrimaryMuscle(ex.exercise as any), muscleGroups)) continue;
          if (!this.matchesEquipmentFilter(ex.exercise.equipment, equipments)) continue;
        }

        for (const set of ex.sets) {
          if (set.setType === 'WARMUP') continue;
          workoutSets++;
        }
      }

      if (workoutSets > 0 || (muscleGroups.length === 0 && equipments.length === 0 && !filter.exerciseId)) {
        const dataPoint: SetsDataPoint = { date: workout.localDate, sets: workoutSets, workoutId: workout.id };
        if (cycle) dataPoint.trainingDay = trainingDayCounter;
        dataPoints.push(dataPoint);
        totalSets += workoutSets;
        validWorkoutsCount++;
      }
      trainingDayCounter++;
    }

    const finalDataPoints =
      filter.aggregation === 'week' ? this.aggregateByWeek(dataPoints, 'sum', 'sets', cycle?.startDate) : dataPoints;

    return {
      cycleId: cycle?.id,
      cycleName: cycle?.name,
      totalSets,
      averageSets: validWorkoutsCount > 0 ? Math.round(totalSets / validWorkoutsCount) : 0,
      period: cycle ? undefined : filter.period,
      totalWorkouts: validWorkoutsCount,
      dataPoints: finalDataPoints,
    };
  }

  /**
   * Intensity (§3.10): ORM% reborn weight-independent -- `3000 / (30 + reps + rir)` per
   * working set, averaged. Weight cancels out by design, which is exactly why (unlike PRs)
   * it needs no benchmark and works across every workout and every gym.
   */
  async getIntensityAnalytics(userId: string, filter: AnalyticsFilterDto): Promise<IntensityAnalyticsDto> {
    const muscleGroups = filter.muscleGroup ?? [];
    const equipments = filter.equipment ?? [];
    const { workouts, cycle } = await this.loadWorkoutsForAnalytics(userId, filter);

    const dataPoints: IntensityDataPoint[] = [];
    let totalIntensitySum = 0;
    let totalSetCount = 0;
    let trainingDayCounter = 1;

    for (const workout of workouts) {
      let workoutIntensitySum = 0;
      let workoutSetCount = 0;

      for (const ex of workout.exercises) {
        if (filter.exerciseId) {
          if (ex.exerciseId !== filter.exerciseId) continue;
        } else {
          if (!this.matchesMuscleFilter(derivePrimaryMuscle(ex.exercise as any), muscleGroups)) continue;
          if (!this.matchesEquipmentFilter(ex.exercise.equipment, equipments)) continue;
        }

        for (const set of ex.sets) {
          if (set.setType !== 'WORKING') continue;
          const intensity = 3000 / (30 + set.reps + (set.rir ?? 0));
          workoutIntensitySum += intensity;
          workoutSetCount++;
        }
      }

      if (workoutSetCount > 0) {
        const dataPoint: IntensityDataPoint = {
          date: workout.localDate,
          intensity: Math.round((workoutIntensitySum / workoutSetCount) * 10) / 10,
          workoutId: workout.id,
        };
        if (cycle) dataPoint.trainingDay = trainingDayCounter;
        dataPoints.push(dataPoint);
        totalIntensitySum += workoutIntensitySum;
        totalSetCount += workoutSetCount;
      }
      trainingDayCounter++;
    }

    const finalDataPoints =
      filter.aggregation === 'week' ? this.aggregateByWeek(dataPoints, 'average', 'intensity', cycle?.startDate) : dataPoints;

    return {
      cycleId: cycle?.id,
      cycleName: cycle?.name,
      averageIntensity: totalSetCount > 0 ? Math.round((totalIntensitySum / totalSetCount) * 10) / 10 : 0,
      period: cycle ? undefined : filter.period,
      totalWorkouts: dataPoints.length,
      dataPoints: finalDataPoints,
    };
  }
}
