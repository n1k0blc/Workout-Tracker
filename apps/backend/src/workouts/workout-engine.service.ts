import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { mapExercisesToResponse, WORKOUT_EXERCISE_TREE_INCLUDE } from '../workout-tree/workout-tree.service';
import { WorkoutExerciseResponseDto } from '../common/dto/workout-tree.dto';
import { getCurrentDate } from '../common/utils/date.util';

export interface SuggestedWorkout {
  cycleId: string;
  cycleName: string;
  workoutDayId: string;
  workoutDayName: string;
  weekday: number;
  order: number;
  plannedHomeGymId?: string | null;
  exercises: WorkoutExerciseResponseDto[];
  /** Whether the scheduled weekday has arrived (or passed) -- gates the "start now" prompt. */
  isDue: boolean;
}

export interface CycleWorkoutDay {
  workoutDayId: string;
  workoutDayName: string;
  weekday: number;
  order: number;
  isSuggested: boolean;
  exerciseCount: number;
}

export interface CurrentCycleWorkouts {
  cycleId: string;
  cycleName: string;
  workoutDays: CycleWorkoutDay[];
}

type DayWithBlueprint = {
  id: string;
  name: string;
  weekday: number;
  order: number;
  plannedHomeGymId: string | null;
  workouts: any[]; // filtered to kind=BLUEPRINT, 0 or 1 element
};

/**
 * The one "next workout" service (§3.6), shared by the workouts controller (suggested
 * workout / cycle overview) and the dashboard -- replaces the old weekday-gated engine
 * and the dashboard's independent sequence-based algorithm. Rotation is driven by
 * `WorkoutDay.order`; weekday is now just a date hint, not a gate. Blueprint is the
 * single source of truth for the suggestion (structure, values, and rest, verbatim --
 * no more merging in numbers from the last completed session).
 */
@Injectable()
export class WorkoutEngineService {
  constructor(private prisma: PrismaService) {}

  private async getActiveCycleWithDays(userId: string) {
    return this.prisma.workoutCycle.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { startDate: 'desc' },
      include: {
        workoutDays: {
          include: { workouts: { where: { kind: 'BLUEPRINT' }, include: WORKOUT_EXERCISE_TREE_INCLUDE } },
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  private isCycleExpired(cycle: { startDate: Date; duration: number }): boolean {
    const endDate = new Date(cycle.startDate);
    endDate.setDate(endDate.getDate() + cycle.duration * 7);
    return getCurrentDate() > endDate;
  }

  /**
   * The next day in rotation order, based on the workoutDay of the last performed workout,
   * plus the date it becomes due: the next occurrence of that day's weekday on/after the
   * last workout's date (or the cycle's start date, for the very first suggestion).
   */
  private async findNextWorkoutDay(
    userId: string,
    cycle: { id: string; startDate: Date; workoutDays: DayWithBlueprint[] },
  ): Promise<{ day: DayWithBlueprint; dueDate: Date } | null> {
    if (cycle.workoutDays.length === 0) {
      return null;
    }

    const lastWorkout = await this.prisma.workout.findFirst({
      where: { userId, cycleId: cycle.id, kind: 'WORKOUT' },
      orderBy: { date: 'desc' },
      select: { workoutDayId: true, date: true },
    });

    const lastIndex = lastWorkout?.workoutDayId
      ? cycle.workoutDays.findIndex((day) => day.id === lastWorkout.workoutDayId)
      : -1;

    if (lastIndex === -1) {
      // No workout logged yet in this cycle: due as soon as the first day's weekday arrives on/after cycle start.
      return { day: cycle.workoutDays[0], dueDate: this.nextOccurrence(cycle.startDate, cycle.workoutDays[0].weekday, true) };
    }

    const nextDay = cycle.workoutDays[(lastIndex + 1) % cycle.workoutDays.length];
    // Due starting the day after the last completed workout's date.
    return { day: nextDay, dueDate: this.nextOccurrence(lastWorkout!.date, nextDay.weekday, false) };
  }

  /** Earliest date on/after (or strictly after) `from` that falls on `weekday`. */
  private nextOccurrence(from: Date, weekday: number, inclusive: boolean): Date {
    const date = new Date(from);
    date.setHours(0, 0, 0, 0);
    if (!inclusive) {
      date.setDate(date.getDate() + 1);
    }
    date.setDate(date.getDate() + ((weekday - date.getDay() + 7) % 7));
    return date;
  }

  async getSuggestedWorkout(userId: string): Promise<SuggestedWorkout | null> {
    const activeCycle = await this.getActiveCycleWithDays(userId);
    if (!activeCycle || this.isCycleExpired(activeCycle)) {
      return null;
    }

    const next = await this.findNextWorkoutDay(userId, activeCycle);
    const blueprint = next?.day.workouts[0];
    if (!next || !blueprint) {
      return null; // no day in rotation, or that day has no blueprint yet
    }

    const today = getCurrentDate();
    today.setHours(0, 0, 0, 0);

    return {
      cycleId: activeCycle.id,
      cycleName: activeCycle.name,
      workoutDayId: next.day.id,
      workoutDayName: next.day.name,
      weekday: next.day.weekday,
      order: next.day.order,
      plannedHomeGymId: next.day.plannedHomeGymId,
      exercises: mapExercisesToResponse(blueprint.exercises),
      isDue: today >= next.dueDate,
    };
  }

  async getCurrentCycleWorkouts(userId: string): Promise<CurrentCycleWorkouts | null> {
    const activeCycle = await this.getActiveCycleWithDays(userId);
    if (!activeCycle || this.isCycleExpired(activeCycle)) {
      return null;
    }

    const next = await this.findNextWorkoutDay(userId, activeCycle);

    const workoutDays: CycleWorkoutDay[] = activeCycle.workoutDays.map((day) => ({
      workoutDayId: day.id,
      workoutDayName: day.name,
      weekday: day.weekday,
      order: day.order,
      isSuggested: next?.day.id === day.id && day.workouts.length > 0,
      exerciseCount: day.workouts[0]?.exercises.length ?? 0,
    }));

    return {
      cycleId: activeCycle.id,
      cycleName: activeCycle.name,
      workoutDays,
    };
  }
}
