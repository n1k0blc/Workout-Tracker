import type { ExerciseLog } from '@/types';
import { setNeedsRir } from '@/lib/log-set-guards';

/**
 * Is this workout finished -- and if not, what is the first thing in the way? (#228, parent #221)
 *
 * One pure rule, shared by every caller: the live "Beenden" button, the Uebung-order lock, past
 * workout tracking and (#229) the 5-hour outcome. A workout is complete when
 *
 *   - every planned set and every added set row is logged or swiped away,
 *   - every logged working set has RIR (a warm-up never needs one), and
 *   - at least one set is logged overall.
 *
 * An Uebung whose sets were all swiped away is complete and simply contributes nothing to the
 * saved workout (`toExercisePayload` drops an Uebung with no logged set). An Uebung with no planned
 * sets and nothing logged is NOT complete: it is a forgotten empty card, not a skipped one.
 *
 * "Swiped away" and "added row" are session state that lives in `workout-context`, not on the
 * workout itself, so they come in as `SetRowState`.
 */

/** Per Uebung (keyed by `ExerciseLog.id`), the set rows that exist only in this session. */
export interface SetRowState {
  /** Planned set numbers the user swiped away. Persisted with the draft. */
  skipped: Readonly<Record<string, readonly number[]>>;
  /** Added set rows that are not logged yet (an unlogged row the user opened with "Satz hinzufügen"). */
  added: Readonly<Record<string, readonly number[]>>;
}

export const EMPTY_SET_ROW_STATE: SetRowState = { skipped: {}, added: {} };

interface ExerciseRef {
  exerciseId: string;
  exerciseName: string;
}

/** What stops a single Uebung from being complete. `exerciseId` is the `ExerciseLog.id`. */
export type ExerciseProblem =
  /** Nothing planned, nothing logged, no row: an empty card. */
  | ({ kind: 'emptyExercise' } & ExerciseRef)
  /** A planned or added row that is neither logged nor swiped away. */
  | ({ kind: 'unloggedSet'; setNumber: number } & ExerciseRef)
  /** A logged working set without RIR. */
  | ({ kind: 'missingRir'; setNumber: number } & ExerciseRef);

export type WorkoutProblem = ExerciseProblem | { kind: 'nothingLogged' };

export type WorkoutCompleteness = { complete: true } | { complete: false; problem: WorkoutProblem };

/** The first thing keeping one Uebung from being complete, or null. */
export function checkExerciseCompleteness(
  exercise: Pick<ExerciseLog, 'id' | 'exerciseName' | 'plannedSets' | 'sets'>,
  rows: SetRowState,
): ExerciseProblem | null {
  const ref = { exerciseId: exercise.id, exerciseName: exercise.exerciseName };
  const skipped = new Set(rows.skipped[exercise.id] ?? []);
  const planned = (exercise.plannedSets ?? []).map((ps) => ps.order);
  const added = rows.added[exercise.id] ?? [];
  const loggedByNumber = new Map(exercise.sets.map((s) => [s.setNumber, s]));

  if (planned.length === 0 && exercise.sets.length === 0 && added.length === 0) {
    return { kind: 'emptyExercise', ...ref };
  }

  const numbers = new Set<number>([
    ...planned.filter((n) => !skipped.has(n)),
    ...added,
    ...loggedByNumber.keys(),
  ]);
  for (const setNumber of [...numbers].sort((a, b) => a - b)) {
    const set = loggedByNumber.get(setNumber);
    if (!set) return { kind: 'unloggedSet', setNumber, ...ref };
    if (setNeedsRir(set)) return { kind: 'missingRir', setNumber, ...ref };
  }
  return null;
}

/**
 * Complete, or the first problem in workout order: Uebungen top to bottom, sets by number. When
 * every Uebung is fine but not a single set is logged (no Uebung at all, or everything swiped
 * away), the problem is `nothingLogged`.
 */
export function checkWorkoutCompleteness(
  workout: { exercises: readonly Pick<ExerciseLog, 'id' | 'exerciseName' | 'plannedSets' | 'sets'>[] },
  rows: SetRowState,
): WorkoutCompleteness {
  for (const exercise of workout.exercises) {
    const problem = checkExerciseCompleteness(exercise, rows);
    if (problem) return { complete: false, problem };
  }
  if (!workout.exercises.some((exercise) => exercise.sets.length > 0)) {
    return { complete: false, problem: { kind: 'nothingLogged' } };
  }
  return { complete: true };
}
