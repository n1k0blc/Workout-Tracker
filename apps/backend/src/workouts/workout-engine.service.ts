import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { mapExercisesToResponse, WORKOUT_EXERCISE_TREE_INCLUDE } from '../workout-tree/workout-tree.service';
import { WorkoutExerciseResponseDto } from '../common/dto/workout-tree.dto';
import { getCurrentDate } from '../common/utils/date.util';
import { Today, addLocalDays } from '../common/utils/today.util';

export interface SuggestedWorkout {
  cycleId: string;
  cycleName: string;
  workoutDayId: string;
  workoutDayName: string;
  weekday: number;
  plannedHomeGymId?: string | null;
  exercises: WorkoutExerciseResponseDto[];
}

export interface CycleWorkoutDay {
  workoutDayId: string;
  workoutDayName: string;
  weekday: number;
  isSuggested: boolean;
  exerciseCount: number;
}

export interface CurrentCycleWorkouts {
  cycleId: string;
  cycleName: string;
  workoutDays: CycleWorkoutDay[];
}

/** The next planned day the dashboard looks ahead to, with the calendar day it falls on. */
export interface NextScheduledWorkout {
  cycleName: string;
  workoutDayId: string;
  workoutDayName: string;
  weekday: number;
  /** `YYYY-MM-DD` in the user's zone -- today when today's workout is still open. */
  localDate: string;
}

type DayWithBlueprint = {
  id: string;
  name: string;
  weekday: number;
  plannedHomeGymId: string | null;
  workouts: any[]; // filtered to kind=BLUEPRINT, 0 or 1 element
};

/**
 * The one "next workout" service (§3.6), shared by the workouts controller (suggested
 * workout / cycle overview) and the dashboard.
 *
 * The recommendation is plain weekday matching: today's cycle day, or nothing. Sequence-based
 * rotation is gone -- it advanced through `WorkoutDay.order` from the last performed workout,
 * so skipping a Saturday and training on Monday performed Saturday's plan on Monday and left
 * the user permanently out of phase with their own week. A skipped day is now simply missed.
 *
 * A day counts as done if *any* workout carries today's `localDate` -- free, template-started,
 * a different cycle day, or a past-workout entry dated today. Blueprint is the single source
 * of truth for the suggestion (structure, values, and rest, verbatim).
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

  /** The planned day whose weekday is `weekday`, if it has a blueprint to start from. */
  private plannedDay(days: DayWithBlueprint[], weekday: number): DayWithBlueprint | undefined {
    return days.find((day) => day.weekday === weekday && day.workouts.length > 0);
  }

  /** Any workout dated today ends the day -- which cycle day it was, or whether it was a cycle day at all, does not matter. */
  private async isDayDone(userId: string, localDate: string): Promise<boolean> {
    const logged = await this.prisma.workout.count({
      where: { userId, kind: 'WORKOUT', localDate },
    });
    return logged > 0;
  }

  /** Today's planned day, unless the day is already done. */
  private async findSuggestedDay(
    userId: string,
    days: DayWithBlueprint[],
    today: Today,
  ): Promise<DayWithBlueprint | null> {
    const day = this.plannedDay(days, today.weekday);
    if (!day || (await this.isDayDone(userId, today.localDate))) {
      return null;
    }
    return day;
  }

  async getSuggestedWorkout(userId: string, today: Today): Promise<SuggestedWorkout | null> {
    const activeCycle = await this.getActiveCycleWithDays(userId);
    if (!activeCycle || this.isCycleExpired(activeCycle)) {
      return null;
    }

    const day = await this.findSuggestedDay(userId, activeCycle.workoutDays, today);
    if (!day) {
      return null;
    }

    return {
      cycleId: activeCycle.id,
      cycleName: activeCycle.name,
      workoutDayId: day.id,
      workoutDayName: day.name,
      weekday: day.weekday,
      plannedHomeGymId: day.plannedHomeGymId,
      exercises: mapExercisesToResponse(day.workouts[0].exercises),
    };
  }

  /**
   * Today's workout while it is still open, otherwise the next scheduled weekday -- wrapping
   * into the following week, so a cycle planning only Mondays answers "next Monday" once
   * Monday is done.
   */
  async getNextScheduledWorkout(userId: string, today: Today): Promise<NextScheduledWorkout | null> {
    const activeCycle = await this.getActiveCycleWithDays(userId);
    if (!activeCycle || this.isCycleExpired(activeCycle)) {
      return null;
    }

    const doneToday = await this.isDayDone(userId, today.localDate);

    for (let offset = doneToday ? 1 : 0; offset <= 7; offset++) {
      const day = this.plannedDay(activeCycle.workoutDays, (today.weekday + offset) % 7);
      if (day) {
        return {
          cycleName: activeCycle.name,
          workoutDayId: day.id,
          workoutDayName: day.name,
          weekday: day.weekday,
          localDate: addLocalDays(today.localDate, offset),
        };
      }
    }

    return null;
  }

  async getCurrentCycleWorkouts(userId: string, today: Today): Promise<CurrentCycleWorkouts | null> {
    const activeCycle = await this.getActiveCycleWithDays(userId);
    if (!activeCycle || this.isCycleExpired(activeCycle)) {
      return null;
    }

    const suggested = await this.findSuggestedDay(userId, activeCycle.workoutDays, today);

    const workoutDays: CycleWorkoutDay[] = activeCycle.workoutDays.map((day) => ({
      workoutDayId: day.id,
      workoutDayName: day.name,
      weekday: day.weekday,
      isSuggested: suggested?.id === day.id,
      exerciseCount: day.workouts[0]?.exercises.length ?? 0,
    }));

    return {
      cycleId: activeCycle.id,
      cycleName: activeCycle.name,
      workoutDays,
    };
  }
}
