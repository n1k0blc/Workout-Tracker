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

/**
 * Locale tracer bullet (#179): the Profil language select persists via `PATCH /users/me`,
 * which spreads `UpdateUserDto` straight into the Prisma `data` object -- so the lowercase
 * wire-type `locale` must be explicitly converted to the uppercase Prisma enum rather than
 * passed through, and mapped back on the way out.
 */
describe('UsersService locale (#179)', () => {
  describe('findById', () => {
    it('maps the stored uppercase locale to the lowercase wire type', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'a@b.com', locale: 'DE' });

      const user = await service.findById('user-1');

      expect(user.locale).toBe('de');
    });
  });

  describe('updateUser', () => {
    it('converts the lowercase locale to the Prisma enum before writing', async () => {
      const { service, prisma } = makeService();
      prisma.user.update.mockResolvedValue({ id: 'user-1', email: 'a@b.com', locale: 'EN' });

      await service.updateUser('user-1', { locale: 'en' } as never);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ locale: 'EN' }) }),
      );
    });

    it('maps the returned uppercase locale back to the lowercase wire type', async () => {
      const { service, prisma } = makeService();
      prisma.user.update.mockResolvedValue({ id: 'user-1', email: 'a@b.com', locale: 'EN' });

      const user = await service.updateUser('user-1', { locale: 'en' } as never);

      expect(user.locale).toBe('en');
    });

    it('leaves locale untouched when not part of the update', async () => {
      const { service, prisma } = makeService();
      prisma.user.update.mockResolvedValue({ id: 'user-1', email: 'a@b.com', locale: 'DE' });

      await service.updateUser('user-1', { firstName: 'Sam' } as never);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ locale: undefined }) }),
      );
    });
  });
});
