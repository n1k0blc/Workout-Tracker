import { describe, it, expect } from 'vitest';
import { nextExerciseLine } from '@/lib/workout-next-exercise';

const ex = (exerciseName: string, loggedSets: number) => ({
  exerciseName,
  sets: Array.from({ length: loggedSets }, (_, i) => ({ id: `s${i}` }) as never),
});

describe('nextExerciseLine', () => {
  it('returns null when the workout has no exercises', () => {
    expect(nextExerciseLine([])).toBeNull();
  });

  it('points at the first exercise before anything is logged', () => {
    expect(nextExerciseLine([ex('Kniebeuge', 0), ex('Bankdrücken', 0)])).toEqual({
      index: 1,
      exerciseName: 'Kniebeuge',
    });
  });

  it('points at the first exercise with no logged sets', () => {
    expect(
      nextExerciseLine([ex('Kniebeuge', 3), ex('Bankdrücken', 1), ex('Rudern', 0)]),
    ).toEqual({ index: 3, exerciseName: 'Rudern' });
  });

  it('skips a started exercise even when an earlier one is still empty', () => {
    expect(
      nextExerciseLine([ex('Kniebeuge', 0), ex('Bankdrücken', 2), ex('Rudern', 0)]),
    ).toEqual({ index: 1, exerciseName: 'Kniebeuge' });
  });

  it('falls back to the last exercise once every exercise has been started', () => {
    expect(
      nextExerciseLine([ex('Kniebeuge', 3), ex('Bankdrücken', 1), ex('Rudern', 2)]),
    ).toEqual({ index: 3, exerciseName: 'Rudern' });
  });
});
