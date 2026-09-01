import { describe, expect, it } from 'vitest';
import { blankPlanValues, buildPrefillToastMessage, mapLastPerformanceOntoPlan } from './last-performance';
import { LastPerformance, LastPerformanceSet, PlannedSet, SetType } from '@/types';

const W = SetType.WORKING;
const WU = SetType.WARMUP;

const planned = (order: number, setType: SetType, over: Partial<PlannedSet> = {}): PlannedSet => ({
  id: `planned-${order}`,
  order,
  setType,
  reps: 8,
  weight: 40,
  rir: 1,
  rest: 120,
  ...over,
});

const hist = (setType: SetType, over: Partial<LastPerformanceSet> = {}): LastPerformanceSet => ({
  setType,
  reps: 10,
  weight: 60,
  rir: 2,
  ...over,
});

let idN = 0;
const makeId = () => `id-${++idN}`;

describe('mapLastPerformanceOntoPlan', () => {
  describe('with a plan structure (swap)', () => {
    it('fills the leg-press example: plan 1 warmup + 3 working, history 2 warmup + 2 working', () => {
      const target = [planned(1, WU), planned(2, W), planned(3, W), planned(4, W)];
      const history = [
        hist(WU, { weight: 20 }),
        hist(WU, { weight: 40 }),
        hist(W, { weight: 100 }),
        hist(W, { weight: 110 }),
      ];

      const { sets, setCountMismatch } = mapLastPerformanceOntoPlan(target, history, makeId);

      // warm-up 1 <- history warm-up 1 (history warm-up 2 dropped)
      expect(sets[0]).toMatchObject({ setType: WU, weight: 20, rest: 120 });
      // working 1, 2 <- history working 1, 2
      expect(sets[1]).toMatchObject({ setType: W, weight: 100 });
      expect(sets[2]).toMatchObject({ setType: W, weight: 110 });
      // working 3 <- repeat history working 2
      expect(sets[3]).toMatchObject({ setType: W, weight: 110 });
      expect(sets).toHaveLength(4);
      expect(setCountMismatch).toBe(false);
    });

    it('fills the reversed example: plan 2 warmup + 2 working, history 1 warmup + 3 working', () => {
      const target = [planned(1, WU), planned(2, WU), planned(3, W), planned(4, W)];
      const history = [
        hist(WU, { weight: 25 }),
        hist(W, { weight: 90 }),
        hist(W, { weight: 95 }),
        hist(W, { weight: 100 }),
      ];

      const { sets, setCountMismatch } = mapLastPerformanceOntoPlan(target, history, makeId);

      expect(sets[0]).toMatchObject({ setType: WU, weight: 25 });
      expect(sets[1]).toMatchObject({ setType: WU, weight: 25 }); // repeat history warm-up 1
      expect(sets[2]).toMatchObject({ setType: W, weight: 90 });
      expect(sets[3]).toMatchObject({ setType: W, weight: 95 }); // history working 3 dropped
      expect(setCountMismatch).toBe(false);
    });

    it('leaves a warm-up slot untouched when history has no warm-up', () => {
      const target = [planned(1, WU, { weight: 15, reps: 12 }), planned(2, W)];
      const history = [hist(W, { weight: 80, reps: 6 })];

      const { sets, setCountMismatch } = mapLastPerformanceOntoPlan(target, history, makeId);

      expect(sets[0]).toEqual(target[0]); // identical object contents -- nothing invented
      expect(sets[1]).toMatchObject({ setType: W, weight: 80, reps: 6 });
      expect(setCountMismatch).toBe(true); // 1 history set vs 2 slots
    });

    it('repeats the last history set when there are fewer history sets than slots', () => {
      const target = [planned(1, W), planned(2, W), planned(3, W)];
      const history = [hist(W, { weight: 50 })];

      const { sets, setCountMismatch } = mapLastPerformanceOntoPlan(target, history, makeId);

      expect(sets.map((s) => s.weight)).toEqual([50, 50, 50]);
      expect(setCountMismatch).toBe(true);
    });

    it('drops the extras when there are more history sets than slots', () => {
      const target = [planned(1, W), planned(2, W)];
      const history = [
        hist(W, { weight: 50 }),
        hist(W, { weight: 55 }),
        hist(W, { weight: 60 }),
        hist(W, { weight: 65 }),
      ];

      const { sets, setCountMismatch } = mapLastPerformanceOntoPlan(target, history, makeId);

      expect(sets.map((s) => s.weight)).toEqual([50, 55]);
      expect(setCountMismatch).toBe(true);
    });

    it('imports per-side values and clears stale per-side data from the swapped-out exercise', () => {
      const target = [planned(1, W, { weightLeft: 30, weightRight: 32, repsLeft: 8, repsRight: 8 })];
      const history = [hist(W, { weight: 60, weightLeft: 60, weightRight: 58, repsLeft: 10, repsRight: 9, rirLeft: 2, rirRight: 1 })];

      const { sets } = mapLastPerformanceOntoPlan(target, history, makeId);

      expect(sets[0]).toMatchObject({ weightLeft: 60, weightRight: 58, repsLeft: 10, repsRight: 9, rirLeft: 2, rirRight: 1 });
    });

    it('clears the target per-side twin when history is bilateral', () => {
      const target = [planned(1, W, { weightLeft: 30, weightRight: 32 })];
      const history = [hist(W, { weight: 70 })];

      const { sets } = mapLastPerformanceOntoPlan(target, history, makeId);

      expect(sets[0].weightLeft).toBeUndefined();
      expect(sets[0].weightRight).toBeUndefined();
    });

    it('never touches rest', () => {
      const target = [planned(1, W, { rest: 240 })];
      const history = [hist(W)];

      const { sets } = mapLastPerformanceOntoPlan(target, history, makeId);

      expect(sets[0].rest).toBe(240);
    });

    it('keeps the plan slot RIR when history carries none, rather than blanking it to 0', () => {
      const target = [planned(1, W, { rir: 3 })];
      const history = [hist(W, { rir: undefined })];

      const { sets } = mapLastPerformanceOntoPlan(target, history, makeId);

      expect(sets[0].rir).toBe(3);
    });

    it('reports changed=false when history has no set of any of the plan\'s types', () => {
      const target = [planned(1, W), planned(2, W)];
      const history = [hist(WU), hist(WU)];

      const { sets, changed } = mapLastPerformanceOntoPlan(target, history, makeId);

      expect(changed).toBe(false);
      expect(sets).toEqual(target); // every slot untouched
    });

    it('reports changed=true when at least one slot took values', () => {
      const target = [planned(1, WU), planned(2, W)];
      const { changed } = mapLastPerformanceOntoPlan(target, [hist(W, { weight: 80 })], makeId);
      expect(changed).toBe(true);
    });
  });

  describe('without a plan structure (add / free workout)', () => {
    it('takes history shape wholesale, minting ids and resetting rest to 90', () => {
      idN = 0;
      const history = [hist(WU, { weight: 20 }), hist(W, { weight: 100 }), hist(W, { weight: 110 })];

      const { sets, setCountMismatch } = mapLastPerformanceOntoPlan(null, history, makeId);

      expect(sets).toHaveLength(3);
      expect(sets.map((s) => s.setType)).toEqual([WU, W, W]);
      expect(sets.map((s) => s.order)).toEqual([1, 2, 3]);
      expect(sets.map((s) => s.weight)).toEqual([20, 100, 110]);
      expect(sets.every((s) => s.rest === 90)).toBe(true);
      expect(sets.map((s) => s.id)).toEqual(['id-1', 'id-2', 'id-3']);
      expect(setCountMismatch).toBe(false);
    });

    it('treats an empty plan the same as no plan', () => {
      const { sets } = mapLastPerformanceOntoPlan([], [hist(W)], makeId);
      expect(sets).toHaveLength(1);
    });
  });

  it('leaves every slot untouched, changed=false, when history is empty (never performed)', () => {
    const target = [planned(1, W), planned(2, W)];
    const { sets, changed } = mapLastPerformanceOntoPlan(target, [], makeId);
    expect(sets).toEqual(target);
    expect(changed).toBe(false);
  });
});

describe('blankPlanValues', () => {
  it('keeps structure, blanks every exercise-specific value and drops per-side data', () => {
    const target = [
      planned(1, WU, { reps: 12, weight: 20, rir: 2, weightLeft: 10, weightRight: 10, rest: 60 }),
      planned(2, W, { reps: 8, weight: 100, rir: 1, rest: 180 }),
    ];

    const blanked = blankPlanValues(target);

    expect(blanked).toEqual([
      { id: 'planned-1', order: 1, setType: WU, rest: 60, reps: 0, weight: 0, rir: 0 },
      { id: 'planned-2', order: 2, setType: W, rest: 180, reps: 0, weight: 0, rir: 0 },
    ]);
  });
});

describe('buildPrefillToastMessage', () => {
  const base: LastPerformance = {
    exerciseId: 'ex-1',
    source: 'CURRENT_GYM',
    performedOn: '2026-08-20',
    gymId: 'gym-1',
    gymName: 'Nordgym',
    sets: [],
  };

  it('names the date and gym, short duration, no extra clauses', () => {
    const { message, durationMs } = buildPrefillToastMessage(base, false, true);
    expect(message).toBe('Werte vom 20.08.2026 (Nordgym) übernommen.');
    expect(durationMs).toBe(6000);
  });

  it('labels a degraded gym source and runs long', () => {
    const { message, durationMs } = buildPrefillToastMessage({ ...base, source: 'HOME_GYM' }, false, true);
    expect(message).toContain('anderes Gym verwendet');
    expect(durationMs).toBe(10000);
  });

  it('does not label degradation when no gym context was given', () => {
    const { message, durationMs } = buildPrefillToastMessage({ ...base, source: 'HOME_GYM' }, false, false);
    expect(message).toBe('Werte vom 20.08.2026 (Nordgym) übernommen.');
    expect(durationMs).toBe(6000);
  });

  it('adds the set-count hint and runs long on a mismatch', () => {
    const { message, durationMs } = buildPrefillToastMessage(base, true, true);
    expect(message).toContain('Andere Satzanzahl');
    expect(durationMs).toBe(10000);
  });

  it('falls back to "Anderes Gym" when the gym name is null', () => {
    const { message } = buildPrefillToastMessage({ ...base, source: 'ANY_GYM', gymName: null }, false, true);
    expect(message).toContain('(Anderes Gym)');
  });
});
