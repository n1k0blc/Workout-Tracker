import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * Ownership guard on the home-gym CRUD methods: `updateHomeGym` / `deleteHomeGym` look the
 * gym up by id alone, then must reject when it belongs to a different user (issue #171).
 * Scoped to that guard only -- not full behavioral coverage of UsersService.
 */
const OTHER_USERS_GYM = {
  id: 'gym-1',
  userId: 'user-2',
  name: 'Fitness First',
  createdAt: new Date('2026-01-01'),
  deletedAt: null as Date | null,
};

function makeService(overrides: { findUnique?: unknown } = {}) {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    homeGym: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest
        .fn()
        .mockResolvedValue(
          'findUnique' in overrides ? overrides.findUnique : { ...OTHER_USERS_GYM },
        ),
      update: jest.fn(),
    },
    workoutDay: {
      findFirst: jest.fn(),
    },
  };

  const service = new UsersService(prisma as never);
  return { service, prisma };
}

describe('UsersService.updateHomeGym — cross-user access', () => {
  it('404s when the gym belongs to a different user', async () => {
    const { service, prisma } = makeService();

    const result = service.updateHomeGym('user-1', 'gym-1', { name: 'Renamed' });
    await expect(result).rejects.toBeInstanceOf(NotFoundException);
    await expect(result).rejects.toMatchObject({ code: 'HOME_GYM_NOT_FOUND' });
    expect(prisma.homeGym.update).not.toHaveBeenCalled();
  });
});

describe('UsersService.deleteHomeGym — cross-user access', () => {
  it('404s when the gym belongs to a different user, without checking active-cycle usage', async () => {
    const { service, prisma } = makeService();

    await expect(service.deleteHomeGym('user-1', 'gym-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.workoutDay.findFirst).not.toHaveBeenCalled();
    expect(prisma.homeGym.update).not.toHaveBeenCalled();
  });
});
