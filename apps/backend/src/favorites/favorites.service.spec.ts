import { NotFoundException } from '@nestjs/common';
import { FavoritesService } from './favorites.service';

/**
 * Domain rules for the Favoriten join tables (#148), through the service's public methods with
 * a mocked Prisma client (the same seam as the foods / meals / diary specs). Covered:
 *
 *  - starring is an idempotent upsert on the `(userId, id)` unique key; a double-star is a no-op
 *  - unstarring is a scoped delete that tolerates "nothing was starred"
 *  - starring something soft-deleted or missing is a 404, and writes nothing
 *  - every read and write is scoped to the calling user
 */

function makeService(
  overrides: { food?: unknown; meal?: unknown; foodRows?: unknown[]; mealRows?: unknown[] } = {},
) {
  const prisma = {
    food: {
      findFirst: jest
        .fn()
        .mockResolvedValue('food' in overrides ? overrides.food : { id: 'food-1' }),
    },
    meal: {
      findFirst: jest
        .fn()
        .mockResolvedValue('meal' in overrides ? overrides.meal : { id: 'meal-1' }),
    },
    foodFavorite: {
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue(overrides.foodRows ?? []),
    },
    mealFavorite: {
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue(overrides.mealRows ?? []),
    },
  };
  return { service: new FavoritesService(prisma as never), prisma };
}

describe('FavoritesService.setFoodFavorite', () => {
  it('stars via an upsert on the (userId, foodId) unique key -- a double-star is a no-op', async () => {
    const { service, prisma } = makeService();

    await service.setFoodFavorite('user-1', 'food-1', true);

    expect(prisma.foodFavorite.upsert).toHaveBeenCalledWith({
      where: { userId_foodId: { userId: 'user-1', foodId: 'food-1' } },
      create: { userId: 'user-1', foodId: 'food-1' },
      update: {},
    });
  });

  it('unstars with a user-scoped delete and never checks the food exists', async () => {
    const { service, prisma } = makeService();

    await service.setFoodFavorite('user-1', 'food-1', false);

    expect(prisma.food.findFirst).not.toHaveBeenCalled();
    expect(prisma.foodFavorite.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', foodId: 'food-1' },
    });
    expect(prisma.foodFavorite.upsert).not.toHaveBeenCalled();
  });

  it('refuses to star a soft-deleted or missing food, and writes nothing', async () => {
    const { service, prisma } = makeService({ food: null });

    await expect(service.setFoodFavorite('user-1', 'gone', true)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.foodFavorite.upsert).not.toHaveBeenCalled();
  });

  it('only considers a non-deleted food when starring', async () => {
    const { service, prisma } = makeService();

    await service.setFoodFavorite('user-1', 'food-1', true);

    expect(prisma.food.findFirst).toHaveBeenCalledWith({
      where: { id: 'food-1', deletedAt: null },
      select: { id: true },
    });
  });
});

describe('FavoritesService.setMealFavorite', () => {
  it('stars via an upsert on the (userId, mealId) unique key', async () => {
    const { service, prisma } = makeService();

    await service.setMealFavorite('user-1', 'meal-1', true);

    expect(prisma.mealFavorite.upsert).toHaveBeenCalledWith({
      where: { userId_mealId: { userId: 'user-1', mealId: 'meal-1' } },
      create: { userId: 'user-1', mealId: 'meal-1' },
      update: {},
    });
  });

  it('refuses to star a soft-deleted or missing meal', async () => {
    const { service, prisma } = makeService({ meal: null });

    await expect(service.setMealFavorite('user-1', 'gone', true)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.mealFavorite.upsert).not.toHaveBeenCalled();
  });

  it('unstars with a user-scoped delete', async () => {
    const { service, prisma } = makeService();

    await service.setMealFavorite('user-1', 'meal-1', false);

    expect(prisma.mealFavorite.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', mealId: 'meal-1' },
    });
  });
});

describe('FavoritesService id-set and list helpers', () => {
  it('favoriteFoodIds returns the starred food ids as a Set, scoped to the user', async () => {
    const { service, prisma } = makeService({
      foodRows: [{ foodId: 'a' }, { foodId: 'b' }],
    });

    const ids = await service.favoriteFoodIds('user-1');

    expect(prisma.foodFavorite.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select: { foodId: true },
    });
    expect(ids).toEqual(new Set(['a', 'b']));
  });

  it('favoriteMealIds returns the starred meal ids as a Set', async () => {
    const { service } = makeService({ mealRows: [{ mealId: 'm1' }] });

    expect(await service.favoriteMealIds('user-1')).toEqual(new Set(['m1']));
  });

  it('listFoodFavorites carries the starred-at timestamp for the tiebreak ordering', async () => {
    const at = new Date('2026-09-01T00:00:00Z');
    const { service, prisma } = makeService({ foodRows: [{ foodId: 'a', createdAt: at }] });

    const rows = await service.listFoodFavorites('user-1');

    expect(prisma.foodFavorite.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select: { foodId: true, createdAt: true },
    });
    expect(rows).toEqual([{ foodId: 'a', createdAt: at }]);
  });
});
