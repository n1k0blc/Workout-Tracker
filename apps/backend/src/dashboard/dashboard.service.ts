import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { 
  DashboardStatsDto, 
  CurrentWeekStatsDto, 
  LastWeekStatsDto 
} from './dto/dashboard-stats.dto';
import { NextPlannedWorkoutDto } from './dto/next-planned-workout.dto';
import { CycleProgressDto } from './dto/cycle-progress.dto';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get Monday 00:00:00 of current week
   */
  private getWeekStart(date: Date = new Date()): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  /**
   * Get Sunday 23:59:59 of current week
   */
  private getWeekEnd(date: Date = new Date()): Date {
    const weekStart = this.getWeekStart(date);
    const sunday = new Date(weekStart);
    sunday.setDate(weekStart.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return sunday;
  }

  /**
   * Get date range for last week
   */
  private getLastWeekRange(): { start: Date; end: Date } {
    const thisWeekStart = this.getWeekStart();
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);
    
    const lastWeekEnd = new Date(lastWeekStart);
    lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
    lastWeekEnd.setHours(23, 59, 59, 999);

    return { start: lastWeekStart, end: lastWeekEnd };
  }

  /**
   * Calculate which week of the cycle we're currently in
   */
  private calculateCycleWeek(cycleStartDate: Date): number {
    const now = new Date();
    const start = new Date(cycleStartDate);
    const diffTime = Math.abs(now.getTime() - start.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7) + 1; // Week 1, 2, 3, ...
  }

  /**
   * Get stats for current week vs last week
   */
  async getCurrentWeekStats(userId: string): Promise<DashboardStatsDto> {
    const weekStart = this.getWeekStart();
    const weekEnd = this.getWeekEnd();
    const lastWeek = this.getLastWeekRange();

    // Current week workouts
    const currentWeekWorkouts = await this.prisma.workout.findMany({
      where: {
        userId,
        date: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      include: {
        exercises: {
          include: {
            sets: true,
          },
        },
      },
    });

    // Last week workouts
    const lastWeekWorkouts = await this.prisma.workout.findMany({
      where: {
        userId,
        date: {
          gte: lastWeek.start,
          lte: lastWeek.end,
        },
      },
      include: {
        exercises: {
          include: {
            sets: true,
          },
        },
      },
    });

    // Calculate current week stats
    const currentWeekStats: CurrentWeekStatsDto = {
      workouts: currentWeekWorkouts.length,
      volume: this.calculateTotalVolume(currentWeekWorkouts),
      averageDuration: this.calculateAverageDuration(currentWeekWorkouts),
    };

    // Calculate last week stats
    const lastWeekStats: LastWeekStatsDto = {
      volume: this.calculateTotalVolume(lastWeekWorkouts),
    };

    // Calculate volume change percentage
    const volumeChange = this.calculatePercentageChange(
      lastWeekStats.volume,
      currentWeekStats.volume,
    );

    return {
      currentWeek: currentWeekStats,
      lastWeek: lastWeekStats,
      volumeChange,
    };
  }

  /**
   * Calculate total volume from workouts
   */
  private calculateTotalVolume(workouts: any[]): number {
    return workouts.reduce((total, workout) => {
      const workoutVolume = workout.exercises.reduce((exTotal, exercise) => {
        const exerciseVolume = exercise.sets.reduce((setTotal, set) => {
          const weight = set.weight || 0;
          const reps = set.reps || 0;
          const multiplier = set.isUnilateral ? 2 : 1;
          return setTotal + weight * reps * multiplier;
        }, 0);
        return exTotal + exerciseVolume;
      }, 0);
      return total + workoutVolume;
    }, 0);
  }

  /**
   * Calculate average duration in minutes
   */
  private calculateAverageDuration(workouts: any[]): number | null {
    const workoutsWithDuration = workouts.filter(
      (w) => w.totalDuration !== null,
    );

    if (workoutsWithDuration.length === 0) return null;

    const totalSeconds = workoutsWithDuration.reduce(
      (sum, w) => sum + w.totalDuration,
      0,
    );
    const averageSeconds = totalSeconds / workoutsWithDuration.length;
    return Math.round(averageSeconds / 60); // Convert to minutes
  }

  /**
   * Calculate percentage change
   */
  private calculatePercentageChange(oldValue: number, newValue: number): number {
    if (oldValue === 0) {
      return newValue > 0 ? 100 : 0;
    }
    return ((newValue - oldValue) / oldValue) * 100;
  }

  /**
   * Get next planned workout from active cycle
   */
  async getNextPlannedWorkout(userId: string): Promise<NextPlannedWorkoutDto | null> {
    // Find active cycle
    const activeCycle = await this.prisma.workoutCycle.findFirst({
      where: {
        userId,
        startDate: { lte: new Date() },
        status: 'ACTIVE',
      },
      include: {
        workoutDays: {
          orderBy: { weekday: 'asc' },
          include: {
            blueprint: true,
          },
        },
      },
    });

    if (!activeCycle || activeCycle.workoutDays.length === 0) {
      return null;
    }

    // Get all workouts in this cycle
    const cycleWorkouts = await this.prisma.workout.findMany({
      where: {
        userId,
        cycleId: activeCycle.id,
      },
      orderBy: { date: 'desc' },
      include: {
        workoutDay: true,
      },
    });

    // Determine next workout day in sequence
    let nextWorkoutDay;
    if (cycleWorkouts.length === 0) {
      // First workout - use first in sequence
      nextWorkoutDay = activeCycle.workoutDays[0];
    } else {
      const lastWorkout = cycleWorkouts[0];
      const lastWorkoutDayIndex = activeCycle.workoutDays.findIndex(
        (wd) => wd.id === lastWorkout.workoutDayId,
      );

      if (lastWorkoutDayIndex === -1) {
        // Fallback to first
        nextWorkoutDay = activeCycle.workoutDays[0];
      } else {
        // Get next in sequence (cycle back to start if at end)
        const nextIndex = (lastWorkoutDayIndex + 1) % activeCycle.workoutDays.length;
        nextWorkoutDay = activeCycle.workoutDays[nextIndex];
      }
    }

    // Suggest date - next occurrence of scheduled day of week
    const today = new Date();
    const targetDayOfWeek = nextWorkoutDay.weekday;
    const currentDayOfWeek = today.getDay();
    
    let daysUntilNext = targetDayOfWeek - currentDayOfWeek;
    if (daysUntilNext <= 0) {
      daysUntilNext += 7; // Next week
    }

    const suggestedDate = new Date(today);
    suggestedDate.setDate(today.getDate() + daysUntilNext);

    return {
      workoutDayId: nextWorkoutDay.id,
      workoutDayName: nextWorkoutDay.name,
      cycleName: activeCycle.name,
      templateName: null, // Blueprint is stored differently
      dayOfWeek: nextWorkoutDay.weekday,
      suggestedDate: suggestedDate.toISOString().split('T')[0], // YYYY-MM-DD
    };
  }

  /**
   * Get cycle progress for active cycle
   */
  async getCycleProgress(userId: string): Promise<CycleProgressDto | null> {
    const activeCycle = await this.prisma.workoutCycle.findFirst({
      where: {
        userId,
        startDate: { lte: new Date() },
        status: 'ACTIVE',
      },
    });

    if (!activeCycle || !activeCycle.duration) {
      return null;
    }

    const currentWeek = this.calculateCycleWeek(activeCycle.startDate);
    const totalWeeks = activeCycle.duration;
    const percentage = Math.min((currentWeek / totalWeeks) * 100, 100);

    return {
      currentWeek: Math.min(currentWeek, totalWeeks),
      totalWeeks,
      percentage: Math.round(percentage * 100) / 100, // 2 decimals
      cycleName: activeCycle.name,
    };
  }
}
