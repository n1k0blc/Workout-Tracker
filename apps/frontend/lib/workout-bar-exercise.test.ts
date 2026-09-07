import { describe, it, expect } from 'vitest';
import { barExerciseLine } from '@/lib/workout-bar-exercise';

const ex = (exerciseName: string, loggedSets: number, plannedSets = 0) => ({
  exerciseName,
  sets: Array.from({ length: loggedSets }, (_, i) => ({ id: `s${i}` }) as never),
  plannedSets: Array.from({ length: plannedSets }, (_, i) => ({ id: `p${i}` }) as never),
});

describe('barExerciseLine', () => {
  it('returns null when the workout has no exercises', () => {
    expect(barExerciseLine([])).toBeNull();
  });

  it('points at the first exercise before anything is logged', () => {
    expect(barExerciseLine([ex('Kniebeuge', 0, 3), ex('Bankdrücken', 0, 3)])).toEqual({
      index: 1,
      exerciseName: 'Kniebeuge',
    });
  });

  it('stays on the current exercise while it still has planned sets to go', () => {
    expect(
      barExerciseLine([ex('Kniebeuge', 1, 3), ex('Bankdrücken', 0, 3), ex('Rudern', 0, 3)]),
    ).toEqual({ index: 1, exerciseName: 'Kniebeuge' });
  });

  it('advances to the next unstarted exercise once the current plan is complete', () => {
    expect(
      barExerciseLine([ex('Kniebeuge', 3, 3), ex('Bankdrücken', 0, 3), ex('Rudern', 0, 3)]),
    ).toEqual({ index: 2, exerciseName: 'Bankdrücken' });
  });

  it('treats extra sets past the plan as complete', () => {
    expect(
      barExerciseLine([ex('Kniebeuge', 4, 3), ex('Bankdrücken', 0, 3)]),
    ).toEqual({ index: 2, exerciseName: 'Bankdrücken' });
  });

  it('keeps a free (planless) exercise as current after a set is logged', () => {
    expect(
      barExerciseLine([ex('Kniebeuge', 1, 0), ex('Bankdrücken', 0, 0)]),
    ).toEqual({ index: 1, exerciseName: 'Kniebeuge' });
  });

  it('falls back to the last exercise once every plan is complete', () => {
    expect(
      barExerciseLine([ex('Kniebeuge', 3, 3), ex('Bankdrücken', 3, 3), ex('Rudern', 2, 2)]),
    ).toEqual({ index: 3, exerciseName: 'Rudern' });
  });

  it('follows the most recently worked exercise when logging out of order', () => {
    expect(
      barExerciseLine([ex('Kniebeuge', 1, 3), ex('Bankdrücken', 0, 3), ex('Rudern', 1, 3)]),
    ).toEqual({ index: 3, exerciseName: 'Rudern' });
  });
});
