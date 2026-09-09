import { MacroTargetsDto } from './dto';

/** The four nullable Tagesziele columns as read straight off the `User` row (#152). */
export type UserTargetsRow = {
  targetKcal: number | null;
  targetCarbs: number | null;
  targetProtein: number | null;
  targetFat: number | null;
};

/** The `select` both the day payload and the analytics payload use to read the Tagesziele. */
export const USER_TARGETS_SELECT = {
  targetKcal: true,
  targetCarbs: true,
  targetProtein: true,
  targetFat: true,
} as const;

/**
 * The user's Tagesziele as the nutrition payloads carry them: `null` when not one of the four
 * is set (the client then shows plain totals), otherwise the whole object with each unset
 * target still `null`. Shared so the `GET /nutrition/day` and `GET /nutrition/analytics`
 * payloads cannot drift apart.
 */
export function toMacroTargetsDto(row: UserTargetsRow | null): MacroTargetsDto | null {
  if (!row) return null;
  const { targetKcal, targetCarbs, targetProtein, targetFat } = row;
  if (
    targetKcal === null &&
    targetCarbs === null &&
    targetProtein === null &&
    targetFat === null
  ) {
    return null;
  }
  return {
    kcal: targetKcal,
    carbs: targetCarbs,
    protein: targetProtein,
    fat: targetFat,
  };
}
