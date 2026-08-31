import { describe, expect, it } from 'vitest';
import { aggregateSetSides, deriveSidesFromDrafts, plannedSideFields, setPerSide } from './set-sides';

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

/**
 * The per-side fields a plan's set sends on save (issue #103). A bilateral exercise sends
 * nothing; a unilateral one always sends a complete pair, falling back to the aggregate so a
 * plan created before per-side targets existed still saves as a valid unilateral tree.
 */
describe('plannedSideFields', () => {
  it('sends nothing for a bilateral exercise', () => {
    expect(plannedSideFields({ reps: 10, weight: 50, rir: 2 }, false)).toEqual({});
  });

  it('fills all six sides from the aggregate for a legacy plan with no stored sides', () => {
    expect(plannedSideFields({ reps: 10, weight: 50, rir: 2 }, true)).toEqual({
      repsLeft: 10,
      repsRight: 10,
      weightLeft: 50,
      weightRight: 50,
      rirLeft: 2,
      rirRight: 2,
    });
  });

  it('keeps stored asymmetric sides as-is', () => {
    expect(
      plannedSideFields(
        { reps: 10, weight: 45, rir: 1, repsLeft: 10, repsRight: 9, weightLeft: 50, weightRight: 40, rirLeft: 1, rirRight: 3 },
        true,
      ),
    ).toEqual({
      repsLeft: 10,
      repsRight: 9,
      weightLeft: 50,
      weightRight: 40,
      rirLeft: 1,
      rirRight: 3,
    });
  });

  it('omits rir on both sides when the set carries none anywhere', () => {
    const out = plannedSideFields({ reps: 10, weight: 50 }, true);
    expect(out).not.toHaveProperty('rirLeft');
    expect(out).not.toHaveProperty('rirRight');
  });

  it('mirrors a one-sided rir so the payload is never half-populated', () => {
    expect(plannedSideFields({ reps: 10, weight: 50, repsLeft: 10, repsRight: 10, weightLeft: 50, weightRight: 50, rirLeft: 2 }, true)).toMatchObject({
      rirLeft: 2,
      rirRight: 2,
    });
  });
});

/**
 * Turns a unilateral set's two per-side input drafts into the payload every per-side writer
 * sends (issue #103/#105). The plan editors and the history editor share this so the server's
 * write-path aggregation rule (issue #100) lives in one place.
 */
describe('deriveSidesFromDrafts', () => {
  const draft = (weight: string, reps: string, rir = '') => ({ weight, reps, rir });
  const fb = { reps: 0, weight: 0 };

  it('derives the aggregate from asymmetric sides the way the server does', () => {
    const d = deriveSidesFromDrafts(draft('50', '10', '1'), draft('40', '9', '3'), fb);

    expect(d).toMatchObject({
      weightLeft: 50,
      weightRight: 40,
      repsLeft: 10,
      repsRight: 9,
      rirLeft: 1,
      rirRight: 3,
      hasRir: true,
      weight: 45,
      reps: 10,
      rir: 1,
    });
  });

  it('falls back to the given aggregate for an empty or unparseable input', () => {
    const d = deriveSidesFromDrafts(draft('', 'x'), draft('60', '8'), { reps: 12, weight: 55 });

    expect(d).toMatchObject({ weightLeft: 55, repsLeft: 12, weightRight: 60, repsRight: 8 });
  });

  it('mirrors a cleared rir side from the other', () => {
    const d = deriveSidesFromDrafts(draft('50', '10', '2'), draft('50', '10', ''), fb);

    expect(d).toMatchObject({ rirLeft: 2, rirRight: 2, hasRir: true, rir: 2 });
  });

  it('reports rir absent only when neither side carries one', () => {
    const d = deriveSidesFromDrafts(draft('50', '10'), draft('50', '10'), fb);

    expect(d).toMatchObject({ rirLeft: null, rirRight: null, hasRir: false, rir: null });
  });
});
