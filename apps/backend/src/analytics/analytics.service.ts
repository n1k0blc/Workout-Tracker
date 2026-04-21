import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ORMService } from '../orm/orm.service';
import {
  VolumeAnalyticsDto,
  VolumeDataPoint,
  VolumeByMuscleGroup,
  OneRMAnalyticsDto,
  OneRMDataPoint,
  PersonalRecordsDto,
  PersonalRecord,
  MuscleDistributionDto,
  MuscleDistributionItem,
  TimeTrackingDto,
  TimeTrackingDataPoint,
  CycleListDto,
  CycleListItem,
  ORMByCycleDto,
  ORMDataPoint,
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

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private ormService: ORMService,
  ) {}

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
   * Helper: Check if exercise matches equipment filter
   */
  private matchesEquipmentFilter(equipment: string, filter: string[]): boolean {
    if (filter.length === 0) return true; // No filter = match all
    return filter.includes(equipment);
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
        status: 'COMPLETED' as any,
        date: dateFilter,
        ...(gymFilter !== undefined && { homeGymId: gymFilter }),
        ...(cycleId && { cycleId }), // NEW: Filter by cycle if provided
      },
      include: {
        exercises: {
          include: {
            exercise: {
              select: {
                muscleGroup: true,
                equipment: true,
                isUnilateral: true,
                isDoubleWeight: true,
              },
            },
            sets: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    const dataPoints: VolumeDataPoint[] = [];
    const volumeByMuscleGroup: Map<string, number> = new Map();
    let totalVolume = 0;
    let trainingDayCounter = 1; // For cycle mode

    for (const workout of workouts) {
      let workoutVolume = 0;

      for (const exerciseLog of workout.exercises) {
        // Apply muscle group and equipment filters
        if (!this.matchesMuscleFilter(exerciseLog.exercise.muscleGroup, muscleGroups)) {
          continue;
        }
        if (!this.matchesEquipmentFilter(exerciseLog.exercise.equipment, equipments)) {
          continue;
        }

        for (const set of exerciseLog.sets) {
          // Skip warmup sets - only count working sets for volume
          if (set.setType === 'WARMUP') continue;

          const setVolume = set.reps * set.weight * 
            (exerciseLog.exercise.isUnilateral ? 2 : 1) * 
            (exerciseLog.exercise.isDoubleWeight ? 2 : 1);
          workoutVolume += setVolume;

          // Track by muscle group
          const mgKey = exerciseLog.exercise.muscleGroup;
          volumeByMuscleGroup.set(
            mgKey,
            (volumeByMuscleGroup.get(mgKey) || 0) + setVolume,
          );
        }
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

    // Calculate percentages for muscle groups
    const byMuscleGroup: VolumeByMuscleGroup[] = Array.from(volumeByMuscleGroup.entries()).map(
      ([muscleGroup, volume]) => ({
        muscleGroup,
        volume,
        percentage: totalVolume > 0 ? (volume / totalVolume) * 100 : 0,
      }),
    );

    return {
      totalVolume,
      period,
      dataPoints,
      byMuscleGroup,
    };
  }

  /**
   * One Rep Max Analytics (Epley Formula)
   * 1RM = weight × (1 + reps / 30)
   */
  async getOneRMAnalytics(userId: string, exerciseId: string): Promise<OneRMAnalyticsDto> {
    // Verify exercise exists
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
      select: { 
        name: true,
        isUnilateral: true,
        isDoubleWeight: true,
      },
    });

    if (!exercise) {
      throw new NotFoundException('Exercise not found');
    }

    const workouts = await this.prisma.workout.findMany({
      where: {
        userId,
        status: 'COMPLETED' as any,
        homeGymId: { not: null }, // Only count 1RM from home gym workouts
        exercises: {
          some: {
            exerciseId,
          },
        },
      },
      include: {
        exercises: {
          where: { exerciseId },
          include: {
            exercise: {
              select: {
                isUnilateral: true,
                isDoubleWeight: true,
              },
            },
            sets: {
              orderBy: { completedAt: 'asc' },
            },
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    const history: OneRMDataPoint[] = [];
    let bestOneRM = 0;
    let currentOneRM = 0;

    for (const workout of workouts) {
      for (const exerciseLog of workout.exercises) {
        for (const set of exerciseLog.sets) {
          // Skip warmup sets - only count working sets for 1RM
          if (set.setType === 'WARMUP') continue;

          const adjustedWeight = set.weight * (exerciseLog.exercise.isDoubleWeight ? 2 : 1);
          const oneRM = this.calculateOneRM(adjustedWeight, set.reps);

          history.push({
            date: workout.date.toISOString().split('T')[0],
            oneRepMax: oneRM,
            weight: adjustedWeight,
            reps: set.reps,
            workoutId: workout.id,
          });

          if (oneRM > bestOneRM) {
            bestOneRM = oneRM;
          }

          // Last workout is current
          currentOneRM = oneRM;
        }
      }
    }

    const improvement = bestOneRM > 0 ? ((currentOneRM - bestOneRM) / bestOneRM) * 100 : 0;

    return {
      exerciseId,
      exerciseName: exercise.name,
      currentOneRM,
      bestOneRM,
      improvement,
      history,
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
        status: 'COMPLETED' as any,
        ...(gymFilter !== undefined && { homeGymId: gymFilter }),
      },
      include: {
        exercises: {
          include: {
            exercise: {
              select: {
                name: true,
                muscleGroup: true,
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
        if (!this.matchesMuscleFilter(exerciseLog.exercise.muscleGroup, muscleGroups)) {
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
        status: 'COMPLETED' as any,
        date: dateFilter,
        ...(gymFilter !== undefined && { homeGymId: gymFilter }),
      },
      include: {
        exercises: {
          include: {
            exercise: {
              select: {
                muscleGroup: true,
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
        const muscleGroup = exerciseLog.exercise.muscleGroup;

        if (!distributionMap.has(muscleGroup)) {
          distributionMap.set(muscleGroup, { volume: 0, workoutCount: new Set() });
        }

        const data = distributionMap.get(muscleGroup);
        data.workoutCount.add(workout.id);

        for (const set of exerciseLog.sets) {
          // Skip warmup sets - only count working sets for muscle distribution
          if (set.setType === 'WARMUP') continue;

          const setVolume = set.reps * set.weight * 
            (exerciseLog.exercise.isUnilateral ? 2 : 1) * 
            (exerciseLog.exercise.isDoubleWeight ? 2 : 1);
          data.volume += setVolume;
          totalVolume += setVolume;
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
        status: 'COMPLETED' as any,
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
   * Helper: Calculate 1RM using Epley Formula
   * 1RM = weight × (1 + reps / 30)
   */
  private calculateOneRM(weight: number, reps: number): number {
    if (reps === 1) {
      return weight;
    }
    return Math.round(weight * (1 + reps / 30) * 10) / 10;
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
   * ORM Analytics for a specific cycle workout day
   */
  async getORMAnalytics(
    cycleId: string,
    workoutDayId: string,
    userId: string,
  ) {
    // 1. Verify user owns this cycle
    const cycle = await this.prisma.workoutCycle.findFirst({
      where: { id: cycleId, userId },
    });

    if (!cycle) {
      throw new NotFoundException('Cycle not found');
    }

    // 2. Get all completed workouts for this workout day (Home Gym only)
    const workouts = await this.prisma.workout.findMany({
      where: {
        cycleId,
        workoutDayId,
        status: 'COMPLETED' as any,
        homeGymId: { not: null }, // Only Home Gym workouts for consistent equipment
      },
      include: {
        exercises: {
          include: {
            exercise: true,
            sets: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    // 3. For each workout, calculate ORM data
    const workoutsData = await Promise.all(
      workouts.map(async workout => {
        const exercisesData = await Promise.all(
          workout.exercises.map(async exerciseLog => {
            const { exerciseId, exercise, sets } = exerciseLog;

            // Get benchmark
            const benchmarkRecord = await this.ormService.getBenchmark(
              cycleId,
              workoutDayId,
              exerciseId,
            );

            if (!benchmarkRecord) {
              return null; // No benchmark = skip
            }

            // Calculate %ORM
            const workingSets = sets.filter((s: any) => s.setType === 'WORKING');
            const percentORM = this.ormService.calculateExercisePercentORM(
              workingSets,
              benchmarkRecord.ormBenchmark,
              exercise,
            );

            return {
              exerciseId,
              exerciseName: exercise.name,
              benchmark: benchmarkRecord.ormBenchmark,
              percentORM,
              wasBenchmarkSet: benchmarkRecord.setAtWorkoutId === workout.id,
            };
          }),
        );

        return {
          workoutId: workout.id,
          date: workout.date.toISOString(),
          exercises: exercisesData.filter(e => e !== null),
        };
      }),
    );

    return { workouts: workoutsData };
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
   * ORM Analytics for entire cycle (all workout days combined)
   * Aggregates %ORM across all exercises matching filters per training day
   */
  async getORMByCycle(
    userId: string,
    cycleId: string,
    muscleGroup?: string | string[],
    equipment?: string | string[],
  ): Promise<ORMByCycleDto> {
    // 1. Verify user owns this cycle
    const cycle = await this.prisma.workoutCycle.findFirst({
      where: { id: cycleId, userId },
      include: {
        workoutDays: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!cycle) {
      throw new NotFoundException('Cycle not found');
    }

    // 2. Get all completed Home Gym workouts for this cycle
    const workouts = await this.prisma.workout.findMany({
      where: {
        cycleId,
        status: 'COMPLETED' as any,
        homeGymId: { not: null }, // Only Home Gym for ORM consistency
      },
      include: {
        exercises: {
          include: {
            exercise: {
              select: {
                id: true,
                name: true,
                muscleGroup: true,
                equipment: true,
                isUnilateral: true,
                isDoubleWeight: true,
              },
            },
            sets: {
              where: { setType: 'WORKING' },
            },
          },
        },
        workoutDay: {
          select: {
            id: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    // 3. Calculate ORM data per workout
    const dataPoints: ORMDataPoint[] = [];
    let trainingDayCounter = 1;
    let totalPercentORM = 0;
    let dataPointCount = 0;

    for (const workout of workouts) {
      const exerciseORMs: number[] = [];

      for (const exerciseLog of workout.exercises) {
        const { exercise, sets, exerciseId } = exerciseLog;

        // Apply filters
        if (muscleGroup && exercise.muscleGroup !== muscleGroup) continue;
        if (equipment && exercise.equipment !== equipment) continue;

        // Get benchmark
        const benchmark = await this.ormService.getBenchmark(
          cycleId,
          workout.workoutDay.id,
          exerciseId,
        );

        if (!benchmark) continue;

        // Calculate %ORM for this exercise
        const percentORM = this.ormService.calculateExercisePercentORM(
          sets,
          benchmark.ormBenchmark,
          exercise as any, // Cast: we only need isDoubleWeight
        );

        exerciseORMs.push(percentORM);
      }

      // Only add data point if we have exercises matching filters
      if (exerciseORMs.length > 0) {
        const avgPercentORM = exerciseORMs.reduce((sum, val) => sum + val, 0) / exerciseORMs.length;

        dataPoints.push({
          date: workout.date.toISOString().split('T')[0],
          trainingDay: trainingDayCounter,
          percentORM: Math.round(avgPercentORM * 10) / 10,
          workoutId: workout.id,
        });

        totalPercentORM += avgPercentORM;
        dataPointCount++;
      }

      trainingDayCounter++;
    }

    const averagePercentORM = dataPointCount > 0
      ? Math.round((totalPercentORM / dataPointCount) * 10) / 10
      : 0;

    return {
      cycleId: cycle.id,
      cycleName: cycle.name,
      dataPoints,
      averagePercentORM,
      totalWorkouts: workouts.length,
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
      status: 'COMPLETED' as any,
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
                muscleGroup: true,
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

        // Apply filters
        if (muscleGroup && exercise.muscleGroup !== muscleGroup) continue;
        if (equipment && exercise.equipment !== equipment) continue;

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

    return {
      cycleId: cycle.id,
      cycleName: cycle.name,
      dataPoints,
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
        status: 'COMPLETED' as any,
        date: dateFilter,
        ...(gymFilter !== undefined && { homeGymId: gymFilter }),
      },
      include: {
        exercises: {
          include: {
            exercise: {
              select: {
                muscleGroup: true,
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
        // Apply filters
        if (!this.matchesMuscleFilter(exerciseLog.exercise.muscleGroup, muscleGroups)) continue;
        if (!this.matchesEquipmentFilter(exerciseLog.exercise.equipment, equipments)) continue;

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

    return {
      totalSets,
      period,
      dataPoints,
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
        status: 'COMPLETED' as any,
        date: dateFilter,
        ...(gymFilter !== undefined && { homeGymId: gymFilter }),
        totalDuration: { not: null }, // Only workouts with duration
      },
      include: {
        exercises: {
          include: {
            exercise: {
              select: {
                muscleGroup: true,
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
          if (!this.matchesMuscleFilter(exerciseLog.exercise.muscleGroup, muscleGroups)) return false;
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

    const averageDuration = validWorkoutsCount > 0
      ? Math.round(totalDuration / validWorkoutsCount)
      : 0;

    return {
      averageDuration,
      period,
      dataPoints,
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
      status: 'COMPLETED' as any,
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
                muscleGroup: true,
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
          if (!this.matchesMuscleFilter(exerciseLog.exercise.muscleGroup, muscleGroups)) return false;
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

    const averageDuration = validWorkoutsCount > 0
      ? Math.round(totalDuration / validWorkoutsCount)
      : 0;

    return {
      cycleId: cycle.id,
      cycleName: cycle.name,
      dataPoints,
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
        status: 'COMPLETED' as any,
        date: dateFilter,
        ...(gymFilter !== undefined && { homeGymId: gymFilter }),
      },
      include: {
        exercises: {
          include: {
            exercise: {
              select: {
                muscleGroup: true,
                equipment: true,
              },
            },
            sets: {
              where: {
                actualRestDuration: { not: null },
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
        // Apply muscle group and equipment filters
        if (!this.matchesMuscleFilter(exerciseLog.exercise.muscleGroup, muscleGroups)) continue;
        if (!this.matchesEquipmentFilter(exerciseLog.exercise.equipment, equipments)) continue;

        // Sum up actual rest durations from sets
        for (const set of exerciseLog.sets) {
          if (set.actualRestDuration !== null) {
            workoutRestTimeSum += set.actualRestDuration;
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

    const overallAverage = totalRestTimeCounts > 0
      ? Math.round(totalRestTime / totalRestTimeCounts)
      : 0;

    return {
      overallAverage,
      period,
      dataPoints,
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
      status: 'COMPLETED' as any,
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
                muscleGroup: true,
                equipment: true,
              },
            },
            sets: {
              where: {
                actualRestDuration: { not: null },
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
        // Apply muscle group and equipment filters
        if (!this.matchesMuscleFilter(exerciseLog.exercise.muscleGroup, muscleGroups)) continue;
        if (!this.matchesEquipmentFilter(exerciseLog.exercise.equipment, equipments)) continue;

        // Sum up actual rest durations from sets
        for (const set of exerciseLog.sets) {
          if (set.actualRestDuration !== null) {
            workoutRestTimeSum += set.actualRestDuration;
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

    const overallAverage = totalRestTimeCounts > 0
      ? Math.round(totalRestTime / totalRestTimeCounts)
      : 0;

    return {
      cycleId: cycle.id,
      cycleName: cycle.name,
      dataPoints,
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
        status: 'COMPLETED' as any,
        date: dateFilter,
        ...(gymFilter !== undefined && { homeGymId: gymFilter }),
      },
      include: {
        exercises: {
          include: {
            exercise: {
              select: {
                muscleGroup: true,
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
        // Apply muscle group and equipment filters
        if (!this.matchesMuscleFilter(exerciseLog.exercise.muscleGroup, muscleGroups)) {
          continue;
        }
        if (!this.matchesEquipmentFilter(exerciseLog.exercise.equipment, equipments)) {
          continue;
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

    const averageReps = validWorkoutsCount > 0
      ? Math.round(totalReps / validWorkoutsCount)
      : 0;

    return {
      totalReps,
      averageReps,
      period,
      dataPoints,
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
  ): Promise<RepsByCycleDto> {
    const muscleGroups = this.normalizeFilterArray(muscleGroup);
    const equipments = this.normalizeFilterArray(equipment);

    const cycle = await this.prisma.workoutCycle.findUnique({
      where: { id: cycleId },
      include: {
        workouts: {
          where: {
            userId,
            status: 'COMPLETED' as any,
          },
          include: {
            exercises: {
              include: {
                exercise: {
                  select: {
                    muscleGroup: true,
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
        // Apply muscle group and equipment filters
        if (!this.matchesMuscleFilter(exerciseLog.exercise.muscleGroup, muscleGroups)) {
          continue;
        }
        if (!this.matchesEquipmentFilter(exerciseLog.exercise.equipment, equipments)) {
          continue;
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

    const averageReps = validWorkoutsCount > 0
      ? Math.round(totalReps / validWorkoutsCount)
      : 0;

    return {
      cycleId: cycle.id,
      cycleName: cycle.name,
      dataPoints,
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
        status: 'COMPLETED' as any,
        date: dateFilter,
        ...(gymFilter !== undefined && { homeGymId: gymFilter }),
      },
      include: {
        exercises: {
          include: {
            exercise: {
              select: {
                muscleGroup: true,
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
        // Apply muscle group and equipment filters
        if (!this.matchesMuscleFilter(exerciseLog.exercise.muscleGroup, muscleGroups)) {
          continue;
        }
        if (!this.matchesEquipmentFilter(exerciseLog.exercise.equipment, equipments)) {
          continue;
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

    const averageSets = validWorkoutsCount > 0
      ? Math.round(totalSets / validWorkoutsCount)
      : 0;

    return {
      totalSets,
      averageSets,
      period,
      dataPoints,
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
  ): Promise<SetsByCycleDto> {
    const muscleGroups = this.normalizeFilterArray(muscleGroup);
    const equipments = this.normalizeFilterArray(equipment);

    const cycle = await this.prisma.workoutCycle.findUnique({
      where: { id: cycleId },
      include: {
        workouts: {
          where: {
            userId,
            status: 'COMPLETED' as any,
          },
          include: {
            exercises: {
              include: {
                exercise: {
                  select: {
                    muscleGroup: true,
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
        // Apply muscle group and equipment filters
        if (!this.matchesMuscleFilter(exerciseLog.exercise.muscleGroup, muscleGroups)) {
          continue;
        }
        if (!this.matchesEquipmentFilter(exerciseLog.exercise.equipment, equipments)) {
          continue;
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

    const averageSets = validWorkoutsCount > 0
      ? Math.round(totalSets / validWorkoutsCount)
      : 0;

    return {
      cycleId: cycle.id,
      cycleName: cycle.name,
      dataPoints,
      totalSets,
      averageSets,
      totalWorkouts: validWorkoutsCount,
    };
  }
}
