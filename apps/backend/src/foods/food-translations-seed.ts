/**
 * SEED food translations (#188, ADR-0007). German is the source of truth -- the name and
 * portion labels `seedFoods` just wrote from FoodsSeed.csv -- and English comes from
 * `FoodsSeed-en.csv` (repo root, `;`-delimited, keyed by the same `key`; portion labels are
 * `|`-separated in the order of the German portions). The seed fails outright if any SEED
 * food or portion would be left without either locale.
 */

import type { PrismaClient } from '../../generated/prisma/client';

export const FOOD_TRANSLATIONS_CSV_HEADER = 'key;name;portions';

export type FoodTranslationEn = { name: string; portions: string[] };

export function parseFoodTranslationsCsv(content: string): Map<string, FoodTranslationEn> {
  const lines = content.replace(/^﻿/, '').split(/\r?\n/);
  if (lines[0].trim() !== FOOD_TRANSLATIONS_CSV_HEADER) {
    throw new Error(
      `FoodsSeed-en.csv: unexpected header "${lines[0]}", expected "${FOOD_TRANSLATIONS_CSV_HEADER}"`,
    );
  }
  const rows = new Map<string, FoodTranslationEn>();
  lines.forEach((line, index) => {
    const lineNo = index + 1;
    if (lineNo === 1 || line.trim() === '') return;
    const cols = line.split(';');
    const [key, name, portions] = cols;
    if (cols.length !== 3 || !key || !name.trim()) {
      throw new Error(`FoodsSeed-en.csv line ${lineNo}: expected "key;name;portions"`);
    }
    if (rows.has(key)) throw new Error(`FoodsSeed-en.csv line ${lineNo}: duplicate key "${key}"`);
    rows.set(key, { name: name.trim(), portions: portions === '' ? [] : portions.split('|') });
  });
  return rows;
}

export async function seedFoodTranslations(
  prisma: Pick<PrismaClient, 'food' | 'foodTranslation' | 'foodPortionTranslation'>,
  englishByKey: Map<string, FoodTranslationEn>,
): Promise<number> {
  const foods = await prisma.food.findMany({
    where: { source: 'SEED', seedKey: { not: null } },
    select: {
      id: true,
      seedKey: true,
      name: true,
      portions: { orderBy: { order: 'asc' }, select: { id: true, label: true } },
    },
  });

  const problems = foods.flatMap((f) => {
    const en = englishByKey.get(f.seedKey!);
    if (!en) return [`${f.seedKey}: no English row`];
    if (en.portions.length !== f.portions.length) {
      return [`${f.seedKey}: ${f.portions.length} portions, ${en.portions.length} English labels`];
    }
    return [];
  });
  if (problems.length > 0) {
    throw new Error(`FoodsSeed-en.csv does not match the SEED foods: ${problems.join('; ')}`);
  }

  let portionCount = 0;
  for (const food of foods) {
    const en = englishByKey.get(food.seedKey!)!;
    for (const [locale, name] of [
      ['DE', food.name],
      ['EN', en.name],
    ] as const) {
      await prisma.foodTranslation.upsert({
        where: { foodId_locale: { foodId: food.id, locale } },
        update: { name },
        create: { foodId: food.id, locale, name },
      });
    }
    for (const [index, portion] of food.portions.entries()) {
      portionCount++;
      for (const [locale, label] of [
        ['DE', portion.label],
        ['EN', en.portions[index]],
      ] as const) {
        await prisma.foodPortionTranslation.upsert({
          where: { portionId_locale: { portionId: portion.id, locale } },
          update: { label },
          create: { portionId: portion.id, locale, label },
        });
      }
    }
  }

  // Only foods the seed manages: a keyless legacy SEED row is not ours to count.
  const seeded = { source: 'SEED', seedKey: { not: null } } as const;
  for (const locale of ['DE', 'EN'] as const) {
    const names = await prisma.foodTranslation.count({
      where: { locale, food: seeded },
    });
    const labels = await prisma.foodPortionTranslation.count({
      where: { locale, portion: { food: seeded } },
    });
    if (names !== foods.length || labels !== portionCount) {
      throw new Error(
        `Expected ${foods.length} names and ${portionCount} labels for "${locale}", found ${names} and ${labels}`,
      );
    }
  }
  return foods.length;
}
