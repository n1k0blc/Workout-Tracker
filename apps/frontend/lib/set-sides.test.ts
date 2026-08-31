import { describe, expect, it } from 'vitest';
import { setPerSide } from './set-sides';

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
