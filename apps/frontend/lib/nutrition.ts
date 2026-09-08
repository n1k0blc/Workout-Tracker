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
