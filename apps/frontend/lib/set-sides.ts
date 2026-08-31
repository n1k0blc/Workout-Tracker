/**
 * The per-side view of a unilateral set (issue #65/#101). Read-only surfaces -- the
 * post-workout summary and the history detail view -- render both sides rather than
 * the stored `reps`/`weight`/`rir` aggregates, because `reps` is a rounded average
 * and would display an asymmetric 10/9 set as `× 10`, silently hiding the imbalance.
 *
 * Returns `null` for any set without complete per-side data: every bilateral set, and
 * defensively any unilateral set that somehow predates the #97 backfill. The presence
 * guard mirrors `setWorkingVolume` -- weight `0` counts as present, `null`/`undefined`
 * does not.
 */
export interface PerSideSet {
  repsLeft?: number | null;
  repsRight?: number | null;
  weightLeft?: number | null;
  weightRight?: number | null;
  rirLeft?: number | null;
  rirRight?: number | null;
}

export interface SideValues {
  reps: number;
  weight: number;
  rir: number | null;
}

export interface PerSideBreakdown {
  left: SideValues;
  right: SideValues;
}

export function setPerSide(set: PerSideSet): PerSideBreakdown | null {
  if (
    set.repsLeft == null ||
    set.repsRight == null ||
    set.weightLeft == null ||
    set.weightRight == null
  ) {
    return null;
  }
  return {
    left: { reps: set.repsLeft, weight: set.weightLeft, rir: set.rirLeft ?? null },
    right: { reps: set.repsRight, weight: set.weightRight, rir: set.rirRight ?? null },
  };
}
