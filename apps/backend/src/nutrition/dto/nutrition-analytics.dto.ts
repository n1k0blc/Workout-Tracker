import { MacroTotals, MacroTargetsDto } from './nutrition-day.dto';

/**
 * One day of the Ernährungs-Analytics series (#153): the day's summed kcal/Kohlenhydrate/
 * Protein/Fett plus its weekday (0 = Sunday .. 6 = Saturday, for the x-axis labels). Days the
 * user logged nothing on are present with every total at 0 -- the chart draws a continuous
 * line, never a gap.
 */
export class NutritionTrendDayDto implements MacroTotals {
  date: string;
  weekday: number;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
}

/**
 * The Ernährungs-Analytics payload: one entry per calendar day in `[start, end]` (inclusive,
 * in the client's timezone -- `localDate` is client-stamped), and the user's Tagesziele (#152)
 * so the chart can draw the target reference line without a second request. `targets` is null
 * when the user has set none.
 */
export class NutritionTrendDto {
  start: string;
  end: string;
  days: NutritionTrendDayDto[];
  targets: MacroTargetsDto | null;
}
