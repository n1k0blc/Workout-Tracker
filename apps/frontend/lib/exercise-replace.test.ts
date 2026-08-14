import { describe, expect, it } from 'vitest';
import { replaceExerciseInList } from './exercise-replace';

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
