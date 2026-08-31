import { ConflictException } from '@nestjs/common';
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

function makeService({ inUse }: { inUse: boolean }) {
  const prisma = {
    exercise: {
      findUnique: jest.fn().mockResolvedValue({ ...CUSTOM_EXERCISE }),
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

    await expect(
      service.update('exercise-1', 'user-1', baseUpdateDto({ isUnilateral: true })),
    ).rejects.toBeInstanceOf(ConflictException);

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
