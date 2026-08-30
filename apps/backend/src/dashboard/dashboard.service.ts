import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkoutEngineService } from '../workouts/workout-engine.service';
import { setWorkingVolume } from '../common/utils/volume.util';
import { calculateCycleWeek, getCurrentDate } from '../common/utils/date.util';
import { Today, localDateToInstant } from '../common/utils/today.util';
import {
  DashboardStatsDto,
  LastSevenDaysStatsDto,
  PreviousSevenDaysStatsDto,
} from './dto/dashboard-stats.dto';
import { NextPlannedWorkoutDto } from './dto/next-planned-workout.dto';
import { CycleProgressDto } from './dto/cycle-progress.dto';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private workoutEngineService: WorkoutEngineService,
  ) {}

  private getLastSevenDaysRange(): { start: Date; end: Date } {
    const now = getCurrentDate();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    return { start, end };
  }

  private getPreviousSevenDaysRange(): { start: Date; end: Date } {
    const now = getCurrentDate();
    const end = new Date(now);
    end.setDate(now.getDate() - 7);
    end.setHours(23, 59, 59, 999);

    const start = new Date(now);
    start.setDate(now.getDate() - 13);
    start.setHours(0, 0, 0, 0);

    return { start, end };
  }

  async getLastSevenDaysStats(userId: string): Promise<DashboardStatsDto> {
    const lastSevenDays = this.getLastSevenDaysRange();
    const previousSevenDays = this.getPreviousSevenDaysRange();

    const workoutInclude = {
      exercises: {
        include: {
          exercise: { select: { isUnilateral: true, isDoubleWeight: true } },
          sets: true,
        },
      },
    };

    const lastSevenDaysWorkouts = await this.prisma.workout.findMany({
      where: {
        userId,
        kind: 'WORKOUT' as const,
        date: { gte: lastSevenDays.start, lte: lastSevenDays.end },
      },
      include: workoutInclude,
    });

    const previousSevenDaysWorkouts = await this.prisma.workout.findMany({
      where: {
        userId,
        kind: 'WORKOUT' as const,
        date: { gte: previousSevenDays.start, lte: previousSevenDays.end },
      },
      include: workoutInclude,
    });

    const lastSevenDaysStats: LastSevenDaysStatsDto = {
      workouts: lastSevenDaysWorkouts.length,
      volume: this.calculateTotalVolume(lastSevenDaysWorkouts),
      averageDuration: this.calculateAverageDuration(lastSevenDaysWorkouts),
    };

    const previousSevenDaysStats: PreviousSevenDaysStatsDto = {
      volume: this.calculateTotalVolume(previousSevenDaysWorkouts),
    };

    const volumeChange = this.calculatePercentageChange(
      previousSevenDaysStats.volume,
      lastSevenDaysStats.volume,
    );

    return {
      lastSevenDays: lastSevenDaysStats,
      previousSevenDays: previousSevenDaysStats,
      volumeChange,
    };
  }

  /** Uses the one volume primitive (§4.5) -- this used to read a nonexistent `set.isUnilateral`. */
  private calculateTotalVolume(workouts: any[]): number {
    return workouts.reduce((total, workout) => {
      const workoutVolume = workout.exercises.reduce((exTotal: number, exercise: any) => {
        const exerciseVolume = exercise.sets.reduce(
          (setTotal: number, set: any) => setTotal + setWorkingVolume(set, exercise.exercise),
          0,
        );
        return exTotal + exerciseVolume;
      }, 0);
      return total + workoutVolume;
    }, 0);
  }

  private calculateAverageDuration(workouts: any[]): number | null {
    const workoutsWithDuration = workouts.filter((w) => w.totalDuration !== null);

    if (workoutsWithDuration.length === 0) return null;

    const totalSeconds = workoutsWithDuration.reduce((sum, w) => sum + w.totalDuration, 0);
    const averageSeconds = totalSeconds / workoutsWithDuration.length;
    return Math.round(averageSeconds / 60);
  }

  private calculatePercentageChange(oldValue: number, newValue: number): number {
    if (oldValue === 0) {
      return newValue > 0 ? 100 : 0;
    }
    return ((newValue - oldValue) / oldValue) * 100;
  }

  /**
   * Delegates to the one next-workout service (§3.6) instead of a second, independent
   * algorithm: today's workout while it is still open, otherwise the next scheduled weekday.
   */
  async getNextPlannedWorkout(userId: string, today: Today): Promise<NextPlannedWorkoutDto | null> {
    const next = await this.workoutEngineService.getNextScheduledWorkout(userId, today);
    if (!next) {
      return null;
    }

    return {
      workoutDayId: next.workoutDayId,
      workoutDayName: next.workoutDayName,
      cycleName: next.cycleName,
      templateName: null,
      dayOfWeek: next.weekday,
      suggestedDate: next.localDate,
      cycleStartDate: next.cycleStartDate,
    };
  }

  /**
   * Takes the client's `Today` for the same reason `getNextPlannedWorkout` does: near local
   * midnight a server-clock "today" would put the two dashboard cards in different weeks.
   * `startDate` is stored as UTC midnight, so reading today's calendar day the same way keeps
   * the difference a whole number of days.
   */
  async getCycleProgress(userId: string, today: Today): Promise<CycleProgressDto | null> {
    const todayInstant = localDateToInstant(today.localDate);

    const activeCycle = await this.prisma.workoutCycle.findFirst({
      where: { userId, startDate: { lte: todayInstant }, status: 'ACTIVE' },
    });

    if (!activeCycle || !activeCycle.duration) {
      return null;
    }

    const currentWeek = calculateCycleWeek(
      activeCycle.startDate,
      activeCycle.duration,
      todayInstant,
    );
    const totalWeeks = activeCycle.duration;
    const percentage = Math.min((currentWeek / totalWeeks) * 100, 100);

    return {
      currentWeek,
      totalWeeks,
      percentage: Math.round(percentage * 100) / 100,
      cycleName: activeCycle.name,
    };
  }
}
