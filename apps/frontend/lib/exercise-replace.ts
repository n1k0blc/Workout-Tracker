/** The fields a picked replacement exercise contributes to a draft exercise entry. */
export interface ReplacementExercise {
  id: string;
  name: string;
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
          isUnilateral: replacement?.isUnilateral ?? false,
          isDoubleWeight: replacement?.isDoubleWeight ?? false,
        }
      : ex,
  );
}
