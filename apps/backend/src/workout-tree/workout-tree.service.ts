import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { SetType, Equipment } from '../common/types';
import {
  WorkoutExerciseInputDto,
  WorkoutExerciseResponseDto,
} from '../common/dto/workout-tree.dto';

/**
 * Neither shape carries `order`: array position *is* the order once a tree is inside the
 * backend, so there is no field to disagree with it. `toExerciseInputs` checks the incoming
 * DTO's `order` against its position and then drops it; `replaceTree` writes the numbering
 * from position. Reintroducing `order` here would recreate the ambiguity this all removes.
 */
export interface SetInput {
  setType: SetType;
  reps: number;
  weight: number;
  rir?: number | null;
  // Per-side values for unilateral sets (issue #65/#97). Round-tripped only for now.
  repsLeft?: number | null;
  repsRight?: number | null;
  weightLeft?: number | null;
  weightRight?: number | null;
  rirLeft?: number | null;
  rirRight?: number | null;
  rest?: number | null;
  completedAt?: Date | null;
}

export interface ExerciseInput {
  exerciseId: string;
  sets: SetInput[];
}

/** The bits of an exercise the write path needs to check set shape -- see `toExerciseInputs`. */
export interface ExerciseShape {
  isUnilateral: boolean;
  name: string;
}

const SIDE_KEYS = [
  'repsLeft',
  'repsRight',
  'weightLeft',
  'weightRight',
  'rirLeft',
  'rirRight',
] as const;

/**
 * Per-side set shape and the reps/weight/rir aggregates (issue #65/#100).
 *
 * `isUnilateral` is a set *shape*: a unilateral set is trained one side then the other and
 * carries both, a bilateral set carries none. This is the single write path, so it owns the
 * aggregates outright -- `reps`, `weight` and `rir` are always recomputed from the sides here
 * and whatever the client sent for them is discarded. Persisting them is what keeps every
 * analytics endpoint reading `reps`/`weight`/`rir` unchanged.
 *
 *   reps   = round(avg(L, R))          -- stays Int
 *   weight = avg(L, R)
 *   rir    = min(L, R)                  -- proximity to failure, the limiting side
 *
 * A database CHECK cannot express "matches this exercise's shape" without joining to the
 * exercise, so the rule lives beside the tree-consistency checks that already load them.
 */
function deriveSetAggregates(
  set: SetInput,
  shape: ExerciseShape,
  exerciseLabel: string,
  setNumber: number,
): SetInput {
  const carriesSideData = SIDE_KEYS.some((key) => set[key] != null);

  if (!shape.isUnilateral) {
    if (carriesSideData) {
      // Every set carrying side data is equally at fault, so this names the exercise, not a set.
      throw new BadRequestException(
        `${exerciseLabel} is a bilateral exercise; its sets must not carry per-side values`,
      );
    }
    return set;
  }

  const { repsLeft, repsRight, weightLeft, weightRight, rirLeft, rirRight } = set;
  if (repsLeft == null || repsRight == null || weightLeft == null || weightRight == null) {
    throw new BadRequestException(
      `${exerciseLabel}, set ${setNumber}: a unilateral exercise needs reps and weight for both sides`,
    );
  }
  if ((rirLeft == null) !== (rirRight == null)) {
    throw new BadRequestException(
      `${exerciseLabel}, set ${setNumber}: RIR is set for only one side; provide both or neither`,
    );
  }

  return {
    ...set,
    reps: Math.round((repsLeft + repsRight) / 2),
    weight: (weightLeft + weightRight) / 2,
    rir: rirLeft == null ? null : Math.min(rirLeft, rirRight),
  };
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
 *
 * ## The ordering invariant
 *
 * **Array position is authoritative. `order` is stored 1-based and contiguous per parent.**
 *
 * `order` is written from array position here, never from the value the caller supplied, so
 * a bad tree cannot reach the database through any path. `toExerciseInputs` separately
 * *rejects* a payload whose `order` disagrees with its array position -- renumbering alone
 * would silently accept an array of A, B, C numbered 3, 1, 2 and rewrite the sequence,
 * losing a reorder with no error.
 *
 * This exists because `order` used to be persisted verbatim: each client re-derived its own
 * convention, and the database ended up holding 0-based rows, 1-based rows, gaps and bases
 * above 1 in the same tables. Migration 20260814080000 cleaned that up; this keeps it clean.
 */
@Injectable()
export class WorkoutTreeService {
  async replaceTree(
    tx: Prisma.TransactionClient,
    workoutId: string,
    exercises: ExerciseInput[],
  ): Promise<void> {
    await tx.workoutExercise.deleteMany({ where: { workoutId } });

    for (const [exerciseIndex, exercise] of exercises.entries()) {
      await tx.workoutExercise.create({
        data: {
          workoutId,
          order: exerciseIndex + 1,
          exerciseId: exercise.exerciseId,
          sets: {
            create: exercise.sets.map((set, setIndex) => ({
              order: setIndex + 1,
              setType: set.setType,
              reps: set.reps,
              weight: set.weight,
              rir: set.rir ?? null,
              repsLeft: set.repsLeft ?? null,
              repsRight: set.repsRight ?? null,
              weightLeft: set.weightLeft ?? null,
              weightRight: set.weightRight ?? null,
              rirLeft: set.rirLeft ?? null,
              rirRight: set.rirRight ?? null,
              rest: set.rest ?? null,
              completedAt: set.completedAt ?? null,
            })),
          },
        },
      });
    }
  }
}

/**
 * Throws unless every entry's `order` equals its index + 1.
 *
 * Deliberately strict rather than forgiving: a payload that merely *contains* 1..n is not
 * good enough, because accepting one whose numbering disagrees with its array order would
 * mean silently choosing one of the two sequences the client sent. There is no safe way to
 * guess which was intended, so it is the client's bug to fix.
 */
function assertOrderMatchesPosition(
  items: { order: number }[],
  label: string,
): void {
  items.forEach((item, index) => {
    const expected = index + 1;
    if (item.order !== expected) {
      throw new BadRequestException(
        `${label}: order must be 1-based, contiguous, and match the order the items were sent in ` +
          `(expected ${expected} at position ${index}, received ${item.order})`,
      );
    }
  });
}

/**
 * WorkoutExerciseInputDto[] -> ExerciseInput[] (DTO wire shape -> internal shape).
 *
 * Every write path funnels through here on its way to `replaceTree`, which makes this the
 * one place the ordering invariant can be enforced without a new DTO forgetting to opt in.
 * See the `WorkoutTreeService` docstring for the invariant itself.
 *
 * `shapesById` is the map `ExercisesService.validateAccessible` returns for the same ids --
 * `deriveSetAggregates` uses it to check per-side set shape and derive the aggregates.
 */
export function toExerciseInputs(
  dtos: WorkoutExerciseInputDto[],
  shapesById: Map<string, ExerciseShape>,
): ExerciseInput[] {
  assertOrderMatchesPosition(dtos, 'exercises');
  dtos.forEach((ex, index) =>
    assertOrderMatchesPosition(ex.sets, `exercise at position ${index}: sets`),
  );

  // `order` is checked above and then dropped -- past this point the array is the ordering.
  return dtos.map((ex, exerciseIndex) => {
    const shape = shapesById.get(ex.exerciseId);
    if (!shape) {
      // Every caller passes the map validateAccessible returned for these same ids, so a miss
      // is a wiring bug in a write path, not bad client input -- a 500, not a 400.
      throw new Error(
        `toExerciseInputs: exercise ${ex.exerciseId} at position ${exerciseIndex} was not loaded for validation`,
      );
    }

    const exerciseLabel = `exercise "${shape.name}" (position ${exerciseIndex})`;
    return {
      exerciseId: ex.exerciseId,
      sets: ex.sets.map((set, setIndex) =>
        deriveSetAggregates(
          {
            setType: set.setType,
            reps: set.reps,
            weight: set.weight,
            rir: set.rir ?? null,
            repsLeft: set.repsLeft ?? null,
            repsRight: set.repsRight ?? null,
            weightLeft: set.weightLeft ?? null,
            weightRight: set.weightRight ?? null,
            rirLeft: set.rirLeft ?? null,
            rirRight: set.rirRight ?? null,
            rest: set.rest ?? 90,
            completedAt: set.completedAt ? new Date(set.completedAt) : null,
          },
          shape,
          exerciseLabel,
          setIndex + 1,
        ),
      ),
    };
  });
}

type LoadedWorkoutExercise = {
  id: string;
  exerciseId: string;
  order: number;
  exercise: {
    name: string;
    equipment: Equipment;
    isUnilateral: boolean;
    isDoubleWeight: boolean;
  };
  sets: {
    id: string;
    order: number;
    setType: SetType;
    reps: number;
    weight: number;
    rir: number | null;
    repsLeft: number | null;
    repsRight: number | null;
    weightLeft: number | null;
    weightRight: number | null;
    rirLeft: number | null;
    rirRight: number | null;
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
      equipment: ex.exercise.equipment,
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
          repsLeft: set.repsLeft ?? undefined,
          repsRight: set.repsRight ?? undefined,
          weightLeft: set.weightLeft ?? undefined,
          weightRight: set.weightRight ?? undefined,
          rirLeft: set.rirLeft ?? undefined,
          rirRight: set.rirRight ?? undefined,
          rest: set.rest ?? undefined,
          completedAt: set.completedAt ?? undefined,
        })),
    }));
}

export const WORKOUT_EXERCISE_TREE_INCLUDE = {
  exercises: {
    include: {
      exercise: {
        select: {
          name: true,
          equipment: true,
          isUnilateral: true,
          isDoubleWeight: true,
        },
      },
      sets: { orderBy: { order: 'asc' as const } },
    },
    orderBy: { order: 'asc' as const },
  },
};
