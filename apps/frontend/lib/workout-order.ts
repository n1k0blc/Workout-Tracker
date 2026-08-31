import { ExerciseLog, SetLog, SetType, WorkoutExercise, WorkoutExerciseInput } from '@/types';

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
 * Server workout tree -> client draft for the history editor (`loadWorkoutForEdit`).
 *
 * The response carries only confirmed sets, so they map straight into `sets` with no
 * `plannedSets` -- history editing is values-only, there is no logging concept. The six
 * per-side columns (issue #105) ride through untouched: a no-op re-save then round-trips a
 * historical unilateral workout instead of nulling its backfilled sides. `toExercisePayload`
 * re-emits them, and the write path (#100) rejects a unilateral set that lost them.
 */
export function buildExerciseLogsForEdit(exercises: WorkoutExercise[]): ExerciseLog[] {
  return exercises.map((ex) => ({
    ...ex,
    sets: ex.sets.map((s): SetLog => ({
      id: s.id,
      setNumber: s.order,
      setType: s.setType,
      reps: s.reps,
      weight: s.weight,
      rir: s.rir,
      repsLeft: s.repsLeft ?? undefined,
      repsRight: s.repsRight ?? undefined,
      weightLeft: s.weightLeft ?? undefined,
      weightRight: s.weightRight ?? undefined,
      rirLeft: s.rirLeft ?? undefined,
      rirRight: s.rirRight ?? undefined,
      rest: s.rest,
      completedAt: s.completedAt ?? new Date().toISOString(),
    })),
    plannedSets: undefined,
  }));
}

/** A values-only edit from the history editor's per-set inputs. */
type AggregateEdit = { reps?: number; weight?: number; rir?: number; setType?: SetType };

/**
 * Applies a history-editor value edit to a draft set, mirroring a *changed* aggregate onto
 * the per-side columns the set carries.
 *
 * The history editor shows one aggregate field per set -- there is no per-side entry here
 * (issue #105). A unilateral set backfilled by #97 carries `repsLeft`/`repsRight` etc., and
 * the write path (#100) re-derives `reps`/`weight`/`rir` from those sides on save. Patching
 * only the aggregate would leave the sides stale and the server would silently revert the
 * edit, so a field whose aggregate actually moved is written to both sides, collapsing that
 * one field to symmetric. Fields the edit left equal to the stored aggregate keep their
 * per-side asymmetry -- the card re-sends all three on every keystroke, so only comparing
 * against the stored value tells an edit from a pass-through. A set with no per-side data
 * (every bilateral set, unilateral sets from before the backfill) is patched as-is.
 */
export function applyAggregateEdit<
  T extends Partial<Record<SideKey, number | null | undefined>> & {
    reps?: number;
    weight?: number;
    rir?: number;
  },
>(s: T, data: AggregateEdit): T {
  const next = { ...s, ...data };
  const mirror = (value: number | undefined, current: number | undefined, left: SideKey, right: SideKey) => {
    if (value == null || value === current) return;
    if (s[left] != null || s[right] != null) {
      next[left] = value as T[SideKey];
      next[right] = value as T[SideKey];
    }
  };
  mirror(data.reps, s.reps, 'repsLeft', 'repsRight');
  mirror(data.weight, s.weight, 'weightLeft', 'weightRight');
  mirror(data.rir, s.rir, 'rirLeft', 'rirRight');
  return next;
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
