import { NotFoundException } from '@nestjs/common';
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
} = {}) {
  const prisma = {
    mealSlot: {
      findFirst: jest.fn().mockResolvedValue(
        'slot' in overrides ? overrides.slot : { id: 'slot-1' },
      ),
      findMany: jest.fn().mockResolvedValue(overrides.slots ?? []),
    },
    diaryEntry: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ...ENTRY,
        ...data,
      })),
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
  };
  return { service: new DiaryEntriesService(prisma as never), prisma };
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
      select: { id: true },
    });
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
});
