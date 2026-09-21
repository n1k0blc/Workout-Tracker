/**
 * Catalogue exercise translations (#187, ADR-0006). German is the source of truth -- the
 * `Exercise.name` written by the main seed from Exercises_premium.csv -- and English comes
 * from `ExerciseTranslations-en.csv` (repo root, `;`-delimited, keyed by the same csvId).
 * Both are upserted, and the seed fails outright if any catalogue row would be left without
 * either locale, so a partial translation can't ship unnoticed.
 */

import type { PrismaClient } from '../../generated/prisma/client';

/** `ID;Exercise` -> csvId to English name. */
export function parseExerciseTranslationsCsv(csv: string): Map<number, string> {
  const names = new Map<number, string>();
  csv
    .split('\n')
    .slice(1)
    .forEach((line, index) => {
      if (!line.trim()) return;
      const [id, name] = line.split(';').map((s) => s.trim());
      const csvId = parseInt(id, 10);
      if (Number.isNaN(csvId) || !name) {
        throw new Error(`ExerciseTranslations-en.csv line ${index + 2}: expected "ID;Exercise"`);
      }
      names.set(csvId, name);
    });
  return names;
}

export async function seedExerciseTranslations(
  prisma: Pick<PrismaClient, 'exercise' | 'exerciseTranslation'>,
  englishByCsvId: Map<number, string>,
): Promise<number> {
  const catalogue = await prisma.exercise.findMany({
    where: { isCustom: false, csvId: { not: null } },
    select: { id: true, csvId: true, name: true },
  });

  const missing = catalogue.filter((e) => !englishByCsvId.has(e.csvId!));
  if (missing.length > 0) {
    throw new Error(
      `No English name for ${missing.length} catalogue exercise(s): ${missing
        .map((e) => `${e.name} (ID ${e.csvId})`)
        .join(', ')}`,
    );
  }

  for (const { id, csvId, name } of catalogue) {
    const rows = [
      { locale: 'DE' as const, name },
      { locale: 'EN' as const, name: englishByCsvId.get(csvId!)! },
    ];
    for (const row of rows) {
      await prisma.exerciseTranslation.upsert({
        where: { exerciseId_locale: { exerciseId: id, locale: row.locale } },
        update: { name: row.name },
        create: { exerciseId: id, ...row },
      });
    }
  }

  for (const locale of ['DE', 'EN'] as const) {
    const count = await prisma.exerciseTranslation.count({
      where: { locale, exercise: { isCustom: false } },
    });
    if (count !== catalogue.length) {
      throw new Error(`Expected ${catalogue.length} "${locale}" rows, found ${count}`);
    }
  }
  return catalogue.length;
}
