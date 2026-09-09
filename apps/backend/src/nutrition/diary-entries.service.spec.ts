import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DiaryEntriesService } from './diary-entries.service';
import { CreateDiaryEntryDto } from './dto';

/**
 * Domain rules for Einträge, driven through the service's public methods with a mocked Prisma
 * client (the same seam as exercises / workout-tree / analytics specs). Covered here:
 *
 *  - a Schnelleintrag snapshots its kcal/macros and stores foodId = null
 *  - a quantity edit rescales that snapshot proportionally, never recomputes it
 *  - every entry op is scoped to the owning user
 *  - the day read model totals per slot and per day, and hides empty archived slots
 */

const ENTRY = {
  id: 'entry-1',
  userId: 'user-1',
  mealSlotId: 'slot-1',
  localDate: '2026-09-07',
  foodId: null as string | null,
  mealId: null as string | null,
  mealName: null as string | null,
  name: 'Kantine · Gemüsepfanne',
  quantity: 1,
  quantityLabel: null as string | null,
  kcal: 540,
  carbs: 48,
  protein: 22,
  fat: 24,
};

function baseCreateDto(overrides: Partial<CreateDiaryEntryDto> = {}): CreateDiaryEntryDto {
  return {
    mealSlotId: 'slot-1',
    localDate: '2026-09-07',
    name: 'Kantine · Gemüsepfanne',
    kcal: 540,
    carbs: 48,
    protein: 22,
    fat: 24,
    ...overrides,
  };
}

function makeService(overrides: {
  slot?: unknown;
  entry?: unknown;
  slots?: unknown[];
  entries?: unknown[];
  deleteCount?: number;
  foods?: unknown[];
  // What the injected MealsService.findById resolves to (the expandable meal). `null` -> 404.
  mealDetail?: unknown;
  // What the injected MealSlotsService.ensureActiveSlot resolves to (the "Sonstiges" fallback).
  fallbackSlot?: { id: string; name: string; order: number; archived: boolean };
} = {}) {
  const foodCreate = jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'food-new',
    ...data,
  }));
  const diaryCreate = jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    ...ENTRY,
    ...data,
  }));

  const prisma = {
    mealSlot: {
      findFirst: jest.fn().mockResolvedValue(
        'slot' in overrides ? overrides.slot : { id: 'slot-1' },
      ),
      findMany: jest.fn().mockResolvedValue(overrides.slots ?? []),
    },
    food: {
      create: foodCreate,
      findMany: jest.fn().mockResolvedValue(overrides.foods ?? []),
    },
    diaryEntry: {
      create: diaryCreate,
      createMany: jest.fn(
        async ({ data }: { data: Array<Record<string, unknown>> }) => ({ count: data.length }),
      ),
      findFirst: jest.fn().mockResolvedValue(
        'entry' in overrides ? overrides.entry : { ...ENTRY },
      ),
      findMany: jest.fn().mockResolvedValue(overrides.entries ?? []),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ...ENTRY,
        ...data,
      })),
      deleteMany: jest.fn().mockResolvedValue({ count: overrides.deleteCount ?? 1 }),
    },
    // Interactive transaction: run the callback against the same mock.
    $transaction: jest.fn(async (cb: (tx: unknown) => unknown) =>
      cb({ food: { create: foodCreate }, diaryEntry: { create: diaryCreate } }),
    ),
  };
  const meals = {
    findById: jest.fn(async () => {
      if ('mealDetail' in overrides) {
        if (overrides.mealDetail == null) {
          throw new NotFoundException('Mahlzeit nicht gefunden');
        }
        return overrides.mealDetail;
      }
      return { ...MEAL_DETAIL };
    }),
  };
  const mealSlots = {
    ensureActiveSlot: jest.fn(async () =>
      overrides.fallbackSlot ?? {
        id: 'slot-sonstiges',
        name: 'Sonstiges',
        order: 5,
        archived: false,
      },
    ),
  };
  return {
    service: new DiaryEntriesService(prisma as never, meals as never, mealSlots as never),
    prisma,
    meals,
    mealSlots,
  };
}

describe('DiaryEntriesService.createEntry — snapshot on create', () => {
  it('stores the given kcal/macros verbatim with foodId and mealId null', async () => {
    const { service, prisma } = makeService();

    const result = await service.createEntry('user-1', baseCreateDto());

    expect(prisma.diaryEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        mealSlotId: 'slot-1',
        localDate: '2026-09-07',
        name: 'Kantine · Gemüsepfanne',
        foodId: null,
        mealId: null,
        kcal: 540,
        carbs: 48,
        protein: 22,
        fat: 24,
      }),
    });
    expect(result.foodId).toBeNull();
    expect(result.kcal).toBe(540);
  });

  it('defaults quantity to 1 when the client omits it', async () => {
    const { service, prisma } = makeService();

    await service.createEntry('user-1', baseCreateDto());

    expect(prisma.diaryEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ quantity: 1, quantityLabel: null }),
    });
  });

  it('rejects logging into an Abschnitt that is not the user\'s', async () => {
    const { service, prisma } = makeService({ slot: null });

    await expect(
      service.createEntry('user-1', baseCreateDto({ mealSlotId: 'someone-elses-slot' })),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.mealSlot.findFirst).toHaveBeenCalledWith({
      where: { id: 'someone-elses-slot', userId: 'user-1' },
      select: { id: true, archivedAt: true },
    });
    expect(prisma.diaryEntry.create).not.toHaveBeenCalled();
  });

  it('rejects logging into an archived Abschnitt (read-only) with a 409', async () => {
    const { service, prisma } = makeService({
      slot: { id: 'slot-1', archivedAt: new Date('2026-01-01') },
    });

    await expect(service.createEntry('user-1', baseCreateDto())).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.diaryEntry.create).not.toHaveBeenCalled();
  });
});

describe('DiaryEntriesService.updateEntryQuantity — proportional rescale', () => {
  it('doubles the snapshot when quantity goes 1 -> 2', async () => {
    const { service, prisma } = makeService({ entry: { ...ENTRY, quantity: 1 } });

    const result = await service.updateEntryQuantity('user-1', 'entry-1', 2);

    expect(prisma.diaryEntry.update).toHaveBeenCalledWith({
      where: { id: 'entry-1' },
      data: { quantity: 2, kcal: 1080, carbs: 96, protein: 44, fat: 48 },
    });
    expect(result.kcal).toBe(1080);
  });

  it('scales by the ratio, not by the absolute quantity (2 -> 3 is x1.5)', async () => {
    const { service, prisma } = makeService({
      entry: { ...ENTRY, quantity: 2, kcal: 1080, carbs: 96, protein: 44, fat: 48 },
    });

    await service.updateEntryQuantity('user-1', 'entry-1', 3);

    expect(prisma.diaryEntry.update).toHaveBeenCalledWith({
      where: { id: 'entry-1' },
      data: { quantity: 3, kcal: 1620, carbs: 144, protein: 66, fat: 72 },
    });
  });

  it('round-trips back to the original snapshot (1 -> 4 -> 1)', async () => {
    const up = makeService({ entry: { ...ENTRY, quantity: 1 } });
    await up.service.updateEntryQuantity('user-1', 'entry-1', 4);
    const scaledUp = up.prisma.diaryEntry.update.mock.calls[0][0].data;
    expect(scaledUp).toMatchObject({ kcal: 2160, carbs: 192 });

    const down = makeService({
      entry: { ...ENTRY, quantity: 4, kcal: 2160, carbs: 192, protein: 88, fat: 96 },
    });
    await down.service.updateEntryQuantity('user-1', 'entry-1', 1);
    expect(down.prisma.diaryEntry.update.mock.calls[0][0].data).toMatchObject({
      quantity: 1,
      kcal: 540,
      carbs: 48,
      protein: 22,
      fat: 24,
    });
  });

  it("404s on another user's entry and does not write", async () => {
    const { service, prisma } = makeService({ entry: null });

    await expect(
      service.updateEntryQuantity('user-1', 'entry-1', 2),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.diaryEntry.findFirst).toHaveBeenCalledWith({
      where: { id: 'entry-1', userId: 'user-1' },
    });
    expect(prisma.diaryEntry.update).not.toHaveBeenCalled();
  });

  it('persists a new quantityLabel when the food-backed editor sends one', async () => {
    const { service, prisma } = makeService({
      entry: { ...ENTRY, foodId: 'food-1', quantity: 40, quantityLabel: '1 Portion (40 g)' },
    });

    await service.updateEntryQuantity('user-1', 'entry-1', 80, '2 Portionen (80 g)');

    expect(prisma.diaryEntry.update).toHaveBeenCalledWith({
      where: { id: 'entry-1' },
      data: expect.objectContaining({ quantity: 80, quantityLabel: '2 Portionen (80 g)' }),
    });
  });

  it('leaves quantityLabel untouched when none is sent (bare Schnelleintrag)', async () => {
    const { service, prisma } = makeService({ entry: { ...ENTRY, quantity: 1 } });

    await service.updateEntryQuantity('user-1', 'entry-1', 2);

    expect(prisma.diaryEntry.update.mock.calls[0][0].data).not.toHaveProperty('quantityLabel');
  });
});

describe('DiaryEntriesService.deleteEntry — scoped hard delete', () => {
  it('deletes only when the row belongs to the user', async () => {
    const { service, prisma } = makeService({ deleteCount: 1 });

    await service.deleteEntry('user-1', 'entry-1');

    expect(prisma.diaryEntry.deleteMany).toHaveBeenCalledWith({
      where: { id: 'entry-1', userId: 'user-1' },
    });
  });

  it('404s when nothing matched (wrong owner or already gone)', async () => {
    const { service } = makeService({ deleteCount: 0 });

    await expect(service.deleteEntry('user-1', 'entry-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('DiaryEntriesService.getDay — day read model', () => {
  const slots = [
    { id: 'slot-1', name: 'Frühstück', order: 1, archivedAt: null },
    { id: 'slot-2', name: 'Mittagessen', order: 2, archivedAt: null },
    { id: 'slot-3', name: 'Zweites Frühstück', order: 3, archivedAt: new Date('2026-01-01') },
  ];

  it('groups entries under their slot and totals per slot and per day', async () => {
    const entries = [
      { ...ENTRY, id: 'e1', mealSlotId: 'slot-1', kcal: 200, carbs: 20, protein: 10, fat: 5 },
      { ...ENTRY, id: 'e2', mealSlotId: 'slot-1', kcal: 300, carbs: 30, protein: 15, fat: 8 },
      { ...ENTRY, id: 'e3', mealSlotId: 'slot-2', kcal: 500, carbs: 40, protein: 30, fat: 20 },
    ];
    const { service, prisma } = makeService({ slots, entries });

    const day = await service.getDay('user-1', '2026-09-07');

    expect(prisma.diaryEntry.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', localDate: '2026-09-07' },
      orderBy: { createdAt: 'asc' },
    });
    expect(day.date).toBe('2026-09-07');
    expect(day.totals).toEqual({ kcal: 1000, carbs: 90, protein: 55, fat: 33 });

    const fruehstueck = day.slots.find((s) => s.id === 'slot-1')!;
    expect(fruehstueck.totals).toEqual({ kcal: 500, carbs: 50, protein: 25, fat: 13 });
    expect(fruehstueck.entries.map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('hides an archived slot with no entries but keeps one that has them', async () => {
    const { service } = makeService({
      slots,
      entries: [{ ...ENTRY, id: 'e9', mealSlotId: 'slot-3', kcal: 90 }],
    });

    const day = await service.getDay('user-1', '2026-09-07');

    expect(day.slots.map((s) => s.id)).toEqual(['slot-1', 'slot-2', 'slot-3']);
    expect(day.slots.find((s) => s.id === 'slot-3')!.archived).toBe(true);
  });

  it('omits an empty archived slot entirely', async () => {
    const { service } = makeService({ slots, entries: [] });

    const day = await service.getDay('user-1', '2026-09-07');

    expect(day.slots.map((s) => s.id)).toEqual(['slot-1', 'slot-2']);
    expect(day.totals).toEqual({ kcal: 0, carbs: 0, protein: 0, fat: 0 });
  });

  it('passes the snapshotted mealName straight through (no live Meal read)', async () => {
    const entries = [
      { ...ENTRY, id: 'm1', mealSlotId: 'slot-1', mealId: 'meal-1', mealName: 'Overnight Oats' },
      { ...ENTRY, id: 'm2', mealSlotId: 'slot-1', mealId: 'meal-1', mealName: 'Overnight Oats' },
      { ...ENTRY, id: 's1', mealSlotId: 'slot-1', mealId: null, mealName: null },
    ];
    const { service, prisma } = makeService({ slots, entries });

    const day = await service.getDay('user-1', '2026-09-07');

    // The day is built from entries and slots only (ADR-0002) -- no join to Meal.
    expect(prisma).not.toHaveProperty('meal');
    const fruehstueck = day.slots.find((s) => s.id === 'slot-1')!;
    expect(fruehstueck.entries.map((e) => e.mealName)).toEqual([
      'Overnight Oats',
      'Overnight Oats',
      null,
    ]);
  });
});

const FOOD = {
  id: 'food-oats',
  name: 'Haferflocken',
  isLiquid: false,
  kcal: 372,
  carbs: 58.7,
  protein: 13.5,
  fat: 7,
};
const OAT_DRINK = {
  id: 'food-oatdrink',
  name: 'Haferdrink',
  isLiquid: true,
  kcal: 59,
  carbs: 6.5,
  protein: 1,
  fat: 3,
};

function batchDto(items: { foodId: string; grams: number; quantityLabel?: string }[]) {
  return { mealSlotId: 'slot-1', localDate: '2026-09-07', items };
}

// What the injected MealsService.findById returns: a resolved meal, per 1x, with each
// ingredient's live per-100 values. `createFromMeal` scales these by `quantity * factor`.
const MEAL_DETAIL = {
  id: 'meal-1',
  name: 'Overnight Oats',
  createdById: 'user-2',
  editable: false,
  deleted: false,
  totals: { kcal: 245, carbs: 25.1, protein: 6.4, fat: 3.8 },
  items: [
    {
      id: 'mi-1',
      foodId: 'food-oats',
      order: 1,
      quantity: 40,
      foodName: 'Haferflocken',
      isLiquid: false,
      deleted: false,
      per100: { kcal: 372, carbs: 58.7, protein: 13.5, fat: 7 },
      portions: [{ label: '1 Portion', grams: 40, order: 1, isDefault: true }],
    },
    {
      id: 'mi-2',
      foodId: 'food-oatdrink',
      order: 2,
      quantity: 200,
      foodName: 'Haferdrink',
      isLiquid: true,
      deleted: true,
      per100: { kcal: 59, carbs: 6.5, protein: 1, fat: 3 },
      portions: [],
    },
  ],
};

function mealDto(overrides: Partial<{ factor: number; mealSlotId: string }> = {}) {
  return {
    mealSlotId: overrides.mealSlotId ?? 'slot-1',
    localDate: '2026-09-07',
    mealId: 'meal-1',
    factor: overrides.factor ?? 1,
  };
}

describe('DiaryEntriesService.createFromMeal — expansion', () => {
  it('writes one entry per ingredient, each carrying the meal id as a grouping tag', async () => {
    const { service, prisma } = makeService();

    const result = await service.createFromMeal('user-1', mealDto());

    expect(prisma.diaryEntry.createMany).toHaveBeenCalledTimes(1);
    const rows = prisma.diaryEntry.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.mealId === 'meal-1')).toBe(true);
    // The meal name is snapshotted onto every ingredient entry (ADR-0002).
    expect(rows.every((r) => r.mealName === 'Overnight Oats')).toBe(true);
    expect(rows.map((r) => r.name)).toEqual(['Haferflocken', 'Haferdrink']);
    expect(rows.map((r) => r.foodId)).toEqual(['food-oats', 'food-oatdrink']);
    expect(result).toEqual({ count: 2 });
  });

  it('snapshots each ingredient from its live per-100 values, scaled by quantity (factor 1)', async () => {
    const { service, prisma } = makeService();

    await service.createFromMeal('user-1', mealDto({ factor: 1 }));

    const [oats, drink] = prisma.diaryEntry.createMany.mock.calls[0][0].data;
    expect(oats).toMatchObject({ quantity: 40, quantityLabel: '40 g' });
    expect(oats.kcal).toBeCloseTo(148.8, 6); // 372 * 40 / 100
    expect(oats.carbs).toBeCloseTo(23.48, 6);
    expect(drink).toMatchObject({ quantity: 200, quantityLabel: '200 ml' });
    expect(drink.kcal).toBeCloseTo(118, 6); // 59 * 200 / 100
  });

  it('multiplies every ingredient amount and nutrient by the Faktor (1.5x)', async () => {
    const { service, prisma } = makeService();

    await service.createFromMeal('user-1', mealDto({ factor: 1.5 }));

    const [oats, drink] = prisma.diaryEntry.createMany.mock.calls[0][0].data;
    expect(oats).toMatchObject({ quantity: 60, quantityLabel: '60 g' }); // 40 * 1.5
    expect(oats.kcal).toBeCloseTo(223.2, 6); // 372 * 60 / 100
    expect(drink).toMatchObject({ quantity: 300, quantityLabel: '300 ml' }); // 200 * 1.5
    expect(drink.kcal).toBeCloseTo(177, 6);
  });

  it('still expands an ingredient whose food was soft-deleted', async () => {
    const { service, prisma } = makeService();

    await service.createFromMeal('user-1', mealDto());

    // The second ingredient (deleted food) is present and computed like any other.
    const rows = prisma.diaryEntry.createMany.mock.calls[0][0].data;
    expect(rows[1]).toMatchObject({ foodId: 'food-oatdrink', name: 'Haferdrink' });
    expect(rows[1].kcal).toBeCloseTo(118, 6);
  });

  it('404s (and writes nothing) when the meal does not exist', async () => {
    const { service, prisma } = makeService({ mealDetail: null });

    await expect(service.createFromMeal('user-1', mealDto())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.diaryEntry.createMany).not.toHaveBeenCalled();
  });

  it('404s when the meal has been soft-deleted', async () => {
    const { service, prisma } = makeService({
      mealDetail: { ...MEAL_DETAIL, deleted: true },
    });

    await expect(service.createFromMeal('user-1', mealDto())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.diaryEntry.createMany).not.toHaveBeenCalled();
  });

  it('rejects logging a meal into an archived Abschnitt with a 409', async () => {
    const { service, prisma } = makeService({
      slot: { id: 'slot-1', archivedAt: new Date('2026-01-01') },
    });

    await expect(service.createFromMeal('user-1', mealDto())).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.diaryEntry.createMany).not.toHaveBeenCalled();
  });
});

describe('DiaryEntriesService.createFromFoodBatch — snapshot math', () => {
  it('scales the food\'s per-100 values by grams / 100 (grams case)', async () => {
    const { service, prisma } = makeService({ foods: [FOOD] });

    await service.createFromFoodBatch(
      'user-1',
      batchDto([{ foodId: 'food-oats', grams: 40, quantityLabel: '150 g' }]),
    );

    const [row] = prisma.diaryEntry.createMany.mock.calls[0][0].data;
    expect(row).toMatchObject({
      userId: 'user-1',
      mealSlotId: 'slot-1',
      localDate: '2026-09-07',
      foodId: 'food-oats',
      mealId: null,
      name: 'Haferflocken',
      quantity: 40,
      quantityLabel: '150 g',
    });
    expect(row.kcal).toBeCloseTo(148.8, 6);
    expect(row.carbs).toBeCloseTo(23.48, 6);
    expect(row.protein).toBeCloseTo(5.4, 6);
    expect(row.fat).toBeCloseTo(2.8, 6);
  });

  it('does the same math for a named portion (client resolves it to grams first)', async () => {
    const { service, prisma } = makeService({ foods: [FOOD] });

    await service.createFromFoodBatch(
      'user-1',
      batchDto([{ foodId: 'food-oats', grams: 40, quantityLabel: '1 Portion (40 g)' }]),
    );

    const [row] = prisma.diaryEntry.createMany.mock.calls[0][0].data;
    expect(row.quantityLabel).toBe('1 Portion (40 g)');
    expect(row.kcal).toBeCloseTo(148.8, 6);
  });

  it('treats the amount as millilitres for a liquid food and defaults the label to "N ml"', async () => {
    const { service, prisma } = makeService({ foods: [OAT_DRINK] });

    await service.createFromFoodBatch(
      'user-1',
      batchDto([{ foodId: 'food-oatdrink', grams: 200 }]),
    );

    const [row] = prisma.diaryEntry.createMany.mock.calls[0][0].data;
    expect(row.quantityLabel).toBe('200 ml');
    expect(row.kcal).toBeCloseTo(118, 6);
    expect(row.carbs).toBeCloseTo(13, 6);
  });

  it('commits several items in one createMany call', async () => {
    const { service, prisma } = makeService({ foods: [FOOD, OAT_DRINK] });

    const result = await service.createFromFoodBatch(
      'user-1',
      batchDto([
        { foodId: 'food-oats', grams: 40 },
        { foodId: 'food-oatdrink', grams: 200 },
      ]),
    );

    expect(prisma.diaryEntry.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.diaryEntry.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(result).toEqual({ count: 2 });
  });

  it('404s (and writes nothing) when an item references an unknown food', async () => {
    const { service, prisma } = makeService({ foods: [FOOD] });

    await expect(
      service.createFromFoodBatch(
        'user-1',
        batchDto([
          { foodId: 'food-oats', grams: 40 },
          { foodId: 'food-ghost', grams: 40 },
        ]),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.diaryEntry.createMany).not.toHaveBeenCalled();
  });

  it('rejects the batch when the Abschnitt is archived', async () => {
    const { service } = makeService({
      slot: { id: 'slot-1', archivedAt: new Date('2026-01-01') },
      foods: [FOOD],
    });

    await expect(
      service.createFromFoodBatch('user-1', batchDto([{ foodId: 'food-oats', grams: 40 }])),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('DiaryEntriesService.createEntry — saveAsFood', () => {
  it('creates a USER food from the entered per-100 values and links the entry to it', async () => {
    const { service, prisma } = makeService();

    const result = await service.createEntry(
      'user-1',
      baseCreateDto({ name: 'Overnight Oats', saveAsFood: true }),
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.food.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Overnight Oats',
        source: 'USER',
        createdById: 'user-1',
        isLiquid: false,
        kcal: 540,
        carbs: 48,
        protein: 22,
        fat: 24,
      }),
    });
    expect(prisma.diaryEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ foodId: 'food-new' }),
    });
    expect(result.foodId).toBe('food-new');
  });

  it('leaves foodId null and creates no food when the toggle is off', async () => {
    const { service, prisma } = makeService();

    const result = await service.createEntry('user-1', baseCreateDto());

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.food.create).not.toHaveBeenCalled();
    expect(result.foodId).toBeNull();
  });
});

// "Von einem anderen Tag kopieren" (#151): a previous day's entries are re-snapshotted onto
// the current day. Copies never re-read a Food -- the source entry's stored numbers are what
// gets written (ADR-0002).

const SRC_ENTRY = {
  ...ENTRY,
  localDate: '2026-09-01',
  quantityLabel: '150 g',
  foodId: 'food-7',
};

describe('DiaryEntriesService.listCopySourceDates', () => {
  it('returns the distinct logged days, newest first, minus the excluded day', async () => {
    const { service, prisma } = makeService({
      entries: [{ localDate: '2026-09-06' }, { localDate: '2026-09-03' }],
    });

    const dates = await service.listCopySourceDates('user-1', '2026-09-07');

    expect(prisma.diaryEntry.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', localDate: { not: '2026-09-07' } },
      distinct: ['localDate'],
      select: { localDate: true },
      orderBy: { localDate: 'desc' },
    });
    expect(dates).toEqual(['2026-09-06', '2026-09-03']);
  });

  it('omits the localDate filter when no day is excluded', async () => {
    const { service, prisma } = makeService({ entries: [] });

    await service.listCopySourceDates('user-1');

    expect(prisma.diaryEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    );
  });
});

describe('DiaryEntriesService.copySlot — one Abschnitt from another day', () => {
  it('re-snapshots every source entry into the same slot on the target day', async () => {
    const { service, prisma } = makeService({
      entries: [
        { ...SRC_ENTRY, id: 's1', name: 'Porridge', kcal: 300, carbs: 40, protein: 10, fat: 6 },
        { ...SRC_ENTRY, id: 's2', name: 'Kaffee', kcal: 8, carbs: 0, protein: 0, fat: 0 },
      ],
    });

    const result = await service.copySlot('user-1', {
      fromDate: '2026-09-01',
      toDate: '2026-09-07',
      mealSlotId: 'slot-1',
    });

    expect(prisma.diaryEntry.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', localDate: '2026-09-01', mealSlotId: 'slot-1' },
      orderBy: { createdAt: 'asc' },
    });
    const written = prisma.diaryEntry.createMany.mock.calls[0][0].data;
    expect(written).toEqual([
      expect.objectContaining({
        userId: 'user-1',
        mealSlotId: 'slot-1',
        localDate: '2026-09-07',
        name: 'Porridge',
        quantity: 1,
        quantityLabel: '150 g',
        foodId: 'food-7',
        kcal: 300,
        carbs: 40,
        protein: 10,
        fat: 6,
      }),
      expect.objectContaining({ name: 'Kaffee', localDate: '2026-09-07' }),
    ]);
    expect(result).toEqual({ count: 2 });
  });

  it('keeps mealId / mealName so a copied Mahlzeit stays grouped', async () => {
    const { service, prisma } = makeService({
      entries: [
        { ...SRC_ENTRY, id: 'm1', mealId: 'meal-9', mealName: 'Overnight Oats' },
        { ...SRC_ENTRY, id: 'm2', mealId: 'meal-9', mealName: 'Overnight Oats' },
      ],
    });

    await service.copySlot('user-1', {
      fromDate: '2026-09-01',
      toDate: '2026-09-07',
      mealSlotId: 'slot-1',
    });

    const written = prisma.diaryEntry.createMany.mock.calls[0][0].data;
    expect(written.map((e) => [e.mealId, e.mealName])).toEqual([
      ['meal-9', 'Overnight Oats'],
      ['meal-9', 'Overnight Oats'],
    ]);
  });

  it('is a no-op (count 0) when that Abschnitt was empty on the source day', async () => {
    const { service, prisma } = makeService({ entries: [] });

    const result = await service.copySlot('user-1', {
      fromDate: '2026-09-01',
      toDate: '2026-09-07',
      mealSlotId: 'slot-1',
    });

    expect(result).toEqual({ count: 0 });
    expect(prisma.diaryEntry.createMany).not.toHaveBeenCalled();
  });

  it('rejects a copy into an archived Abschnitt (read-only) and writes nothing', async () => {
    const { service, prisma } = makeService({
      slot: { id: 'slot-1', archivedAt: new Date('2026-01-01') },
      entries: [{ ...SRC_ENTRY }],
    });

    await expect(
      service.copySlot('user-1', {
        fromDate: '2026-09-01',
        toDate: '2026-09-07',
        mealSlotId: 'slot-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.diaryEntry.createMany).not.toHaveBeenCalled();
  });

  it("404s on another user's Abschnitt", async () => {
    const { service } = makeService({ slot: null, entries: [{ ...SRC_ENTRY }] });

    await expect(
      service.copySlot('user-1', {
        fromDate: '2026-09-01',
        toDate: '2026-09-07',
        mealSlotId: 'not-mine',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects copying a day onto itself', async () => {
    const { service } = makeService();

    await expect(
      service.copySlot('user-1', {
        fromDate: '2026-09-07',
        toDate: '2026-09-07',
        mealSlotId: 'slot-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('DiaryEntriesService.copyDay — the whole day', () => {
  const slots = [
    { id: 'slot-1', archivedAt: null },
    { id: 'slot-2', archivedAt: null },
    { id: 'slot-archived', archivedAt: new Date('2026-01-01') },
  ];

  it('maps each entry to the current Abschnitt by slot id', async () => {
    const { service, prisma, mealSlots } = makeService({
      slots,
      entries: [
        { ...SRC_ENTRY, id: 'a', mealSlotId: 'slot-1' },
        { ...SRC_ENTRY, id: 'b', mealSlotId: 'slot-2' },
      ],
    });

    const result = await service.copyDay('user-1', {
      fromDate: '2026-09-01',
      toDate: '2026-09-07',
    });

    expect(mealSlots.ensureActiveSlot).not.toHaveBeenCalled();
    const written = prisma.diaryEntry.createMany.mock.calls[0][0].data;
    expect(written.map((e) => [e.mealSlotId, e.localDate])).toEqual([
      ['slot-1', '2026-09-07'],
      ['slot-2', '2026-09-07'],
    ]);
    expect(result).toEqual({ count: 2 });
  });

  it('redirects entries from an archived Abschnitt into a visible "Sonstiges"', async () => {
    const { service, prisma, mealSlots } = makeService({
      slots,
      entries: [
        { ...SRC_ENTRY, id: 'a', mealSlotId: 'slot-1' },
        { ...SRC_ENTRY, id: 'c', mealSlotId: 'slot-archived' },
      ],
      fallbackSlot: { id: 'slot-sonstiges', name: 'Sonstiges', order: 3, archived: false },
    });

    await service.copyDay('user-1', { fromDate: '2026-09-01', toDate: '2026-09-07' });

    expect(mealSlots.ensureActiveSlot).toHaveBeenCalledWith('user-1', 'Sonstiges');
    const written = prisma.diaryEntry.createMany.mock.calls[0][0].data;
    expect(written.map((e) => e.mealSlotId)).toEqual([
      'slot-1',
      'slot-sonstiges',
    ]);
  });

  it('does not create "Sonstiges" when no entry needs it', async () => {
    const { service, mealSlots } = makeService({
      slots,
      entries: [{ ...SRC_ENTRY, mealSlotId: 'slot-2' }],
    });

    await service.copyDay('user-1', { fromDate: '2026-09-01', toDate: '2026-09-07' });

    expect(mealSlots.ensureActiveSlot).not.toHaveBeenCalled();
  });

  it('is a no-op (count 0) when the source day is empty', async () => {
    const { service, prisma } = makeService({ slots, entries: [] });

    const result = await service.copyDay('user-1', {
      fromDate: '2026-09-01',
      toDate: '2026-09-07',
    });

    expect(result).toEqual({ count: 0 });
    expect(prisma.diaryEntry.createMany).not.toHaveBeenCalled();
  });

  it('rejects copying a day onto itself', async () => {
    const { service } = makeService({ slots });

    await expect(
      service.copyDay('user-1', { fromDate: '2026-09-07', toDate: '2026-09-07' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
