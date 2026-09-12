import {
  FOODS_CSV_HEADER as HEADER,
  parseFoodsCsv,
  seedFoods,
  SeedFood,
  SeedFoodsClient,
} from './foods-seed';

/**
 * The generic-food seed (#145): FoodsSeed.csv at the repo root is parsed into SEED foods
 * and upserted by the stable `seedKey`, so re-running updates rows instead of duplicating.
 */

describe('parseFoodsCsv', () => {
  it('turns a row into a per-100 food with its portions, first portion default', () => {
    const csv = [
      HEADER,
      'olivenoel;Olivenöl;Fette & Öle;false;884;0.0;0.0;99.6;1 Esslöffel=10|1 Teelöffel=5;USDA FDC 171413',
    ].join('\n');

    expect(parseFoodsCsv(csv)).toEqual([
      {
        seedKey: 'olivenoel',
        name: 'Olivenöl',
        isLiquid: false,
        kcal: 884,
        carbs: 0,
        protein: 0,
        fat: 99.6,
        portions: [
          { label: '1 Esslöffel', grams: 10, isDefault: true },
          { label: '1 Teelöffel', grams: 5, isDefault: false },
        ],
      },
    ]);
  });
});

describe('parseFoodsCsv — file shape', () => {
  it('handles a liquid row, an empty portions field, BOM, CRLF and a trailing newline', () => {
    const csv =
      '﻿' +
      [
        HEADER,
        'vollmilch-3-5;Vollmilch 3,5 %;Milchprodukte;true;64;4.8;3.3;3.6;1 Glas=200;BLS',
        'haehnchenbrust-roh;Hähnchenbrust, roh;Fleisch & Wurst;false;106;0.0;24.0;1.3;;USDA FDC 171077',
        '',
      ].join('\r\n');

    const foods = parseFoodsCsv(csv);

    expect(foods.map((f) => [f.seedKey, f.isLiquid, f.portions])).toEqual([
      ['vollmilch-3-5', true, [{ label: '1 Glas', grams: 200, isDefault: true }]],
      ['haehnchenbrust-roh', false, []],
    ]);
  });
});

describe('parseFoodsCsv — rejects malformed input', () => {
  const row = (fields: string) =>
    [HEADER, 'apfel;Apfel;Obst;false;52;11.4;0.3;0.2;;BLS', fields].join('\n');

  it.each([
    ['wrong column count', 'banane;Banane;Obst;false;89;20.2;1.1', /line 3/],
    ['non-numeric kcal', 'banane;Banane;Obst;false;viel;20.2;1.1;0.3;;BLS', /line 3.*kcal/],
    ['negative macro', 'banane;Banane;Obst;false;89;-1;1.1;0.3;;BLS', /line 3.*carbs/],
    [
      'key that is not kebab-case ascii',
      'Banane!;Banane;Obst;false;89;20.2;1.1;0.3;;BLS',
      /line 3.*key/,
    ],
    [
      'isLiquid other than true/false',
      'banane;Banane;Obst;ja;89;20.2;1.1;0.3;;BLS',
      /line 3.*isLiquid/,
    ],
    [
      'portion without a weight',
      'banane;Banane;Obst;false;89;20.2;1.1;0.3;1 Stück;BLS',
      /line 3.*portion/,
    ],
    [
      'zero portion weight (the API rejects it too)',
      'banane;Banane;Obst;false;89;20.2;1.1;0.3;1 Stück=0;BLS',
      /line 3.*portion/,
    ],
    [
      'duplicate key',
      'apfel;Apfel, geschält;Obst;false;52;11.4;0.3;0.2;;BLS',
      /line 3.*duplicate.*apfel/,
    ],
  ])('rejects a row with %s', (_label, fields, message) => {
    expect(() => parseFoodsCsv(row(fields))).toThrow(message);
  });

  it('rejects a file whose header is not the expected one', () => {
    expect(() => parseFoodsCsv('id;name\n1;Apfel')).toThrow(/header/);
  });
});

/**
 * In-memory stand-in for the two Prisma calls the seed uses (the database is the boundary
 * here). `upsert` keys rows by `seedKey` and rewrites nested portions the way Prisma does
 * for `{ deleteMany: {}, create: [...] }`.
 */
function fakePrisma() {
  const rows = new Map<string, Record<string, unknown>>();
  return {
    rows,
    food: {
      findMany: async ({ where }: { where: { seedKey: { in: string[] } } }) =>
        where.seedKey.in.filter((k) => rows.has(k)).map((k) => ({ seedKey: k })),
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { seedKey: string };
        create: Record<string, unknown> & { portions?: { create: unknown[] } };
        update: Record<string, unknown> & { portions?: { deleteMany: object; create: unknown[] } };
      }) => {
        const existing = rows.get(where.seedKey);
        const next = existing
          ? { ...existing, ...update, portions: update.portions?.create ?? existing.portions }
          : { ...create, portions: create.portions?.create ?? [] };
        rows.set(where.seedKey, next);
        return next;
      },
    },
  };
}

describe('seedFoods', () => {
  const apfel: SeedFood = {
    seedKey: 'apfel-mit-schale',
    name: 'Apfel, mit Schale',
    isLiquid: false,
    kcal: 52,
    carbs: 11.4,
    protein: 0.3,
    fat: 0.2,
    portions: [{ label: '1 Stück', grams: 130, isDefault: true }],
  };

  it('creates SEED foods with their portions and no creator', async () => {
    const prisma = fakePrisma();

    const result = await seedFoods(prisma as unknown as SeedFoodsClient, [apfel]);

    expect(result).toEqual({ created: 1, updated: 0 });
    expect(prisma.rows.get('apfel-mit-schale')).toMatchObject({
      name: 'Apfel, mit Schale',
      source: 'SEED',
      createdById: null,
      kcal: 52,
      portions: [{ label: '1 Stück', grams: 130, order: 1, isDefault: true }],
    });
  });

  it('re-running with changed values updates the row in place instead of duplicating', async () => {
    const prisma = fakePrisma();
    await seedFoods(prisma as unknown as SeedFoodsClient, [apfel]);

    const result = await seedFoods(prisma as unknown as SeedFoodsClient, [
      {
        ...apfel,
        name: 'Apfel, mit Schale (BLS)',
        kcal: 54,
        portions: [
          { label: '1 Stück', grams: 125, isDefault: true },
          { label: '1 Portion', grams: 250, isDefault: false },
        ],
      },
    ]);

    expect(result).toEqual({ created: 0, updated: 1 });
    expect(prisma.rows.size).toBe(1);
    expect(prisma.rows.get('apfel-mit-schale')).toMatchObject({
      name: 'Apfel, mit Schale (BLS)',
      kcal: 54,
      portions: [
        { label: '1 Stück', grams: 125, order: 1, isDefault: true },
        { label: '1 Portion', grams: 250, order: 2, isDefault: false },
      ],
    });
  });
});
