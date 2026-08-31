import { describe, expect, it } from 'vitest';
import {
  buildExerciseLogsForEdit,
  reorderExerciseLogs,
  toExercisePayload,
  withArrayPositionOrder,
} from './workout-order';
import { ExerciseLog, SetType, WorkoutExercise } from '@/types';

const set = (setNumber: number, over: Partial<{ setType: SetType }> = {}) => ({
  id: `set-${setNumber}`,
  setNumber,
  setType: SetType.WORKING,
  reps: 10,
  weight: 40,
  rir: 2,
  completedAt: '2026-08-14T10:00:00.000Z',
  ...over,
});

const log = (id: string, order: number, setNumbers: number[]): ExerciseLog =>
  ({
    id,
    exerciseId: `ex-${id}`,
    exerciseName: id,
    order,
    sets: setNumbers.map((n) => set(n)),
  }) as unknown as ExerciseLog;

describe('withArrayPositionOrder', () => {
  it('numbers exercises and sets from 1 by array position', () => {
    const out = withArrayPositionOrder([
      { exerciseId: 'a', sets: [{ reps: 10 }, { reps: 8 }] },
      { exerciseId: 'b', sets: [{ reps: 5 }] },
    ]);

    expect(out).toEqual([
      { exerciseId: 'a', order: 1, sets: [{ reps: 10, order: 1 }, { reps: 8, order: 2 }] },
      { exerciseId: 'b', order: 2, sets: [{ reps: 5, order: 1 }] },
    ]);
  });

  it('closes gaps left by removing a set from the middle', () => {
    // The template editor filters the removed set out without renumbering.
    const [ex] = withArrayPositionOrder([
      { exerciseId: 'a', sets: [{ order: 1 }, { order: 3 }] },
    ]);

    expect(ex.sets.map((s) => s.order)).toEqual([1, 2]);
  });

  it('overrides a stored 0-based order rather than trusting it', () => {
    const [ex] = withArrayPositionOrder([
      { exerciseId: 'a', order: 0, sets: [{ order: 0 }, { order: 1 }] },
    ]);

    expect(ex.order).toBe(1);
    expect(ex.sets.map((s) => s.order)).toEqual([1, 2]);
  });

  it('keeps every other field on both levels', () => {
    const [ex] = withArrayPositionOrder([
      { exerciseId: 'a', sets: [{ reps: 10, weight: 40, setType: SetType.WARMUP }] },
    ]);

    expect(ex.exerciseId).toBe('a');
    expect(ex.sets[0]).toMatchObject({ reps: 10, weight: 40, setType: SetType.WARMUP });
  });

  it('tolerates an exercise with no sets', () => {
    expect(withArrayPositionOrder([{ exerciseId: 'a', sets: [] }])).toEqual([
      { exerciseId: 'a', order: 1, sets: [] },
    ]);
  });
});

describe('toExercisePayload', () => {
  it('writes 1-based ordering for exercises and sets', () => {
    const payload = toExercisePayload([log('a', 1, [1, 2]), log('b', 2, [1])]);

    expect(payload.map((e) => e.order)).toEqual([1, 2]);
    expect(payload[0].sets.map((s) => s.order)).toEqual([1, 2]);
    expect(payload[1].sets.map((s) => s.order)).toEqual([1]);
  });

  it('normalizes a draft that predates the ordering migration', () => {
    // A workout started from a system template held 0-based set numbers in localStorage.
    const stale = log('a', 0, [0, 1, 2]);

    expect(toExercisePayload([stale])[0].sets.map((s) => s.order)).toEqual([1, 2, 3]);
  });

  it('persists the sequence the user sees after a drag, not the pre-drag order', () => {
    const exercises = [log('a', 1, [1]), log('b', 2, [1]), log('c', 3, [1])];
    const dragged = reorderExerciseLogs(exercises, ['c', 'a', 'b']);

    const payload = toExercisePayload(dragged);

    expect(payload.map((e) => e.exerciseId)).toEqual(['ex-c', 'ex-a', 'ex-b']);
    expect(payload.map((e) => e.order)).toEqual([1, 2, 3]);
  });

  it('renumbers around exercises dropped for having no sets', () => {
    const payload = toExercisePayload([log('a', 1, [1]), log('b', 2, []), log('c', 3, [1])]);

    expect(payload.map((e) => e.exerciseId)).toEqual(['ex-a', 'ex-c']);
    // 'b' is filtered out, so 'c' must become 2 -- not keep 3 and leave a gap.
    expect(payload.map((e) => e.order)).toEqual([1, 2]);
  });

  it('closes gaps left by skipped planned sets', () => {
    // Planned set 2 was skipped, so only 1 and 3 were ever logged.
    const payload = toExercisePayload([log('a', 1, [1, 3])]);

    expect(payload[0].sets.map((s) => s.order)).toEqual([1, 2]);
  });

  it('carries set values through unchanged', () => {
    const payload = toExercisePayload([log('a', 1, [1])]);

    expect(payload[0].sets[0]).toMatchObject({
      setType: SetType.WORKING,
      reps: 10,
      weight: 40,
      rir: 2,
      rest: 90,
      completedAt: '2026-08-14T10:00:00.000Z',
    });
  });

  it('emits the six per-side fields for a unilateral set that carries them', () => {
    const uni = log('a', 1, [1]);
    Object.assign(uni.sets[0], {
      repsLeft: 10,
      repsRight: 9,
      weightLeft: 50,
      weightRight: 40,
      rirLeft: 1,
      rirRight: 3,
    });

    expect(toExercisePayload([uni])[0].sets[0]).toMatchObject({
      repsLeft: 10,
      repsRight: 9,
      weightLeft: 50,
      weightRight: 40,
      rirLeft: 1,
      rirRight: 3,
    });
  });

  it('drops per-side keys for a bilateral set so the payload carries none', () => {
    const set = toExercisePayload([log('a', 1, [1])])[0].sets[0];

    expect(set).not.toHaveProperty('repsLeft');
    expect(set).not.toHaveProperty('weightRight');
    expect(set).not.toHaveProperty('rirLeft');
  });

  it('emits reps/weight sides without RIR when neither side was graded', () => {
    const uni = log('a', 1, [1]);
    Object.assign(uni.sets[0], {
      repsLeft: 10,
      repsRight: 10,
      weightLeft: 50,
      weightRight: 50,
    });

    const set = toExercisePayload([uni])[0].sets[0];
    expect(set).toMatchObject({ repsLeft: 10, weightRight: 50 });
    expect(set).not.toHaveProperty('rirLeft');
    expect(set).not.toHaveProperty('rirRight');
  });
});

describe('buildExerciseLogsForEdit', () => {
  const serverExercise = (over: Partial<WorkoutExercise['sets'][number]> = {}): WorkoutExercise =>
    ({
      id: 'we-1',
      exerciseId: 'ex-1',
      exerciseName: 'Bulgarian Split Squat',
      isUnilateral: true,
      order: 1,
      sets: [
        {
          id: 's-1',
          order: 1,
          setType: SetType.WORKING,
          reps: 10,
          weight: 45,
          rir: 2,
          rest: 90,
          completedAt: '2026-08-14T10:00:00.000Z',
          ...over,
        },
      ],
    }) as WorkoutExercise;

  it('carries the six per-side columns from the server tree into the draft set', () => {
    const [ex] = buildExerciseLogsForEdit([
      serverExercise({
        reps: 10,
        weight: 45,
        rir: 2,
        repsLeft: 10,
        repsRight: 9,
        weightLeft: 50,
        weightRight: 40,
        rirLeft: 1,
        rirRight: 3,
      }),
    ]);

    expect(ex.sets[0]).toMatchObject({
      repsLeft: 10,
      repsRight: 9,
      weightLeft: 50,
      weightRight: 40,
      rirLeft: 1,
      rirRight: 3,
    });
  });

  it('round-trips a historical unilateral workout through load -> save unchanged', () => {
    const server = [
      serverExercise({
        reps: 10,
        weight: 45,
        rir: 2,
        repsLeft: 10,
        repsRight: 9,
        weightLeft: 50,
        weightRight: 40,
        rirLeft: 1,
        rirRight: 3,
      }),
    ];

    const payloadSet = toExercisePayload(buildExerciseLogsForEdit(server))[0].sets[0];

    expect(payloadSet).toMatchObject({
      reps: 10,
      weight: 45,
      rir: 2,
      repsLeft: 10,
      repsRight: 9,
      weightLeft: 50,
      weightRight: 40,
      rirLeft: 1,
      rirRight: 3,
    });
  });

  it('leaves a bilateral set with no per-side keys after the round-trip', () => {
    const payloadSet = toExercisePayload(buildExerciseLogsForEdit([serverExercise()]))[0].sets[0];

    expect(payloadSet).not.toHaveProperty('repsLeft');
    expect(payloadSet).not.toHaveProperty('weightRight');
    expect(payloadSet).not.toHaveProperty('rirLeft');
  });
});

describe('reorderExerciseLogs', () => {
  it('renumbers the draft 1-based so order-sorted readers match the new sequence', () => {
    const reordered = reorderExerciseLogs([log('a', 1, [1]), log('b', 2, [1])], ['b', 'a']);

    expect(reordered.map((e) => e.id)).toEqual(['b', 'a']);
    expect(reordered.map((e) => e.order)).toEqual([1, 2]);
  });

  it('drops ids that are no longer in the list', () => {
    const reordered = reorderExerciseLogs([log('a', 1, [1])], ['a', 'gone']);

    expect(reordered.map((e) => e.id)).toEqual(['a']);
  });
});
