import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
} from './dto';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Volume Analytics
   * Volume = sets × reps × weight
   */
  async getVolumeAnalytics(
    userId: string,
    period: 'week' | 'month' | 'all' = 'month',
    startDate?: Date,
    endDate?: Date,
  ): Promise<VolumeAnalyticsDto> {
    const dateFilter = this.getDateFilter(period, startDate, endDate);

    const workouts = await this.prisma.workout.findMany({
      where: {
        userId,
        status: 'COMPLETED' as any,
        date: dateFilter,
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
      orderBy: { date: 'asc' },
    });

    const dataPoints: VolumeDataPoint[] = [];
    const volumeByMuscleGroup: Map<string, number> = new Map();
    let totalVolume = 0;

    for (const workout of workouts) {
      let workoutVolume = 0;

      for (const exerciseLog of workout.exercises) {
        for (const set of exerciseLog.sets) {
          // Skip warmup sets - only count working sets for volume
          if (set.setType === 'WARMUP') continue;

          const setVolume = set.reps * set.weight * 
            (exerciseLog.exercise.isUnilateral ? 2 : 1) * 
            (exerciseLog.exercise.isDoubleWeight ? 2 : 1);
          workoutVolume += setVolume;

          // Track by muscle group
          const muscleGroup = exerciseLog.exercise.muscleGroup;
          volumeByMuscleGroup.set(
            muscleGroup,
            (volumeByMuscleGroup.get(muscleGroup) || 0) + setVolume,
          );
        }
      }

      totalVolume += workoutVolume;
      dataPoints.push({
        date: workout.date.toISOString().split('T')[0],
        volume: workoutVolume,
        workoutId: workout.id,
      });
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
    muscleGroup?: string,
    equipment?: string,
  ): Promise<PersonalRecordsDto> {
    const workouts = await this.prisma.workout.findMany({
      where: {
        userId,
        status: 'COMPLETED' as any,
        homeGymId: { not: null }, // Only count PRs from home gym workouts
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
      orderBy: { date: 'desc' },
    });

    const prsByExercise: Map<string, PersonalRecord> = new Map();

    for (const workout of workouts) {
      for (const exerciseLog of workout.exercises) {
        const exerciseId = exerciseLog.exerciseId;
        const exerciseName = exerciseLog.exercise.name;

        // Apply filters
        if (muscleGroup && exerciseLog.exercise.muscleGroup !== muscleGroup) {
          continue;
        }
        if (equipment && exerciseLog.exercise.equipment !== equipment) {
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
  ): Promise<MuscleDistributionDto> {
    const dateFilter = this.getDateFilter(period);

    const workouts = await this.prisma.workout.findMany({
      where: {
        userId,
        status: 'COMPLETED' as any,
        date: dateFilter,
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
}
