import { Equipment, SetType } from '@/types';

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
  | 'zeroWeight';

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
      if (n === 0 && ctx.equipment !== Equipment.BODYWEIGHT) return 'zeroWeight';
      return null;
    case 'reps':
      if (empty || Number.isNaN(n)) return 'missing';
      return Number.isInteger(n) && n >= 1 ? null : 'invalid';
    case 'rir':
      if (ctx.setType === SetType.WARMUP) return null;
      if (empty || Number.isNaN(n)) return 'missing';
      return Number.isInteger(n) && n >= 0 ? null : 'invalid';
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
