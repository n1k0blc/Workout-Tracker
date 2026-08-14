import { BadRequestException } from '@nestjs/common';
import { WorkoutTreeService, toExerciseInputs } from './workout-tree.service';
import { SetType } from '../common/types';
import { WorkoutExerciseInputDto } from '../common/dto/workout-tree.dto';

/**
 * The ordering invariant: array position is authoritative, and `order` must restate it as
 * 1-based contiguous numbering. `toExerciseInputs` rejects a payload that disagrees;
 * `replaceTree` renumbers from array position so nothing else can persist a bad tree.
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

describe('toExerciseInputs', () => {
  it('accepts a tree whose order restates its array position, and drops the field', () => {
    const inputs = toExerciseInputs([exercise(1, [1, 2]), exercise(2, [1])]);

    // Sequence survives as array position; `order` itself does not survive at all.
    expect(inputs.map((e) => e.exerciseId)).toEqual(['ex-1', 'ex-2']);
    expect(inputs.map((e) => e.sets.length)).toEqual([2, 1]);
    expect(inputs[0]).not.toHaveProperty('order');
    expect(inputs[0].sets[0]).not.toHaveProperty('order');
  });

  it('rejects 0-based exercise ordering', () => {
    expect(() => toExerciseInputs([exercise(0, [1]), exercise(1, [1])])).toThrow(
      BadRequestException,
    );
  });

  it('rejects 0-based set ordering', () => {
    expect(() => toExerciseInputs([exercise(1, [0, 1])])).toThrow(BadRequestException);
  });

  it('rejects duplicate set numbers', () => {
    expect(() => toExerciseInputs([exercise(1, [1, 1, 2])])).toThrow(BadRequestException);
  });

  it('rejects a gap in set ordering', () => {
    expect(() => toExerciseInputs([exercise(1, [1, 3])])).toThrow(BadRequestException);
  });

  it('rejects a valid permutation that disagrees with array position', () => {
    // [3, 1, 2] is a legitimate 1..n set, but the array says A, B, C. Renumbering by array
    // position would silently rewrite the sequence and lose a reorder, so this is a 400 --
    // not something to normalize quietly.
    expect(() => toExerciseInputs([exercise(3, [1]), exercise(1, [1]), exercise(2, [1])])).toThrow(
      BadRequestException,
    );
  });

  it('names the offending exercise so a bad client is debuggable', () => {
    expect(() => toExerciseInputs([exercise(1, [1]), exercise(3, [1])])).toThrow(/order/i);
  });

  it('carries values through unchanged', () => {
    const inputs = toExerciseInputs([
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
    expect(toExerciseInputs([])).toEqual([]);
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

  it('clears the existing tree before writing the new one', async () => {
    const tx = buildTx();

    await service.replaceTree(tx as never, 'w1', []);

    expect(tx.workoutExercise.deleteMany).toHaveBeenCalledWith({ where: { workoutId: 'w1' } });
  });
});
