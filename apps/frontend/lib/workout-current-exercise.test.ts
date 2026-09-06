import { describe, it, expect } from 'vitest';
import { currentExerciseLine } from '@/lib/workout-current-exercise';

const ex = (exerciseName: string, loggedSets: number) => ({
  exerciseName,
  sets: Array.from({ length: loggedSets }, (_, i) => ({ id: `s${i}` }) as never),
});

describe('currentExerciseLine', () => {
  it('returns null when the workout has no exercises', () => {
    expect(currentExerciseLine([])).toBeNull();
  });

  it('points at the first exercise before anything is logged', () => {
    expect(currentExerciseLine([ex('Kniebeuge', 0), ex('Bankdrücken', 0)])).toEqual({
      index: 1,
      exerciseName: 'Kniebeuge',
    });
  });

  it('points at the last exercise that has a logged set', () => {
    expect(
      currentExerciseLine([ex('Kniebeuge', 3), ex('Bankdrücken', 1), ex('Rudern', 0)]),
    ).toEqual({ index: 2, exerciseName: 'Bankdrücken' });
  });

  it('stays on the last logged exercise even when a later one was skipped back to', () => {
    expect(
      currentExerciseLine([ex('Kniebeuge', 3), ex('Bankdrücken', 0), ex('Rudern', 2)]),
    ).toEqual({ index: 3, exerciseName: 'Rudern' });
  });
});
