import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  MealSlotsService,
  DEFAULT_MEAL_SLOT_NAMES,
  defaultMealSlotCreateData,
  assertContiguousOrder,
} from './meal-slots.service';

type Row = { id: string; userId: string; name: string; order: number; archivedAt: Date | null };

/**
 * A small stateful Prisma-for-MealSlot mock so the specs can assert the resulting rows rather
 * than a sequence of write calls. `$transaction` runs its ops in order like the real array
 * form; `update` mutates in place, which matches the real net effect of the two-pass renumber.
 */
function makeStore(initial: Array<Partial<Row> & { id: string; name: string; order: number }>) {
  const rows: Row[] = initial.map((r) => ({
    userId: 'user-1',
    archivedAt: null,
    ...r,
  }));
  let seq = 0;

  const matches = (row: Row, where: Record<string, unknown> = {}): boolean => {
    if (where.id !== undefined && row.id !== where.id) return false;
    if (where.userId !== undefined && row.userId !== where.userId) return false;
    if (where.name !== undefined && row.name !== where.name) return false;
    if (where.archivedAt === null && row.archivedAt !== null) return false;
    if (
      where.archivedAt &&
      typeof where.archivedAt === 'object' &&
      'not' in (where.archivedAt as object) &&
      row.archivedAt === null
    ) {
      return false;
    }
    return true;
  };

  const prisma = {
    mealSlot: {
      findMany: jest.fn(async ({ where, orderBy }: any = {}) => {
        let out = rows.filter((r) => matches(r, where));
        if (orderBy?.order === 'asc') out = [...out].sort((a, b) => a.order - b.order);
        return out.map((r) => ({ ...r }));
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        const r = rows.find((x) => matches(x, where));
        return r ? { ...r } : null;
      }),
      count: jest.fn(async ({ where }: any) => rows.filter((r) => matches(r, where)).length),
      create: jest.fn(async ({ data }: any) => {
        const row: Row = {
          id: data.id ?? `new-${++seq}`,
          userId: data.userId,
          name: data.name,
          order: data.order,
          archivedAt: data.archivedAt ?? null,
        };
        rows.push(row);
        return { ...row };
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const r = rows.find((x) => x.id === where.id);
        if (!r) throw new Error(`no row ${where.id}`);
        Object.assign(r, data);
        return { ...r };
      }),
      createMany: jest.fn(async () => ({ count: 0 })),
    },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };

  return { service: new MealSlotsService(prisma as never), prisma, rows };
}

const snapshot = (rows: Row[]) =>
  [...rows]
    .sort((a, b) => a.order - b.order)
    .map((r) => `${r.order}:${r.name}${r.archivedAt ? '(arch)' : ''}`);

/**
 * Every user's eating day starts divided into four Abschnitte (Frühstück, Mittagessen,
 * Abendessen, Snacks). Their `order` is 1-based and contiguous within the user -- the same
 * invariant `WorkoutDay.order` carries -- and one shared definition feeds both the
 * registration path and the existing-user backfill so the two cannot diverge.
 */
describe('defaultMealSlotCreateData — order invariant', () => {
  it('lists the four defaults in the documented display order', () => {
    expect(defaultMealSlotCreateData().map((s) => s.name)).toEqual([
      'Frühstück',
      'Mittagessen',
      'Abendessen',
      'Snacks',
    ]);
    expect(DEFAULT_MEAL_SLOT_NAMES).toHaveLength(4);
  });

  it('numbers them 1-based, contiguous, matching array position', () => {
    const rows = defaultMealSlotCreateData();
    rows.forEach((row, index) => expect(row.order).toBe(index + 1));
    expect(rows.map((r) => r.order)).toEqual([1, 2, 3, 4]);
  });

  it('returns a fresh array each call (no shared mutable state)', () => {
    const first = defaultMealSlotCreateData();
    first[0].order = 99;
    expect(defaultMealSlotCreateData()[0].order).toBe(1);
  });
});

describe('MealSlotsService.createDefaultsForUser', () => {
  function makeService() {
    const prisma = {
      mealSlot: { createMany: jest.fn().mockResolvedValue({ count: 4 }) },
    };
    return { service: new MealSlotsService(prisma as never), prisma };
  }

  it('inserts the four defaults for the given user with contiguous 1-based order', async () => {
    const { service, prisma } = makeService();

    await service.createDefaultsForUser('user-1');

    expect(prisma.mealSlot.createMany).toHaveBeenCalledWith({
      data: [
        { name: 'Frühstück', order: 1, userId: 'user-1' },
        { name: 'Mittagessen', order: 2, userId: 'user-1' },
        { name: 'Abendessen', order: 3, userId: 'user-1' },
        { name: 'Snacks', order: 4, userId: 'user-1' },
      ],
    });
  });
});

const FOUR = () => [
  { id: 'f', name: 'Frühstück', order: 1 },
  { id: 'm', name: 'Mittagessen', order: 2 },
  { id: 'a', name: 'Abendessen', order: 3 },
  { id: 's', name: 'Snacks', order: 4 },
];

describe('assertContiguousOrder — the workout-tree order rule', () => {
  it('passes a 1-based contiguous list that matches array position', () => {
    expect(() =>
      assertContiguousOrder([{ order: 1 }, { order: 2 }, { order: 3 }]),
    ).not.toThrow();
  });

  it('rejects an order that disagrees with its position (400)', () => {
    expect(() => assertContiguousOrder([{ order: 2 }, { order: 1 }])).toThrow(
      BadRequestException,
    );
    expect(() => assertContiguousOrder([{ order: 1 }, { order: 3 }])).toThrow(
      BadRequestException,
    );
    expect(() => assertContiguousOrder([{ order: 0 }])).toThrow(BadRequestException);
  });
});

describe('MealSlotsService.ensureActiveSlot — the whole-day-copy fallback (#151)', () => {
  it('returns the existing active slot of that name without creating one', async () => {
    const { service, rows } = makeStore([
      ...FOUR(),
      { id: 'x', name: 'Sonstiges', order: 5 },
    ]);

    const slot = await service.ensureActiveSlot('user-1', 'Sonstiges');

    expect(slot).toMatchObject({ id: 'x', name: 'Sonstiges', archived: false });
    expect(snapshot(rows)).toHaveLength(5);
  });

  it('creates and appends the slot when the user has none by that name', async () => {
    const { service, rows } = makeStore(FOUR());

    const slot = await service.ensureActiveSlot('user-1', 'Sonstiges');

    expect(slot).toMatchObject({ name: 'Sonstiges', order: 5, archived: false });
    expect(snapshot(rows)).toEqual([
      '1:Frühstück',
      '2:Mittagessen',
      '3:Abendessen',
      '4:Snacks',
      '5:Sonstiges',
    ]);
  });

  it('does not reuse an archived slot of that name -- the fallback must be visible', async () => {
    const { service, rows } = makeStore([
      { id: 'f', name: 'Frühstück', order: 1 },
      { id: 'z', name: 'Sonstiges', order: 2, archivedAt: new Date('2026-01-01') },
    ]);

    const slot = await service.ensureActiveSlot('user-1', 'Sonstiges');

    expect(slot.archived).toBe(false);
    expect(slot.id).not.toBe('z');
    expect(snapshot(rows)).toEqual(['1:Frühstück', '2:Sonstiges', '3:Sonstiges(arch)']);
  });
});

describe('MealSlotsService.create — appends after the active Abschnitte', () => {
  it('adds the new slot at the end of the active order', async () => {
    const { service, rows } = makeStore(FOUR());

    const created = await service.create('user-1', 'Zweites Frühstück');

    expect(created).toMatchObject({ name: 'Zweites Frühstück', order: 5, archived: false });
    expect(snapshot(rows)).toEqual([
      '1:Frühstück',
      '2:Mittagessen',
      '3:Abendessen',
      '4:Snacks',
      '5:Zweites Frühstück',
    ]);
  });

  it('keeps archived slots numbered after the (now longer) active run', async () => {
    const { service, rows } = makeStore([
      { id: 'f', name: 'Frühstück', order: 1 },
      { id: 'm', name: 'Mittagessen', order: 2 },
      { id: 'z', name: 'Zweites Frühstück', order: 3, archivedAt: new Date('2026-01-01') },
    ]);

    await service.create('user-1', 'Pre-Workout');

    expect(snapshot(rows)).toEqual([
      '1:Frühstück',
      '2:Mittagessen',
      '3:Pre-Workout',
      '4:Zweites Frühstück(arch)',
    ]);
  });
});

describe('MealSlotsService.setArchived — archive semantics', () => {
  it('closing the gap: archiving a middle slot renumbers the rest 1..n-1', async () => {
    const { service, rows } = makeStore(FOUR());

    await service.setArchived('user-1', 'm', true);

    expect(snapshot(rows)).toEqual([
      '1:Frühstück',
      '2:Abendessen',
      '3:Snacks',
      '4:Mittagessen(arch)',
    ]);
  });

  it('unarchiving appends the slot to the end of the active order', async () => {
    const { service, rows } = makeStore([
      { id: 'f', name: 'Frühstück', order: 1 },
      { id: 'm', name: 'Mittagessen', order: 2 },
      { id: 'a', name: 'Abendessen', order: 3 },
      { id: 'z', name: 'Zweites Frühstück', order: 4, archivedAt: new Date('2026-01-01') },
    ]);

    const result = await service.setArchived('user-1', 'z', false);

    expect(result).toMatchObject({ name: 'Zweites Frühstück', order: 4, archived: false });
    expect(snapshot(rows)).toEqual([
      '1:Frühstück',
      '2:Mittagessen',
      '3:Abendessen',
      '4:Zweites Frühstück',
    ]);
  });

  it('refuses to archive the last remaining active Abschnitt (409)', async () => {
    const { service, prisma } = makeStore([{ id: 'f', name: 'Frühstück', order: 1 }]);

    await expect(service.setArchived('user-1', 'f', true)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.mealSlot.update).not.toHaveBeenCalled();
  });

  it('is a no-op when the slot is already in the requested state', async () => {
    const { service, prisma } = makeStore([
      { id: 'f', name: 'Frühstück', order: 1 },
      { id: 'z', name: 'Zweites Frühstück', order: 2, archivedAt: new Date('2026-01-01') },
    ]);

    await service.setArchived('user-1', 'z', true);

    expect(prisma.mealSlot.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("404s on another user's slot", async () => {
    const { service } = makeStore([
      { id: 'f', userId: 'someone-else', name: 'Frühstück', order: 1 },
      { id: 'm', name: 'Mittagessen', order: 2 },
    ]);

    await expect(service.setArchived('user-1', 'f', true)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('MealSlotsService.reorder — order invariant', () => {
  it('rejects an order that disagrees with array position (400), writes nothing', async () => {
    const { service, prisma } = makeStore(FOUR());

    await expect(
      service.reorder('user-1', [
        { id: 'm', order: 1 },
        { id: 'f', order: 1 }, // should be 2
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a payload that is not exactly the current active set', async () => {
    const { service } = makeStore(FOUR());

    // missing 's', and includes an unknown id
    await expect(
      service.reorder('user-1', [
        { id: 'f', order: 1 },
        { id: 'm', order: 2 },
        { id: 'a', order: 3 },
        { id: 'ghost', order: 4 },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a duplicate id', async () => {
    const { service } = makeStore(FOUR());

    await expect(
      service.reorder('user-1', [
        { id: 'f', order: 1 },
        { id: 'f', order: 2 },
        { id: 'a', order: 3 },
        { id: 's', order: 4 },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applies the requested active order and leaves archived slots parked after it', async () => {
    const { service, rows } = makeStore([
      ...FOUR(),
      { id: 'z', name: 'Zweites Frühstück', order: 5, archivedAt: new Date('2026-01-01') },
    ]);

    const list = await service.reorder('user-1', [
      { id: 's', order: 1 },
      { id: 'a', order: 2 },
      { id: 'm', order: 3 },
      { id: 'f', order: 4 },
    ]);

    expect(list.active.map((s) => s.name)).toEqual([
      'Snacks',
      'Abendessen',
      'Mittagessen',
      'Frühstück',
    ]);
    expect(snapshot(rows)).toEqual([
      '1:Snacks',
      '2:Abendessen',
      '3:Mittagessen',
      '4:Frühstück',
      '5:Zweites Frühstück(arch)',
    ]);
  });
});

describe('MealSlotsService.rename', () => {
  it('updates the name, scoped to the owner', async () => {
    const { service, rows } = makeStore(FOUR());

    const result = await service.rename('user-1', 'm', 'Lunch');

    expect(result).toMatchObject({ id: 'm', name: 'Lunch', order: 2 });
    expect(rows.find((r) => r.id === 'm')!.name).toBe('Lunch');
  });

  it("404s on another user's slot", async () => {
    const { service } = makeStore([{ id: 'f', userId: 'someone-else', name: 'F', order: 1 }]);

    await expect(service.rename('user-1', 'f', 'X')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('MealSlotsService.list', () => {
  it('splits active (in order) from archived', async () => {
    const { service } = makeStore([
      { id: 'f', name: 'Frühstück', order: 1 },
      { id: 'z', name: 'Zweites Frühstück', order: 3, archivedAt: new Date('2026-01-01') },
      { id: 'm', name: 'Mittagessen', order: 2 },
    ]);

    const list = await service.list('user-1');

    expect(list.active.map((s) => s.name)).toEqual(['Frühstück', 'Mittagessen']);
    expect(list.archived.map((s) => s.name)).toEqual(['Zweites Frühstück']);
    expect(list.active.every((s) => s.archived === false)).toBe(true);
    expect(list.archived[0].archived).toBe(true);
  });
});
