import { NotFoundException } from '@nestjs/common';
import { WorkoutTemplatesService } from './workout-templates.service';
import { UpdateWorkoutTemplateDto } from './dto';

/**
 * Cross-user access to a Workout Template (#171): a system template (isCustom: false) is
 * shared and readable by any user, but a custom template belongs to exactly one user, and
 * findOne / update / delete all guard on that with the same 404.
 */

const CUSTOM_TEMPLATE = {
  id: 'tpl-1',
  kind: 'TEMPLATE',
  isCustom: true,
  userId: 'user-1',
  name: 'Push Day',
  homeGymId: null,
  createdAt: new Date('2026-01-01'),
  exercises: [],
};

const SYSTEM_TEMPLATE = {
  id: 'tpl-sys',
  kind: 'TEMPLATE',
  isCustom: false,
  userId: null,
  name: 'Starting Strength',
  homeGymId: null,
  createdAt: new Date('2026-01-01'),
  exercises: [],
};

function makeService(overrides: { findUnique?: unknown; findFirst?: unknown } = {}) {
  // update() writes through tx.workout.update inside $transaction, not prisma.workout.update
  // directly, so the transaction callback needs to actually run against a mocked tx.
  const tx = { workout: { update: jest.fn() } };
  const prisma = {
    workout: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          'findUnique' in overrides ? overrides.findUnique : { ...CUSTOM_TEMPLATE },
        ),
      findFirst: jest.fn().mockResolvedValue(overrides.findFirst ?? null),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
  };
  const workoutTreeService = { replaceTree: jest.fn() };
  const exercisesService = { validateAccessible: jest.fn().mockResolvedValue(new Map()) };

  return {
    service: new WorkoutTemplatesService(
      prisma as never,
      workoutTreeService as never,
      exercisesService as never,
    ),
    prisma,
    tx,
  };
}

describe('WorkoutTemplatesService.findOne — ownership', () => {
  it('404s when the template belongs to another user', async () => {
    const { service } = makeService({
      findUnique: { ...CUSTOM_TEMPLATE, userId: 'someone-else' },
    });

    const result = service.findOne('tpl-1', 'user-1');
    await expect(result).rejects.toBeInstanceOf(NotFoundException);
    await expect(result).rejects.toMatchObject({ code: 'WORKOUT_TEMPLATE_NOT_FOUND' });
  });

  it('is readable by any user when it is a system template (isCustom: false)', async () => {
    const { service } = makeService({ findUnique: { ...SYSTEM_TEMPLATE } });

    const result = await service.findOne('tpl-sys', 'user-1');

    expect(result.id).toBe('tpl-sys');
    expect(result.isCustom).toBe(false);
  });
});

describe('WorkoutTemplatesService.update — ownership', () => {
  it('404s when updating a template owned by another user, writes nothing', async () => {
    const { service, tx } = makeService({
      findUnique: { ...CUSTOM_TEMPLATE, userId: 'someone-else' },
    });

    await expect(
      service.update('tpl-1', 'user-1', { name: 'Hacked' } as UpdateWorkoutTemplateDto),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.workout.update).not.toHaveBeenCalled();
  });
});

describe('WorkoutTemplatesService.delete — ownership', () => {
  it('404s when deleting a template owned by another user, does not delete', async () => {
    const { service, prisma } = makeService({
      findUnique: { ...CUSTOM_TEMPLATE, userId: 'someone-else' },
    });

    await expect(service.delete('tpl-1', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.workout.delete).not.toHaveBeenCalled();
  });
});
