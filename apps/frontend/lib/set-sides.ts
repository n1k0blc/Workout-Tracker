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

export interface SideInput {
  reps: number;
  weight: number;
  rir?: number | null;
}

/**
 * The reps/weight/rir aggregate a unilateral set stores, derived from its two sides.
 * Mirrors the server's write-path rule exactly (`deriveSetAggregates`, issue #100):
 * `reps = round(avg(L, R))`, `weight = avg(L, R)`, `rir = min(L, R)` -- the limiting
 * side is the one that decided whether another rep was possible.
 *
 * The client computes this only so the live logging card can show a consistent
 * aggregate the instant a set is logged (volume, PR hints). The server recomputes
 * and owns the persisted values; whatever the client sends for these three is
 * discarded there.
 *
 * `rir` is `undefined` unless *both* sides carry one -- the server rejects a set
 * with RIR on only one side, and the card mirrors RIR between the sides so the
 * one-sided case never reaches here in practice.
 */
export function aggregateSetSides(
  left: SideInput,
  right: SideInput,
): { reps: number; weight: number; rir?: number } {
  const rir =
    left.rir == null || right.rir == null ? undefined : Math.min(left.rir, right.rir);
  return {
    reps: Math.round((left.reps + right.reps) / 2),
    weight: (left.weight + right.weight) / 2,
    rir,
  };
}

interface PlannedSetLikeSides {
  reps: number;
  weight: number;
  rir?: number | null;
  repsLeft?: number | null;
  repsRight?: number | null;
  weightLeft?: number | null;
  weightRight?: number | null;
  rirLeft?: number | null;
  rirRight?: number | null;
}

type PlannedSideKey =
  | 'repsLeft'
  | 'repsRight'
  | 'weightLeft'
  | 'weightRight'
  | 'rirLeft'
  | 'rirRight';

/**
 * The per-side fields a plan's set (template / blueprint / cycle-day) sends on save.
 *
 * For a bilateral exercise: nothing -- the write path rejects a bilateral set that carries
 * side data. For a unilateral one: all six sides, falling back to the aggregate for any that
 * a legacy plan never stored, so the payload is always a valid unilateral tree even for a
 * plan created before per-side targets existed (issue #103). RIR is emitted on both sides or
 * neither, matching the server's "both or neither" rule.
 */
export function plannedSideFields(
  s: PlannedSetLikeSides,
  isUnilateral: boolean | undefined,
): Partial<Record<PlannedSideKey, number>> {
  if (!isUnilateral) return {};
  const out: Partial<Record<PlannedSideKey, number>> = {
    repsLeft: s.repsLeft ?? s.reps,
    repsRight: s.repsRight ?? s.reps,
    weightLeft: s.weightLeft ?? s.weight,
    weightRight: s.weightRight ?? s.weight,
  };
  const rir = s.rirLeft ?? s.rirRight ?? s.rir;
  if (rir != null) {
    out.rirLeft = s.rirLeft ?? rir;
    out.rirRight = s.rirRight ?? rir;
  }
  return out;
}
