import * as fs from 'fs';
import * as path from 'path';
import { parseFoodsCsv } from './foods-seed';
import {
  FOOD_TRANSLATIONS_CSV_HEADER as HEADER,
  parseFoodTranslationsCsv,
  seedFoodTranslations,
} from './food-translations-seed';

describe('parseFoodTranslationsCsv', () => {
  it('maps a key to its English name and portion labels', () => {
    const csv = [HEADER, 'olivenoel;Olive oil;1 tablespoon|1 teaspoon', 'feta;Feta;', ''].join(
      '\n',
    );
    expect(parseFoodTranslationsCsv(csv)).toEqual(
      new Map([
        ['olivenoel', { name: 'Olive oil', portions: ['1 tablespoon', '1 teaspoon'] }],
        ['feta', { name: 'Feta', portions: [] }],
      ]),
    );
  });

  it('rejects a wrong header, a short row and a duplicate key with the line number', () => {
    expect(() => parseFoodTranslationsCsv('nope\n')).toThrow(/header/);
    expect(() => parseFoodTranslationsCsv(`${HEADER}\nfeta;Feta`)).toThrow(/line 2/);
    expect(() => parseFoodTranslationsCsv(`${HEADER}\nfeta;Feta;\nfeta;Feta;`)).toThrow(/line 3/);
  });
});

describe('FoodsSeed-en.csv', () => {
  const root = path.join(__dirname, '../../../..');
  it('covers every FoodsSeed.csv food with one label per portion', () => {
    const german = parseFoodsCsv(fs.readFileSync(path.join(root, 'FoodsSeed.csv'), 'utf-8'));
    const english = parseFoodTranslationsCsv(
      fs.readFileSync(path.join(root, 'FoodsSeed-en.csv'), 'utf-8'),
    );
    expect(english.size).toBe(german.length);
    for (const food of german) {
      expect(english.get(food.seedKey)?.portions).toHaveLength(food.portions.length);
    }
  });
});

describe('seedFoodTranslations', () => {
  type Row = {
    id: string;
    seedKey: string;
    name: string;
    portions: { id: string; label: string }[];
  };
  const apfel: Row = {
    id: 'f1',
    seedKey: 'apfel',
    name: 'Apfel',
    portions: [{ id: 'p1', label: '1 Stück' }],
  };

  function fakePrisma(foods: Row[]) {
    const food = new Map<string, string>();
    const portion = new Map<string, string>();
    return {
      food,
      portion,
      client: {
        food: { findMany: jest.fn().mockResolvedValue(foods) },
        foodTranslation: {
          upsert: jest.fn(
            async ({ create }) => void food.set(`${create.foodId}:${create.locale}`, create.name),
          ),
          count: jest.fn(
            async ({ where }) =>
              [...food.keys()].filter((k) => k.endsWith(`:${where.locale}`)).length,
          ),
        },
        foodPortionTranslation: {
          upsert: jest.fn(
            async ({ create }) =>
              void portion.set(`${create.portionId}:${create.locale}`, create.label),
          ),
          count: jest.fn(
            async ({ where }) =>
              [...portion.keys()].filter((k) => k.endsWith(`:${where.locale}`)).length,
          ),
        },
      },
    };
  }

  it('writes de from the stored rows and en from the CSV, for foods and portions', async () => {
    const fake = fakePrisma([apfel]);
    const en = new Map([['apfel', { name: 'Apple', portions: ['1 piece'] }]]);

    expect(await seedFoodTranslations(fake.client as never, en)).toBe(1);

    expect(Object.fromEntries(fake.food)).toEqual({ 'f1:DE': 'Apfel', 'f1:EN': 'Apple' });
    expect(Object.fromEntries(fake.portion)).toEqual({ 'p1:DE': '1 Stück', 'p1:EN': '1 piece' });
  });

  it('fails when a SEED food has no English row', async () => {
    const fake = fakePrisma([apfel]);
    await expect(seedFoodTranslations(fake.client as never, new Map())).rejects.toThrow(/apfel/);
  });

  it('fails when the English portion labels do not line up with the stored portions', async () => {
    const fake = fakePrisma([apfel]);
    const en = new Map([['apfel', { name: 'Apple', portions: [] as string[] }]]);
    await expect(seedFoodTranslations(fake.client as never, en)).rejects.toThrow(/apfel/);
  });
});
