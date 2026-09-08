export interface MacroTotals {
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
}

/** One logged Eintrag, as returned to the client. Full snapshot precision -- the UI rounds. */
export class DiaryEntryDto {
  id: string;
  mealSlotId: string;
  localDate: string;
  foodId: string | null;
  // Set on every entry that came from expanding a Mahlzeit (#147); the entries sharing one
  // `mealId` group under `mealName` on the Abschnitt page.
  mealId: string | null;
  // The meal's name, snapshotted at expansion time (ADR-0002) -- never re-read from the
  // Meal, so a later rename does not rewrite past days. Null unless `mealId` is set.
  mealName: string | null;
  name: string;
  quantity: number;
  quantityLabel: string | null;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
}

/** An Abschnitt with its entries for one day and the totals of just those entries. */
export class NutritionDaySlotDto {
  id: string;
  name: string;
  order: number;
  // True for a slot #142 has archived. Archived slots are returned only on days that already
  // have entries in them, so history stays intact.
  archived: boolean;
  totals: MacroTotals;
  entries: DiaryEntryDto[];
}

/** The Tagesansicht payload: the user's Abschnitte for `date`, plus the whole-day totals. */
export class NutritionDayDto {
  date: string;
  totals: MacroTotals;
  slots: NutritionDaySlotDto[];
}
