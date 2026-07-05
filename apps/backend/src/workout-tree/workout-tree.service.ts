import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SetType } from '../common/types';
import {
  WorkoutExerciseInputDto,
  WorkoutExerciseResponseDto,
} from '../common/dto/workout-tree.dto';

export interface SetInput {
  order: number;
  setType: SetType;
  reps: number;
  weight: number;
  rir?: number | null;
  rest?: number | null;
  completedAt?: Date | null;
}

export interface ExerciseInput {
  order: number;
  exerciseId: string;
  sets: SetInput[];
}

/**
 * PR2 (§3.2/§3.4): the shared copy primitive. "Materialize this tree as/into a record of
 * kind K" -- every create/overwrite path (save a workout, overwrite a blueprint, save/overwrite
 * a template) funnels through this one method instead of a bespoke per-path translation.
 *
 * The source tree is always the one the client already built and validated once (the request
 * payload) -- side effects (overwrite blueprint / save-as-template) reapply that same tree to
 * other target Workout rows rather than re-reading and re-copying from elsewhere.
 *
 * Must be called with a transaction client so multi-target writes (workout + blueprint +
 * template in one request) commit atomically.
 */
@Injectable()
export class WorkoutTreeService {
  async replaceTree(
    tx: Prisma.TransactionClient,
    workoutId: string,
    exercises: ExerciseInput[],
  ): Promise<void> {
    await tx.workoutExercise.deleteMany({ where: { workoutId } });

    for (const exercise of exercises) {
      await tx.workoutExercise.create({
        data: {
          workoutId,
          order: exercise.order,
          exerciseId: exercise.exerciseId,
          sets: {
            create: exercise.sets.map((set) => ({
              order: set.order,
              setType: set.setType,
              reps: set.reps,
              weight: set.weight,
              rir: set.rir ?? null,
              rest: set.rest ?? null,
              completedAt: set.completedAt ?? null,
            })),
          },
        },
      });
    }
  }
}

/** WorkoutExerciseInputDto[] -> ExerciseInput[] (DTO wire shape -> internal shape). */
export function toExerciseInputs(dtos: WorkoutExerciseInputDto[]): ExerciseInput[] {
  return dtos.map((ex) => ({
    order: ex.order,
    exerciseId: ex.exerciseId,
    sets: ex.sets.map((set) => ({
      order: set.order,
      setType: set.setType,
      reps: set.reps,
      weight: set.weight,
      rir: set.rir ?? null,
      rest: set.rest ?? 90,
      completedAt: set.completedAt ? new Date(set.completedAt) : null,
    })),
  }));
}

type LoadedWorkoutExercise = {
  id: string;
  exerciseId: string;
  order: number;
  exercise: { name: string; isUnilateral: boolean; isDoubleWeight: boolean };
  sets: {
    id: string;
    order: number;
    setType: SetType;
    reps: number;
    weight: number;
    rir: number | null;
    rest: number | null;
    completedAt: Date | null;
  }[];
};

/** Maps a Prisma-loaded WorkoutExercise[] (with nested exercise+sets) to the API response shape. */
export function mapExercisesToResponse(
  exercises: LoadedWorkoutExercise[],
): WorkoutExerciseResponseDto[] {
  return exercises
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((ex) => ({
      id: ex.id,
      exerciseId: ex.exerciseId,
      exerciseName: ex.exercise.name,
      isUnilateral: ex.exercise.isUnilateral,
      isDoubleWeight: ex.exercise.isDoubleWeight,
      order: ex.order,
      sets: ex.sets
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((set) => ({
          id: set.id,
          order: set.order,
          setType: set.setType,
          reps: set.reps,
          weight: set.weight,
          rir: set.rir ?? undefined,
          rest: set.rest ?? undefined,
          completedAt: set.completedAt ?? undefined,
        })),
    }));
}

export const WORKOUT_EXERCISE_TREE_INCLUDE = {
  exercises: {
    include: {
      exercise: {
        select: { name: true, isUnilateral: true, isDoubleWeight: true },
      },
      sets: { orderBy: { order: 'asc' as const } },
    },
    orderBy: { order: 'asc' as const },
  },
};
