import { describe, expect, it } from 'vitest';
import {
  checkExerciseCompleteness,
  checkWorkoutCompleteness,
  EMPTY_SET_ROW_STATE,
  type SetRowState,
} from './workout-completeness';
import { SetType, type ExerciseLog, type PlannedSet, type SetLog } from '@/types';

const planned = (order: number, over: Partial<PlannedSet> = {}): PlannedSet => ({
  id: `p${order}`,
  order,
  setType: SetType.WORKING,
  reps: 10,
  weight: 60,
  rir: 2,
  rest: 90,
  ...over,
});

const logged = (setNumber: number, over: Partial<SetLog> = {}): SetLog => ({
  id: `s${setNumber}`,
  setNumber,
  setType: SetType.WORKING,
  reps: 10,
  weight: 60,
  rir: 2,
  completedAt: '2026-11-02T10:00:00.000Z',
  ...over,
});

const exercise = (id: string, over: Partial<ExerciseLog> = {}): ExerciseLog => ({
  id,
  exerciseId: `e-${id}`,
  exerciseName: `Übung ${id}`,
  order: 1,
  plannedSets: [],
  sets: [],
  ...over,
});

const rows = (over: Partial<SetRowState> = {}): SetRowState => ({ ...EMPTY_SET_ROW_STATE, ...over });

describe('checkWorkoutCompleteness', () => {
  it('is complete when every planned set is logged', () => {
    const result = checkWorkoutCompleteness(
      { exercises: [exercise('a', { plannedSets: [planned(1), planned(2)], sets: [logged(1), logged(2)] })] },
      rows(),
    );

    expect(result).toEqual({ complete: true });
  });

  it('names the first planned set that is not logged yet', () => {
    const result = checkWorkoutCompleteness(
      {
        exercises: [
          exercise('a', { plannedSets: [planned(1)], sets: [logged(1)] }),
          exercise('b', { plannedSets: [planned(1), planned(2)], sets: [logged(1)] }),
        ],
      },
      rows(),
    );

    expect(result).toEqual({
      complete: false,
      problem: { kind: 'unloggedSet', exerciseId: 'b', exerciseName: 'Übung b', setNumber: 2 },
    });
  });

  it('reports the earliest Übung first, not the earliest kind of problem', () => {
    const result = checkWorkoutCompleteness(
      {
        exercises: [
          exercise('a', { plannedSets: [planned(1), planned(2)], sets: [logged(1, { rir: undefined })] }),
          exercise('b', { plannedSets: [planned(1)], sets: [] }),
        ],
      },
      rows(),
    );

    // Übung a: set 1 lacks RIR (and set 2 is unlogged) -- set 1 comes first.
    expect(result).toEqual({
      complete: false,
      problem: { kind: 'missingRir', exerciseId: 'a', exerciseName: 'Übung a', setNumber: 1 },
    });
  });

  it('counts a swiped-away planned set as done', () => {
    const result = checkWorkoutCompleteness(
      { exercises: [exercise('a', { plannedSets: [planned(1), planned(2)], sets: [logged(1)] })] },
      rows({ skipped: { a: [2] } }),
    );

    expect(result).toEqual({ complete: true });
  });

  it('blocks on an added set row that is not logged', () => {
    const result = checkWorkoutCompleteness(
      { exercises: [exercise('a', { plannedSets: [planned(1)], sets: [logged(1)] })] },
      rows({ added: { a: [2] } }),
    );

    expect(result).toEqual({
      complete: false,
      problem: { kind: 'unloggedSet', exerciseId: 'a', exerciseName: 'Übung a', setNumber: 2 },
    });
  });

  it('does not count a logged extra set as an open row', () => {
    const result = checkWorkoutCompleteness(
      { exercises: [exercise('a', { plannedSets: [planned(1)], sets: [logged(1), logged(2)] })] },
      rows({ added: { a: [2] } }),
    );

    expect(result).toEqual({ complete: true });
  });

  it('blocks on a logged working set without RIR, the warm-up switched to working', () => {
    const result = checkWorkoutCompleteness(
      { exercises: [exercise('a', { plannedSets: [planned(1)], sets: [logged(1, { rir: undefined })] })] },
      rows(),
    );

    expect(result).toEqual({
      complete: false,
      problem: { kind: 'missingRir', exerciseId: 'a', exerciseName: 'Übung a', setNumber: 1 },
    });
  });

  it('lets a logged warm-up go without RIR', () => {
    const result = checkWorkoutCompleteness(
      {
        exercises: [
          exercise('a', {
            plannedSets: [planned(1, { setType: SetType.WARMUP })],
            sets: [logged(1, { setType: SetType.WARMUP, rir: undefined })],
          }),
        ],
      },
      rows(),
    );

    expect(result).toEqual({ complete: true });
  });

  it('is not complete when nothing is logged at all', () => {
    expect(checkWorkoutCompleteness({ exercises: [] }, rows())).toEqual({
      complete: false,
      problem: { kind: 'nothingLogged' },
    });
  });

  it('is not complete when every set of every Übung is swiped away', () => {
    const result = checkWorkoutCompleteness(
      { exercises: [exercise('a', { plannedSets: [planned(1), planned(2)] })] },
      rows({ skipped: { a: [1, 2] } }),
    );

    expect(result).toEqual({ complete: false, problem: { kind: 'nothingLogged' } });
  });

  it('counts an Übung with every set swiped away as done, next to one with logged sets', () => {
    const result = checkWorkoutCompleteness(
      {
        exercises: [
          exercise('a', { plannedSets: [planned(1)], sets: [] }),
          exercise('b', { plannedSets: [planned(1)], sets: [logged(1)] }),
        ],
      },
      rows({ skipped: { a: [1] } }),
    );

    expect(result).toEqual({ complete: true });
  });

  it('is not complete for an Übung with no planned sets and nothing logged', () => {
    const result = checkWorkoutCompleteness(
      {
        exercises: [
          exercise('a', { plannedSets: [planned(1)], sets: [logged(1)] }),
          exercise('b', { plannedSets: [], sets: [] }),
        ],
      },
      rows(),
    );

    expect(result).toEqual({
      complete: false,
      problem: { kind: 'emptyExercise', exerciseId: 'b', exerciseName: 'Übung b' },
    });
  });

  it('treats an Übung without a plan field like one with an empty plan', () => {
    const noPlan = { ...exercise('a'), plannedSets: undefined };

    expect(checkExerciseCompleteness(noPlan, EMPTY_SET_ROW_STATE)).toEqual({
      kind: 'emptyExercise',
      exerciseId: 'a',
      exerciseName: 'Übung a',
    });
  });

  it('ignores skip state that belongs to another Übung', () => {
    const result = checkWorkoutCompleteness(
      { exercises: [exercise('a', { plannedSets: [planned(1), planned(2)], sets: [logged(1)] })] },
      rows({ skipped: { other: [2] } }),
    );

    expect(result).toMatchObject({ complete: false, problem: { kind: 'unloggedSet', setNumber: 2 } });
  });
});

describe('checkExerciseCompleteness', () => {
  it('answers null for a complete Übung, with no "at least one set logged" rule of its own', () => {
    expect(
      checkExerciseCompleteness(exercise('a', { plannedSets: [planned(1)] }), rows({ skipped: { a: [1] } })),
    ).toBeNull();
  });

  it('answers the first open set by set number across planned and added rows', () => {
    expect(
      checkExerciseCompleteness(
        exercise('a', { plannedSets: [planned(1), planned(3)], sets: [logged(1)] }),
        rows({ added: { a: [2] } }),
      ),
    ).toMatchObject({ kind: 'unloggedSet', setNumber: 2 });
  });
});
