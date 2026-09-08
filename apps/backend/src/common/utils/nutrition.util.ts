export interface MacroValues {
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
}

/**
 * The one nutrient-scaling primitive: per-100 values (per 100 g, or per 100 ml for a liquid)
 * scaled to `grams` by `grams / 100`. Used wherever the nutrition code turns a food's
 * per-100 figures into an amount -- the diary snapshot on a food/meal log, and a meal's
 * live totals.
 *
 * The frontend cannot import from this file, so it keeps a hand-mirrored twin
 * (`scalePer100` in `apps/frontend/lib/nutrition.ts`). The two must move together -- the
 * picker previews with the frontend copy and the server stores with this one, and they are
 * only safe to compare because the arithmetic is identical.
 */
export function scalePer100(per100: MacroValues, grams: number): MacroValues {
  const factor = grams / 100;
  return {
    kcal: per100.kcal * factor,
    carbs: per100.carbs * factor,
    protein: per100.protein * factor,
    fat: per100.fat * factor,
  };
}
