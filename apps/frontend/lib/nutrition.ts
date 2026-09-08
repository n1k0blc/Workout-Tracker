import { fromLocalDateString, toLocalDateString } from '@/lib/local-date';

/** Energy density of the macronutrients: 4 kcal/g carbs, 4 kcal/g protein, 9 kcal/g fat. */
export const KCAL_PER_GRAM = { carbs: 4, protein: 4, fat: 9 } as const;

export interface Macros {
  carbs: number;
  protein: number;
  fat: number;
}

/** The kcal the given macros account for, to the nearest whole number. */
export function kcalFromMacros({ carbs, protein, fat }: Macros): number {
  return Math.round(
    carbs * KCAL_PER_GRAM.carbs + protein * KCAL_PER_GRAM.protein + fat * KCAL_PER_GRAM.fat,
  );
}

/**
 * The Schnelleintrag consistency hint. Returns `null` when there is nothing worth saying --
 * no kcal entered yet, or the macros already add up to the entered kcal. Otherwise it states
 * what the macros imply and that the entered kcal is what gets saved, unchanged.
 */
export function macroConsistencyHint(
  enteredKcal: number,
  macros: Macros,
): string | null {
  if (!Number.isFinite(enteredKcal) || enteredKcal <= 0) return null;
  const macroKcal = kcalFromMacros(macros);
  if (macroKcal === enteredKcal) return null;
  return `Makros ergeben ${macroKcal} kcal. Differenz zu ${enteredKcal} kcal wird übernommen wie eingegeben.`;
}

/**
 * A calendar day `n` days from `localDate` (`n` may be negative), as `YYYY-MM-DD`. Goes
 * through the local-date helpers so month, year and leap-day boundaries fall out of the
 * platform's own date maths rather than string arithmetic.
 */
export function addDays(localDate: string, n: number): string {
  const date = fromLocalDateString(localDate);
  date.setDate(date.getDate() + n);
  return toLocalDateString(date);
}

export interface Per100 {
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
}

/**
 * The nutrients of `grams` (grams or millilitres) of a food, from its per-100 values. The
 * picker previews with this; the server does the identical `* grams / 100` when it snapshots
 * the entry, so preview and stored value cannot drift.
 */
export function scalePer100(per100: Per100, grams: number): Per100 {
  const factor = grams / 100;
  return {
    kcal: per100.kcal * factor,
    carbs: per100.carbs * factor,
    protein: per100.protein * factor,
    fat: per100.fat * factor,
  };
}

/**
 * How a picked amount reads and is stored: a named portion becomes `"1 Portion (40 g)"`, a
 * free amount just `"150 g"` (or `ml` for a liquid).
 */
export function formatQuantityLabel(
  portionLabel: string | null,
  grams: number,
  isLiquid: boolean,
): string {
  const amount = `${Math.round(grams)} ${isLiquid ? 'ml' : 'g'}`;
  return portionLabel ? `${portionLabel} (${amount})` : amount;
}

/**
 * The ownership / provenance marker shown next to a food: `"Eigenes"` for the current user's
 * own food, `"System"` for a seeded one, `"Open Food Facts"` for an imported one, and `null`
 * for another user's food (no byline, per ADR-0003).
 */
export function foodSourceLabel(food: {
  editable: boolean;
  source: 'SEED' | 'OPEN_FOOD_FACTS' | 'USER';
}): string | null {
  if (food.editable) return 'Eigenes';
  if (food.source === 'SEED') return 'System';
  if (food.source === 'OPEN_FOOD_FACTS') return 'Open Food Facts';
  return null;
}

/** Round amounts offered in the Menge stepper alongside a food's named portions. */
export const GRAM_PRESETS = [25, 50, 100, 150, 200, 250, 300] as const;

export interface QuantityStop {
  /** The portion name, or `null` for a plain gram/ml amount. */
  label: string | null;
  grams: number;
}

/**
 * The stops the Menge stepper walks: the food's named portions in `order`, then the round
 * gram/ml presets that don't duplicate one of those portions' amounts.
 */
export function buildQuantityStops(
  portions: { label: string; grams: number; order: number }[],
): QuantityStop[] {
  const portionStops: QuantityStop[] = [...portions]
    .sort((a, b) => a.order - b.order)
    .map((p) => ({ label: p.label, grams: p.grams }));
  const gramStops: QuantityStop[] = GRAM_PRESETS.filter(
    (g) => !portionStops.some((s) => Math.round(s.grams) === g),
  ).map((g) => ({ label: null, grams: g }));
  return [...portionStops, ...gramStops];
}

/** Index of the stop to start on: the default portion, else the one nearest 100 g/ml. */
export function defaultQuantityStopIndex(
  stops: QuantityStop[],
  defaultPortionLabel: string | null,
): number {
  if (defaultPortionLabel) {
    const i = stops.findIndex((s) => s.label === defaultPortionLabel);
    if (i >= 0) return i;
  }
  let best = 0;
  let bestDist = Infinity;
  stops.forEach((s, i) => {
    const d = Math.abs(s.grams - 100);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

/** `"53 g KH · 20 g P · 20 g F"` -- the macro summary line used across the nutrition screens. */
export function formatMacroLine(macros: Macros): string {
  return `${Math.round(macros.carbs)} g KH · ${Math.round(macros.protein)} g P · ${Math.round(
    macros.fat,
  )} g F`;
}

/** Whole-number kcal with a German thousands separator: `1842` -> `"1.842"`. */
export function formatKcal(kcal: number): string {
  return Math.round(kcal).toLocaleString('de-DE');
}

/** A quantity multiplier the German way: `0.5` -> `"0,5×"`, `1` -> `"1×"`. */
export function formatFactor(n: number): string {
  return `${n.toLocaleString('de-DE')}×`;
}

/**
 * The quick multipliers offered wherever a whole item is scaled by a factor rather than a
 * gram amount: the Schnelleintrag quantity chips and the picker's Mahlzeit "Faktor" control.
 */
export const QUANTITY_FACTORS = [0.5, 1, 1.5, 2] as const;

/** A macro block multiplied by a plain factor (a Faktor pick, a quantity ratio). */
export function scaleMacros(m: Per100, factor: number): Per100 {
  return {
    kcal: m.kcal * factor,
    carbs: m.carbs * factor,
    protein: m.protein * factor,
    fat: m.fat * factor,
  };
}

/**
 * The live totals of a Mahlzeit, per 1x: every ingredient's per-100 values scaled by its
 * `quantity / 100` and summed. Matches what the backend computes for the meal's displayed
 * total -- editing a food changes this, entries already logged do not.
 */
export function computeMealTotals(
  items: { per100: Per100; quantity: number }[],
): Per100 {
  return items.reduce<Per100>(
    (sum, item) => {
      const part = scalePer100(item.per100, item.quantity);
      return {
        kcal: sum.kcal + part.kcal,
        carbs: sum.carbs + part.carbs,
        protein: sum.protein + part.protein,
        fat: sum.fat + part.fat,
      };
    },
    { kcal: 0, carbs: 0, protein: 0, fat: 0 },
  );
}

/**
 * The ingredient preview shown on a meal row: the first `maxNames` names joined with commas,
 * then `" +N"` for however many are left. `"Reis, Hähnchen, Paprika +3"`. Empty for a meal
 * with no ingredients.
 */
export function mealIngredientPreview(names: string[], maxNames = 3): string {
  if (names.length === 0) return '';
  const shown = names.slice(0, maxNames).join(', ');
  const rest = names.length - maxNames;
  return rest > 0 ? `${shown} +${rest}` : shown;
}

/**
 * Parses a number typed into one of the nutrition inputs. Accepts a German decimal comma,
 * trims blanks, and returns `null` for anything empty, non-numeric or negative -- so a caller
 * can treat `null` as "leave blank / invalid" without a second check.
 */
export function parseAmount(input: string): number | null {
  const normalized = input.trim().replace(',', '.');
  if (normalized === '') return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export interface DiaryEntryGrouping<T> {
  /** One group per referenced meal, in the order each meal first appears. */
  mealGroups: { mealId: string; mealName: string; entries: T[]; kcal: number }[];
  /** Everything else -- Schnelleinträge and single food entries -- in original order. */
  singles: T[];
}

/**
 * Splits an Abschnitt's entries for the Abschnitt page: every entry carrying a `mealId` (and
 * its snapshotted `mealName`) joins that meal's group, rendered as a card under a
 * "MAHLZEIT <name>" header; everything else falls through to the "Einzeleinträge" list. The
 * grouping is by `mealId` alone, not entry position, so it does not depend on the order
 * `getDay` returns rows in -- logging the same meal twice into one Abschnitt on one day
 * yields a single combined group.
 */
export function groupDiaryEntries<
  T extends { mealId: string | null; mealName: string | null; kcal: number },
>(entries: T[]): DiaryEntryGrouping<T> {
  const mealGroups: DiaryEntryGrouping<T>['mealGroups'] = [];
  const byMealId = new Map<string, DiaryEntryGrouping<T>['mealGroups'][number]>();
  const singles: T[] = [];

  for (const entry of entries) {
    if (entry.mealId && entry.mealName) {
      let group = byMealId.get(entry.mealId);
      if (!group) {
        group = { mealId: entry.mealId, mealName: entry.mealName, entries: [], kcal: 0 };
        byMealId.set(entry.mealId, group);
        mealGroups.push(group);
      }
      group.entries.push(entry);
      group.kcal += entry.kcal;
    } else {
      singles.push(entry);
    }
  }

  return { mealGroups, singles };
}

/**
 * Floats the picker's starred rows to the top of the "Alle" tab without otherwise reordering
 * (#148): favorites keep their incoming order, non-favorites keep theirs, favorites come
 * first. A stable partition -- the incoming order is the name sort, which is the only
 * "match quality" the food search exposes.
 */
export function sortFavoritesFirst<T extends { isFavorite: boolean }>(rows: T[]): T[] {
  return [...rows.filter((r) => r.isFavorite), ...rows.filter((r) => !r.isFavorite)];
}

/**
 * How a day reads relative to the client's today: `"Heute"`, `"Gestern"`, `"Morgen"`, or the
 * full German weekday for anything further out.
 */
export function relativeDayLabel(localDate: string, today: string): string {
  if (localDate === today) return 'Heute';
  if (localDate === addDays(today, -1)) return 'Gestern';
  if (localDate === addDays(today, 1)) return 'Morgen';
  return new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(
    fromLocalDateString(localDate),
  );
}
