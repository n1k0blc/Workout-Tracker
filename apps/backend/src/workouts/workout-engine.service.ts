import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SuggestedWorkout {
  cycleId: string;
  cycleName: string;
  workoutDayId: string;
  workoutDayName: string;
  weekday: number;
  plannedHomeGymId?: string | null;
  exercises: {
    exerciseId: string;
    exerciseName: string;
    order: number;
    sets: {
      order: number;
      setType: string;
      reps: number;
      weight: number;
      rir: number;
      restAfterSet: number;
    }[];
  }[];
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

@Injectable()
export class WorkoutEngineService {
  constructor(private prisma: PrismaService) {}

  async getSuggestedWorkout(userId: string): Promise<SuggestedWorkout | null> {
    // Get current active cycle (most recent)
    const activeCycle = await this.prisma.workoutCycle.findFirst({
      where: { 
        userId,
        status: 'ACTIVE',
      },
      orderBy: { startDate: 'desc' },
      include: {
        workoutDays: {
          include: {
            blueprint: {
              include: {
                exercises: {
                  include: {
                    exercise: {
                      select: { name: true },
                    },
                    sets: {
                      orderBy: { order: 'asc' },
                    },
                  },
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!activeCycle) {
      return null; // No active cycle
    }

    // Check if cycle has ended
    const cycleEndDate = new Date(activeCycle.startDate);
    cycleEndDate.setDate(cycleEndDate.getDate() + activeCycle.duration * 7);

    const now = new Date();
    if (now > cycleEndDate) {
      return null; // Cycle has ended
    }

    // Get current weekday (0 = Sunday, 6 = Saturday)
    const currentWeekday = now.getDay();

    // Find workout day for today
    const todaysWorkoutDay = activeCycle.workoutDays.find(
      (day) => day.weekday === currentWeekday,
    );

    if (!todaysWorkoutDay || !todaysWorkoutDay.blueprint) {
      return null; // No workout scheduled for today
    }

    // Check if user already completed workout today
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const completedToday = await this.prisma.workout.findFirst({
      where: {
        userId,
        workoutDayId: todaysWorkoutDay.id,
        status: 'COMPLETED' as any,
        date: {
          gte: startOfToday,
        },
      },
    });

    if (completedToday) {
      return null; // Already completed today's workout
    }

    // Get last workout for this workout day to use as baseline for weight/reps
    const lastWorkout = await this.prisma.workout.findFirst({
      where: {
        userId,
        workoutDayId: todaysWorkoutDay.id,
        status: 'COMPLETED' as any,
      },
      include: {
        exercises: {
          include: {
            sets: {
              orderBy: { setNumber: 'desc' },
              take: 1, // Get last set for each exercise
            },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    // Build suggested workout
    const exercises = todaysWorkoutDay.blueprint.exercises.map((blueprintEx) => {
      // Try to find data from last workout
      const lastExerciseLog = lastWorkout?.exercises.find(
        (ex) => ex.exerciseId === blueprintEx.exerciseId,
      );

      // Map each individual set from blueprint
      const sets = blueprintEx.sets.map((bpSet) => {
        // Try to find corresponding set from last workout (by order/setNumber)
        const lastSetLog = lastExerciseLog?.sets.find(
          (s) => s.setNumber === bpSet.order,
        );

        return {
          order: bpSet.order,
          setType: bpSet.setType,
          reps: lastSetLog?.reps || bpSet.reps,
          weight: lastSetLog?.weight || bpSet.weight,
          rir: lastSetLog?.rir ?? bpSet.rir,
          restAfterSet: bpSet.restAfterSet,
        };
      });

      return {
        exerciseId: blueprintEx.exerciseId,
        exerciseName: blueprintEx.exercise.name,
        order: blueprintEx.order,
        sets,
      };
    });

    return {
      cycleId: activeCycle.id,
      cycleName: activeCycle.name,
      workoutDayId: todaysWorkoutDay.id,
      workoutDayName: todaysWorkoutDay.name,
      weekday: todaysWorkoutDay.weekday,
      plannedHomeGymId: todaysWorkoutDay.plannedHomeGymId,
      exercises,
    };
  }

  async getCurrentCycleWeek(userId: string): Promise<number | null> {
    const activeCycle = await this.prisma.workoutCycle.findFirst({
      where: { 
        userId,
        status: 'ACTIVE',
      },
      orderBy: { startDate: 'desc' },
    });

    if (!activeCycle) {
      return null;
    }

    const now = new Date();
    const startDate = new Date(activeCycle.startDate);
    const diffTime = Math.abs(now.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const currentWeek = Math.ceil(diffDays / 7);

    return currentWeek <= activeCycle.duration ? currentWeek : null;
  }

  async getCurrentCycleWorkouts(userId: string): Promise<CurrentCycleWorkouts | null> {
    // Get current active cycle
    const activeCycle = await this.prisma.workoutCycle.findFirst({
      where: { 
        userId,
        status: 'ACTIVE',
      },
      orderBy: { startDate: 'desc' },
      include: {
        workoutDays: {
          include: {
            blueprint: {
              include: {
                exercises: true,
              },
            },
          },
        },
      },
    });

    if (!activeCycle) {
      return null;
    }

    // Check if cycle has ended
    const cycleEndDate = new Date(activeCycle.startDate);
    cycleEndDate.setDate(cycleEndDate.getDate() + activeCycle.duration * 7);

    const now = new Date();
    if (now > cycleEndDate) {
      return null;
    }

    // Get current weekday and check for completed workout today
    const currentWeekday = now.getDay();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const completedToday = await this.prisma.workout.findFirst({
      where: {
        userId,
        status: 'COMPLETED' as any,
        date: {
          gte: startOfToday,
        },
      },
    });

    // Map workout days with suggestion info
    const workoutDays: CycleWorkoutDay[] = activeCycle.workoutDays.map((day) => {
      const isSuggested = 
        !completedToday && 
        day.weekday === currentWeekday &&
        day.blueprint !== null;

      return {
        workoutDayId: day.id,
        workoutDayName: day.name,
        weekday: day.weekday,
        isSuggested,
        exerciseCount: day.blueprint?.exercises.length || 0,
      };
    });

    return {
      cycleId: activeCycle.id,
      cycleName: activeCycle.name,
      workoutDays,
    };
  }
}
