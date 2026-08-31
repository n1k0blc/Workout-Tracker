import { BadRequestException } from '@nestjs/common';
import {
  WorkoutTreeService,
  ExerciseShape,
  toExerciseInputs,
  mapExercisesToResponse,
} from './workout-tree.service';
import { SetType } from '../common/types';
import { WorkoutExerciseInputDto } from '../common/dto/workout-tree.dto';

/**
 * The ordering invariant: array position is authoritative, and `order` must restate it as
 * 1-based contiguous numbering. `toExerciseInputs` rejects a payload that disagrees;
 * `replaceTree` renumbers from array position so nothing else can persist a bad tree.
 *
 * `toExerciseInputs` also owns per-side set shape and the reps/weight/rir aggregates
 * (issue #100): a caller passes the exercises it already loaded for the BOLA check, and the
 * aggregates are derived from the sides here rather than trusted from the client.
 */

const set = (order: number, over: Partial<{ setType: SetType }> = {}) =>
  ({
    order,
    setType: SetType.WORKING,
    reps: 10,
    weight: 40,
    ...over,
  }) as WorkoutExerciseInputDto['sets'][number];

const exercise = (order: number, setOrders: number[]): WorkoutExerciseInputDto =>
  ({
    exerciseId: `ex-${order}`,
    order,
    sets: setOrders.map((o) => set(o)),
  }) as WorkoutExerciseInputDto;

/**
 * Runs `toExerciseInputs` with a shapes map covering every exerciseId in `dtos` -- bilateral
 * by default, `over[id]` to mark one unilateral.
 */
const run = (
  dtos: WorkoutExerciseInputDto[],
  over: Record<string, Partial<ExerciseShape>> = {},
) => {
  const shapes = new Map<string, ExerciseShape>();
  for (const ex of dtos) {
    shapes.set(ex.exerciseId, {
      isUnilateral: false,
      name: ex.exerciseId,
      ...over[ex.exerciseId],
    });
  }
  return toExerciseInputs(dtos, shapes);
};

describe('toExerciseInputs ordering', () => {
  it('accepts a tree whose order restates its array position, and drops the field', () => {
    const inputs = run([exercise(1, [1, 2]), exercise(2, [1])]);

    // Sequence survives as array position; `order` itself does not survive at all.
    expect(inputs.map((e) => e.exerciseId)).toEqual(['ex-1', 'ex-2']);
    expect(inputs.map((e) => e.sets.length)).toEqual([2, 1]);
    expect(inputs[0]).not.toHaveProperty('order');
    expect(inputs[0].sets[0]).not.toHaveProperty('order');
  });

  it('rejects 0-based exercise ordering', () => {
    expect(() => run([exercise(0, [1]), exercise(1, [1])])).toThrow(BadRequestException);
  });

  it('rejects 0-based set ordering', () => {
    expect(() => run([exercise(1, [0, 1])])).toThrow(BadRequestException);
  });

  it('rejects duplicate set numbers', () => {
    expect(() => run([exercise(1, [1, 1, 2])])).toThrow(BadRequestException);
  });

  it('rejects a gap in set ordering', () => {
    expect(() => run([exercise(1, [1, 3])])).toThrow(BadRequestException);
  });

  it('rejects a valid permutation that disagrees with array position', () => {
    // [3, 1, 2] is a legitimate 1..n set, but the array says A, B, C. Renumbering by array
    // position would silently rewrite the sequence and lose a reorder, so this is a 400 --
    // not something to normalize quietly.
    expect(() => run([exercise(3, [1]), exercise(1, [1]), exercise(2, [1])])).toThrow(
      BadRequestException,
    );
  });

  it('names the offending exercise so a bad client is debuggable', () => {
    expect(() => run([exercise(1, [1]), exercise(3, [1])])).toThrow(/order/i);
  });

  it('carries values through unchanged', () => {
    const inputs = run([
      { exerciseId: 'a', order: 1, sets: [set(1, { setType: SetType.WARMUP })] },
    ] as WorkoutExerciseInputDto[]);

    expect(inputs[0]).toMatchObject({ exerciseId: 'a' });
    expect(inputs[0].sets[0]).toMatchObject({
      setType: SetType.WARMUP,
      reps: 10,
      weight: 40,
      rest: 90,
    });
  });

  it('accepts an empty tree', () => {
    expect(toExerciseInputs([], new Map())).toEqual([]);
  });

  it('throws (a wiring bug, not a 400) if an exercise was not loaded for validation', () => {
    expect(() => toExerciseInputs([exercise(1, [1])], new Map())).toThrow(/not loaded/);
  });
});

describe('toExerciseInputs per-side shape (#100)', () => {
  const unilateralSet = (over: Record<string, unknown> = {}) =>
    ({
      order: 1,
      setType: SetType.WORKING,
      reps: 1,
      weight: 1,
      repsLeft: 10,
      repsRight: 10,
      weightLeft: 40,
      weightRight: 40,
      ...over,
    }) as WorkoutExerciseInputDto['sets'][number];

  const uni = (setOver: Record<string, unknown> = {}): WorkoutExerciseInputDto =>
    ({ exerciseId: 'a', order: 1, sets: [unilateralSet(setOver)] }) as WorkoutExerciseInputDto;

  it('derives the aggregates for a symmetric unilateral set', () => {
    const [ex] = run([uni({ rirLeft: 2, rirRight: 2 })], { a: { isUnilateral: true } });

    expect(ex.sets[0]).toMatchObject({ reps: 10, weight: 40, rir: 2 });
  });

  it('averages weight and takes the lower RIR for an asymmetric set', () => {
    const [ex] = run(
      [uni({ repsLeft: 10, repsRight: 10, weightLeft: 40, weightRight: 45, rirLeft: 3, rirRight: 1 })],
      { a: { isUnilateral: true } },
    );

    expect(ex.sets[0]).toMatchObject({ reps: 10, weight: 42.5, rir: 1 });
  });

  it('rounds an odd reps average rather than truncating it', () => {
    const [ex] = run([uni({ repsLeft: 10, repsRight: 9 })], { a: { isUnilateral: true } });

    // avg(10, 9) = 9.5 -> 10, not 9.
    expect(ex.sets[0].reps).toBe(10);
  });

  it('overwrites client-supplied aggregates with the derived ones', () => {
    const [ex] = run([uni({ reps: 999, weight: 999, rir: 9 })], { a: { isUnilateral: true } });

    expect(ex.sets[0]).toMatchObject({ reps: 10, weight: 40, rir: null });
  });

  it('leaves rir null when neither side carries one', () => {
    const [ex] = run([uni()], { a: { isUnilateral: true } });

    expect(ex.sets[0].rir).toBeNull();
  });

  it('rejects a unilateral set with no per-side data, naming the exercise and set', () => {
    expect(() =>
      run([{ exerciseId: 'a', order: 1, sets: [set(1)] }] as WorkoutExerciseInputDto[], {
        a: { isUnilateral: true, name: 'Split Squat' },
      }),
    ).toThrow(/Split Squat.*set 1/);
  });

  it('rejects a unilateral set missing one side', () => {
    expect(() =>
      run([uni({ repsRight: undefined })], { a: { isUnilateral: true } }),
    ).toThrow(BadRequestException);
  });

  it('rejects a unilateral set with RIR on only one side', () => {
    expect(() =>
      run([uni({ rirLeft: 2 })], { a: { isUnilateral: true } }),
    ).toThrow(BadRequestException);
  });

  it('rejects a bilateral set that carries per-side data, naming the exercise', () => {
    expect(() =>
      run([uni()], { a: { isUnilateral: false, name: 'Bench Press' } }),
    ).toThrow(/Bench Press/);
  });

  it('leaves a bilateral set with no per-side data untouched', () => {
    const [ex] = run([exercise(1, [1])]);

    expect(ex.sets[0]).toMatchObject({
      reps: 10,
      weight: 40,
      repsLeft: null,
      repsRight: null,
      weightLeft: null,
      weightRight: null,
      rirLeft: null,
      rirRight: null,
    });
  });
});

describe('mapExercisesToResponse', () => {
  const loadedSet = (over: Record<string, unknown> = {}) => ({
    id: 's1',
    order: 1,
    setType: SetType.WORKING,
    reps: 10,
    weight: 40,
    rir: 2,
    repsLeft: null,
    repsRight: null,
    weightLeft: null,
    weightRight: null,
    rirLeft: null,
    rirRight: null,
    rest: 90,
    completedAt: null,
    ...over,
  });

  const loadedExercise = (setOver: Record<string, unknown> = {}) =>
    ({
      id: 'we1',
      exerciseId: 'ex1',
      order: 1,
      exercise: { name: 'Split Squat', isUnilateral: true, isDoubleWeight: false },
      sets: [loadedSet(setOver)],
    }) as Parameters<typeof mapExercisesToResponse>[0][number];

  it('round-trips per-side values from a backfilled unilateral set', () => {
    const [ex] = mapExercisesToResponse([
      loadedExercise({
        repsLeft: 10,
        repsRight: 10,
        weightLeft: 40,
        weightRight: 40,
        rirLeft: 2,
        rirRight: 2,
      }),
    ]);

    expect(ex.sets[0]).toMatchObject({
      repsLeft: 10,
      repsRight: 10,
      weightLeft: 40,
      weightRight: 40,
      rirLeft: 2,
      rirRight: 2,
    });
  });

  it('omits per-side values for a bilateral set (all columns null)', () => {
    const [ex] = mapExercisesToResponse([loadedExercise()]);

    expect(ex.sets[0].repsLeft).toBeUndefined();
    expect(ex.sets[0].repsRight).toBeUndefined();
    expect(ex.sets[0].weightLeft).toBeUndefined();
    expect(ex.sets[0].weightRight).toBeUndefined();
    expect(ex.sets[0].rirLeft).toBeUndefined();
    expect(ex.sets[0].rirRight).toBeUndefined();
  });
});

describe('replaceTree', () => {
  const buildTx = () => ({
    workoutExercise: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({}),
    },
  });

  const service = new WorkoutTreeService();

  it('numbers exercises and sets from array position', async () => {
    const tx = buildTx();

    // ExerciseInput/SetInput carry no `order` field at all, so position is the only ordering
    // information reaching the write -- there is nothing here for a caller to contradict.
    await service.replaceTree(tx as never, 'w1', [
      {
        exerciseId: 'a',
        sets: [
          { setType: SetType.WORKING, reps: 10, weight: 40 },
          { setType: SetType.WORKING, reps: 10, weight: 40 },
        ],
      },
      {
        exerciseId: 'b',
        sets: [{ setType: SetType.WORKING, reps: 10, weight: 40 }],
      },
    ]);

    const written = tx.workoutExercise.create.mock.calls.map((c) => c[0].data);

    expect(written.map((d: { order: number }) => d.order)).toEqual([1, 2]);
    expect(written.map((d: { exerciseId: string }) => d.exerciseId)).toEqual(['a', 'b']);
    expect(written[0].sets.create.map((s: { order: number }) => s.order)).toEqual([1, 2]);
    expect(written[1].sets.create.map((s: { order: number }) => s.order)).toEqual([1]);
  });

  it('writes per-side values through, and null for the sides not supplied', async () => {
    const tx = buildTx();

    await service.replaceTree(tx as never, 'w1', [
      {
        exerciseId: 'a',
        sets: [
          {
            setType: SetType.WORKING,
            reps: 10,
            weight: 40,
            repsLeft: 10,
            repsRight: 9,
            weightLeft: 40,
            weightRight: 42.5,
            rirLeft: 2,
            rirRight: 1,
          },
          { setType: SetType.WORKING, reps: 10, weight: 40 },
        ],
      },
    ]);

    const written = tx.workoutExercise.create.mock.calls[0][0].data.sets.create;

    expect(written[0]).toMatchObject({
      repsLeft: 10,
      repsRight: 9,
      weightLeft: 40,
      weightRight: 42.5,
      rirLeft: 2,
      rirRight: 1,
    });
    expect(written[1]).toMatchObject({
      repsLeft: null,
      repsRight: null,
      weightLeft: null,
      weightRight: null,
      rirLeft: null,
      rirRight: null,
    });
  });

  it('clears the existing tree before writing the new one', async () => {
    const tx = buildTx();

    await service.replaceTree(tx as never, 'w1', []);

    expect(tx.workoutExercise.deleteMany).toHaveBeenCalledWith({ where: { workoutId: 'w1' } });
  });
});
