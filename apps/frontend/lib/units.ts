/**
 * Weight unit system (#186, ADR-0005). Storage is canonical kilograms; everything here is
 * display-only. The one rule that makes that safe: never write back a value the user did not
 * type. `weightToKg` enforces it -- pass the stored kg as `originalKg` and an untouched
 * input string returns that exact kg instead of a re-converted, rounded copy.
 */
export type UnitSystem = 'METRIC' | 'IMPERIAL';

export const KG_PER_LB = 0.45359237;
export const CM_PER_INCH = 2.54;

export function weightUnitLabel(system: UnitSystem): 'kg' | 'lb' {
  return system === 'IMPERIAL' ? 'lb' : 'kg';
}

/** Decimals a tracked weight can be typed with, in the user's own unit. */
export const WEIGHT_DECIMALS = 3;
/** Body weight (Profil) is typed with one decimal at most. */
export const BODY_WEIGHT_DECIMALS = 1;

/**
 * A weight in the user's unit, to the decimals it can be typed with. The rounding only removes
 * floating-point noise (and the lb/kg conversion's tail), so whatever was typed in kg or lb
 * reads back exactly as typed.
 */
export function displayWeight(kg: number, system: UnitSystem, decimals: number = WEIGHT_DECIMALS): number {
  const shown = system === 'IMPERIAL' ? kg / KG_PER_LB : kg;
  const factor = 10 ** decimals;
  return Math.round(shown * factor) / factor;
}

/** The string a weight `<input type="number">` is prefilled with. */
export function weightInputString(kg: number, system: UnitSystem, decimals: number = WEIGHT_DECIMALS): string {
  return String(displayWeight(kg, system, decimals));
}

/**
 * Typed input -> canonical kg, converted once. Returns `originalKg` untouched when the
 * string is exactly what `weightInputString(originalKg)` would have shown (the user did not
 * edit it). Null for empty/unparseable input.
 */
export function weightToKg(
  input: string,
  system: UnitSystem,
  originalKg?: number | null,
  decimals: number = WEIGHT_DECIMALS,
): number | null {
  if (originalKg != null && input === weightInputString(originalKg, system, decimals)) return originalKg;
  if (input.trim() === '') return null;
  const typed = parseFloat(input);
  if (Number.isNaN(typed)) return null;
  return system === 'IMPERIAL' ? typed * KG_PER_LB : typed;
}

/** Volume figures (sets x reps x weight) in whole units of the chosen system. */
export function displayVolume(kg: number, system: UnitSystem): number {
  return Math.round(system === 'IMPERIAL' ? kg / KG_PER_LB : kg);
}

/**
 * Height converts in the input widget only; `User.height` stays centimetres. Imperial users
 * type whole inches. Same never-write-back guard as weights: an untouched input returns the
 * stored cm, not a re-converted copy.
 */
export function heightUnitLabel(system: UnitSystem): 'cm' | 'in' {
  return system === 'IMPERIAL' ? 'in' : 'cm';
}

export function heightInputString(cm: number, system: UnitSystem): string {
  return system === 'IMPERIAL' ? String(Math.round(cm / CM_PER_INCH)) : String(cm);
}

export function heightToCm(input: string, system: UnitSystem, originalCm?: number | null): number | null {
  if (originalCm != null && input === heightInputString(originalCm, system)) return originalCm;
  if (input.trim() === '') return null;
  const typed = parseFloat(input);
  if (Number.isNaN(typed)) return null;
  // The backend column is an integer number of centimetres.
  return system === 'IMPERIAL' ? Math.round(typed * CM_PER_INCH) : Math.round(typed);
}

interface VolumeAnalyticsLike {
  totalVolume: number;
  dataPoints: Array<{ volume: number }>;
  byMuscleGroup?: Array<{ volume: number }>;
}

/** Converts every kg volume figure in an analytics payload for display. */
export function volumeAnalyticsForDisplay<T extends VolumeAnalyticsLike>(data: T, system: UnitSystem): T {
  return {
    ...data,
    totalVolume: displayVolume(data.totalVolume, system),
    dataPoints: data.dataPoints.map((p) => ({ ...p, volume: displayVolume(p.volume, system) })),
    byMuscleGroup: data.byMuscleGroup?.map((m) => ({ ...m, volume: displayVolume(m.volume, system) })),
  };
}
