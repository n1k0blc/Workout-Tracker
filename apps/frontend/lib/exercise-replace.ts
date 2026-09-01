import type { Equipment } from '@/types';

/** The fields a picked replacement exercise contributes to a draft exercise entry. */
export interface ReplacementExercise {
  id: string;
  name: string;
  equipment?: Equipment;
  isUnilateral?: boolean;
  isDoubleWeight?: boolean;
}

/**
 * Swaps the exercise identity of the entry with `exerciseLogId`, keeping its sets/order intact.
 *
 * `isUnilateral`/`isDoubleWeight` belong to the *new* exercise, so they are always overwritten --
 * never left to survive the `...ex` spread. ExerciseCard renders the "Gewicht (2x)" / "Wdh (2x)"
 * column headers straight off these two flags, so a carried-over value shows the previous
 * exercise's loading scheme (missing headers after swapping to a dumbbell exercise, stale headers
 * after swapping away from one). Absent flags normalise to `false` for the same reason.
 *
 * `equipment` is overwritten on the same principle -- it gates the card's 0 kg additional-set
 * guard, so a swap away from a BODYWEIGHT exercise must not leave that guard open. A lookup miss
 * carries no equipment, which drops it and falls back to the strict guard.
 */
export function replaceExerciseInList<T extends { id: string }>(
  exercises: T[],
  exerciseLogId: string,
  replacement: ReplacementExercise | undefined,
): T[] {
  return exercises.map((ex) =>
    ex.id === exerciseLogId
      ? {
          ...ex,
          exerciseId: replacement?.id ?? (ex as { exerciseId?: string }).exerciseId,
          exerciseName: replacement?.name || 'Exercise',
          equipment: replacement?.equipment,
          isUnilateral: replacement?.isUnilateral ?? false,
          isDoubleWeight: replacement?.isDoubleWeight ?? false,
        }
      : ex,
  );
}

/** The aggregate + per-side fields the plan-editor reshape reads and rewrites on one set. */
interface ShapedSet {
  reps: number;
  weight: number;
  rir?: number;
  repsLeft?: number;
  repsRight?: number;
  weightLeft?: number;
  weightRight?: number;
  rirLeft?: number;
  rirRight?: number;
}

/** Seeds both sides of a set from the aggregate already there (bilateral -> unilateral). */
const seedSidesFromAggregate = <T extends ShapedSet>(set: T): T => ({
  ...set,
  repsLeft: set.reps,
  repsRight: set.reps,
  weightLeft: set.weight,
  weightRight: set.weight,
  rirLeft: set.rir,
  rirRight: set.rir,
});

/** Drops the per-side data, keeping the aggregate (unilateral -> bilateral). */
const dropSides = <T extends ShapedSet>(set: T): T => ({
  ...set,
  repsLeft: undefined,
  repsRight: undefined,
  weightLeft: undefined,
  weightRight: undefined,
  rirLeft: undefined,
  rirRight: undefined,
});

/**
 * A plan editor's exercise swap. Replaces the exercise identity like `replaceExerciseInList`
 * and -- only when the swap flips the unilateral flag -- reshapes that entry's planned sets so
 * their side data matches the new exercise (issue #104):
 *
 *  - bilateral -> unilateral: seed both sides of every set from the aggregate already there
 *  - unilateral -> bilateral: keep the aggregate, drop the per-side data
 *
 * A swap between two exercises of the same shape leaves the sets untouched. This keeps the
 * numbers the user typed -- the whole reason a plan swap keeps the sets -- while stopping
 * per-side data from stranding on an exercise that cannot carry it, the same inconsistency the
 * active workout's swap lock prevents. `setsKey` names the field the editor keeps its plan sets
 * under: `'plannedSets'` for the template and blueprint editors, `'sets'` for the cycle-day one.
 */
export function replacePlanExerciseInList<T extends { id: string; isUnilateral?: boolean }>(
  exercises: T[],
  exerciseLogId: string,
  replacement: ReplacementExercise | undefined,
  setsKey: keyof T & string,
): T[] {
  const replaced = replaceExerciseInList(exercises, exerciseLogId, replacement);

  // Reshape only when the picked exercise's shape is actually known. On a lookup miss the
  // replacement carries no `isUnilateral`, `replaceExerciseInList` forces it to `false`, and
  // reshaping off that would let a flag-less swap masquerade as "-> bilateral" and strip a
  // unilateral entry's per-side numbers -- the opposite of preserving what the user typed.
  if (replacement?.isUnilateral === undefined) return replaced;

  const wasUnilateral = !!exercises.find((ex) => ex.id === exerciseLogId)?.isUnilateral;
  if (wasUnilateral === replacement.isUnilateral) return replaced;

  return replaced.map((ex) => {
    if (ex.id !== exerciseLogId) return ex;
    const sets = (ex[setsKey] as ShapedSet[] | undefined) ?? [];
    const reshape = replacement.isUnilateral ? seedSidesFromAggregate : dropSides;
    return { ...ex, [setsKey]: sets.map(reshape) } as T;
  });
}
