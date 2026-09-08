import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MealsService } from './meals.service';
import { CreateMealDto } from './dto';

/**
 * Domain rules for the shared Mahlzeiten library, through the service's public methods with a
 * mocked Prisma client (the same seam as the foods / diary specs). Covered:
 *
 *  - every meal is visible to every user; "Nur meine" narrows to the caller
 *  - totals are computed *live* from the current food nutrients, per 1x
 *  - a meal whose ingredient food was soft-deleted still resolves and computes
 *  - only the creator edits or deletes a meal (403 otherwise); delete is soft
 *  - items are stored with `order` from array position; duplicate names are allowed
 */

const OATS = {
  id: 'food-oats',
  name: 'Haferflocken',
  isLiquid: false,
  kcal: 372,
  carbs: 58.7,
  protein: 13.5,
  fat: 7,
  deletedAt: null as Date | null,
  portions: [{ id: 'p-oats-1', label: '1 Portion', grams: 40, order: 1, isDefault: true }],
};
const SKYR = {
  id: 'food-skyr',
  name: 'Skyr natur',
  isLiquid: false,
  kcal: 63,
  carbs: 4,
  protein: 11,
  fat: 0.2,
  deletedAt: null as Date | null,
  portions: [],
};

function mealRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'meal-1',
    name: 'Overnight Oats',
    createdById: 'user-1',
    deletedAt: null as Date | null,
    items: [
      { id: 'mi-1', foodId: 'food-oats', quantity: 40, order: 1, food: { ...OATS } },
      { id: 'mi-2', foodId: 'food-skyr', quantity: 150, order: 2, food: { ...SKYR } },
    ],
    ...overrides,
  };
}

function makeService(
  overrides: {
    findMany?: unknown[];
    findUnique?: unknown;
    foodCount?: number;
    createImpl?: (args: { data: Record<string, unknown> }) => unknown;
    updateImpl?: (args: { data: Record<string, unknown> }) => unknown;
    favoriteMealIds?: string[];
  } = {},
) {
  const prisma = {
    meal: {
      findMany: jest.fn().mockResolvedValue(overrides.findMany ?? []),
      findUnique: jest
        .fn()
        .mockResolvedValue('findUnique' in overrides ? overrides.findUnique : mealRow()),
      create: jest.fn(
        overrides.createImpl ??
          (async ({ data }: { data: Record<string, unknown> }) => ({
            ...mealRow(),
            name: data.name,
          })),
      ),
      update: jest.fn(
        overrides.updateImpl ??
          (async ({ data }: { data: Record<string, unknown> }) => ({
            ...mealRow(),
            name: typeof data.name === 'string' ? data.name : 'Overnight Oats',
          })),
      ),
    },
    food: {
      // Default: every queried id exists. `foodCount` forces a lower number (a missing food).
      count: jest.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        overrides.foodCount ?? where.id.in.length,
      ),
    },
  };
  const favorites = {
    favoriteMealIds: jest.fn().mockResolvedValue(new Set(overrides.favoriteMealIds ?? [])),
  };
  return {
    service: new MealsService(prisma as never, favorites as never),
    prisma,
    favorites,
  };
}

function baseCreateDto(overrides: Partial<CreateMealDto> = {}): CreateMealDto {
  return {
    name: 'Overnight Oats',
    items: [
      { foodId: 'food-oats', quantity: 40 },
      { foodId: 'food-skyr', quantity: 150 },
    ],
    ...overrides,
  };
}

describe('MealsService.findAll — visibility and counts', () => {
  it('returns meals from every user, with editable set only for the caller\'s own', async () => {
    const { service, prisma } = makeService({
      findMany: [
        mealRow({ id: 'm1', createdById: 'user-1' }),
        mealRow({ id: 'm2', createdById: 'user-2' }),
      ],
    });

    const result = await service.findAll('user-1');

    expect(prisma.meal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null } }),
    );
    expect(result.items.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(result.items.find((m) => m.id === 'm1')!.editable).toBe(true);
    expect(result.items.find((m) => m.id === 'm2')!.editable).toBe(false);
    expect(result.total).toBe(2);
    expect(result.mineTotal).toBe(1);
  });

  it('"Nur meine" narrows the list but leaves the counts library-wide', async () => {
    const { service } = makeService({
      findMany: [
        mealRow({ id: 'm1', createdById: 'user-1' }),
        mealRow({ id: 'm2', createdById: 'user-2' }),
        mealRow({ id: 'm3', createdById: 'user-2' }),
      ],
    });

    const result = await service.findAll('user-1', true);

    expect(result.items.map((m) => m.id)).toEqual(['m1']);
    // The count line still describes the whole library, not the filtered view.
    expect(result.total).toBe(3);
    expect(result.mineTotal).toBe(1);
  });

  it('exposes the ingredient preview and a live totals line', async () => {
    const { service } = makeService({ findMany: [mealRow()] });

    const [meal] = (await service.findAll('user-1')).items;

    expect(meal.ingredientNames).toEqual(['Haferflocken', 'Skyr natur']);
    expect(meal.itemCount).toBe(2);
    // 372*0.4 + 63*1.5 = 148.8 + 94.5 = 243.3
    expect(meal.totals.kcal).toBeCloseTo(243.3, 6);
  });
});

describe('MealsService.findById — live reference', () => {
  it('computes totals from the current per-100 food values (per 1x)', async () => {
    const { service } = makeService({ findUnique: mealRow() });

    const meal = await service.findById('meal-1', 'user-1');

    expect(meal.totals.kcal).toBeCloseTo(243.3, 6); // 372*0.4 + 63*1.5
    expect(meal.totals.protein).toBeCloseTo(21.9, 6); // 13.5*0.4 + 11*1.5
    expect(meal.items[0]).toMatchObject({
      foodId: 'food-oats',
      quantity: 40,
      foodName: 'Haferflocken',
      per100: { kcal: 372, carbs: 58.7, protein: 13.5, fat: 7 },
    });
  });

  it('re-computes when a food changes (editing a food changes the meal total)', async () => {
    const bumped = mealRow();
    bumped.items[0].food = { ...OATS, kcal: 400 };
    const { service } = makeService({ findUnique: bumped });

    const meal = await service.findById('meal-1', 'user-1');

    expect(meal.totals.kcal).toBeCloseTo(254.5, 6); // 400*0.4 + 63*1.5
  });

  it('still resolves and computes a meal whose ingredient food was soft-deleted', async () => {
    const withDeleted = mealRow();
    withDeleted.items[1].food = { ...SKYR, deletedAt: new Date('2026-01-01') };
    const { service } = makeService({ findUnique: withDeleted });

    const meal = await service.findById('meal-1', 'user-1');

    expect(meal.items[1].deleted).toBe(true);
    expect(meal.totals.kcal).toBeCloseTo(243.3, 6); // unchanged -- deleted food still counts
  });

  it('404s an unknown id', async () => {
    const { service } = makeService({ findUnique: null });
    await expect(service.findById('nope', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('MealsService.create', () => {
  it('stamps the creator, trims the name and writes order from array position', async () => {
    const { service, prisma } = makeService();

    await service.create('user-1', baseCreateDto({ name: '  Overnight Oats  ' }));

    expect(prisma.meal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Overnight Oats',
          createdById: 'user-1',
          items: {
            create: [
              { foodId: 'food-oats', quantity: 40, order: 1 },
              { foodId: 'food-skyr', quantity: 150, order: 2 },
            ],
          },
        }),
      }),
    );
  });

  it('allows two meals with the same name', async () => {
    const { service } = makeService();

    await expect(service.create('user-1', baseCreateDto())).resolves.toBeDefined();
    await expect(service.create('user-1', baseCreateDto())).resolves.toBeDefined();
  });

  it('404s when an item references a food that does not exist', async () => {
    const { service, prisma } = makeService({ foodCount: 1 });

    await expect(service.create('user-1', baseCreateDto())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.meal.create).not.toHaveBeenCalled();
  });
});

describe('MealsService.update / softDelete — creator only', () => {
  it('403s when someone other than the creator edits the meal', async () => {
    const { service, prisma } = makeService({
      findUnique: mealRow({ createdById: 'user-2' }),
    });

    await expect(
      service.update('user-1', 'meal-1', baseCreateDto()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.meal.update).not.toHaveBeenCalled();
  });

  it('lets the creator rewrite name and items wholesale', async () => {
    const { service, prisma } = makeService();

    await service.update(
      'user-1',
      'meal-1',
      baseCreateDto({ name: 'Overnight Oats XL', items: [{ foodId: 'food-oats', quantity: 80 }] }),
    );

    expect(prisma.meal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'meal-1' },
        data: expect.objectContaining({
          name: 'Overnight Oats XL',
          items: { deleteMany: {}, create: [{ foodId: 'food-oats', quantity: 80, order: 1 }] },
        }),
      }),
    );
  });

  it('404s updating a soft-deleted meal', async () => {
    const { service } = makeService({ findUnique: mealRow({ deletedAt: new Date() }) });
    await expect(
      service.update('user-1', 'meal-1', baseCreateDto()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('403s when a non-creator deletes the meal', async () => {
    const { service } = makeService({ findUnique: mealRow({ createdById: 'user-2' }) });
    await expect(service.softDelete('user-1', 'meal-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('soft-deletes by stamping deletedAt, and 404s a second time', async () => {
    const { service, prisma } = makeService();

    await service.softDelete('user-1', 'meal-1');

    expect(prisma.meal.update).toHaveBeenCalledWith({
      where: { id: 'meal-1' },
      data: { deletedAt: expect.any(Date) },
    });

    const gone = makeService({ findUnique: mealRow({ deletedAt: new Date() }) });
    await expect(gone.service.softDelete('user-1', 'meal-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
