import { describe, expect, it } from 'vitest';
import { aggregateSetSides, setPerSide } from './set-sides';

/**
 * Coverage for the per-side breakdown helper (issue #101). It gates whether a
 * read-only surface shows one aggregate line or a left/right breakdown, so the
 * asymmetric case and the "incomplete data falls back to the aggregate" case
 * are the ones that matter.
 */
describe('setPerSide', () => {
  it('returns null for a bilateral set with no per-side data', () => {
    expect(setPerSide({ reps: 10, weight: 50 } as never)).toBeNull();
  });

  it('returns both sides for a symmetric backfilled set', () => {
    expect(
      setPerSide({ repsLeft: 10, repsRight: 10, weightLeft: 50, weightRight: 50, rirLeft: 2, rirRight: 2 }),
    ).toEqual({
      left: { reps: 10, weight: 50, rir: 2 },
      right: { reps: 10, weight: 50, rir: 2 },
    });
  });

  it('preserves an asymmetric set distinctly -- no rounding to a shared value', () => {
    expect(
      setPerSide({ repsLeft: 10, repsRight: 9, weightLeft: 50, weightRight: 40, rirLeft: 1, rirRight: 3 }),
    ).toEqual({
      left: { reps: 10, weight: 50, rir: 1 },
      right: { reps: 9, weight: 40, rir: 3 },
    });
  });

  it('reports rir as null on both sides when neither side carries one', () => {
    const breakdown = setPerSide({ repsLeft: 10, repsRight: 9, weightLeft: 50, weightRight: 50 });
    expect(breakdown?.left.rir).toBeNull();
    expect(breakdown?.right.rir).toBeNull();
  });

  it('treats a zero per-side weight as present', () => {
    expect(setPerSide({ repsLeft: 10, repsRight: 10, weightLeft: 0, weightRight: 0 })).toEqual({
      left: { reps: 10, weight: 0, rir: null },
      right: { reps: 10, weight: 0, rir: null },
    });
  });

  it('returns null when only one side is populated', () => {
    expect(setPerSide({ repsLeft: 10, weightLeft: 50 })).toBeNull();
  });
});

/**
 * The client-side twin of the server's `deriveSetAggregates` (issue #100/#102). The
 * live logging card uses it to show an aggregate the instant a unilateral set is
 * logged; the two formulas must not drift.
 */
describe('aggregateSetSides', () => {
  it('averages a symmetric set to its own values', () => {
    expect(aggregateSetSides({ reps: 10, weight: 50, rir: 2 }, { reps: 10, weight: 50, rir: 2 })).toEqual({
      reps: 10,
      weight: 50,
      rir: 2,
    });
  });

  it('averages weight and rounds reps for an asymmetric set', () => {
    expect(aggregateSetSides({ reps: 10, weight: 50, rir: 1 }, { reps: 9, weight: 40, rir: 3 })).toEqual({
      reps: 10, // round(9.5)
      weight: 45,
      rir: 1, // the limiting side
    });
  });

  it('rounds an odd reps average half-up, matching Math.round', () => {
    expect(aggregateSetSides({ reps: 8, weight: 20, rir: 0 }, { reps: 11, weight: 20, rir: 0 }).reps).toBe(10);
  });

  it('omits rir entirely when neither side carries one', () => {
    expect(aggregateSetSides({ reps: 10, weight: 50 }, { reps: 10, weight: 50 })).toEqual({
      reps: 10,
      weight: 50,
      rir: undefined,
    });
  });

  it('omits rir when only one side carries one', () => {
    expect(aggregateSetSides({ reps: 10, weight: 50, rir: 2 }, { reps: 10, weight: 50 }).rir).toBeUndefined();
  });
});
