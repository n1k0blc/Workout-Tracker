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
  // Null in this ticket (a Schnelleintrag). Carried so later tickets can render meal grouping
  // and food links without a shape change.
  foodId: string | null;
  mealId: string | null;
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
