import { PickerService } from './picker.service';

/**
 * The picker's Favoriten and Zuletzt tabs (#148), through the service's public methods with a
 * mocked Prisma client and stubbed Foods / Meals / Favorites services. Covered:
 *
 *  Zuletzt (recents, derived from the diary):
 *   - distinctness: the same food logged repeatedly is one row
 *   - limit: at most 20 rows
 *   - ordering: most recently logged first, order preserved from the query
 *   - a meal-expansion entry counts toward the meal, never its ingredient food
 *   - scope 'food' asks only for stand-alone food entries
 *   - a since-soft-deleted item drops out
 *
 *  Favoriten (starred, ordered by last use):
 *   - ordered by when each was last logged, most recent first
 *   - a favorite never logged sorts last, most-recently-starred first
 *   - scope 'food' never looks at meal favorites
 *   - no favorites -> empty, and the diary is not queried
 */

const d = (ms: number) => new Date(ms);
const foodEntry = (foodId: string) => ({ foodId, mealId: null });

function makeService(
  overrides: {
    entries?: { foodId: string | null; mealId: string | null }[];
    uses?: { foodId: string | null; mealId: string | null; createdAt: Date }[];
    foodFavs?: { foodId: string; createdAt: Date }[];
    mealFavs?: { mealId: string; createdAt: Date }[];
    missingFoodIds?: string[];
    missingMealIds?: string[];
  } = {},
) {
  const prisma = {
    diaryEntry: {
      // Recents select { foodId, mealId }; the favorites last-use query also selects createdAt.
      findMany: jest.fn(
        async ({
          select,
        }: {
          where?: Record<string, unknown>;
          select?: Record<string, boolean>;
        }) => (select?.createdAt ? (overrides.uses ?? []) : (overrides.entries ?? [])),
      ),
    },
  };
  const drop = (ids: string[], missing: string[] = []) =>
    ids.filter((id) => !missing.includes(id)).map((id) => ({ id, name: id }));
  const foods = {
    listByIds: jest.fn(async (_userId: string, ids: string[]) =>
      drop(ids, overrides.missingFoodIds),
    ),
  };
  const meals = {
    listByIds: jest.fn(async (_userId: string, ids: string[]) =>
      drop(ids, overrides.missingMealIds),
    ),
  };
  const favorites = {
    listFoodFavorites: jest.fn().mockResolvedValue(overrides.foodFavs ?? []),
    listMealFavorites: jest.fn().mockResolvedValue(overrides.mealFavs ?? []),
  };
  return {
    service: new PickerService(prisma as never, foods as never, meals as never, favorites as never),
    prisma,
    foods,
    meals,
    favorites,
  };
}

const ids = (result: { items: { kind: string; food?: { id: string }; meal?: { id: string } }[] }) =>
  result.items.map((i) => (i.kind === 'food' ? i.food!.id : i.meal!.id));
const kinds = (result: { items: { kind: string }[] }) => result.items.map((i) => i.kind);

describe('PickerService.getRecent — Zuletzt', () => {
  it('collapses repeats of the same food into one row', async () => {
    const { service } = makeService({
      entries: [foodEntry('A'), foodEntry('A'), foodEntry('B'), foodEntry('A')],
    });

    expect(ids(await service.getRecent('user-1', 'all'))).toEqual(['A', 'B']);
  });

  it('returns at most 20 distinct items', async () => {
    const { service } = makeService({
      entries: Array.from({ length: 25 }, (_, i) => foodEntry(`f${i}`)),
    });

    const result = await service.getRecent('user-1', 'all');

    expect(result.items).toHaveLength(20);
    expect(ids(result)[0]).toBe('f0');
  });

  it('keeps the diary order -- most recently logged first', async () => {
    const { service } = makeService({
      entries: [foodEntry('C'), foodEntry('A'), foodEntry('B')],
    });

    expect(ids(await service.getRecent('user-1', 'all'))).toEqual(['C', 'A', 'B']);
  });

  it('counts a meal-expansion entry toward the meal, not its ingredient food', async () => {
    const { service } = makeService({
      entries: [
        { foodId: 'ingredient', mealId: 'm1' },
        { foodId: 'f2', mealId: null },
      ],
    });

    const result = await service.getRecent('user-1', 'all');

    expect(kinds(result)).toEqual(['meal', 'food']);
    expect(ids(result)).toEqual(['m1', 'f2']);
  });

  it('scope "food" asks only for stand-alone food entries and treats any hit as a food', async () => {
    const { service, prisma } = makeService({
      entries: [{ foodId: 'f2', mealId: 'm1' }],
    });

    const result = await service.getRecent('user-1', 'food');

    expect(prisma.diaryEntry.findMany.mock.calls[0][0].where).toEqual({
      userId: 'user-1',
      foodId: { not: null },
      mealId: null,
    });
    expect(kinds(result)).toEqual(['food']);
    expect(ids(result)).toEqual(['f2']);
  });

  it('drops an item whose food has since been soft-deleted', async () => {
    const { service } = makeService({
      entries: [foodEntry('A'), foodEntry('B')],
      missingFoodIds: ['B'],
    });

    expect(ids(await service.getRecent('user-1', 'all'))).toEqual(['A']);
  });
});

describe('PickerService.getFavorites — Favoriten', () => {
  it('returns nothing and does not touch the diary when there are no favorites', async () => {
    const { service, prisma } = makeService({ foodFavs: [], mealFavs: [] });

    expect(await service.getFavorites('user-1', 'all')).toEqual({ items: [] });
    expect(prisma.diaryEntry.findMany).not.toHaveBeenCalled();
  });

  it('orders favorites by when each was last logged, most recent first', async () => {
    const { service } = makeService({
      foodFavs: [
        { foodId: 'A', createdAt: d(1) },
        { foodId: 'B', createdAt: d(2) },
      ],
      uses: [
        { foodId: 'A', mealId: null, createdAt: d(200) },
        { foodId: 'B', mealId: null, createdAt: d(100) },
      ],
    });

    expect(ids(await service.getFavorites('user-1', 'all'))).toEqual(['A', 'B']);
  });

  it('sorts a never-logged favorite last, most recently starred first', async () => {
    const { service } = makeService({
      foodFavs: [
        { foodId: 'A', createdAt: d(1) },
        { foodId: 'B', createdAt: d(10) },
        { foodId: 'C', createdAt: d(20) },
      ],
      uses: [{ foodId: 'A', mealId: null, createdAt: d(50) }],
    });

    expect(ids(await service.getFavorites('user-1', 'all'))).toEqual(['A', 'C', 'B']);
  });

  it('interleaves starred meals with starred foods by last use', async () => {
    const { service } = makeService({
      foodFavs: [{ foodId: 'A', createdAt: d(1) }],
      mealFavs: [{ mealId: 'M', createdAt: d(1) }],
      uses: [
        { foodId: null, mealId: 'M', createdAt: d(300) },
        { foodId: 'A', mealId: null, createdAt: d(100) },
      ],
    });

    const result = await service.getFavorites('user-1', 'all');

    expect(kinds(result)).toEqual(['meal', 'food']);
    expect(ids(result)).toEqual(['M', 'A']);
  });

  it('scope "food" never reads meal favorites', async () => {
    const { service, favorites } = makeService({
      foodFavs: [{ foodId: 'A', createdAt: d(1) }],
      mealFavs: [{ mealId: 'M', createdAt: d(5) }],
      uses: [{ foodId: 'A', mealId: null, createdAt: d(10) }],
    });

    const result = await service.getFavorites('user-1', 'food');

    expect(favorites.listMealFavorites).not.toHaveBeenCalled();
    expect(ids(result)).toEqual(['A']);
  });

  it('drops a favorite whose food has since been soft-deleted', async () => {
    const { service } = makeService({
      foodFavs: [
        { foodId: 'A', createdAt: d(2) },
        { foodId: 'B', createdAt: d(1) },
      ],
      uses: [],
      missingFoodIds: ['A'],
    });

    expect(ids(await service.getFavorites('user-1', 'all'))).toEqual(['B']);
  });
});
