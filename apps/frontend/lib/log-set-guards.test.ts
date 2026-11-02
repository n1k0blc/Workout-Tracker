import { describe, it, expect } from 'vitest';
import {
  checkSetForLogging,
  rirNeedsHint,
  firstEarlierUnresolvedSet,
  setNeedsRir,
  findFirstSetNeedingRir,
  type SetFieldValues,
} from './log-set-guards';
import { Equipment, SetType } from '@/types';

const values = (over: Partial<SetFieldValues> = {}): SetFieldValues => ({
  weight: '60',
  reps: '10',
  rir: '2',
  ...over,
});

const check = (
  v: SetFieldValues | { left: SetFieldValues; right: SetFieldValues },
  over: { setType?: SetType; equipment?: Equipment | null } = {},
) => checkSetForLogging({ setType: SetType.WORKING, equipment: Equipment.BARBELL, values: v, ...over });

describe('checkSetForLogging: a working set needs weight, reps and RIR', () => {
  it('passes a complete set', () => {
    expect(check(values())).toEqual([]);
  });

  it('names every empty field, not only the first', () => {
    expect(check(values({ weight: '', reps: '', rir: '' }))).toEqual([
      { field: 'weight', kind: 'missing' },
      { field: 'reps', kind: 'missing' },
      { field: 'rir', kind: 'missing' },
    ]);
  });

  it('treats a whitespace-only value as empty', () => {
    expect(check(values({ rir: '  ' }))).toEqual([{ field: 'rir', kind: 'missing' }]);
  });

  it('accepts RIR 0: failure is a value, not an absence', () => {
    expect(check(values({ rir: '0' }))).toEqual([]);
  });

  it('refuses reps below 1 and fractional reps or RIR', () => {
    expect(check(values({ reps: '0' }))).toEqual([{ field: 'reps', kind: 'invalid' }]);
    expect(check(values({ reps: '1' }))).toEqual([]);
    expect(check(values({ reps: '2.5' }))).toEqual([{ field: 'reps', kind: 'invalid' }]);
    expect(check(values({ rir: '1.5' }))).toEqual([{ field: 'rir', kind: 'invalid' }]);
  });

  it('refuses a negative weight or RIR', () => {
    expect(check(values({ weight: '-5' }))).toEqual([{ field: 'weight', kind: 'invalid' }]);
    expect(check(values({ rir: '-1' }))).toEqual([{ field: 'rir', kind: 'invalid' }]);
  });
});

describe('checkSetForLogging: 0 kg is a load only on Bodyweight exercises', () => {
  it('refuses 0 kg on any other equipment, and on an unknown one', () => {
    expect(check(values({ weight: '0' }))).toEqual([{ field: 'weight', kind: 'zeroWeight' }]);
    expect(check(values({ weight: '0' }), { equipment: null })).toEqual([
      { field: 'weight', kind: 'zeroWeight' },
    ]);
  });

  it('accepts 0 kg on a Bodyweight exercise', () => {
    expect(check(values({ weight: '0' }), { equipment: Equipment.BODYWEIGHT })).toEqual([]);
  });

  it('still needs reps on a Bodyweight exercise', () => {
    expect(check(values({ weight: '0', reps: '' }), { equipment: Equipment.BODYWEIGHT })).toEqual([
      { field: 'reps', kind: 'missing' },
    ]);
  });

  it('still refuses a negative load on a Bodyweight exercise', () => {
    expect(check(values({ weight: '-5' }), { equipment: Equipment.BODYWEIGHT })).toEqual([
      { field: 'weight', kind: 'invalid' },
    ]);
  });

  it('accepts a weighted bodyweight set (weighted pull-up)', () => {
    expect(check(values({ weight: '20' }), { equipment: Equipment.BODYWEIGHT })).toEqual([]);
  });
});

describe('checkSetForLogging: a warm-up set has no RIR', () => {
  it('needs only weight and reps', () => {
    expect(check(values({ rir: '' }), { setType: SetType.WARMUP })).toEqual([]);
    expect(check(values({ weight: '', reps: '', rir: '' }), { setType: SetType.WARMUP })).toEqual([
      { field: 'weight', kind: 'missing' },
      { field: 'reps', kind: 'missing' },
    ]);
  });
});

describe('checkSetForLogging: a unilateral set needs every per-side field', () => {
  const sides = (left: Partial<SetFieldValues> = {}, right: Partial<SetFieldValues> = {}) => ({
    left: values(left),
    right: values(right),
  });

  it('passes when both sides are complete', () => {
    expect(check(sides())).toEqual([]);
  });

  it('names the side and the field', () => {
    expect(check(sides({ rir: '' }, { reps: '' }))).toEqual([
      { field: 'left.rir', kind: 'missing' },
      { field: 'right.reps', kind: 'missing' },
    ]);
  });

  it('applies the 0 kg rule per side', () => {
    expect(check(sides({}, { weight: '0' }))).toEqual([{ field: 'right.weight', kind: 'zeroWeight' }]);
    expect(check(sides({ weight: '0' }, { weight: '0' }), { equipment: Equipment.BODYWEIGHT })).toEqual([]);
  });

  it('asks for no RIR on a warm-up', () => {
    expect(check(sides({ rir: '' }, { rir: '' }), { setType: SetType.WARMUP })).toEqual([]);
  });
});

describe('rirNeedsHint: aim for at most RIR 2', () => {
  it('starts at RIR 3 on a working set', () => {
    expect(rirNeedsHint(SetType.WORKING, '2')).toBe(false);
    expect(rirNeedsHint(SetType.WORKING, '3')).toBe(true);
    expect(rirNeedsHint(SetType.WORKING, '10')).toBe(true);
  });

  it('is silent for empty, non-numeric and warm-up values', () => {
    expect(rirNeedsHint(SetType.WORKING, '')).toBe(false);
    expect(rirNeedsHint(SetType.WORKING, 'abc')).toBe(false);
    expect(rirNeedsHint(SetType.WARMUP, '5')).toBe(false);
  });
});

describe('firstEarlierUnresolvedSet: sets are logged in order', () => {
  it('is null for the first set and when every earlier set is logged', () => {
    expect(firstEarlierUnresolvedSet(1, [1, 2, 3], new Set())).toBeNull();
    expect(firstEarlierUnresolvedSet(3, [1, 2, 3], new Set([1, 2]))).toBeNull();
  });

  it('names the first earlier set that is neither logged nor gone', () => {
    expect(firstEarlierUnresolvedSet(3, [1, 2, 3], new Set([1]))).toBe(2);
    expect(firstEarlierUnresolvedSet(3, [1, 2, 3], new Set())).toBe(1);
  });

  it('ignores a swiped-away set because it is not among the slots', () => {
    expect(firstEarlierUnresolvedSet(3, [1, 3], new Set([1]))).toBeNull();
  });

  it('does not look at later sets', () => {
    expect(firstEarlierUnresolvedSet(1, [1, 2], new Set())).toBeNull();
  });
});

describe('setNeedsRir', () => {
  it('is true for a working set without RIR, false with one (0 included)', () => {
    expect(setNeedsRir({ setType: SetType.WORKING, rir: undefined })).toBe(true);
    expect(setNeedsRir({ setType: SetType.WORKING, rir: null })).toBe(true);
    expect(setNeedsRir({ setType: SetType.WORKING, rir: 0 })).toBe(false);
    expect(setNeedsRir({ rir: undefined })).toBe(true);
  });

  it('is false for a warm-up', () => {
    expect(setNeedsRir({ setType: SetType.WARMUP, rir: undefined })).toBe(false);
  });
});

describe('findFirstSetNeedingRir', () => {
  it('finds the first working set without RIR across exercises', () => {
    const exercises = [
      { sets: [{ setType: SetType.WARMUP }, { setType: SetType.WORKING, rir: 2 }] },
      { sets: [{ setType: SetType.WORKING, rir: 1 }, { setType: SetType.WORKING }] },
    ];
    expect(findFirstSetNeedingRir(exercises)).toEqual({ exerciseIndex: 1, setIndex: 1 });
  });

  it('is null when every working set has RIR', () => {
    expect(findFirstSetNeedingRir([{ sets: [{ setType: SetType.WORKING, rir: 0 }] }])).toBeNull();
  });
});
