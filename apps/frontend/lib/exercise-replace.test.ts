import { describe, expect, it } from 'vitest';
import { replaceExerciseInList, replacePlanExerciseInList } from './exercise-replace';
import { Equipment } from '@/types';

const plainExercise = {
  id: 'log-1',
  exerciseId: 'ex-plain',
  exerciseName: 'Beinpresse',
  isUnilateral: false,
  isDoubleWeight: false,
  order: 1,
  sets: [{ id: 'set-1', setNumber: 1, reps: 10, weight: 40 }],
};

describe('replaceExerciseInList', () => {
  it('adopts the replacement exercise flags so the (2x) column headers appear', () => {
    const [replaced] = replaceExerciseInList([plainExercise], 'log-1', {
      id: 'ex-db',
      name: 'Kurzhantel Bankdrücken',
      isUnilateral: true,
      isDoubleWeight: true,
    });

    expect(replaced.exerciseId).toBe('ex-db');
    expect(replaced.exerciseName).toBe('Kurzhantel Bankdrücken');
    // exercise-card.tsx renders "Gewicht (2x)" / "Wdh (2x)" straight off these two flags.
    expect(replaced.isDoubleWeight).toBe(true);
    expect(replaced.isUnilateral).toBe(true);
  });

  it('clears the flags when swapping back to an exercise without them', () => {
    const dumbbell = { ...plainExercise, isUnilateral: true, isDoubleWeight: true };

    const [replaced] = replaceExerciseInList([dumbbell], 'log-1', {
      id: 'ex-plain',
      name: 'Beinpresse',
      isUnilateral: false,
      isDoubleWeight: false,
    });

    expect(replaced.isDoubleWeight).toBe(false);
    expect(replaced.isUnilateral).toBe(false);
  });

  it('adopts the replacement equipment, and drops it back to undefined on a lookup miss', () => {
    const bodyweight = { ...plainExercise, equipment: Equipment.BODYWEIGHT };

    const [toBarbell] = replaceExerciseInList([bodyweight], 'log-1', {
      id: 'ex-bb',
      name: 'Langhantel Rudern',
      equipment: Equipment.BARBELL,
    });
    expect(toBarbell.equipment).toBe(Equipment.BARBELL);

    const [miss] = replaceExerciseInList([bodyweight], 'log-1', {
      id: 'ex-x',
      name: 'Nur Name',
    });
    expect(miss.equipment).toBeUndefined();
  });

  it('keeps sets and order untouched', () => {
    const [replaced] = replaceExerciseInList([plainExercise], 'log-1', {
      id: 'ex-db',
      name: 'Kurzhantel Bankdrücken',
      isDoubleWeight: true,
    });

    expect(replaced.sets).toEqual(plainExercise.sets);
    expect(replaced.order).toBe(1);
  });

  it('leaves other entries alone', () => {
    const other = { ...plainExercise, id: 'log-2', exerciseId: 'ex-other' };

    const result = replaceExerciseInList([plainExercise, other], 'log-1', {
      id: 'ex-db',
      name: 'Kurzhantel Bankdrücken',
      isDoubleWeight: true,
    });

    expect(result[1]).toBe(other);
  });

  it('normalises missing flags to false rather than leaving the old value', () => {
    const dumbbell = { ...plainExercise, isUnilateral: true, isDoubleWeight: true };

    // Lookup miss in a locally-cached exercise list: name falls back, flags must not stick.
    const [replaced] = replaceExerciseInList([dumbbell], 'log-1', {
      id: 'ex-unknown',
      name: 'Beinpresse',
    });

    expect(replaced.isDoubleWeight).toBe(false);
    expect(replaced.isUnilateral).toBe(false);
  });
});

const planEntry = {
  id: 'log-1',
  exerciseId: 'ex-bilateral',
  exerciseName: 'Beinpresse',
  isUnilateral: false,
  isDoubleWeight: false,
  order: 1,
  plannedSets: [
    { id: 'p-1', order: 1, setType: 'WORKING', reps: 10, weight: 40, rir: 2, rest: 90 },
    { id: 'p-2', order: 2, setType: 'WORKING', reps: 8, weight: 45, rir: 1, rest: 90 },
  ],
};

describe('replacePlanExerciseInList', () => {
  it('seeds both sides of every set when swapping bilateral -> unilateral', () => {
    const [replaced] = replacePlanExerciseInList(
      [planEntry],
      'log-1',
      { id: 'ex-uni', name: 'Bulgarian Split Squat', isUnilateral: true },
      'plannedSets',
    );

    expect(replaced.isUnilateral).toBe(true);
    expect(replaced.plannedSets).toEqual([
      {
        id: 'p-1', order: 1, setType: 'WORKING', reps: 10, weight: 40, rir: 2, rest: 90,
        repsLeft: 10, repsRight: 10, weightLeft: 40, weightRight: 40, rirLeft: 2, rirRight: 2,
      },
      {
        id: 'p-2', order: 2, setType: 'WORKING', reps: 8, weight: 45, rir: 1, rest: 90,
        repsLeft: 8, repsRight: 8, weightLeft: 45, weightRight: 45, rirLeft: 1, rirRight: 1,
      },
    ]);
  });

  it('keeps the aggregate and clears per-side data when swapping unilateral -> bilateral', () => {
    const uniEntry = {
      ...planEntry,
      isUnilateral: true,
      plannedSets: [
        {
          id: 'p-1', order: 1, setType: 'WORKING', reps: 10, weight: 38, rir: 1, rest: 90,
          repsLeft: 10, repsRight: 9, weightLeft: 40, weightRight: 36, rirLeft: 2, rirRight: 1,
        },
      ],
    };

    const [replaced] = replacePlanExerciseInList(
      [uniEntry],
      'log-1',
      { id: 'ex-bi', name: 'Beinpresse', isUnilateral: false },
      'plannedSets',
    );

    expect(replaced.isUnilateral).toBe(false);
    expect(replaced.plannedSets[0]).toEqual({
      id: 'p-1', order: 1, setType: 'WORKING', reps: 10, weight: 38, rir: 1, rest: 90,
      repsLeft: undefined, repsRight: undefined,
      weightLeft: undefined, weightRight: undefined,
      rirLeft: undefined, rirRight: undefined,
    });
  });

  it('leaves the sets untouched on a swap between two exercises of the same shape', () => {
    const [replaced] = replacePlanExerciseInList(
      [planEntry],
      'log-1',
      { id: 'ex-other-bilateral', name: 'Hackenschmidt', isUnilateral: false },
      'plannedSets',
    );

    expect(replaced.exerciseId).toBe('ex-other-bilateral');
    expect(replaced.plannedSets).toBe(planEntry.plannedSets);
  });

  it('reshapes the cycle-day editor\'s "sets" field too', () => {
    const dayEntry = {
      id: 'log-1',
      isUnilateral: false,
      order: 1,
      sets: [{ id: 's-1', order: 1, setType: 'WORKING', reps: 12, weight: 20, rir: 3, rest: 90 }],
    };

    const [replaced] = replacePlanExerciseInList(
      [dayEntry],
      'log-1',
      { id: 'ex-uni', name: 'Split Squat', isUnilateral: true },
      'sets',
    );

    expect(replaced.sets[0]).toMatchObject({
      repsLeft: 12, repsRight: 12, weightLeft: 20, weightRight: 20, rirLeft: 3, rirRight: 3,
    });
  });

  it('leaves other entries alone', () => {
    const other = { ...planEntry, id: 'log-2' };

    const result = replacePlanExerciseInList(
      [planEntry, other],
      'log-1',
      { id: 'ex-uni', name: 'Split Squat', isUnilateral: true },
      'plannedSets',
    );

    expect(result[1]).toBe(other);
  });

  it('leaves the sets untouched when the replacement has no known shape', () => {
    const uniEntry = {
      ...planEntry,
      isUnilateral: true,
      plannedSets: [
        {
          id: 'p-1', order: 1, setType: 'WORKING', reps: 10, weight: 40, rir: 1, rest: 90,
          repsLeft: 11, repsRight: 9, weightLeft: 42, weightRight: 38, rirLeft: 2, rirRight: 1,
        },
      ],
    };

    // Lookup miss: the picker handed over only a name + id, no isUnilateral. The forced
    // `isUnilateral: false` must NOT be read as a real bilateral target and strip the sides.
    const [replaced] = replacePlanExerciseInList(
      [uniEntry],
      'log-1',
      { id: 'ex-unknown', name: 'Exercise' },
      'plannedSets',
    );

    expect(replaced.plannedSets).toBe(uniEntry.plannedSets);
  });
});
