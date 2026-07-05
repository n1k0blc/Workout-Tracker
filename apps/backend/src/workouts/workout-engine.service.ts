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

  /** The next day in rotation order, based on the workoutDay of the last performed workout. */
  private async findNextWorkoutDay(
    userId: string,
    cycle: { id: string; workoutDays: DayWithBlueprint[] },
  ): Promise<DayWithBlueprint | null> {
    if (cycle.workoutDays.length === 0) {
      return null;
    }

    const lastWorkout = await this.prisma.workout.findFirst({
      where: { userId, cycleId: cycle.id, kind: 'WORKOUT' },
      orderBy: { date: 'desc' },
      select: { workoutDayId: true },
    });

    const lastIndex = lastWorkout?.workoutDayId
      ? cycle.workoutDays.findIndex((day) => day.id === lastWorkout.workoutDayId)
      : -1;

    if (lastIndex === -1) {
      return cycle.workoutDays[0];
    }

    return cycle.workoutDays[(lastIndex + 1) % cycle.workoutDays.length];
  }

  async getSuggestedWorkout(userId: string): Promise<SuggestedWorkout | null> {
    const activeCycle = await this.getActiveCycleWithDays(userId);
    if (!activeCycle || this.isCycleExpired(activeCycle)) {
      return null;
    }

    const nextDay = await this.findNextWorkoutDay(userId, activeCycle);
    const blueprint = nextDay?.workouts[0];
    if (!nextDay || !blueprint) {
      return null; // no day in rotation, or that day has no blueprint yet
    }

    return {
      cycleId: activeCycle.id,
      cycleName: activeCycle.name,
      workoutDayId: nextDay.id,
      workoutDayName: nextDay.name,
      weekday: nextDay.weekday,
      order: nextDay.order,
      plannedHomeGymId: nextDay.plannedHomeGymId,
      exercises: mapExercisesToResponse(blueprint.exercises),
    };
  }

  async getCurrentCycleWorkouts(userId: string): Promise<CurrentCycleWorkouts | null> {
    const activeCycle = await this.getActiveCycleWithDays(userId);
    if (!activeCycle || this.isCycleExpired(activeCycle)) {
      return null;
    }

    const nextDay = await this.findNextWorkoutDay(userId, activeCycle);

    const workoutDays: CycleWorkoutDay[] = activeCycle.workoutDays.map((day) => ({
      workoutDayId: day.id,
      workoutDayName: day.name,
      weekday: day.weekday,
      order: day.order,
      isSuggested: nextDay?.id === day.id && day.workouts.length > 0,
      exerciseCount: day.workouts[0]?.exercises.length ?? 0,
    }));

    return {
      cycleId: activeCycle.id,
      cycleName: activeCycle.name,
      workoutDays,
    };
  }
}
