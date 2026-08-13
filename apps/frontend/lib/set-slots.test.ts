import { describe, expect, it } from 'vitest';
import { getSetIndicatorSlots, resolveSetRows } from './set-slots';
import { SetType } from '@/types';

/**
 * The reported bug: "Legs" (system template) / "Kurzhantel Bulgarian Split Squat" holds one
 * warm-up and two working sets. The template editor drew two bars and labelled the rows
 * warm-up, warm-up, working; loading the same template to perform showed all three correctly.
 *
 * Both symptoms came from one cause -- the editor collapsed the sets stored at order 0 and 1
 * onto the same number -- so both are asserted here, bar count and per-row type.
 */
const bulgarianSplitSquat = {
  // 1-based and contiguous, as the backend now stores and returns it.
  plannedSets: [
    { order: 1, setType: SetType.WARMUP },
    { order: 2, setType: SetType.WORKING },
    { order: 3, setType: SetType.WORKING },
  ],
  sets: [] as { setNumber: number; setType?: SetType }[],
};

describe('getSetIndicatorSlots', () => {
  it('draws one bar per set of the Bulgarian Split Squat', () => {
    expect(getSetIndicatorSlots(bulgarianSplitSquat)).toEqual([1, 2, 3]);
  });

  it('does not draw a second bar for a planned set that has been logged', () => {
    const slots = getSetIndicatorSlots({
      ...bulgarianSplitSquat,
      sets: [{ setNumber: 1, setType: SetType.WARMUP }],
    });

    expect(slots).toEqual([1, 2, 3]);
  });

  it('collapses sets that share a number -- the failure the 1-based invariant prevents', () => {
    // What the editor used to build from 0-based rows: orders 0 and 1 both became 1.
    const collided = getSetIndicatorSlots({
      plannedSets: [
        { order: 1, setType: SetType.WARMUP },
        { order: 1, setType: SetType.WORKING },
        { order: 2, setType: SetType.WORKING },
      ],
      sets: [],
    });

    // Documents *why* the invariant matters: de-duplication is correct behaviour here, so
    // the bar count is only trustworthy while set numbers are unique.
    expect(collided).toEqual([1, 2]);
  });

  it('includes logged extras and unlogged drafts beyond the plan, in order', () => {
    const slots = getSetIndicatorSlots({
      plannedSets: [{ order: 1 }, { order: 2 }],
      sets: [{ setNumber: 3 }],
      additionalSetNumbers: [4],
    });

    expect(slots).toEqual([1, 2, 3, 4]);
  });

  it('drops planned sets skipped for this session', () => {
    const slots = getSetIndicatorSlots({
      ...bulgarianSplitSquat,
      skippedSetNumbers: new Set([2]),
    });

    expect(slots).toEqual([1, 3]);
  });

  it('handles a free workout with no plan at all', () => {
    expect(getSetIndicatorSlots({ sets: [{ setNumber: 1 }, { setNumber: 2 }] })).toEqual([1, 2]);
  });
});

describe('resolveSetRows', () => {
  it('labels the Bulgarian Split Squat warm-up, working, working', () => {
    expect(resolveSetRows(bulgarianSplitSquat)).toEqual([
      { setNumber: 1, setType: SetType.WARMUP },
      { setNumber: 2, setType: SetType.WORKING },
      { setNumber: 3, setType: SetType.WORKING },
    ]);
  });

  it('draws a row per set, matching the collapsed bar count', () => {
    // The two views disagreeing is the bug; assert they agree.
    expect(resolveSetRows(bulgarianSplitSquat)).toHaveLength(
      getSetIndicatorSlots(bulgarianSplitSquat).length,
    );
  });

  it('prefers what was logged over what was planned', () => {
    const rows = resolveSetRows({
      ...bulgarianSplitSquat,
      sets: [{ setNumber: 2, setType: SetType.WARMUP }],
    });

    expect(rows[1]).toEqual({ setNumber: 2, setType: SetType.WARMUP });
    expect(rows[0].setType).toBe(SetType.WARMUP);
    expect(rows[2].setType).toBe(SetType.WORKING);
  });

  it('mislabels rows when sets share a number -- the second symptom of the same cause', () => {
    const rows = resolveSetRows({
      plannedSets: [
        { order: 1, setType: SetType.WARMUP },
        { order: 1, setType: SetType.WORKING },
        { order: 2, setType: SetType.WORKING },
      ],
      // The editor used to fabricate a logged copy of every planned set, so the lookup below
      // resolved both order-1 rows to the first match.
      sets: [
        { setNumber: 1, setType: SetType.WARMUP },
        { setNumber: 1, setType: SetType.WORKING },
        { setNumber: 2, setType: SetType.WORKING },
      ],
    });

    // Exactly the reported "two warm-up, one working".
    expect(rows.map((r) => r.setType)).toEqual([
      SetType.WARMUP,
      SetType.WARMUP,
      SetType.WORKING,
    ]);
  });

  it('falls back to working when the plan carries no type', () => {
    expect(resolveSetRows({ plannedSets: [{ order: 1 }], sets: [] })).toEqual([
      { setNumber: 1, setType: SetType.WORKING },
    ]);
  });

  it('drops rows skipped for this session', () => {
    const rows = resolveSetRows({ ...bulgarianSplitSquat, skippedSetNumbers: new Set([1]) });

    expect(rows.map((r) => r.setNumber)).toEqual([2, 3]);
  });
});
