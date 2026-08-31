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

/** The raw string state of one side's three inputs in a per-side entry row. */
export interface SideDraftValues {
  weight: string;
  reps: string;
  rir: string;
}

export interface DerivedSides {
  repsLeft: number;
  repsRight: number;
  weightLeft: number;
  weightRight: number;
  /** `null` only when *both* sides' RIR inputs are empty -- the server rejects RIR on one
   *  side alone, so a cleared side is filled from the other before this is decided. */
  rirLeft: number | null;
  rirRight: number | null;
  hasRir: boolean;
  /** reps/weight/rir aggregate, by the server's write-path rule (`aggregateSetSides`). `rir`
   *  is `null` when `hasRir` is false; each caller maps that to its own payload default. */
  reps: number;
  weight: number;
  rir: number | null;
}

/**
 * Turns a unilateral set's two per-side input drafts into the payload every per-side writer
 * sends: the six side values plus the reps/weight/rir aggregate re-derived exactly as the
 * server does on save (issue #100). Shared by the plan editors (issue #103) and the history
 * editor (issue #105) so that rule lives in one place.
 *
 * An empty or unparseable weight/reps input falls back to the matching aggregate default
 * (the set's current value). RIR is filled from the other side when one is cleared, and
 * reported as absent (`hasRir: false`, `rir: null`) only when neither side carries one.
 */
export function deriveSidesFromDrafts(
  left: SideDraftValues,
  right: SideDraftValues,
  fallback: { reps: number; weight: number },
): DerivedSides {
  const numOr = (raw: string, fb: number) => {
    const n = parseFloat(raw);
    return raw.trim() !== '' && !Number.isNaN(n) ? n : fb;
  };
  const intOr = (raw: string, fb: number) => {
    const n = parseInt(raw);
    return raw.trim() !== '' && !Number.isNaN(n) ? n : fb;
  };
  const parseRir = (raw: string) => {
    if (raw.trim() === '') return null;
    const n = parseInt(raw);
    return Number.isNaN(n) ? null : n;
  };

  const weightLeft = numOr(left.weight, fallback.weight);
  const weightRight = numOr(right.weight, fallback.weight);
  const repsLeft = intOr(left.reps, fallback.reps);
  const repsRight = intOr(right.reps, fallback.reps);

  let rirLeft = parseRir(left.rir);
  let rirRight = parseRir(right.rir);
  if (rirLeft == null && rirRight != null) rirLeft = rirRight;
  if (rirRight == null && rirLeft != null) rirRight = rirLeft;
  const hasRir = rirLeft != null;

  const agg = aggregateSetSides(
    { reps: repsLeft, weight: weightLeft, rir: rirLeft },
    { reps: repsRight, weight: weightRight, rir: rirRight },
  );

  return {
    repsLeft,
    repsRight,
    weightLeft,
    weightRight,
    rirLeft,
    rirRight,
    hasRir,
    reps: agg.reps || 0,
    weight: agg.weight || 0,
    rir: hasRir ? (agg.rir ?? 0) : null,
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
