import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FoodsService } from './foods.service';
import { CreateFoodDto } from './dto';

/**
 * Domain rules for the shared Lebensmittel library, through the service's public methods with
 * a mocked Prisma client. Covered: every food is visible to every user, only the creator can
 * edit a USER food, SEED / Open-Food-Facts foods are read-only for everyone, barcodes are
 * globally unique (409), and delete is soft (the food leaves search but resolves by id).
 */

const OWN_FOOD = {
  id: 'food-own',
  name: 'Haferflocken',
  brand: null as string | null,
  barcode: '4008713700086' as string | null,
  isLiquid: false,
  kcal: 372,
  carbs: 58.7,
  protein: 13.5,
  fat: 7,
  source: 'USER' as const,
  createdById: 'user-1',
  deletedAt: null as Date | null,
  portions: [{ id: 'p1', label: '1 Portion', grams: 40, order: 1, isDefault: true }],
};

const OTHER_USER_FOOD = {
  ...OWN_FOOD,
  id: 'food-other',
  name: 'Skyr',
  createdById: 'user-2',
  barcode: null,
};
const SEED_FOOD = {
  ...OWN_FOOD,
  id: 'food-seed',
  name: 'Butter',
  source: 'SEED' as const,
  createdById: null,
  barcode: null,
};
const OFF_FOOD = {
  ...OWN_FOOD,
  id: 'food-off',
  name: 'Haferdrink',
  source: 'OPEN_FOOD_FACTS' as const,
  createdById: null,
  barcode: null,
};

function makeService(
  overrides: {
    findMany?: unknown[];
    findUnique?: unknown;
    createImpl?: (args: { data: Record<string, unknown> }) => unknown;
    updateImpl?: (args: { data: Record<string, unknown> }) => unknown;
    diaryEntries?: unknown[];
  } = {},
) {
  const prisma = {
    food: {
      // Counts ignore the page cap; "own" narrows to the caller's editable foods.
      count: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const rows = (overrides.findMany ?? []) as { createdById?: string; source?: string }[];
        if (!where.createdById) return rows.length;
        return rows.filter((f) => f.createdById === where.createdById && f.source === 'USER')
          .length;
      }),
      findMany: jest.fn().mockResolvedValue(overrides.findMany ?? []),
      findUnique: jest
        .fn()
        .mockResolvedValue('findUnique' in overrides ? overrides.findUnique : { ...OWN_FOOD }),
      create: jest.fn(
        overrides.createImpl ??
          (async ({ data }: { data: Record<string, unknown> }) => ({
            ...OWN_FOOD,
            ...data,
            portions: [],
          })),
      ),
      update: jest.fn(
        overrides.updateImpl ??
          (async ({ data }: { data: Record<string, unknown> }) => ({
            ...OWN_FOOD,
            ...data,
            portions: [],
          })),
      ),
    },
    diaryEntry: {
      findMany: jest.fn().mockResolvedValue(overrides.diaryEntries ?? []),
    },
  };
  return { service: new FoodsService(prisma as never), prisma };
}

function baseCreateDto(overrides: Partial<CreateFoodDto> = {}): CreateFoodDto {
  return {
    name: 'Neues Lebensmittel',
    kcal: 100,
    carbs: 10,
    protein: 5,
    fat: 2,
    ...overrides,
  };
}

describe('FoodsService.findAll — visibility', () => {
  it('returns foods from every user, filtered to non-deleted, name search applied', async () => {
    const { service, prisma } = makeService({
      findMany: [OWN_FOOD, OTHER_USER_FOOD, SEED_FOOD, OFF_FOOD],
    });

    const result = await service.findAll('user-1', 'hafer');

    expect(prisma.food.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: 'hafer', mode: 'insensitive' } },
            { brand: { contains: 'hafer', mode: 'insensitive' } },
          ],
        },
      }),
    );
    expect(result.items.map((f) => f.id)).toEqual([
      'food-own',
      'food-other',
      'food-seed',
      'food-off',
    ]);
  });

  it("marks editable only for the current user's own non-deleted USER food", async () => {
    const { service } = makeService({
      findMany: [OWN_FOOD, OTHER_USER_FOOD, SEED_FOOD, OFF_FOOD],
    });

    const byId = Object.fromEntries((await service.findAll('user-1')).items.map((f) => [f.id, f]));

    expect(byId['food-own'].editable).toBe(true);
    expect(byId['food-other'].editable).toBe(false); // someone else's
    expect(byId['food-seed'].editable).toBe(false); // seeded
    expect(byId['food-off'].editable).toBe(false); // imported
  });
});

describe('FoodsService.findAll - totals are not the page size', () => {
  it("reports how many foods match and how many are the caller's own, beyond the page cap", async () => {
    // The library holds ~180k imported foods (#146) but a page is capped, so the totals have
    // to be counted separately -- otherwise the tab reports the page size as the library size.
    const { service, prisma } = makeService({
      findMany: [OWN_FOOD, OTHER_USER_FOOD, SEED_FOOD, OFF_FOOD],
    });
    prisma.food.count = jest.fn().mockResolvedValueOnce(180983).mockResolvedValueOnce(9);

    const result = await service.findAll('user-1');

    expect(result.total).toBe(180983);
    expect(result.ownTotal).toBe(9);
    expect(result.items).toHaveLength(4);
  });
});

describe('FoodsService.findAll - search matches brand too', () => {
  it('finds an imported product by its brand, not just its name', async () => {
    // The Open Food Facts import (#146) fills the library with branded products, so a
    // search for the brand has to reach them.
    const { service, prisma } = makeService({ findMany: [OFF_FOOD] });

    await service.findAll('user-1', 'Oatly');

    expect(prisma.food.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: 'Oatly', mode: 'insensitive' } },
            { brand: { contains: 'Oatly', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });
});

describe('FoodsService.findById — resolves soft-deleted', () => {
  it('still returns a soft-deleted food, flagged deleted and not editable', async () => {
    const { service } = makeService({
      findUnique: { ...OWN_FOOD, deletedAt: new Date('2026-01-01') },
    });

    const food = await service.findById('food-own', 'user-1');

    expect(food.deleted).toBe(true);
    expect(food.editable).toBe(false);
  });

  it('404s when the id is unknown', async () => {
    const { service } = makeService({ findUnique: null });
    await expect(service.findById('nope', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('FoodsService.create', () => {
  it('stamps source USER and the creator, trims the name, empty barcode -> null', async () => {
    const { service, prisma } = makeService();

    await service.create('user-1', baseCreateDto({ name: '  Reis  ', barcode: '' }));

    expect(prisma.food.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Reis',
          barcode: null,
          source: 'USER',
          createdById: 'user-1',
        }),
      }),
    );
  });

  it('rejects a duplicate barcode with a 409', async () => {
    const { service } = makeService({
      createImpl: async () => {
        throw { code: 'P2002' };
      },
    });

    await expect(
      service.create('user-1', baseCreateDto({ barcode: '4008713700086' })),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('writes portions with order from array position and requires exactly one default', async () => {
    const { service, prisma } = makeService();

    await service.create(
      'user-1',
      baseCreateDto({
        portions: [
          { label: '1 Portion', grams: 40, isDefault: true },
          { label: '1 EL', grams: 12 },
        ],
      }),
    );

    expect(prisma.food.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          portions: {
            create: [
              { label: '1 Portion', grams: 40, order: 1, isDefault: true },
              { label: '1 EL', grams: 12, order: 2, isDefault: false },
            ],
          },
        }),
      }),
    );
  });

  it('rejects a portion list with no default or with more than one default', async () => {
    const { service } = makeService();

    await expect(
      service.create(
        'user-1',
        baseCreateDto({
          portions: [
            { label: 'a', grams: 1 },
            { label: 'b', grams: 2 },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.create(
        'user-1',
        baseCreateDto({
          portions: [
            { label: 'a', grams: 1, isDefault: true },
            { label: 'b', grams: 2, isDefault: true },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('FoodsService.update / softDelete — creator-only, read-only globals', () => {
  it('403s when a USER food is edited by someone other than its creator', async () => {
    const { service, prisma } = makeService({ findUnique: { ...OTHER_USER_FOOD } });

    await expect(service.update('user-1', 'food-other', baseCreateDto())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.food.update).not.toHaveBeenCalled();
  });

  it('403s on a SEED food for everyone', async () => {
    const { service } = makeService({ findUnique: { ...SEED_FOOD } });
    await expect(service.update('user-1', 'food-seed', baseCreateDto())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('403s on an OPEN_FOOD_FACTS food for everyone', async () => {
    const { service } = makeService({ findUnique: { ...OFF_FOOD } });
    await expect(service.softDelete('user-1', 'food-off')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('lets the creator update their own food and maps a barcode clash to 409', async () => {
    const ok = makeService();
    await ok.service.update('user-1', 'food-own', baseCreateDto({ name: 'Haferflocken fein' }));
    expect(ok.prisma.food.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Haferflocken fein',
          portions: { deleteMany: {}, create: [] },
        }),
      }),
    );

    const clash = makeService({
      updateImpl: async () => {
        throw { code: 'P2002' };
      },
    });
    await expect(
      clash.service.update('user-1', 'food-own', baseCreateDto({ barcode: '111' })),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('soft-deletes by stamping deletedAt, and 404s a second time', async () => {
    const { service, prisma } = makeService();

    await service.softDelete('user-1', 'food-own');

    expect(prisma.food.update).toHaveBeenCalledWith({
      where: { id: 'food-own' },
      data: { deletedAt: expect.any(Date) },
    });

    const gone = makeService({ findUnique: { ...OWN_FOOD, deletedAt: new Date() } });
    await expect(gone.service.softDelete('user-1', 'food-own')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('FoodsService.findSimilar', () => {
  it("returns the user's own matching foods with a per-user usage count", async () => {
    const { service, prisma } = makeService({
      findMany: [
        { ...OWN_FOOD, id: 'f1', name: 'Haferdrink ungesüßt' },
        { ...OWN_FOOD, id: 'f2', name: 'Haferdrink Barista' },
      ],
      // f1 referenced by 24 of the user's entries, f2 by none.
      diaryEntries: Array.from({ length: 24 }, () => ({ foodId: 'f1' })),
    });

    const result = await service.findSimilar('user-1', 'haferdrink');

    expect(prisma.food.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: 'USER',
          createdById: 'user-1',
          deletedAt: null,
          name: { contains: 'haferdrink', mode: 'insensitive' },
        }),
      }),
    );
    expect(result).toEqual([
      { id: 'f1', name: 'Haferdrink ungesüßt', kcal: 372, isLiquid: false, usageCount: 24 },
      { id: 'f2', name: 'Haferdrink Barista', kcal: 372, isLiquid: false, usageCount: 0 },
    ]);
  });

  it('returns nothing for a query shorter than two characters', async () => {
    const { service, prisma } = makeService();
    expect(await service.findSimilar('user-1', 'h')).toEqual([]);
    expect(prisma.food.findMany).not.toHaveBeenCalled();
  });
});
