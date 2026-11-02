import { Equipment, SetType } from '@/types';
import { REPS_MAX, RIR_MAX, WEIGHT_KG_MAX } from './field-rules';

/**
 * The rules for logging one set (#227, parent #221), as pure functions over the raw strings the
 * exercise card holds. Every log path -- the tick, the swipe and the auto-commit when tracking a
 * past workout -- goes through `checkSetForLogging`, so no way of logging is looser than another.
 * The workout-completeness check (#228) reuses `setNeedsRir` / `findFirstSetNeedingRir` for "every
 * logged working set has RIR".
 *
 * A working set needs weight, reps and RIR; a warm-up needs weight and reps and has no RIR at all.
 * A unilateral set needs every field on both sides. 0 kg is a load only on Bodyweight exercises.
 * The server does none of this for working sets (history holds sets without RIR); it only rejects
 * an RIR on a warm-up.
 */

export type SetField = 'weight' | 'reps' | 'rir';
export type Side = 'left' | 'right';
/** The field a problem belongs to: `weight`, or `left.weight` on a unilateral set. */
export type SetFieldKey = SetField | `${Side}.${SetField}`;

/** One set's three inputs as typed. `weight` is the card's canonical-kg string (ADR-0005). */
export interface SetFieldValues {
  weight: string;
  reps: string;
  rir: string;
}

export type SetProblemKind =
  /** Empty (or not a number at all): the field was never filled in. */
  | 'missing'
  /** A number the field cannot hold: negative, fractional reps or RIR, reps below 1. */
  | 'invalid'
  /** 0 kg on an exercise that is not Bodyweight. */
  | 'zeroWeight'
  /** Above the field's upper bound (`WEIGHT_KG_MAX`, `REPS_MAX`, `RIR_MAX`). */
  | 'tooHigh';

export interface SetProblem {
  field: SetFieldKey;
  kind: SetProblemKind;
}

export interface LogGuardInput {
  setType: SetType;
  equipment?: Equipment | null;
  /** One set's values, or both sides of a unilateral set. */
  values: SetFieldValues | { left: SetFieldValues; right: SetFieldValues };
}

/** RIR from here up on a working set earns the amber "aim for at most RIR 2" hint. */
export const RIR_HINT_FROM = 3;

const FIELD_ORDER: SetField[] = ['weight', 'reps', 'rir'];

function checkField(
  field: SetField,
  raw: string,
  ctx: { setType: SetType; equipment?: Equipment | null },
): SetProblemKind | null {
  const empty = raw.trim() === '';
  const n = Number(raw);
  switch (field) {
    case 'weight':
      if (empty || Number.isNaN(n)) return 'missing';
      if (n < 0) return 'invalid';
      if (n > WEIGHT_KG_MAX) return 'tooHigh';
      if (n === 0 && ctx.equipment !== Equipment.BODYWEIGHT) return 'zeroWeight';
      return null;
    case 'reps':
      if (empty || Number.isNaN(n)) return 'missing';
      if (!Number.isInteger(n) || n < 1) return 'invalid';
      return n > REPS_MAX ? 'tooHigh' : null;
    case 'rir':
      if (ctx.setType === SetType.WARMUP) return null;
      if (empty || Number.isNaN(n)) return 'missing';
      if (!Number.isInteger(n) || n < 0) return 'invalid';
      return n > RIR_MAX ? 'tooHigh' : null;
  }
}

/** Every rule the set breaks, in field order (left side first); an empty list means it may be logged. */
export function checkSetForLogging(input: LogGuardInput): SetProblem[] {
  const ctx = { setType: input.setType, equipment: input.equipment };
  const problems: SetProblem[] = [];
  const run = (values: SetFieldValues, prefix: '' | `${Side}.`) => {
    for (const field of FIELD_ORDER) {
      const kind = checkField(field, values[field], ctx);
      if (kind) problems.push({ field: `${prefix}${field}` as SetFieldKey, kind });
    }
  };
  if ('left' in input.values) {
    run(input.values.left, 'left.');
    run(input.values.right, 'right.');
  } else {
    run(input.values, '');
  }
  return problems;
}

/** A stored set (numbers, sides optional), as the history editor holds it. */
export interface StoredSetValues {
  setType?: SetType;
  weight: number;
  reps: number;
  rir?: number | null;
  weightLeft?: number | null;
  weightRight?: number | null;
  repsLeft?: number | null;
  repsRight?: number | null;
  rirLeft?: number | null;
  rirRight?: number | null;
}

/**
 * `checkSetForLogging` for a set that is already stored. The history editor applies it only to
 * the sets the user changed: older workouts hold working sets without RIR, and an untouched one
 * must not block saving.
 */
export function checkLoggedSet(
  set: StoredSetValues,
  ctx: { equipment?: Equipment | null; isUnilateral?: boolean },
): SetProblem[] {
  const str = (n: number | null | undefined) => (n == null ? '' : String(n));
  // A set predating per-side data reads both sides from the aggregate; once either side carries
  // an RIR, a side without one is genuinely missing it.
  const hasSideRir = set.rirLeft != null || set.rirRight != null;
  const side = (weight?: number | null, reps?: number | null, rir?: number | null): SetFieldValues => ({
    weight: str(weight ?? set.weight),
    reps: str(reps ?? set.reps),
    rir: str(hasSideRir ? rir : set.rir),
  });
  return checkSetForLogging({
    setType: set.setType ?? SetType.WORKING,
    equipment: ctx.equipment,
    values: ctx.isUnilateral
      ? {
          left: side(set.weightLeft, set.repsLeft, set.rirLeft),
          right: side(set.weightRight, set.repsRight, set.rirRight),
        }
      : { weight: str(set.weight), reps: str(set.reps), rir: str(set.rir) },
  });
}

/** The amber hint: a working set planned or logged at RIR 3 or more. Never blocks anything. */
export function rirNeedsHint(setType: SetType, raw: string): boolean {
  if (setType !== SetType.WORKING || raw.trim() === '') return false;
  const n = Number(raw);
  return Number.isFinite(n) && n >= RIR_HINT_FROM;
}

/**
 * In the active workout a set can only be logged once every earlier set of its Uebung is logged
 * or swiped away. `slots` are the set numbers still in play (swiped-away ones are not among
 * them); returns the first earlier one that is not logged yet, or null when `target` may go.
 */
export function firstEarlierUnresolvedSet(
  target: number,
  slots: readonly number[],
  logged: ReadonlySet<number>,
): number | null {
  const pending = slots.filter((n) => n < target && !logged.has(n)).sort((a, b) => a - b);
  return pending[0] ?? null;
}

/** A working set (the default type) with no RIR. A warm-up never needs one. */
export function setNeedsRir(set: { setType?: SetType; rir?: number | null }): boolean {
  return (set.setType ?? SetType.WORKING) === SetType.WORKING && set.rir == null;
}

/** The first working set without RIR across a workout or a plan, or null. */
export function findFirstSetNeedingRir(
  exercises: readonly { sets: readonly { setType?: SetType; rir?: number | null }[] }[],
): { exerciseIndex: number; setIndex: number } | null {
  for (const [exerciseIndex, exercise] of exercises.entries()) {
    const setIndex = exercise.sets.findIndex(setNeedsRir);
    if (setIndex !== -1) return { exerciseIndex, setIndex };
  }
  return null;
}

/** A planned or stored set's numbers, aggregate and per side; absent values are not judged. */
interface BoundedSet {
  weight?: number | null;
  weightLeft?: number | null;
  weightRight?: number | null;
  reps?: number | null;
  repsLeft?: number | null;
  repsRight?: number | null;
  rir?: number | null;
  rirLeft?: number | null;
  rirRight?: number | null;
}

/**
 * The first set across a plan holding a weight, reps or RIR past its upper bound, or null. The
 * plan editors check it before saving, so the user is told on the client instead of by a 400.
 */
export function findFirstSetOverLimit(
  exercises: readonly { sets: readonly BoundedSet[] }[],
): { exerciseIndex: number; setIndex: number } | null {
  const over = (value: number | null | undefined, max: number) => value != null && value > max;
  const isOver = (s: BoundedSet) =>
    [s.weight, s.weightLeft, s.weightRight].some((v) => over(v, WEIGHT_KG_MAX)) ||
    [s.reps, s.repsLeft, s.repsRight].some((v) => over(v, REPS_MAX)) ||
    [s.rir, s.rirLeft, s.rirRight].some((v) => over(v, RIR_MAX));
  for (const [exerciseIndex, exercise] of exercises.entries()) {
    const setIndex = exercise.sets.findIndex(isOver);
    if (setIndex !== -1) return { exerciseIndex, setIndex };
  }
  return null;
}
