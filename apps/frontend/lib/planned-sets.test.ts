import { describe, expect, it } from 'vitest';
import { addPlannedSet, removePlannedSet, updatePlannedSet } from './planned-sets';
import { SetType } from '@/types';

const planned = (order: number, over: Partial<{ setType: SetType; reps: number; weight: number; rir: number; rest: number }> = {}) => ({
  id: `planned-${order}`,
  order,
  setType: SetType.WORKING,
  reps: 10,
  weight: 40,
  rir: 2,
  rest: 90,
  ...over,
});

describe('addPlannedSet', () => {
  it('appends a set numbered after the last one', () => {
    const next = addPlannedSet([planned(1), planned(2)]);

    expect(next.map((s) => s.order)).toEqual([1, 2, 3]);
  });

  it('copies the previous set as the starting point rather than a blank row', () => {
    const next = addPlannedSet([planned(1, { reps: 8, weight: 60, rir: 1, rest: 120 })]);

    expect(next[1]).toMatchObject({ order: 2, reps: 8, weight: 60, rir: 1, rest: 120 });
  });

  it('starts a working set at sensible defaults for an exercise with no sets', () => {
    const next = addPlannedSet([]);

    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ order: 1, setType: SetType.WORKING, rest: 90 });
  });

  it('gives the new set its own id', () => {
    const next = addPlannedSet([planned(1)]);

    expect(next[1].id).not.toBe(next[0].id);
  });

  it('never reuses a number, even if the list arrives with a gap', () => {
    // Numbering should be contiguous by the time it reaches here, but deriving the next
    // number from array length would hand back an existing one if it ever is not -- and
    // duplicate set numbers are undetectable downstream (see set-slots.ts).
    const next = addPlannedSet([planned(1), planned(3)]);

    expect(next[2].order).toBe(4);
    expect(new Set(next.map((s) => s.order)).size).toBe(next.length);
  });
});

describe('removePlannedSet', () => {
  it('renumbers the survivors so numbering stays contiguous', () => {
    const next = removePlannedSet([planned(1), planned(2), planned(3)], 2);

    expect(next.map((s) => s.order)).toEqual([1, 2]);
  });

  it('keeps the surviving sets values, not just their numbers', () => {
    const next = removePlannedSet(
      [planned(1, { weight: 40 }), planned(2, { weight: 50 }), planned(3, { weight: 60 })],
      2,
    );

    expect(next.map((s) => s.weight)).toEqual([40, 60]);
  });

  it('is a no-op when the set number is not present', () => {
    const sets = [planned(1), planned(2)];

    expect(removePlannedSet(sets, 9).map((s) => s.order)).toEqual([1, 2]);
  });

  it('can empty the list', () => {
    expect(removePlannedSet([planned(1)], 1)).toEqual([]);
  });
});

describe('updatePlannedSet', () => {
  it('patches only the addressed set', () => {
    const next = updatePlannedSet([planned(1), planned(2)], 2, { weight: 75 });

    expect(next[0].weight).toBe(40);
    expect(next[1].weight).toBe(75);
  });

  it('toggles set type', () => {
    const next = updatePlannedSet([planned(1)], 1, { setType: SetType.WARMUP });

    expect(next[0].setType).toBe(SetType.WARMUP);
  });

  it('leaves fields it was not given alone', () => {
    const next = updatePlannedSet([planned(1, { reps: 8, rest: 150 })], 1, { weight: 75 });

    expect(next[0]).toMatchObject({ reps: 8, rest: 150, weight: 75 });
  });

  it('does not renumber', () => {
    const next = updatePlannedSet([planned(1), planned(2)], 1, { reps: 5 });

    expect(next.map((s) => s.order)).toEqual([1, 2]);
  });

  it('is a no-op for an unknown set number', () => {
    const sets = [planned(1)];

    expect(updatePlannedSet(sets, 9, { weight: 99 })[0].weight).toBe(40);
  });
});
