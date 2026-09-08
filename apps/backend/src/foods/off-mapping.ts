/**
 * Open Food Facts mapping (#146).
 *
 * Open Food Facts publishes the same product in three different shapes: flat per-100 columns
 * in the CSV export, a nested `nutrition.input_sets` structure in the JSONL export and the
 * daily deltas, and the legacy `nutriments` block from the API. Each gets a thin adapter that
 * produces the `OffProduct` below; everything after that -- the quality filter and this
 * mapping -- is shared by the bulk import, the weekly sync (#150) and the live lookup (#149).
 */
import { isValidEan13 } from './barcode';

/** One product, normalized away from whichever raw shape it arrived in. Values are per 100. */
export type OffProduct = {
  barcode: string;
  name: string;
  brand: string | null;
  quantity: string | null;
  servingSize: string | null;
  categoriesTags: string[];
  countriesTags: string[];
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
};

export type MappedFood = {
  barcode: string;
  name: string;
  brand: string | null;
  isLiquid: boolean;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  portions: { label: string; grams: number; isDefault: boolean }[];
};

/**
 * The market filter, deliberately separate from the quality gate below. The import (#146) and
 * the weekly sync (#150) narrow the library to products sold in Germany; the live barcode
 * lookup (#149) does not, because it caches whatever the user physically scanned.
 *
 * `en:germany` is user-contributed and means only that somebody said the product is sold
 * here, so it scopes the import rather than vouching for quality.
 */
export function isSoldInGermany(product: OffProduct): boolean {
  return product.countriesTags.includes('en:germany');
}

const LIQUID_CATEGORIES = ['en:beverages', 'en:drinks', 'en:waters', 'en:juices'];

/**
 * A beverage category, or a pack size stated in millilitres/litres. The category alone misses
 * products filed under sauces or dairy that are still sold by volume.
 */
function isLiquid(product: OffProduct): boolean {
  if (product.categoriesTags.some((tag) => LIQUID_CATEGORIES.includes(tag))) return true;
  return /\d\s*(ml|cl|l)\b/i.test(product.quantity ?? '');
}

/** The export stores values with full float error (580.645161290323 kcal). */
function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** `"500 g"` / `"250ml"` -> the number. Null when there is no leading amount to read. */
function parseServingGrams(servingSize: string | null): number | null {
  if (!servingSize) return null;
  const match = /^\s*([\d.,]+)\s*(g|ml)\b/i.exec(servingSize);
  if (!match) return null;
  const grams = Number(match[1].replace(',', '.'));
  return Number.isFinite(grams) && grams > 0 ? grams : null;
}

export function mapOffProduct(product: OffProduct): MappedFood {
  const serving = parseServingGrams(product.servingSize);
  return {
    barcode: product.barcode,
    name: product.name,
    brand: product.brand,
    isLiquid: isLiquid(product),
    kcal: round(product.kcal, 0),
    carbs: round(product.carbs, 1),
    protein: round(product.protein, 1),
    fat: round(product.fat, 1),
    portions: serving === null ? [] : [{ label: '1 Portion', grams: serving, isDefault: true }],
  };
}

/**
 * Why this product's name or nutrients are unusable, or null when they are fine. Split out
 * from {@link rejectOffProduct} because the live barcode lookup (#149) needs this half only:
 * it has already validated the code the user physically scanned, and that code may legitimately
 * be an EAN-8 the bulk gate below turns away.
 *
 * The ±15% energy tolerance is the one the curated seed CSV uses (#145).
 */
export function rejectOffNutrition(product: OffProduct): string | null {
  if (!product.name.trim()) return 'no name';
  const macros = [product.kcal, product.carbs, product.protein, product.fat];
  if (macros.some((value) => !Number.isFinite(value))) return 'missing or non-numeric macro';
  if (macros.some((value) => value < 0)) return 'negative macro value';
  if (product.kcal > 900 || Math.max(product.carbs, product.protein, product.fat) > 100) {
    return 'impossible per-100 value';
  }
  const fromMacros = 4 * product.carbs + 4 * product.protein + 9 * product.fat;
  if (product.kcal > 0) {
    if (Math.abs(fromMacros - product.kcal) / product.kcal > 0.15) {
      return `macros imply ${Math.round(fromMacros)} kcal but ${product.kcal} is stated`;
    }
  } else if (fromMacros > 20) {
    return `zero kcal stated but macros imply ${Math.round(fromMacros)} kcal`;
  }
  return null;
}

/**
 * Why this product must not be imported in bulk, or null when it may be: the shared nutrition
 * gate above plus a 13-digit EAN. It is the quality half of the import's filter -- keeping
 * foreign products out is `isSoldInGermany`'s job, and the two stay separate.
 *
 * Shorter codes are rejected on purpose: EAN-8 is legitimate on small packages, but in the
 * Open Food Facts export 8-digit codes are overwhelmingly internal and test entries, about 9%
 * of otherwise importable German rows. A *scanned* EAN-8 goes through `rejectOffNutrition`
 * instead and is kept -- see `off-lookup.ts`.
 */
export function rejectOffProduct(product: OffProduct): string | null {
  if (!isValidEan13(product.barcode)) {
    return `barcode "${product.barcode}" is not 13 digits with a valid EAN check digit`;
  }
  return rejectOffNutrition(product);
}

// --- source adapters -------------------------------------------------------------------
// Open Food Facts publishes one product in three shapes. Each adapter reads one of them and
// produces the OffProduct above; nothing downstream knows which source a product came from.

const MACRO_KEYS = ['energy-kcal', 'carbohydrates', 'proteins', 'fat'] as const;

function text(value: unknown): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed === '' ? null : trimmed;
}

function num(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function assemble(
  raw: Record<string, unknown>,
  categoriesTags: string[],
  countriesTags: string[],
  macros: { kcal: number | null; carbs: number | null; protein: number | null; fat: number | null },
): OffProduct | null {
  const { kcal, carbs, protein, fat } = macros;
  if (kcal === null || carbs === null || protein === null || fat === null) return null;
  return {
    barcode: text(raw.code) ?? '',
    name: text(raw.product_name) ?? text(raw.product_name_de) ?? text(raw.generic_name) ?? '',
    brand: text(raw.brands),
    quantity: text(raw.quantity),
    servingSize: text(raw.serving_size),
    categoriesTags,
    countriesTags,
    kcal,
    carbs,
    protein,
    fat,
  };
}

/** CSV export: flat per-100 columns, `categories_tags` comma-joined. */
export function fromCsvRow(row: Record<string, string>): OffProduct | null {
  return assemble(
    row,
    (row.categories_tags ?? '').split(',').filter(Boolean),
    (row.countries_tags ?? '').split(',').filter(Boolean),
    {
      kcal: num(row['energy-kcal_100g']),
      carbs: num(row.carbohydrates_100g),
      protein: num(row.proteins_100g),
      fat: num(row.fat_100g),
    },
  );
}

/**
 * JSONL export and the daily deltas: values live in `nutrition.input_sets`. Only an as-sold
 * set measured per 100 is usable, and a label reading (`packaging` / `manufacturer`) is
 * preferred over Open Food Facts' own estimate from the ingredient list.
 */
export function fromExportProduct(raw: Record<string, unknown>): OffProduct | null {
  const nutrition = raw.nutrition as { input_sets?: unknown[] } | undefined;
  const sets = (nutrition?.input_sets ?? []) as Record<string, unknown>[];
  const rank: Record<string, number> = { packaging: 0, manufacturer: 1, estimate: 2 };
  const usable = sets
    .filter((set) => set.preparation === 'as_sold' && set.per_quantity === 100)
    .sort((a, b) => (rank[a.source as string] ?? 9) - (rank[b.source as string] ?? 9));

  for (const set of usable) {
    const nutrients = (set.nutrients ?? {}) as Record<string, { value?: unknown }>;
    const [kcal, carbs, protein, fat] = MACRO_KEYS.map((key) => num(nutrients[key]?.value));
    const product = assemble(
      raw,
      (raw.categories_tags as string[]) ?? [],
      (raw.countries_tags as string[]) ?? [],
      {
        kcal,
        carbs,
        protein,
        fat,
      },
    );
    if (product) return product;
  }
  return null;
}

/** API v2: the legacy `nutriments` block, which the API still serves for compatibility. */
export function fromApiProduct(raw: Record<string, unknown>): OffProduct | null {
  const nutriments = (raw.nutriments ?? {}) as Record<string, unknown>;
  return assemble(
    raw,
    (raw.categories_tags as string[]) ?? [],
    (raw.countries_tags as string[]) ?? [],
    {
      kcal: num(nutriments['energy-kcal_100g']),
      carbs: num(nutriments.carbohydrates_100g),
      protein: num(nutriments.proteins_100g),
      fat: num(nutriments.fat_100g),
    },
  );
}
