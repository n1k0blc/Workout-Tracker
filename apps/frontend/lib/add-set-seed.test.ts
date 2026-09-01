import { describe, expect, it } from 'vitest';
import { seedAddedSetValues } from './add-set-seed';
import { PlannedSet, SetLog, SetType } from '@/types';

const logged = (setNumber: number, over: Partial<SetLog> = {}): SetLog => ({
  id: `set-${setNumber}`,
  setNumber,
  setType: SetType.WORKING,
  reps: 10,
  weight: 60,
  rir: 2,
  completedAt: '2026-09-01T10:00:00.000Z',
  ...over,
});

const planned = (order: number, over: Partial<PlannedSet> = {}): PlannedSet => ({
  id: `planned-${order}`,
  order,
  setType: SetType.WORKING,
  reps: 8,
  weight: 40,
  rir: 1,
  rest: 90,
  ...over,
});

describe('seedAddedSetValues', () => {
  it('copies the last logged set when any set is logged', () => {
    const seed = seedAddedSetValues([logged(1), logged(2, { reps: 8, weight: 65, rir: 1 })], [planned(1), planned(2)]);

    expect(seed).toEqual({
      weight: 65,
      reps: 8,
      rir: 1,
      repsLeft: undefined,
      repsRight: undefined,
      weightLeft: undefined,
      weightRight: undefined,
      rirLeft: undefined,
      rirRight: undefined,
    });
  });

  it('takes the highest-numbered logged set, not the last in array order', () => {
    const seed = seedAddedSetValues([logged(3, { weight: 70 }), logged(1, { weight: 50 })], undefined);

    expect(seed?.weight).toBe(70);
  });

  it('falls back to the last planned set when nothing is logged', () => {
    const seed = seedAddedSetValues([], [planned(1), planned(2, { reps: 6, weight: 45, rir: 0 })]);

    expect(seed).toMatchObject({ weight: 45, reps: 6, rir: 0 });
  });

  it('keeps a logged RIR of 0 (train to failure) rather than treating it as unset', () => {
    const seed = seedAddedSetValues([logged(1, { rir: 0 })], undefined);

    expect(seed?.rir).toBe(0);
  });

  it('reports a missing logged RIR as null so the caller can leave the field blank', () => {
    const seed = seedAddedSetValues([logged(1, { rir: undefined })], undefined);

    expect(seed?.rir).toBeNull();
  });

  it('carries the previous set per-side values for a unilateral exercise', () => {
    const seed = seedAddedSetValues(
      [logged(1, { repsLeft: 10, repsRight: 9, weightLeft: 50, weightRight: 40, rirLeft: 1, rirRight: 3 })],
      undefined,
    );

    expect(seed).toMatchObject({
      repsLeft: 10,
      repsRight: 9,
      weightLeft: 50,
      weightRight: 40,
      rirLeft: 1,
      rirRight: 3,
    });
  });

  it('returns null with no previous set at all, so the caller seeds zeros', () => {
    expect(seedAddedSetValues([], undefined)).toBeNull();
    expect(seedAddedSetValues([], [])).toBeNull();
  });
});
