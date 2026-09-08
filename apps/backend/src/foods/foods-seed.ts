/**
 * Generic-food seed (#145). `FoodsSeed.csv` (repo root, `;`-delimited, see
 * FoodsSeed-notes.md) is parsed into SEED foods and upserted by the stable `seedKey`, so
 * re-running the seed updates rows in place instead of duplicating them.
 */

import type { Prisma } from '../../generated/prisma/client';

export type SeedFoodPortion = { label: string; grams: number; isDefault: boolean };

export type SeedFood = {
  seedKey: string;
  name: string;
  isLiquid: boolean;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  portions: SeedFoodPortion[];
};

export const FOODS_CSV_HEADER = 'key;name;category;isLiquid;kcal;carbs;protein;fat;portions;source';

const KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const COLUMN_COUNT = FOODS_CSV_HEADER.split(';').length;

class CsvRowError extends Error {
  constructor(lineNo: number, message: string) {
    super(`FoodsSeed.csv line ${lineNo}: ${message}`);
  }
}

function nonNegativeNumber(field: string, value: string, lineNo: number): number {
  const n = Number(value);
  if (value.trim() === '' || Number.isNaN(n) || n < 0) {
    throw new CsvRowError(lineNo, `${field} must be a non-negative number, got "${value}"`);
  }
  return n;
}

/** `Label=weight|Label=weight`; the first pair is the default portion. Empty = no portions. */
function parsePortions(field: string, lineNo: number): SeedFoodPortion[] {
  if (field === '') return [];
  return field.split('|').map((pair, index) => {
    const [label, grams, ...rest] = pair.split('=');
    if (!label || grams === undefined || rest.length > 0) {
      throw new CsvRowError(lineNo, `portion "${pair}" must be "Label=weight"`);
    }
    const weight = nonNegativeNumber('portion weight', grams, lineNo);
    if (weight === 0) throw new CsvRowError(lineNo, `portion "${pair}" must weigh more than 0`);
    return { label, grams: weight, isDefault: index === 0 };
  });
}

export function parseFoodsCsv(content: string): SeedFood[] {
  const lines = content.replace(/^﻿/, '').split(/\r?\n/);
  if (lines[0].trim() !== FOODS_CSV_HEADER) {
    throw new Error(
      `FoodsSeed.csv: unexpected header "${lines[0]}", expected "${FOODS_CSV_HEADER}"`,
    );
  }
  const seen = new Set<string>();
  const foods: SeedFood[] = [];
  lines.forEach((line, index) => {
    const lineNo = index + 1;
    if (lineNo === 1 || line.trim() === '') return;
    const cols = line.split(';');
    if (cols.length !== COLUMN_COUNT) {
      throw new CsvRowError(lineNo, `expected ${COLUMN_COUNT} columns, got ${cols.length}`);
    }
    const [key, name, , isLiquid, kcal, carbs, protein, fat, portions] = cols;
    if (!KEY_PATTERN.test(key))
      throw new CsvRowError(lineNo, `key "${key}" must be lowercase kebab-case ASCII`);
    if (seen.has(key)) throw new CsvRowError(lineNo, `duplicate key "${key}"`);
    seen.add(key);
    if (name.trim() === '') throw new CsvRowError(lineNo, 'name is empty');
    if (isLiquid !== 'true' && isLiquid !== 'false') {
      throw new CsvRowError(lineNo, `isLiquid must be "true" or "false", got "${isLiquid}"`);
    }
    foods.push({
      seedKey: key,
      name,
      isLiquid: isLiquid === 'true',
      kcal: nonNegativeNumber('kcal', kcal, lineNo),
      carbs: nonNegativeNumber('carbs', carbs, lineNo),
      protein: nonNegativeNumber('protein', protein, lineNo),
      fat: nonNegativeNumber('fat', fat, lineNo),
      portions: parsePortions(portions, lineNo),
    });
  });
  return foods;
}

/** The two Prisma calls the seed needs; structural so the seed can run against a fake. */
export type SeedFoodsClient = {
  food: {
    findMany(args: {
      where: { seedKey: { in: string[] } };
      select: { seedKey: true };
    }): Promise<{ seedKey: string | null }[]>;
    upsert(args: Prisma.FoodUpsertArgs): Promise<unknown>;
  };
};

/**
 * Upserts every row as a `source = SEED` food keyed by `seedKey`. Portions are rewritten
 * wholesale on update (same rule as FoodsService.update), `order` from array position.
 */
export async function seedFoods(
  prisma: SeedFoodsClient,
  foods: SeedFood[],
): Promise<{ created: number; updated: number }> {
  const existing = new Set(
    (
      await prisma.food.findMany({
        where: { seedKey: { in: foods.map((f) => f.seedKey) } },
        select: { seedKey: true },
      })
    ).map((row) => row.seedKey),
  );
  let created = 0;
  let updated = 0;
  for (const food of foods) {
    const scalars = {
      name: food.name,
      isLiquid: food.isLiquid,
      kcal: food.kcal,
      carbs: food.carbs,
      protein: food.protein,
      fat: food.fat,
    };
    const portions = food.portions.map((p, index) => ({
      label: p.label,
      grams: p.grams,
      order: index + 1,
      isDefault: p.isDefault,
    }));
    await prisma.food.upsert({
      where: { seedKey: food.seedKey },
      create: {
        ...scalars,
        seedKey: food.seedKey,
        source: 'SEED',
        createdById: null,
        portions: { create: portions },
      },
      update: { ...scalars, portions: { deleteMany: {}, create: portions } },
    });
    if (existing.has(food.seedKey)) updated++;
    else created++;
  }
  return { created, updated };
}
