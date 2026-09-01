import { PlannedSet, SetLog } from '@/types';

export interface SeededSetValues {
  weight: number;
  reps: number;
  /** `null` when the source set carried no RIR; `0` is a real value (train to failure). */
  rir: number | null;
  repsLeft?: number;
  repsRight?: number;
  weightLeft?: number;
  weightRight?: number;
  rirLeft?: number;
  rirRight?: number;
}

/**
 * The values a set added during the active workout should arrive carrying (issue #111), so the
 * common case -- another set at the same weight and reps -- is one tap rather than a retype
 * between sets with a rest timer running.
 *
 * The copy source is the last set the user actually **logged**; when nothing is logged yet, the
 * last **planned** set -- what you just did predicts the next set better than what the plan said
 * you would do. With neither, `null`: the caller leaves the fields blank so the user types an
 * estimate into obvious 0 placeholders, and rest stays at its 90 s default rather than 0.
 *
 * Values only. The set **type** is never copied -- an added set is always a working set, so
 * adding one after a warm-up does not produce a second warm-up. Per-side values ride along for a
 * unilateral exercise; the caller re-derives the aggregate from them.
 */
export function seedAddedSetValues(
  loggedSets: readonly SetLog[],
  plannedSets: readonly PlannedSet[] | undefined,
): SeededSetValues | null {
  const lastLogged = loggedSets.reduce<SetLog | undefined>(
    (max, s) => (max === undefined || s.setNumber > max.setNumber ? s : max),
    undefined,
  );
  const lastPlanned =
    plannedSets && plannedSets.length > 0
      ? plannedSets.reduce((max, s) => (s.order > max.order ? s : max))
      : undefined;

  const source: SetLog | PlannedSet | undefined = lastLogged ?? lastPlanned;
  if (!source) return null;

  return {
    weight: source.weight,
    reps: source.reps,
    rir: source.rir ?? null,
    repsLeft: source.repsLeft,
    repsRight: source.repsRight,
    weightLeft: source.weightLeft,
    weightRight: source.weightRight,
    rirLeft: source.rirLeft,
    rirRight: source.rirRight,
  };
}
