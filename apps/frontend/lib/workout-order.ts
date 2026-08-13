import { ExerciseLog, SetType, WorkoutExerciseInput } from '@/types';

/**
 * Reorders the draft's exercises to match `exerciseIds` (drag-and-drop result).
 * Array position is authoritative, so `order` is renumbered to match it -- otherwise the
 * dragged exercises keep their original `order` and every order-sorted reader (save payload,
 * start screen) still shows the pre-drag sequence.
 */
export function reorderExerciseLogs(exercises: ExerciseLog[], exerciseIds: string[]): ExerciseLog[] {
  return (exerciseIds
    .map((id) => exercises.find((ex) => ex.id === id))
    .filter(Boolean) as ExerciseLog[])
    .map((ex, index) => ({ ...ex, order: index }));
}

/**
 * ExerciseLog[] (client draft) -> WorkoutExerciseInput[] (save payload).
 * `order` is derived from array position, not from `ex.order`: the backend persists this value
 * verbatim into the workout *and* into any overwritten blueprint/template, and reads it back
 * sorted, so it must reflect the sequence the user actually sees.
 */
export function toExercisePayload(exercises: ExerciseLog[]): WorkoutExerciseInput[] {
  return exercises
    .filter((ex) => ex.sets.length > 0)
    .map((ex, index) => ({
      exerciseId: ex.exerciseId,
      order: index,
      sets: ex.sets.map((s) => ({
        order: s.setNumber,
        setType: s.setType ?? SetType.WORKING,
        reps: s.reps,
        weight: s.weight,
        rir: s.rir,
        rest: s.rest ?? 90,
        completedAt: s.completedAt,
      })),
    }));
}
