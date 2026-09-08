export type FoodSourceValue = 'SEED' | 'OPEN_FOOD_FACTS' | 'USER';

export class FoodPortionDto {
  id: string;
  label: string;
  grams: number;
  order: number;
  isDefault: boolean;
}

export class FoodDto {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  isLiquid: boolean;
  // Per 100 g / 100 ml.
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  source: FoodSourceValue;
  createdById: string | null;
  /** True once soft-deleted -- the food drops out of search but still resolves by id. */
  deleted: boolean;
  /** True only for the current user's own, non-deleted USER food. Drives the read-only editor. */
  editable: boolean;
  portions: FoodPortionDto[];
}

/** A row in the "Ähnliche eigene Einträge" / similar-name hint list. */
export class SimilarFoodDto {
  id: string;
  name: string;
  kcal: number;
  isLiquid: boolean;
  /** How many of the current user's diary entries reference this food (0 until #144). */
  usageCount: number;
}
