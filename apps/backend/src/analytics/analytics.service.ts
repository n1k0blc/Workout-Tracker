import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { derivePrimaryMuscle, MusclePercentages } from '../common/muscle.util';
import {
  VolumeAnalyticsDto,
  VolumeDataPoint,
  VolumeByMuscleGroup,
  PersonalRecordsDto,
  PersonalRecord,
  MuscleDistributionDto,
  MuscleDistributionItem,
  TimeTrackingDto,
  TimeTrackingDataPoint,
  CycleListDto,
  CycleListItem,
  RIRByCycleDto,
  RIRDataPoint,
  RIRAnalyticsDto,
  RIRAnalyticsDataPoint,
  DurationAnalyticsDto,
  DurationDataPoint,
  DurationByCycleDto,
  RestTimeAnalyticsDto,
  RestTimeDataPoint,
  RestTimeByCycleDto,
  RepsAnalyticsDto,
  RepsDataPoint,
  RepsByCycleDto,
  SetsAnalyticsDto,
  SetsDataPoint,
  SetsByCycleDto,
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

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Helper: Normalize filter parameters to arrays
   */
  private normalizeFilterArray(value: string | string[] | undefined): string[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  /**
   * Helper: Check if exercise matches muscle group filter
   */
  private matchesMuscleFilter(muscleGroup: string, filter: string[]): boolean {
    if (filter.length === 0) return true; // No filter = match all
    return filter.includes(muscleGroup);
  }

  /**
   * Helper: Distribute volume across muscle groups based on percentages
   * Returns a map of muscle group -> volume contribution
   */
  private distributeVolumeByMuscleGroups(
    totalVolume: number,
    exercise: {
      abdomenPercent: number;
      latissimusPercent: number;
      trapeziusPercent: number;
      lowerBackPercent: number;
      hamstringsPercent: number;
      glutesPercent: number;
      shouldersPercent: number;
      bicepsPercent: number;
      chestPercent: number;
      quadricepsPercent: number;
      calvesPercent: number;
      tricepsPercent: number;
    },
  ): Map<string, number> {
    const distribution = new Map<string, number>();

    // Map of percent field to muscle group enum value
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
   * Helper: Check if exercise matches equipment filter
   */
  private matchesEquipmentFilter(equipment: string, filter: string[]): boolean {
    if (filter.length === 0) return true; // No filter = match all
    return filter.includes(equipment);
  }

  /**
   * Helper: Get cycle week number (1-based) from cycle start date
   * Week 1 starts on cycle start date and lasts 7 days
   */
  private getCycleWeekNumber(date: Date, cycleStartDate: Date): number {
    const diffTime = date.getTime() - cycleStartDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7) + 1;
  }

  /**
   * Helper: Get calendar week number (ISO 8601)
   */
  private getCalendarWeek(date: Date): number {
    const tempDate = new Date(date.valueOf());
    const dayNum = (tempDate.getDay() + 6) % 7;
    tempDate.setDate(tempDate.getDate() - dayNum + 3);
    const firstThursday = tempDate.valueOf();
    tempDate.setMonth(0, 1);
    if (tempDate.getDay() !== 4) {
      tempDate.setMonth(0, 1 + ((4 - tempDate.getDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - tempDate.valueOf()) / 604800000);
  }

  /**
   * Helper: Get start and end of week for a given date and cycle start
   */
  private getWeekBounds(date: Date, cycleStartDate?: Date): { start: Date; end: Date } {
    if (cycleStartDate) {
      // Cycle mode: weeks start on cycle start day of week
      const cycleDay = cycleStartDate.getDay();
      const currentDay = date.getDay();
      const daysSinceWeekStart = (currentDay - cycleDay + 7) % 7;
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - daysSinceWeekStart);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      return { start: weekStart, end: weekEnd };
    } else {
      // Calendar mode: weeks start on Monday
      const currentDay = date.getDay();
      const daysSinceMonday = (currentDay + 6) % 7;
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - daysSinceMonday);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      return { start: weekStart, end: weekEnd };
    }
  }

  /**
   * Helper: Aggregate data points by week
   */
  private aggregateByWeek<T extends { date: string; workoutId?: string }>(
    dataPoints: T[],
    aggregationType: 'sum' | 'average',
    metricKey: keyof T,
    cycleStartDate?: Date,
  ): T[] {
    if (dataPoints.length === 0) return [];

    // Group by week
    const weekMap = new Map<string, T[]>();

    for (const point of dataPoints) {
      const pointDate = new Date(point.date);
      const weekBounds = this.getWeekBounds(pointDate, cycleStartDate);
      const weekKey = weekBounds.start.toISOString();
      
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, []);
      }
      weekMap.get(weekKey)!.push(point);
    }

    // Aggregate each week
    const aggregated: T[] = [];
    for (const [weekKey, points] of weekMap.entries()) {
      const weekStart = new Date(weekKey);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      let metricValue: number;
      if (aggregationType === 'sum') {
        metricValue = points.reduce((sum, p) => sum + (p[metricKey] as number), 0);
      } else {
        const sum = points.reduce((sum, p) => sum + (p[metricKey] as number), 0);
        metricValue = sum / points.length;
      }

      const weekNumber = cycleStartDate 
        ? this.getCycleWeekNumber(weekStart, cycleStartDate)
        : this.getCalendarWeek(weekStart);

      const weekLabel = cycleStartDate
        ? `Woche ${weekNumber}`
        : `KW${weekNumber}`;

      const aggregatedPoint: T = {
        ...points[0],
        date: weekStart.toISOString().split('T')[0],
        [metricKey]: metricValue,
        weekNumber,
        weekLabel,
        weekStartDate: weekStart.toISOString().split('T')[0],
        weekEndDate: weekEnd.toISOString().split('T')[0],
        workoutCount: points.length,
      };

      aggregated.push(aggregatedPoint);
    }

    return aggregated.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  /**
   * Volume Analytics
   * Volume = sets × reps × weight
   */
  async getVolumeAnalytics(
    userId: string,
    period: 'week' | 'month' | 'all' = 'month',
    startDate?: Date,
    endDate?: Date,
    gymId?: string, // Filter by gym: null = "andere", undefined = "alle", specific ID = that gym
    muscleGroup?: string | string[],
    equipment?: string | string[],
    cycleId?: string, // Filter by cycle (only workouts in this cycle)
    aggregation?: 'day' | 'week',
    exerciseId?: string, // Filter by specific exercise (overrides muscleGroup/equipment)
  ): Promise<VolumeAnalyticsDto> {
    const dateFilter = this.getDateFilter(period, startDate, endDate);

    // Normalize filter arrays
    const muscleGroups = this.normalizeFilterArray(muscleGroup);
    const equipments = this.normalizeFilterArray(equipment);

    // Gym filter logic
    const gymFilter = gymId === 'andere'
      ? null // "andere" = workouts without homeGymId
      : gymId === 'alle' || gymId === undefined
      ? undefined // "alle" or undefined = keine Filterung
      : gymId; // specific gym ID

    const workouts = await this.prisma.workout.findMany({
      where: {
        userId,
        kind: 'WORKOUT' as any,
        date: dateFilter,
        ...(gymFilter !== undefined && { homeGymId: gymFilter }),
        ...(cycleId && { cycleId }), // NEW: Filter by cycle if provided
      },
      include: {
        exercises: {
          include: {
            exercise: {
              select: {
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
                equipment: true,
                isUnilateral: true,
                isDoubleWeight: true,
              },
            },
            sets: true,
          },
        },
        cycle: cycleId ? { select: { startDate: true } } : false,
      },
      orderBy: { date: 'asc' },
    });

    const dataPoints: VolumeDataPoint[] = [];
    const volumeByMuscleGroup: Map<string, number> = new Map();
    let totalVolume = 0;
    let trainingDayCounter = 1; // For cycle mode
    const cycleStartDate = workouts[0]?.cycle?.startDate;

    for (const workout of workouts) {
      let workoutVolume = 0;
      const workoutVolumeByMuscle: Map<string, number> = new Map();

      for (const exerciseLog of workout.exercises) {
        // If exerciseId is provided, filter by exercise ID only (ignore muscle/equipment filters)
        if (exerciseId) {
          if (exerciseLog.exerciseId !== exerciseId) {
            continue;
          }
        } else {
          // Apply equipment filter only (NOT muscle group - we distribute volume instead)
          if (!this.matchesEquipmentFilter(exerciseLog.exercise.equipment, equipments)) {
            continue;
          }
        }

        for (const set of exerciseLog.sets) {
          // Skip warmup sets - only count working sets for volume
          if (set.setType === 'WARMUP') continue;

          const setVolume = set.reps * set.weight * 
            (exerciseLog.exercise.isUnilateral ? 2 : 1) * 
            (exerciseLog.exercise.isDoubleWeight ? 2 : 1);

          // Distribute volume across muscle groups based on percentages
          const distribution = this.distributeVolumeByMuscleGroups(setVolume, exerciseLog.exercise);
          for (const [muscleGroup, volume] of distribution) {
            // Add to global muscle group totals
            volumeByMuscleGroup.set(
              muscleGroup,
              (volumeByMuscleGroup.get(muscleGroup) || 0) + volume,
            );
            
            // Track per-workout volume by muscle for filtered display
            workoutVolumeByMuscle.set(
              muscleGroup,
              (workoutVolumeByMuscle.get(muscleGroup) || 0) + volume,
            );
          }
        }
      }

      // Calculate workout volume: either filtered by muscle groups or total
      if (muscleGroups.length > 0) {
        // Sum only volumes for selected muscle groups
        workoutVolume = Array.from(workoutVolumeByMuscle.entries())
          .filter(([mg]) => muscleGroups.includes(mg))
          .reduce((sum, [, vol]) => sum + vol, 0);
      } else {
        // No filter: sum all muscle groups
        workoutVolume = Array.from(workoutVolumeByMuscle.values())
          .reduce((sum, vol) => sum + vol, 0);
      }

      totalVolume += workoutVolume;
      const dataPoint: VolumeDataPoint = {
        date: workout.date.toISOString().split('T')[0],
        volume: workoutVolume,
        workoutId: workout.id,
      };
      
      // Add trainingDay for cycle mode
      if (cycleId) {
        dataPoint.trainingDay = trainingDayCounter;
      }
      
      dataPoints.push(dataPoint);
      trainingDayCounter++;
    }

    // Apply week aggregation if requested
    const finalDataPoints = aggregation === 'week'
      ? this.aggregateByWeek(dataPoints, 'sum', 'volume', cycleStartDate)
      : dataPoints;

    // Calculate percentages for muscle groups
    let byMuscleGroup: VolumeByMuscleGroup[] = Array.from(volumeByMuscleGroup.entries()).map(
      ([muscleGroup, volume]) => ({
        muscleGroup,
        volume,
        percentage: totalVolume > 0 ? (volume / totalVolume) * 100 : 0,
      }),
    );

    // Filter byMuscleGroup if muscle group filter is provided
    if (muscleGroups.length > 0) {
      byMuscleGroup = byMuscleGroup.filter(item => muscleGroups.includes(item.muscleGroup));
    }

    return {
      totalVolume,
      period,
      dataPoints: finalDataPoints,
      byMuscleGroup,
    };
  }

  /**
   * Personal Records
   */
  async getPersonalRecords(
    userId: string,
    muscleGroup?: string | string[],
    equipment?: string | string[],
    gymId?: string,
  ): Promise<PersonalRecordsDto> {
    // Normalize filter arrays
    const muscleGroups = this.normalizeFilterArray(muscleGroup);
    const equipments = this.normalizeFilterArray(equipment);

    // Gym filter logic
    const gymFilter = gymId === 'andere'
      ? null
      : gymId === 'alle' || gymId === undefined
      ? { not: null } // Default: only Home Gym PRs
      : gymId;

    const workouts = await this.prisma.workout.findMany({
      where: {
        userId,
        kind: 'WORKOUT' as any,
        ...(gymFilter !== undefined && { homeGymId: gymFilter }),
      },
      include: {
        homeGym: {
          select: { id: true, name: true },
        },
        exercises: {
          include: {
            exercise: {
              select: {
                name: true,
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
                equipment: true,
                isUnilateral: true,
                isDoubleWeight: true,
              },
            },
            sets: true,
          },
        },
      },
      orderBy: { date: 'asc' }, // Ascending order to track first PR occurrence
    });

    const prsByExercise: Map<string, PersonalRecord> = new Map();

    for (const workout of workouts) {
      for (const exerciseLog of workout.exercises) {
        const exerciseId = exerciseLog.exerciseId;
        const exerciseName = exerciseLog.exercise.name;

        // Apply filters
        if (!this.matchesMuscleFilter(derivePrimaryMuscle(exerciseLog.exercise), muscleGroups)) {
          continue;
        }
        if (!this.matchesEquipmentFilter(exerciseLog.exercise.equipment, equipments)) {
          continue;
        }

        for (const set of exerciseLog.sets) {
          // Skip warmup sets - only count working sets for PRs
          if (set.setType === 'WARMUP') continue;

          const currentPR = prsByExercise.get(exerciseId);
          const adjustedWeight = set.weight * (exerciseLog.exercise.isDoubleWeight ? 2 : 1);

          // Weight PR - only track weight PRs now
          if (!currentPR || adjustedWeight > currentPR.value) {
            prsByExercise.set(exerciseId, {
              exerciseId,
              exerciseName,
              isUnilateral: exerciseLog.exercise.isUnilateral,
              isDoubleWeight: exerciseLog.exercise.isDoubleWeight,
              type: 'weight',
              value: adjustedWeight,
              date: workout.date,
              workoutId: workout.id,
              details: { weight: adjustedWeight, reps: set.reps },
              homeGym: workout.homeGym
                ? { id: workout.homeGym.id, name: workout.homeGym.name }
                : null,
            });
          }
        }
      }
    }

    // Collect all PRs
    const allPRs: PersonalRecord[] = Array.from(prsByExercise.values());

    // Recent PRs (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentPRs = allPRs.filter((pr) => new Date(pr.date) >= thirtyDaysAgo);

    return {
      recentPRs: recentPRs.sort((a, b) => b.date.getTime() - a.date.getTime()),
      allTimePRs: allPRs.sort((a, b) => b.value - a.value),
    };
  }

  /**
   * Muscle Distribution
   */
  async getMuscleDistribution(
    userId: string,
    period: 'week' | 'month' | 'all' = 'month',
    gymId?: string,
  ): Promise<MuscleDistributionDto> {
    const dateFilter = this.getDateFilter(period);

    // Gym filter logic
    const gymFilter = gymId === 'andere'
      ? null
      : gymId === 'alle' || gymId === undefined
      ? undefined
      : gymId;

    const workouts = await this.prisma.workout.findMany({
      where: {
        userId,
        kind: 'WORKOUT' as any,
        date: dateFilter,
        ...(gymFilter !== undefined && { homeGymId: gymFilter }),
      },
      include: {
        exercises: {
          include: {
            exercise: {
              select: {
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
                isUnilateral: true,
                isDoubleWeight: true,
              },
            },
            sets: true,
          },
        },
      },
    });

    const distributionMap: Map<
      string,
      { volume: number; workoutCount: Set<string> }
    > = new Map();
    let totalVolume = 0;

    for (const workout of workouts) {
      for (const exerciseLog of workout.exercises) {
        for (const set of exerciseLog.sets) {
          // Skip warmup sets - only count working sets for muscle distribution
          if (set.setType === 'WARMUP') continue;

          const setVolume = set.reps * set.weight * 
            (exerciseLog.exercise.isUnilateral ? 2 : 1) * 
            (exerciseLog.exercise.isDoubleWeight ? 2 : 1);
          
          totalVolume += setVolume;

          // Distribute volume across muscle groups based on percentages
          const distribution = this.distributeVolumeByMuscleGroups(setVolume, exerciseLog.exercise);
          for (const [muscleGroup, volume] of distribution) {
            if (!distributionMap.has(muscleGroup)) {
              distributionMap.set(muscleGroup, { volume: 0, workoutCount: new Set() });
            }
            const data = distributionMap.get(muscleGroup);
            data.volume += volume;
            data.workoutCount.add(workout.id);
          }
        }
      }
    }

    const distribution: MuscleDistributionItem[] = Array.from(distributionMap.entries()).map(
      ([muscleGroup, data]) => ({
        muscleGroup,
        volume: data.volume,
        percentage: totalVolume > 0 ? (data.volume / totalVolume) * 100 : 0,
        workoutCount: data.workoutCount.size,
      }),
    );

    return {
      period,
      distribution: distribution.sort((a, b) => b.volume - a.volume),
    };
  }

  /**
   * Time Tracking
   */
  async getTimeTracking(
    userId: string,
    period: 'week' | 'month' | 'all' = 'month',
  ): Promise<TimeTrackingDto> {
    const dateFilter = this.getDateFilter(period);

    const workouts = await this.prisma.workout.findMany({
      where: {
        userId,
        kind: 'WORKOUT' as any,
        date: dateFilter,
        totalDuration: { not: null },
      },
      select: {
        id: true,
        date: true,
        totalDuration: true,
      },
      orderBy: { date: 'asc' },
    });

    const dataPoints: TimeTrackingDataPoint[] = workouts.map((workout) => ({
      date: workout.date.toISOString().split('T')[0],
      duration: Math.round(workout.totalDuration / 60), // seconds to minutes
      workoutId: workout.id,
    }));

    const totalMinutes = dataPoints.reduce((sum, point) => sum + point.duration, 0);
    const workoutCount = workouts.length;
    const averageDuration = workoutCount > 0 ? totalMinutes / workoutCount : 0;

    return {
      period,
      totalMinutes,
      averageDuration: Math.round(averageDuration),
      workoutCount,
      dataPoints,
    };
  }

  /**
   * Helper: Get date filter based on period
   */
  private getDateFilter(
    period: 'week' | 'month' | 'all' = 'month',
    customStart?: Date,
    customEnd?: Date,
  ) {
    if (customStart || customEnd) {
      return {
        ...(customStart && { gte: customStart }),
        ...(customEnd && { lte: customEnd }),
      };
    }

    if (period === 'all') {
      return undefined;
    }

    const now = new Date();
    const daysToSubtract = period === 'week' ? 7 : 30;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysToSubtract);

    return { gte: startDate };
  }

  /**
   * Match workout hour against time of day filter
   */
  private matchesTimeOfDay(hour: number, timeOfDayFilter: string): boolean {
    switch (timeOfDayFilter) {
      case 'morning':
        return hour >= 6 && hour < 12;
      case 'afternoon':
        return hour >= 12 && hour < 18;
      case 'evening':
        return hour >= 18 && hour < 24;
      default:
        return true; // No filter or unknown filter: include all
    }
  }

  /**
   * Get list of user's cycles (active + completed)
   */
  async getCycles(userId: string): Promise<CycleListDto> {
    const cycles = await this.prisma.workoutCycle.findMany({
      where: { userId },
      orderBy: [
        { status: 'asc' }, // ACTIVE first
        { startDate: 'desc' },
      ],
      select: {
        id: true,
        name: true,
        duration: true,
        startDate: true,
        status: true,
        completedAt: true,
        createdAt: true,
      },
    });

    const activeCycle = cycles.find(c => c.status === 'ACTIVE');
    const completedCycles = cycles.filter(c => c.status === 'COMPLETED');

    return {
      activeCycle,
      completedCycles,
    };
  }

  /**
   * RIR Analytics for entire cycle
   * Counts working sets by RIR (0, 1, 2) per training day
   */
  async getRIRByCycle(
    userId: string,
    cycleId: string,
    gymId?: string,
    muscleGroup?: string | string[],
    equipment?: string | string[],
    timeOfDay?: string,
    aggregation?: 'day' | 'week',
    exerciseId?: string,
  ): Promise<RIRByCycleDto> {
    // 1. Verify user owns this cycle
    const cycle = await this.prisma.workoutCycle.findFirst({
      where: { id: cycleId, userId },
    });

    if (!cycle) {
      throw new NotFoundException('Cycle not found');
    }

    // 2. Build where clause for workouts
    // Gym filter logic (same as volume analytics)
    const gymFilter = gymId === 'andere'
      ? null // "andere" = workouts without homeGymId
      : gymId === 'alle' || gymId === undefined
      ? undefined // "alle" or undefined = keine Filterung
      : gymId; // specific gym ID
    
    const whereClause: any = {
      cycleId,
      kind: 'WORKOUT' as any,
    };

    // Apply gym filter only if it's not undefined
    if (gymFilter !== undefined) {
      whereClause.homeGymId = gymFilter;
    }

    // 3. Get all completed workouts for this cycle
    const workouts = await this.prisma.workout.findMany({
      where: whereClause,
      include: {
        exercises: {
          include: {
            exercise: {
              select: {
                id: true,
                name: true,
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
                equipment: true,
              },
            },
            sets: {
              where: { setType: 'WORKING' },
            },
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    // 4. Calculate RIR data per workout
    const dataPoints: RIRDataPoint[] = [];
    let trainingDayCounter = 1;
    let totalSets = 0;

    for (const workout of workouts) {
      // Apply time of day filter
      if (timeOfDay) {
        const workoutHour = workout.date.getHours();
        const isMatch = this.matchesTimeOfDay(workoutHour, timeOfDay);
        if (!isMatch) {
          trainingDayCounter++;
          continue;
        }
      }

      let rir0Count = 0;
      let rir1Count = 0;
      let rir2Count = 0;

      for (const exerciseLog of workout.exercises) {
        const { exercise, sets } = exerciseLog;

        // If exerciseId is provided, filter by exercise ID only (ignore muscle/equipment filters)
        if (exerciseId) {
          if (exerciseLog.exerciseId !== exerciseId) {
            continue;
          }
        } else {
          // Apply muscle group and equipment filters
          if (muscleGroup && derivePrimaryMuscle(exercise) !== muscleGroup) continue;
          if (equipment && exercise.equipment !== equipment) continue;
        }

        // Count sets by RIR (only 0, 1, 2)
        for (const set of sets) {
          if (set.rir === 0) rir0Count++;
          else if (set.rir === 1) rir1Count++;
          else if (set.rir === 2) rir2Count++;
          // Ignore RIR > 2
        }
      }

      const totalSetsThisWorkout = rir0Count + rir1Count + rir2Count;

      // Only add data point if we have sets matching filters
      if (totalSetsThisWorkout > 0) {
        dataPoints.push({
          date: workout.date.toISOString().split('T')[0],
          trainingDay: trainingDayCounter,
          rir0Count,
          rir1Count,
          rir2Count,
          workoutId: workout.id,
        });

        totalSets += totalSetsThisWorkout;
      }

      trainingDayCounter++;
    }

    // Apply week aggregation if requested
    let finalDataPoints = dataPoints;
    if (aggregation === 'week' && dataPoints.length > 0) {
      // For RIR, we need to sum all 3 counts separately
      const weekMap = new Map<string, RIRDataPoint[]>();

      for (const point of dataPoints) {
        const pointDate = new Date(point.date);
        const weekBounds = this.getWeekBounds(pointDate, cycle.startDate);
        const weekKey = weekBounds.start.toISOString();
        
        if (!weekMap.has(weekKey)) {
          weekMap.set(weekKey, []);
        }
        weekMap.get(weekKey)!.push(point);
      }

      finalDataPoints = [];
      for (const [weekKey, points] of weekMap.entries()) {
        const weekStart = new Date(weekKey);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        const weekNumber = this.getCycleWeekNumber(weekStart, cycle.startDate);
        const weekLabel = `Woche ${weekNumber}`;

        const aggregatedPoint: RIRDataPoint = {
          date: weekStart.toISOString().split('T')[0],
          trainingDay: points[0].trainingDay,
          rir0Count: points.reduce((sum, p) => sum + p.rir0Count, 0),
          rir1Count: points.reduce((sum, p) => sum + p.rir1Count, 0),
          rir2Count: points.reduce((sum, p) => sum + p.rir2Count, 0),
          workoutId: points[0].workoutId,
          weekNumber,
          weekLabel,
          weekStartDate: weekStart.toISOString().split('T')[0],
          weekEndDate: weekEnd.toISOString().split('T')[0],
          workoutCount: points.length,
        };

        finalDataPoints.push(aggregatedPoint);
      }

      finalDataPoints.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    return {
      cycleId: cycle.id,
      cycleName: cycle.name,
      dataPoints: finalDataPoints,
      totalSets,
      totalWorkouts: workouts.length,
    };
  }

  /**
   * RIR Analytics (time-based, not cycle-specific)
   * Counts working sets by RIR (0, 1, 2) over a time period
   */
  async getRIRAnalytics(
    userId: string,
    period: 'week' | 'month' | 'all' = 'month',
    startDate?: Date,
    endDate?: Date,
    gymId?: string,
    muscleGroup?: string | string[],
    equipment?: string | string[],
    aggregation?: 'day' | 'week',
    exerciseId?: string,
  ): Promise<RIRAnalyticsDto> {
    const muscleGroups = this.normalizeFilterArray(muscleGroup);
    const equipments = this.normalizeFilterArray(equipment);

    const dateFilter = this.getDateFilter(period, startDate, endDate);

    // Gym filter logic
    const gymFilter = gymId === 'andere'
      ? null
      : gymId === 'alle' || gymId === undefined
      ? undefined
      : gymId;

    const workouts = await this.prisma.workout.findMany({
      where: {
        userId,
        kind: 'WORKOUT' as any,
        date: dateFilter,
        ...(gymFilter !== undefined && { homeGymId: gymFilter }),
      },
      include: {
        exercises: {
          include: {
            exercise: {
              select: {
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
                equipment: true,
              },
            },
            sets: {
              where: { setType: 'WORKING' },
            },
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    const dataPoints: RIRAnalyticsDataPoint[] = [];
    let totalSets = 0;

    for (const workout of workouts) {
      let rir0Count = 0;
      let rir1Count = 0;
      let rir2Count = 0;

      for (const exerciseLog of workout.exercises) {
        // If exerciseId is provided, filter by exercise ID only (ignore muscle/equipment filters)
        if (exerciseId) {
          if (exerciseLog.exerciseId !== exerciseId) {
            continue;
          }
        } else {
          // Apply muscle group and equipment filters
          if (!this.matchesMuscleFilter(derivePrimaryMuscle(exerciseLog.exercise), muscleGroups)) continue;
          if (!this.matchesEquipmentFilter(exerciseLog.exercise.equipment, equipments)) continue;
        }

        // Count sets by RIR
        for (const set of exerciseLog.sets) {
          if (set.rir === 0) rir0Count++;
          else if (set.rir === 1) rir1Count++;
          else if (set.rir === 2) rir2Count++;
        }
      }

      const totalSetsThisWorkout = rir0Count + rir1Count + rir2Count;

      if (totalSetsThisWorkout > 0) {
        dataPoints.push({
          date: workout.date.toISOString().split('T')[0],
          rir0Count,
          rir1Count,
          rir2Count,
          workoutId: workout.id,
        });

        totalSets += totalSetsThisWorkout;
      }
    }

    // Apply week aggregation if requested
    let finalDataPoints = dataPoints;
    if (aggregation === 'week' && dataPoints.length > 0) {
      // For RIR, we need to sum all 3 counts separately
      const weekMap = new Map<string, RIRAnalyticsDataPoint[]>();

      for (const point of dataPoints) {
        const pointDate = new Date(point.date);
        const weekBounds = this.getWeekBounds(pointDate, undefined);
        const weekKey = weekBounds.start.toISOString();
        
        if (!weekMap.has(weekKey)) {
          weekMap.set(weekKey, []);
        }
        weekMap.get(weekKey)!.push(point);
      }

      finalDataPoints = [];
      for (const [weekKey, points] of weekMap.entries()) {
        const weekStart = new Date(weekKey);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        const weekNumber = this.getCalendarWeek(weekStart);
        const weekLabel = `KW${weekNumber}`;

        const aggregatedPoint: RIRAnalyticsDataPoint = {
          date: weekStart.toISOString().split('T')[0],
          rir0Count: points.reduce((sum, p) => sum + p.rir0Count, 0),
          rir1Count: points.reduce((sum, p) => sum + p.rir1Count, 0),
          rir2Count: points.reduce((sum, p) => sum + p.rir2Count, 0),
          workoutId: points[0].workoutId,
          weekNumber,
          weekLabel,
          weekStartDate: weekStart.toISOString().split('T')[0],
          weekEndDate: weekEnd.toISOString().split('T')[0],
          workoutCount: points.length,
        };

        finalDataPoints.push(aggregatedPoint);
      }

      finalDataPoints.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    return {
      totalSets,
      period,
      dataPoints: finalDataPoints,
    };
  }

  /**
   * Duration Analytics (time-based)
   * Shows workout duration over time
   */
  async getDurationAnalytics(
    userId: string,
    period: 'week' | 'month' | 'all' = 'month',
    startDate?: Date,
    endDate?: Date,
    gymId?: string,
    muscleGroup?: string | string[],
    equipment?: string | string[],
    aggregation?: 'day' | 'week',
  ): Promise<DurationAnalyticsDto> {
    const muscleGroups = this.normalizeFilterArray(muscleGroup);
    const equipments = this.normalizeFilterArray(equipment);

    const dateFilter = this.getDateFilter(period, startDate, endDate);

    // Gym filter logic
    const gymFilter = gymId === 'andere'
      ? null
      : gymId === 'alle' || gymId === undefined
      ? undefined
      : gymId;

    const workouts = await this.prisma.workout.findMany({
      where: {
        userId,
        kind: 'WORKOUT' as any,
        date: dateFilter,
        ...(gymFilter !== undefined && { homeGymId: gymFilter }),
        totalDuration: { not: null }, // Only workouts with duration
      },
      include: {
        exercises: {
          include: {
            exercise: {
              select: {
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
                equipment: true,
              },
            },
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    const dataPoints: DurationDataPoint[] = [];
    let totalDuration = 0;
    let validWorkoutsCount = 0;

    for (const workout of workouts) {
      // Check if workout has exercises matching filters
      if (muscleGroup || equipment) {
        const hasMatchingExercise = workout.exercises.some(exerciseLog => {
          if (!this.matchesMuscleFilter(derivePrimaryMuscle(exerciseLog.exercise), muscleGroups)) return false;
          if (!this.matchesEquipmentFilter(exerciseLog.exercise.equipment, equipments)) return false;
          return true;
        });

        if (!hasMatchingExercise) continue;
      }

      const durationInMinutes = Math.round(workout.totalDuration / 60);

      dataPoints.push({
        date: workout.date.toISOString().split('T')[0],
        duration: durationInMinutes,
        workoutId: workout.id,
      });

      totalDuration += durationInMinutes;
      validWorkoutsCount++;
    }

    // Apply week aggregation if requested
    const finalDataPoints = aggregation === 'week'
      ? this.aggregateByWeek(dataPoints, 'average', 'duration', undefined)
      : dataPoints;

    const averageDuration = validWorkoutsCount > 0
      ? Math.round(totalDuration / validWorkoutsCount)
      : 0;

    return {
      averageDuration,
      period,
      dataPoints: finalDataPoints,
    };
  }

  /**
   * Duration Analytics for entire cycle
   */
  async getDurationByCycle(
    userId: string,
    cycleId: string,
    gymId?: string,
    muscleGroup?: string | string[],
    equipment?: string | string[],
    aggregation?: 'day' | 'week',
  ): Promise<DurationByCycleDto> {
    const muscleGroups = this.normalizeFilterArray(muscleGroup);
    const equipments = this.normalizeFilterArray(equipment);

    // 1. Verify user owns this cycle
    const cycle = await this.prisma.workoutCycle.findFirst({
      where: { id: cycleId, userId },
    });

    if (!cycle) {
      throw new NotFoundException('Cycle not found');
    }

    // 2. Build where clause
    const gymFilter = gymId === 'andere'
      ? null
      : gymId === 'alle' || gymId === undefined
      ? undefined
      : gymId;
    
    const whereClause: any = {
      cycleId,
      kind: 'WORKOUT' as any,
      totalDuration: { not: null },
    };

    if (gymFilter !== undefined) {
      whereClause.homeGymId = gymFilter;
    }

    // 3. Get all completed workouts
    const workouts = await this.prisma.workout.findMany({
      where: whereClause,
      include: {
        exercises: {
          include: {
            exercise: {
              select: {
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
                equipment: true,
              },
            },
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    // 4. Calculate duration data per workout
    const dataPoints: DurationDataPoint[] = [];
    let trainingDayCounter = 1;
    let totalDuration = 0;
    let validWorkoutsCount = 0;

    for (const workout of workouts) {
      // Check if workout has exercises matching filters
      if (muscleGroup || equipment) {
        const hasMatchingExercise = workout.exercises.some(exerciseLog => {
          if (!this.matchesMuscleFilter(derivePrimaryMuscle(exerciseLog.exercise), muscleGroups)) return false;
          if (!this.matchesEquipmentFilter(exerciseLog.exercise.equipment, equipments)) return false;
          return true;
        });

        if (!hasMatchingExercise) {
          trainingDayCounter++;
          continue;
        }
      }

      const durationInMinutes = Math.round(workout.totalDuration / 60);

      dataPoints.push({
        date: workout.date.toISOString().split('T')[0],
        duration: durationInMinutes,
        workoutId: workout.id,
        trainingDay: trainingDayCounter,
      });

      totalDuration += durationInMinutes;
      validWorkoutsCount++;
      trainingDayCounter++;
    }

    // Apply week aggregation if requested
    const finalDataPoints = aggregation === 'week'
      ? this.aggregateByWeek(dataPoints, 'average', 'duration', cycle.startDate)
      : dataPoints;

    const averageDuration = validWorkoutsCount > 0
      ? Math.round(totalDuration / validWorkoutsCount)
      : 0;

    return {
      cycleId: cycle.id,
      cycleName: cycle.name,
      dataPoints: finalDataPoints,
      averageDuration,
      totalWorkouts: validWorkoutsCount,
    };
  }

  /**
   * Rest Time Analytics (time-based)
   * Shows average rest time between sets over time
   */
  async getRestTimeAnalytics(
    userId: string,
    period: 'week' | 'month' | 'all' = 'month',
    startDate?: Date,
    endDate?: Date,
    gymId?: string,
    muscleGroup?: string | string[],
    equipment?: string | string[],
    aggregation?: 'day' | 'week',
    exerciseId?: string,
  ): Promise<RestTimeAnalyticsDto> {
    const muscleGroups = this.normalizeFilterArray(muscleGroup);
    const equipments = this.normalizeFilterArray(equipment);

    const dateFilter = this.getDateFilter(period, startDate, endDate);

    // Gym filter logic
    const gymFilter = gymId === 'andere'
      ? null
      : gymId === 'alle' || gymId === undefined
      ? undefined
      : gymId;

    const workouts = await this.prisma.workout.findMany({
      where: {
        userId,
        kind: 'WORKOUT' as any,
        date: dateFilter,
        ...(gymFilter !== undefined && { homeGymId: gymFilter }),
      },
      include: {
        exercises: {
          include: {
            exercise: {
              select: {
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
                equipment: true,
              },
            },
            sets: {
              where: {
                rest: { not: null },
              },
            },
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    const dataPoints: RestTimeDataPoint[] = [];
    let totalRestTime = 0;
    let totalRestTimeCounts = 0;

    for (const workout of workouts) {
      let workoutRestTimeSum = 0;
      let workoutRestTimeCount = 0;

      for (const exerciseLog of workout.exercises) {
        // If exerciseId is provided, filter by exercise ID only (ignore muscle/equipment filters)
        if (exerciseId) {
          if (exerciseLog.exerciseId !== exerciseId) {
            continue;
          }
        } else {
          // Apply muscle group and equipment filters
          if (!this.matchesMuscleFilter(derivePrimaryMuscle(exerciseLog.exercise), muscleGroups)) continue;
          if (!this.matchesEquipmentFilter(exerciseLog.exercise.equipment, equipments)) continue;
        }

        // Sum up actual rest durations from sets
        for (const set of exerciseLog.sets) {
          if (set.rest !== null) {
            workoutRestTimeSum += set.rest;
            workoutRestTimeCount++;
          }
        }
      }

      // Only add datapoint if we have rest time data
      if (workoutRestTimeCount > 0) {
        const avgRestTime = Math.round(workoutRestTimeSum / workoutRestTimeCount);

        dataPoints.push({
          date: workout.date.toISOString().split('T')[0],
          averageRestTime: avgRestTime,
          workoutId: workout.id,
        });

        totalRestTime += avgRestTime;
        totalRestTimeCounts++;
      }
    }

    // Apply week aggregation if requested
    const finalDataPoints = aggregation === 'week'
      ? this.aggregateByWeek(dataPoints, 'average', 'averageRestTime', undefined)
      : dataPoints;

    const overallAverage = totalRestTimeCounts > 0
      ? Math.round(totalRestTime / totalRestTimeCounts)
      : 0;

    return {
      overallAverage,
      period,
      dataPoints: finalDataPoints,
    };
  }

  /**
   * Rest Time Analytics for entire cycle
   */
  async getRestTimeByCycle(
    userId: string,
    cycleId: string,
    gymId?: string,
    muscleGroup?: string | string[],
    equipment?: string | string[],
    aggregation?: 'day' | 'week',
    exerciseId?: string,
  ): Promise<RestTimeByCycleDto> {
    const muscleGroups = this.normalizeFilterArray(muscleGroup);
    const equipments = this.normalizeFilterArray(equipment);

    // 1. Verify user owns this cycle
    const cycle = await this.prisma.workoutCycle.findFirst({
      where: { id: cycleId, userId },
    });

    if (!cycle) {
      throw new NotFoundException('Cycle not found');
    }

    // 2. Build where clause
    const gymFilter = gymId === 'andere'
      ? null
      : gymId === 'alle' || gymId === undefined
      ? undefined
      : gymId;
    
    const whereClause: any = {
      cycleId,
      kind: 'WORKOUT' as any,
    };

    if (gymFilter !== undefined) {
      whereClause.homeGymId = gymFilter;
    }

    // 3. Get all completed workouts
    const workouts = await this.prisma.workout.findMany({
      where: whereClause,
      include: {
        exercises: {
          include: {
            exercise: {
              select: {
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
                equipment: true,
              },
            },
            sets: {
              where: {
                rest: { not: null },
              },
            },
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    // 4. Calculate rest time data per workout
    const dataPoints: RestTimeDataPoint[] = [];
    let trainingDayCounter = 1;
    let totalRestTime = 0;
    let totalRestTimeCounts = 0;

    for (const workout of workouts) {
      let workoutRestTimeSum = 0;
      let workoutRestTimeCount = 0;

      for (const exerciseLog of workout.exercises) {
        // If exerciseId is provided, filter by exercise ID only (ignore muscle/equipment filters)
        if (exerciseId) {
          if (exerciseLog.exerciseId !== exerciseId) {
            continue;
          }
        } else {
          // Apply muscle group and equipment filters
          if (!this.matchesMuscleFilter(derivePrimaryMuscle(exerciseLog.exercise), muscleGroups)) continue;
          if (!this.matchesEquipmentFilter(exerciseLog.exercise.equipment, equipments)) continue;
        }

        // Sum up actual rest durations from sets
        for (const set of exerciseLog.sets) {
          if (set.rest !== null) {
            workoutRestTimeSum += set.rest;
            workoutRestTimeCount++;
          }
        }
      }

      // Only add datapoint if we have rest time data
      if (workoutRestTimeCount > 0) {
        const avgRestTime = Math.round(workoutRestTimeSum / workoutRestTimeCount);

        dataPoints.push({
          date: workout.date.toISOString().split('T')[0],
          averageRestTime: avgRestTime,
          workoutId: workout.id,
          trainingDay: trainingDayCounter,
        });

        totalRestTime += avgRestTime;
        totalRestTimeCounts++;
      }

      trainingDayCounter++;
    }

    // Apply week aggregation if requested
    const finalDataPoints = aggregation === 'week'
      ? this.aggregateByWeek(dataPoints, 'average', 'averageRestTime', cycle.startDate)
      : dataPoints;

    const overallAverage = totalRestTimeCounts > 0
      ? Math.round(totalRestTime / totalRestTimeCounts)
      : 0;

    return {
      cycleId: cycle.id,
      cycleName: cycle.name,
      dataPoints: finalDataPoints,
      overallAverage,
      totalWorkouts: totalRestTimeCounts,
    };
  }

  /**
   * Reps Analytics (time-based)
   * Shows total repetitions per workout over time
   */
  async getRepsAnalytics(
    userId: string,
    period: 'week' | 'month' | 'all' = 'month',
    startDate?: Date,
    endDate?: Date,
    gymId?: string,
    muscleGroup?: string | string[],
    equipment?: string | string[],
    aggregation?: 'day' | 'week',
    exerciseId?: string,
  ): Promise<RepsAnalyticsDto> {
    const muscleGroups = this.normalizeFilterArray(muscleGroup);
    const equipments = this.normalizeFilterArray(equipment);

    const dateFilter = this.getDateFilter(period, startDate, endDate);

    // Gym filter logic
    const gymFilter = gymId === 'andere'
      ? null
      : gymId === 'alle' || gymId === undefined
      ? undefined
      : gymId;

    const workouts = await this.prisma.workout.findMany({
      where: {
        userId,
        kind: 'WORKOUT' as any,
        date: dateFilter,
        ...(gymFilter !== undefined && { homeGymId: gymFilter }),
      },
      include: {
        exercises: {
          include: {
            exercise: {
              select: {
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
                equipment: true,
              },
            },
            sets: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    const dataPoints: RepsDataPoint[] = [];
    let totalReps = 0;
    let validWorkoutsCount = 0;

    for (const workout of workouts) {
      let workoutReps = 0;

      for (const exerciseLog of workout.exercises) {
        // If exerciseId is provided, filter by exercise ID only (ignore muscle/equipment filters)
        if (exerciseId) {
          if (exerciseLog.exerciseId !== exerciseId) {
            continue;
          }
        } else {
          // Apply muscle group and equipment filters
          if (!this.matchesMuscleFilter(derivePrimaryMuscle(exerciseLog.exercise), muscleGroups)) {
            continue;
          }
          if (!this.matchesEquipmentFilter(exerciseLog.exercise.equipment, equipments)) {
            continue;
          }
        }

        for (const set of exerciseLog.sets) {
          // Skip warmup sets - only count working sets
          if (set.setType === 'WARMUP') continue;
          workoutReps += set.reps;
        }
      }

      // Only add data point if workout has reps
      if (workoutReps > 0 || (!muscleGroup && !equipment)) {
        dataPoints.push({
          date: workout.date.toISOString().split('T')[0],
          reps: workoutReps,
          workoutId: workout.id,
        });

        totalReps += workoutReps;
        validWorkoutsCount++;
      }
    }

    // Apply week aggregation if requested
    const finalDataPoints = aggregation === 'week'
      ? this.aggregateByWeek(dataPoints, 'sum', 'reps', undefined)
      : dataPoints;

    const averageReps = validWorkoutsCount > 0
      ? Math.round(totalReps / validWorkoutsCount)
      : 0;

    return {
      totalReps,
      averageReps,
      period,
      dataPoints: finalDataPoints,
    };
  }

  /**
   * Reps Analytics for entire cycle
   */
  async getRepsByCycle(
    userId: string,
    cycleId: string,
    muscleGroup?: string | string[],
    equipment?: string | string[],
    aggregation?: 'day' | 'week',
    exerciseId?: string,
  ): Promise<RepsByCycleDto> {
    const muscleGroups = this.normalizeFilterArray(muscleGroup);
    const equipments = this.normalizeFilterArray(equipment);

    const cycle = await this.prisma.workoutCycle.findFirst({
      where: { id: cycleId, userId },
      include: {
        workouts: {
          where: {
            userId,
            kind: 'WORKOUT' as any,
          },
          include: {
            exercises: {
              include: {
                exercise: {
                  select: {
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
                    equipment: true,
                  },
                },
                sets: true,
              },
            },
          },
          orderBy: { date: 'asc' },
        },
      },
    });

    if (!cycle) {
      throw new NotFoundException(`Cycle with ID ${cycleId} not found`);
    }

    const dataPoints: RepsDataPoint[] = [];
    let totalReps = 0;
    let validWorkoutsCount = 0;
    let trainingDayCounter = 1;

    for (const workout of cycle.workouts) {
      let workoutReps = 0;

      for (const exerciseLog of workout.exercises) {
        // If exerciseId is provided, filter by exercise ID only (ignore muscle/equipment filters)
        if (exerciseId) {
          if (exerciseLog.exerciseId !== exerciseId) {
            continue;
          }
        } else {
          // Apply muscle group and equipment filters
          if (!this.matchesMuscleFilter(derivePrimaryMuscle(exerciseLog.exercise), muscleGroups)) {
            continue;
          }
          if (!this.matchesEquipmentFilter(exerciseLog.exercise.equipment, equipments)) {
            continue;
          }
        }

        for (const set of exerciseLog.sets) {
          // Skip warmup sets - only count working sets
          if (set.setType === 'WARMUP') continue;
          workoutReps += set.reps;
        }
      }

      // Only add data point if workout has reps
      if (workoutReps > 0 || (!muscleGroup && !equipment)) {
        dataPoints.push({
          date: workout.date.toISOString().split('T')[0],
          reps: workoutReps,
          workoutId: workout.id,
          trainingDay: trainingDayCounter,
        });

        totalReps += workoutReps;
        validWorkoutsCount++;
      }

      trainingDayCounter++;
    }

    // Apply week aggregation if requested
    const finalDataPoints = aggregation === 'week'
      ? this.aggregateByWeek(dataPoints, 'sum', 'reps', cycle.startDate)
      : dataPoints;

    const averageReps = validWorkoutsCount > 0
      ? Math.round(totalReps / validWorkoutsCount)
      : 0;

    return {
      cycleId: cycle.id,
      cycleName: cycle.name,
      dataPoints: finalDataPoints,
      totalReps,
      averageReps,
      totalWorkouts: validWorkoutsCount,
    };
  }

  /**
   * Sets Analytics for time-based view
   */
  async getSetsAnalytics(
    userId: string,
    period: 'week' | 'month' | 'all' = 'month',
    startDate?: Date,
    endDate?: Date,
    gymId?: string,
    muscleGroup?: string | string[],
    equipment?: string | string[],
    aggregation?: 'day' | 'week',
    exerciseId?: string,
  ): Promise<SetsAnalyticsDto> {
    const muscleGroups = this.normalizeFilterArray(muscleGroup);
    const equipments = this.normalizeFilterArray(equipment);

    const dateFilter = this.getDateFilter(period, startDate, endDate);

    // Gym filter logic
    const gymFilter = gymId === 'andere'
      ? null
      : gymId === 'alle' || gymId === undefined
      ? undefined
      : gymId;

    const workouts = await this.prisma.workout.findMany({
      where: {
        userId,
        kind: 'WORKOUT' as any,
        date: dateFilter,
        ...(gymFilter !== undefined && { homeGymId: gymFilter }),
      },
      include: {
        exercises: {
          include: {
            exercise: {
              select: {
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
                equipment: true,
              },
            },
            sets: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    const dataPoints: SetsDataPoint[] = [];
    let totalSets = 0;
    let validWorkoutsCount = 0;

    for (const workout of workouts) {
      let workoutSets = 0;

      for (const exerciseLog of workout.exercises) {
        // If exerciseId is provided, filter by exercise ID only (ignore muscle/equipment filters)
        if (exerciseId) {
          if (exerciseLog.exerciseId !== exerciseId) {
            continue;
          }
        } else {
          // Apply muscle group and equipment filters
          if (!this.matchesMuscleFilter(derivePrimaryMuscle(exerciseLog.exercise), muscleGroups)) {
            continue;
          }
          if (!this.matchesEquipmentFilter(exerciseLog.exercise.equipment, equipments)) {
            continue;
          }
        }

        for (const set of exerciseLog.sets) {
          // Skip warmup sets - only count working sets
          if (set.setType === 'WARMUP') continue;
          workoutSets++;
        }
      }

      // Only add data point if workout has sets
      if (workoutSets > 0 || (!muscleGroup && !equipment)) {
        dataPoints.push({
          date: workout.date.toISOString().split('T')[0],
          sets: workoutSets,
          workoutId: workout.id,
        });

        totalSets += workoutSets;
        validWorkoutsCount++;
      }
    }

    // Apply week aggregation if requested
    const finalDataPoints = aggregation === 'week'
      ? this.aggregateByWeek(dataPoints, 'sum', 'sets', undefined)
      : dataPoints;

    const averageSets = validWorkoutsCount > 0
      ? Math.round(totalSets / validWorkoutsCount)
      : 0;

    return {
      totalSets,
      averageSets,
      period,
      dataPoints: finalDataPoints,
    };
  }

  /**
   * Sets Analytics for entire cycle
   */
  async getSetsByCycle(
    userId: string,
    cycleId: string,
    muscleGroup?: string | string[],
    equipment?: string | string[],
    aggregation?: 'day' | 'week',
    exerciseId?: string,
  ): Promise<SetsByCycleDto> {
    const muscleGroups = this.normalizeFilterArray(muscleGroup);
    const equipments = this.normalizeFilterArray(equipment);

    const cycle = await this.prisma.workoutCycle.findFirst({
      where: { id: cycleId, userId },
      include: {
        workouts: {
          where: {
            userId,
            kind: 'WORKOUT' as any,
          },
          include: {
            exercises: {
              include: {
                exercise: {
                  select: {
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
                    equipment: true,
                  },
                },
                sets: true,
              },
            },
          },
          orderBy: { date: 'asc' },
        },
      },
    });

    if (!cycle) {
      throw new NotFoundException(`Cycle with ID ${cycleId} not found`);
    }

    const dataPoints: SetsDataPoint[] = [];
    let totalSets = 0;
    let validWorkoutsCount = 0;
    let trainingDayCounter = 1;

    for (const workout of cycle.workouts) {
      let workoutSets = 0;

      for (const exerciseLog of workout.exercises) {
        // If exerciseId is provided, filter by exercise ID only (ignore muscle/equipment filters)
        if (exerciseId) {
          if (exerciseLog.exerciseId !== exerciseId) {
            continue;
          }
        } else {
          // Apply muscle group and equipment filters
          if (!this.matchesMuscleFilter(derivePrimaryMuscle(exerciseLog.exercise), muscleGroups)) {
            continue;
          }
          if (!this.matchesEquipmentFilter(exerciseLog.exercise.equipment, equipments)) {
            continue;
          }
        }

        for (const set of exerciseLog.sets) {
          // Skip warmup sets - only count working sets
          if (set.setType === 'WARMUP') continue;
          workoutSets++;
        }
      }

      // Only add data point if workout has sets
      if (workoutSets > 0 || (!muscleGroup && !equipment)) {
        dataPoints.push({
          date: workout.date.toISOString().split('T')[0],
          sets: workoutSets,
          workoutId: workout.id,
          trainingDay: trainingDayCounter,
        });

        totalSets += workoutSets;
        validWorkoutsCount++;
      }

      trainingDayCounter++;
    }

    // Apply week aggregation if requested
    const finalDataPoints = aggregation === 'week'
      ? this.aggregateByWeek(dataPoints, 'sum', 'sets', cycle.startDate)
      : dataPoints;

    const averageSets = validWorkoutsCount > 0
      ? Math.round(totalSets / validWorkoutsCount)
      : 0;

    return {
      cycleId: cycle.id,
      cycleName: cycle.name,
      dataPoints: finalDataPoints,
      totalSets,
      averageSets,
      totalWorkouts: validWorkoutsCount,
    };
  }
}
