import { importOffProducts, OffImportClient } from './off-import';
import { MappedFood } from './off-mapping';

/**
 * The Open Food Facts importer (#146). Upserts mapped products by barcode as
 * OPEN_FOOD_FACTS foods, in batches, idempotently. The barcode is globally unique across
 * every source, so the rule that matters most is that a barcode already owned by a user's
 * own food or by a curated seed row is never overwritten.
 */

function mapped(overrides: Partial<MappedFood> = {}): MappedFood {
  return {
    barcode: '4025500287955',
    name: 'Kalinka Kefir Fettarm Mild Pur',
    brand: 'müller',
    isLiquid: true,
    kcal: 46,
    carbs: 4.1,
    protein: 3.4,
    fat: 1.5,
    portions: [{ label: '1 Portion', grams: 500, isDefault: true }],
    ...overrides,
  };
}

/** In-memory stand-in for the database, keyed by barcode like the real unique index. */
function fakeDb(existing: Record<string, unknown>[] = []) {
  const rows = new Map(existing.map((r) => [r.barcode as string, { ...r }]));
  const client = {
    rows,
    food: {
      findMany: async ({ where }: { where: { barcode: { in: string[] } } }) =>
        where.barcode.in.flatMap((b) => (rows.has(b) ? [rows.get(b)] : [])),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { ...data, portions: (data.portions as { create: unknown[] })?.create ?? [] };
        rows.set(data.barcode as string, row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = [...rows.values()].find((r) => (r as { id: string }).id === where.id) as Record<
          string,
          unknown
        >;
        Object.assign(row, data, {
          portions: (data.portions as { create?: unknown[] })?.create ?? row.portions,
        });
        return row;
      },
    },
  };
  return client as typeof client & OffImportClient;
}

describe('importOffProducts', () => {
  it('creates new products as read-only OPEN_FOOD_FACTS foods with a sync timestamp', async () => {
    const db = fakeDb();
    const now = new Date('2026-09-08T12:00:00Z');

    const stats = await importOffProducts(db, [mapped()], { now });

    expect(stats).toMatchObject({ created: 1, updated: 0, skipped: 0 });
    expect(db.rows.get('4025500287955')).toMatchObject({
      barcode: '4025500287955',
      name: 'Kalinka Kefir Fettarm Mild Pur',
      brand: 'müller',
      isLiquid: true,
      kcal: 46,
      source: 'OPEN_FOOD_FACTS',
      createdById: null,
      lastSyncedAt: now,
      portions: [{ label: '1 Portion', grams: 500, order: 1, isDefault: true }],
    });
  });
});

describe('importOffProducts — re-running', () => {
  it('updates the existing row in place instead of duplicating it', async () => {
    const db = fakeDb();
    await importOffProducts(db, [mapped()], { now: new Date('2026-09-01T00:00:00Z') });

    const stats = await importOffProducts(
      db,
      [mapped({ name: 'Kalinka Kefir Fettarm Mild', kcal: 48, portions: [] })],
      { now: new Date('2026-09-08T00:00:00Z') },
    );

    expect(stats).toMatchObject({ created: 0, updated: 1, skipped: 0 });
    expect(db.rows.size).toBe(1);
    expect(db.rows.get('4025500287955')).toMatchObject({
      name: 'Kalinka Kefir Fettarm Mild',
      kcal: 48,
      lastSyncedAt: new Date('2026-09-08T00:00:00Z'),
      portions: [],
    });
  });
});

describe('importOffProducts — foods it does not own', () => {
  it.each([['USER'], ['SEED']])(
    'leaves a %s food holding the same barcode untouched',
    async (source) => {
      const db = fakeDb([
        {
          id: 'existing-1',
          barcode: '4025500287955',
          source,
          name: 'Mein Kefir',
          kcal: 999,
          createdById: source === 'USER' ? 'user-1' : null,
        },
      ]);

      const stats = await importOffProducts(db, [mapped()]);

      expect(stats).toMatchObject({ created: 0, updated: 0, skipped: 1 });
      expect(db.rows.get('4025500287955')).toMatchObject({
        source,
        name: 'Mein Kefir',
        kcal: 999,
      });
    },
  );
});

describe('importOffProducts — batching a streamed source', () => {
  async function* stream(products: MappedFood[]) {
    for (const product of products) yield product;
  }

  const five = [
    '4025500287955',
    '4004480000013',
    '4000521006549',
    '4008400202037',
    '4011800296001',
  ].map((barcode, i) => mapped({ barcode, name: `Produkt ${i + 1}`, portions: [] }));

  it('imports every product from an async source', async () => {
    const db = fakeDb();

    const stats = await importOffProducts(db, stream(five), { batchSize: 2 });

    expect(stats).toMatchObject({ created: 5, updated: 0, skipped: 0 });
    expect(db.rows.size).toBe(5);
    expect(db.rows.get('4011800296001')).toMatchObject({ name: 'Produkt 5' });
  });

  it('looks the batch up in one query per batch rather than one per product', async () => {
    const db = fakeDb();
    const lookups = jest.spyOn(db.food, 'findMany');

    await importOffProducts(db, stream(five), { batchSize: 2 });

    // 5 products at a batch size of 2 is three batches, so three lookups -- not five.
    expect(lookups).toHaveBeenCalledTimes(3);
  });
});
