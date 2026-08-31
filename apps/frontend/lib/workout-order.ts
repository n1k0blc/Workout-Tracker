import { ExerciseLog, SetType, WorkoutExerciseInput } from '@/types';

/**
 * Array position is authoritative for ordering; `order` on the wire only restates it.
 *
 * Stored `order` used to be passed straight through to save payloads, and each builder
 * re-derived its own convention -- the workout path wrote 0-based exercises, the template
 * editor 1-based, and two cycle-wizard paths added or subtracted 1 to "convert" between
 * bases they only assumed. The result was a database holding both bases plus gaps, which is
 * what migration 20260814080000 had to clean up.
 *
 * `withArrayPositionOrder` is the one place that assigns `order` for a save payload. Callers
 * build their tree without one; any `order` that does slip in on the input is overwritten
 * rather than honoured, so a stored value cannot reach the wire through here.
 */

type WithOrder<T> = T & { order: number };

/**
 * Stamps 1-based contiguous `order` on a save payload, derived from array position at both
 * levels. Gaps close and any stored numbering is overridden -- which is what normalizes a
 * localStorage draft written before the ordering migration.
 */
export function withArrayPositionOrder<E extends { sets: object[] }>(
  exercises: E[],
): WithOrder<Omit<E, 'sets'> & { sets: WithOrder<E['sets'][number]>[] }>[] {
  return exercises.map((exercise, exerciseIndex) => {
    const { sets, ...rest } = exercise;
    return {
      ...(rest as Omit<E, 'sets'>),
      order: exerciseIndex + 1,
      sets: sets.map((set, setIndex) => ({ ...set, order: setIndex + 1 })),
    };
  });
}

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
    .map((ex, index) => ({ ...ex, order: index + 1 }));
}

/**
 * ExerciseLog[] (client draft) -> WorkoutExerciseInput[] (save payload).
 *
 * Ordering comes from array position via `withArrayPositionOrder`, never from `ex.order` or
 * `s.setNumber`: the backend persists this tree verbatim into the workout *and* into any
 * overwritten blueprint/template, and reads it back sorted, so it must reflect the sequence
 * the user actually sees. Exercises with no logged sets are dropped first, so the remaining
 * ones close the gap rather than keeping numbers around a hole.
 */
export function toExercisePayload(exercises: ExerciseLog[]): WorkoutExerciseInput[] {
  const unordered = exercises
    .filter((ex) => ex.sets.length > 0)
    .map((ex) => ({
      exerciseId: ex.exerciseId,
      sets: ex.sets.map((s) => ({
        setType: s.setType ?? SetType.WORKING,
        reps: s.reps,
        weight: s.weight,
        rir: s.rir,
        // Per-side values for unilateral sets (issue #102). Emitted only when the set
        // carries them; the server derives reps/weight/rir from these and rejects a
        // unilateral set that has none. Bilateral sets leave every field undefined and
        // the key is dropped from the payload, which the server also requires.
        ...perSideFields(s),
        rest: s.rest ?? 90,
        completedAt: s.completedAt,
      })),
    }));

  return withArrayPositionOrder(unordered);
}

type SideKey = 'repsLeft' | 'repsRight' | 'weightLeft' | 'weightRight' | 'rirLeft' | 'rirRight';
const SIDE_KEYS: readonly SideKey[] = ['repsLeft', 'repsRight', 'weightLeft', 'weightRight', 'rirLeft', 'rirRight'];

/** The six per-side fields of a set, with any `null`/`undefined` entry dropped so a
 *  bilateral set contributes nothing to the payload. Used by the workout save path; the
 *  plan editors use `plannedSideFields` (set-sides.ts), which adds an aggregate fallback. */
function perSideFields(
  s: Partial<Record<SideKey, number | null | undefined>>,
): Partial<Record<SideKey, number>> {
  const out: Partial<Record<SideKey, number>> = {};
  for (const key of SIDE_KEYS) {
    const v = s[key];
    if (v != null) out[key] = v;
  }
  return out;
}
