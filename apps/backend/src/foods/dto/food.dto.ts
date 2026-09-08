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
  /** The current user has starred this food (#148). Floats it up the picker's "Alle" tab. */
  isFavorite: boolean;
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

/**
 * One capped page of the library plus the totals behind it. The Open Food Facts import (#146)
 * puts ~180k foods in the library, so the page a caller receives says nothing about how many
 * foods match -- the counts have to travel with it.
 */
export class FoodListDto {
  items: FoodDto[];
  /** Foods matching the search, ignoring the page cap. */
  total: number;
  /** How many of `total` are the caller's own editable foods. */
  ownTotal: number;
}

/**
 * Where a scanned barcode landed in the miss chain (#149): `local` -- already in the shared
 * library (possibly just undeleted); `openFoodFacts` -- fetched live and cached as a global
 * food; `notFound` -- neither, so the client opens the create form with the barcode prefilled.
 */
export type BarcodeLookupStatus = 'local' | 'openFoodFacts' | 'notFound';

export class BarcodeLookupDto {
  status: BarcodeLookupStatus;
  /** The code in its canonical form -- a scanned UPC-A comes back widened to an EAN-13. */
  barcode: string;
  /** The resolved food; null only when `status` is `notFound`. */
  food: FoodDto | null;
}
