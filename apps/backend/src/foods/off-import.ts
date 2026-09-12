/**
 * Open Food Facts importer (#146).
 *
 * Takes products already mapped and filtered by `off-mapping` and writes them as
 * `OPEN_FOOD_FACTS` foods, keyed by barcode. Barcodes are globally unique across every
 * source, so a barcode already owned by a user's own food or by a curated seed row is left
 * alone -- the importer only ever writes rows it owns.
 */
import { MappedFood } from './off-mapping';

export type ImportStats = {
  created: number;
  updated: number;
  /** Barcode already held by a USER or SEED food; left untouched. */
  skipped: number;
};

type FoodRow = { id: string; barcode: string | null; source: string };

export type OffImportClient = {
  food: {
    findMany(args: {
      where: { barcode: { in: string[] } };
      select: { id: true; barcode: true; source: true };
    }): Promise<FoodRow[]>;
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
};

function portionData(product: MappedFood) {
  return product.portions.map((portion, index) => ({
    label: portion.label,
    grams: portion.grams,
    order: index + 1,
    isDefault: portion.isDefault,
  }));
}

/** Default batch size: big enough to keep the round trips cheap, small enough that the Pi
 * never holds a large statement or a long lock. */
const DEFAULT_BATCH_SIZE = 500;

async function* batched(
  products: Iterable<MappedFood> | AsyncIterable<MappedFood>,
  size: number,
): AsyncGenerator<MappedFood[]> {
  let batch: MappedFood[] = [];
  for await (const product of products as AsyncIterable<MappedFood>) {
    batch.push(product);
    if (batch.length >= size) {
      yield batch;
      batch = [];
    }
  }
  if (batch.length > 0) yield batch;
}

export async function importOffProducts(
  prisma: OffImportClient,
  products: Iterable<MappedFood> | AsyncIterable<MappedFood>,
  options: { now?: Date; batchSize?: number } = {},
): Promise<ImportStats> {
  const now = options.now ?? new Date();
  const stats: ImportStats = { created: 0, updated: 0, skipped: 0 };

  for await (const batch of batched(products, options.batchSize ?? DEFAULT_BATCH_SIZE)) {
    await importBatch(prisma, batch, now, stats);
  }
  return stats;
}

async function importBatch(
  prisma: OffImportClient,
  batch: MappedFood[],
  now: Date,
  stats: ImportStats,
): Promise<void> {
  const existing = new Map(
    (
      await prisma.food.findMany({
        where: { barcode: { in: batch.map((p) => p.barcode) } },
        select: { id: true, barcode: true, source: true },
      })
    ).map((row) => [row.barcode as string, row]),
  );

  for (const product of batch) {
    const scalars = {
      name: product.name,
      brand: product.brand,
      isLiquid: product.isLiquid,
      kcal: product.kcal,
      carbs: product.carbs,
      protein: product.protein,
      fat: product.fat,
      lastSyncedAt: now,
    };
    const row = existing.get(product.barcode);
    if (!row) {
      await prisma.food.create({
        data: {
          ...scalars,
          barcode: product.barcode,
          source: 'OPEN_FOOD_FACTS',
          createdById: null,
          portions: { create: portionData(product) },
        },
      });
      stats.created++;
    } else if (row.source !== 'OPEN_FOOD_FACTS') {
      stats.skipped++;
    } else {
      await prisma.food.update({
        where: { id: row.id },
        data: { ...scalars, portions: { deleteMany: {}, create: portionData(product) } },
      });
      stats.updated++;
    }
  }
}
