import { ConflictException, NotFoundException } from '@nestjs/common';
import { ExercisesService } from './exercises.service';
import { UpdateExerciseDto } from './dto';
import { MuscleGroup } from '../common/muscle.util';
import { Equipment } from './dto/create-exercise.dto';

/**
 * An exercise referenced by any WorkoutSet cannot switch its `isUnilateral` flag --
 * that would silently double/halve every historical volume number and, once sets
 * carry per-side data, leave structurally inconsistent rows (issue #98/#65). The
 * rule counts sets of every workout kind, since they share one table.
 */
const CUSTOM_EXERCISE = {
  id: 'exercise-1',
  name: 'Bulgarian Split Squat',
  equipment: Equipment.DUMBBELL,
  isUnilateral: true,
  isDoubleWeight: false,
  isCustom: true,
  userId: 'user-1',
  deletedAt: null,
  abdomenPercent: 0,
  latissimusPercent: 0,
  trapeziusPercent: 0,
  lowerBackPercent: 0,
  hamstringsPercent: 0,
  glutesPercent: 20,
  shouldersPercent: 0,
  bicepsPercent: 0,
  chestPercent: 0,
  quadricepsPercent: 80,
  calvesPercent: 0,
  tricepsPercent: 0,
};

function baseUpdateDto(overrides: Partial<UpdateExerciseDto> = {}): UpdateExerciseDto {
  return {
    name: CUSTOM_EXERCISE.name,
    equipment: Equipment.DUMBBELL,
    glutesPercent: 20,
    quadricepsPercent: 80,
    ...overrides,
  } as UpdateExerciseDto;
}

function makeService({
  inUse = false,
  findUnique = { ...CUSTOM_EXERCISE },
  findMany = [],
}: { inUse?: boolean; findUnique?: unknown; findMany?: unknown[] } = {}) {
  const prisma = {
    exercise: {
      findUnique: jest.fn().mockResolvedValue(findUnique),
      findMany: jest.fn().mockResolvedValue(findMany),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ...CUSTOM_EXERCISE,
        ...data,
      })),
    },
    // "in use" is: a WorkoutExercise for this exercise that carries at least one set.
    workoutExercise: {
      findMany: jest.fn().mockResolvedValue(inUse ? [{ exerciseId: 'exercise-1' }] : []),
    },
  };

  const service = new ExercisesService(prisma as never);
  return { service, prisma };
}

describe('ExercisesService.update — isUnilateral toggle guard', () => {
  it('rejects turning unilateral off on an exercise referenced by a set', async () => {
    const { service, prisma } = makeService({ inUse: true });

    const error = await service
      .update('exercise-1', 'user-1', baseUpdateDto({ isUnilateral: false }))
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictException);
    // A clear German message the editor can surface, not a bare status code.
    expect((error as ConflictException).message).toMatch(/unilateral lässt sich nicht mehr ändern/);
    expect(prisma.exercise.update).not.toHaveBeenCalled();
  });

  it('rejects turning unilateral on when the exercise is already in use', async () => {
    const { service, prisma } = makeService({ inUse: true });
    prisma.exercise.findUnique.mockResolvedValue({
      ...CUSTOM_EXERCISE,
      isUnilateral: false,
    });

    const result = service.update('exercise-1', 'user-1', baseUpdateDto({ isUnilateral: true }));
    await expect(result).rejects.toBeInstanceOf(ConflictException);
    await expect(result).rejects.toMatchObject({ code: 'EXERCISE_UNILATERAL_CHANGE_BLOCKED' });

    expect(prisma.exercise.update).not.toHaveBeenCalled();
  });

  it('counts sets of every workout kind, not only performed ones', async () => {
    const { service, prisma } = makeService({ inUse: true });

    await expect(
      service.update('exercise-1', 'user-1', baseUpdateDto({ isUnilateral: false })),
    ).rejects.toBeInstanceOf(ConflictException);

    // The guard keys off exerciseId + "has any set" alone -- no completedAt or
    // workout-kind predicate, so template and blueprint sets count too.
    expect(prisma.workoutExercise.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { exerciseId: { in: ['exercise-1'] }, sets: { some: {} } },
      }),
    );
  });

  it('allows flipping unilateral off when no set references the exercise', async () => {
    const { service, prisma } = makeService({ inUse: false });

    const result = await service.update(
      'exercise-1',
      'user-1',
      baseUpdateDto({ isUnilateral: false }),
    );

    expect(prisma.exercise.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isUnilateral: false }) }),
    );
    expect(result.isUnilateral).toBe(false);
  });

  it('allows flipping unilateral on when no set references the exercise', async () => {
    const { service, prisma } = makeService({ inUse: false });
    prisma.exercise.findUnique.mockResolvedValue({
      ...CUSTOM_EXERCISE,
      isUnilateral: false,
    });

    const result = await service.update(
      'exercise-1',
      'user-1',
      baseUpdateDto({ isUnilateral: true }),
    );

    expect(prisma.exercise.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isUnilateral: true }) }),
    );
    expect(result.isUnilateral).toBe(true);
  });

  it('allows editing other fields while the exercise is in use', async () => {
    const { service, prisma } = makeService({ inUse: true });

    await service.update(
      'exercise-1',
      'user-1',
      baseUpdateDto({
        name: 'Bulgarian Split Squat (DB)',
        equipment: Equipment.BARBELL,
        primaryMuscle: MuscleGroup.QUADRICEPS,
      }),
    );

    expect(prisma.exercise.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Bulgarian Split Squat (DB)',
          equipment: Equipment.BARBELL,
        }),
      }),
    );
  });

  it('allows a no-op save that restates the current isUnilateral value while in use', async () => {
    const { service, prisma } = makeService({ inUse: true });

    await service.update(
      'exercise-1',
      'user-1',
      baseUpdateDto({ isUnilateral: true }), // already true on CUSTOM_EXERCISE
    );

    expect(prisma.exercise.update).toHaveBeenCalled();
  });

  it('reports the in-use exercise on the returned DTO', async () => {
    const { service } = makeService({ inUse: true });

    const result = await service.update('exercise-1', 'user-1', baseUpdateDto());

    expect(result.inUse).toBe(true);
  });
});

/**
 * Ownership guards (§2.1/§3.1): a custom exercise is visible only to the user it belongs
 * to, while a system exercise (isCustom: false) stays globally readable.
 */
const SYSTEM_EXERCISE = {
  ...CUSTOM_EXERCISE,
  id: 'exercise-system',
  name: 'Barbell Squat',
  equipment: Equipment.BARBELL,
  isUnilateral: false,
  isCustom: false,
  userId: null,
};

const OTHER_USER_EXERCISE = { ...CUSTOM_EXERCISE, id: 'exercise-other', userId: 'user-2' };

describe('ExercisesService.findById — cross-user access', () => {
  it("404s on another user's custom exercise", async () => {
    const { service } = makeService({ findUnique: OTHER_USER_EXERCISE });

    const result = service.findById(OTHER_USER_EXERCISE.id, 'user-1');
    await expect(result).rejects.toBeInstanceOf(NotFoundException);
    await expect(result).rejects.toMatchObject({ code: 'EXERCISE_NOT_FOUND' });
  });

  it('remains accessible to any user for a system exercise', async () => {
    const { service } = makeService({ findUnique: SYSTEM_EXERCISE });

    const result = await service.findById(SYSTEM_EXERCISE.id, 'user-1');

    expect(result.id).toBe(SYSTEM_EXERCISE.id);
  });
});

describe('ExercisesService.update — cross-user access', () => {
  it("404s updating another user's custom exercise, without writing", async () => {
    const { service, prisma } = makeService({ findUnique: OTHER_USER_EXERCISE });

    await expect(
      service.update(OTHER_USER_EXERCISE.id, 'user-1', baseUpdateDto()),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.exercise.update).not.toHaveBeenCalled();
  });
});

describe('ExercisesService.delete — cross-user access', () => {
  it("404s deleting another user's custom exercise, without deleting it", async () => {
    const { service, prisma } = makeService({ findUnique: OTHER_USER_EXERCISE });

    await expect(service.delete(OTHER_USER_EXERCISE.id, 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.exercise.update).not.toHaveBeenCalled();
  });
});

describe('ExercisesService.validateAccessible — cross-user access', () => {
  it("rejects when one of the requested ids is another user's custom exercise", async () => {
    const { service } = makeService({ findMany: [SYSTEM_EXERCISE, OTHER_USER_EXERCISE] });

    const result = service.validateAccessible(
      [SYSTEM_EXERCISE.id, OTHER_USER_EXERCISE.id],
      'user-1',
    );
    await expect(result).rejects.toBeInstanceOf(NotFoundException);
    await expect(result).rejects.toMatchObject({ code: 'EXERCISES_NOT_FOUND' });
  });

  it('accepts system exercises and the same custom exercise for its own owner', async () => {
    const { service } = makeService({ findMany: [SYSTEM_EXERCISE, CUSTOM_EXERCISE] });

    const accessible = await service.validateAccessible(
      [SYSTEM_EXERCISE.id, CUSTOM_EXERCISE.id],
      'user-1',
    );

    expect(Array.from(accessible.keys())).toEqual([SYSTEM_EXERCISE.id, CUSTOM_EXERCISE.id]);
  });
});
