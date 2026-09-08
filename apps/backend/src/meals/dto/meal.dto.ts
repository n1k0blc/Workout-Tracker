export interface MealMacroTotals {
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
}

export class MealItemPortionDto {
  id: string;
  label: string;
  grams: number;
  order: number;
  isDefault: boolean;
}

/**
 * One ingredient of a Mahlzeit, with everything the editor needs to render it and recompute
 * its contribution live: the current per-100 values of the referenced food, its portions and
 * its unit. `deleted` is true when the food has been soft-deleted -- the row still resolves
 * and still computes (ADR-0003), the editor just marks it.
 */
export class MealItemDto {
  id: string;
  foodId: string;
  order: number;
  /** Grams or millilitres, matching the food's `isLiquid`. */
  quantity: number;
  foodName: string;
  isLiquid: boolean;
  deleted: boolean;
  /** Per 100 g / 100 ml, read live from the food. */
  per100: MealMacroTotals;
  portions: MealItemPortionDto[];
}

/**
 * A Mahlzeit with its ingredients resolved and its totals computed live from the current
 * food nutrients (editing a food changes this; already-logged entries do not change). Used
 * by the editor.
 */
export class MealDto {
  id: string;
  name: string;
  /**
   * True only for the caller's own, non-deleted meal -- the only case the editor writes.
   * This is the sole creator-derived fact exposed; the creator's id and name are not
   * returned (ADR-0003 -- a shared meal has no byline).
   */
  editable: boolean;
  deleted: boolean;
  items: MealItemDto[];
  /** Sum of every ingredient's live contribution, per 1x. */
  totals: MealMacroTotals;
}

/** A row in the Mahlzeiten tab / picker list: no per-item detail, just the preview. */
export class MealListItemDto {
  id: string;
  name: string;
  editable: boolean;
  itemCount: number;
  /** Ingredient names in item order, for the "Reis, Hähnchen, Paprika +3" preview. */
  ingredientNames: string[];
  totals: MealMacroTotals;
}

/**
 * The Mahlzeiten tab payload: the meals plus the two counts the tab's count line needs
 * ("N Mahlzeiten · M eigene"). `mineTotal` is how many of `total` the caller created.
 */
export class MealListDto {
  items: MealListItemDto[];
  total: number;
  mineTotal: number;
}
