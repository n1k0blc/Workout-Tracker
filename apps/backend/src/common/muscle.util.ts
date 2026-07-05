/**
 * PR2 (§3.7): the 12-column percent distribution is the single source of truth for an
 * exercise's muscle involvement. There is no stored "muscleGroup" column anymore --
 * `MuscleGroup` here is an app-level enum (not Prisma-backed) used for DTOs/filters and
 * for the derived "primary muscle" (the max-percent column).
 */
export enum MuscleGroup {
  ABDOMEN = 'ABDOMEN',
  LATISSIMUS = 'LATISSIMUS',
  TRAPEZIUS = 'TRAPEZIUS',
  LOWER_BACK = 'LOWER_BACK',
  HAMSTRINGS = 'HAMSTRINGS',
  GLUTES = 'GLUTES',
  SHOULDERS = 'SHOULDERS',
  BICEPS = 'BICEPS',
  CHEST = 'CHEST',
  QUADRICEPS = 'QUADRICEPS',
  CALVES = 'CALVES',
  TRICEPS = 'TRICEPS',
}

export const MUSCLE_PERCENT_FIELD: Record<MuscleGroup, string> = {
  [MuscleGroup.ABDOMEN]: 'abdomenPercent',
  [MuscleGroup.LATISSIMUS]: 'latissimusPercent',
  [MuscleGroup.TRAPEZIUS]: 'trapeziusPercent',
  [MuscleGroup.LOWER_BACK]: 'lowerBackPercent',
  [MuscleGroup.HAMSTRINGS]: 'hamstringsPercent',
  [MuscleGroup.GLUTES]: 'glutesPercent',
  [MuscleGroup.SHOULDERS]: 'shouldersPercent',
  [MuscleGroup.BICEPS]: 'bicepsPercent',
  [MuscleGroup.CHEST]: 'chestPercent',
  [MuscleGroup.QUADRICEPS]: 'quadricepsPercent',
  [MuscleGroup.CALVES]: 'calvesPercent',
  [MuscleGroup.TRICEPS]: 'tricepsPercent',
};

export interface MusclePercentages {
  abdomenPercent: number;
  latissimusPercent: number;
  trapeziusPercent: number;
  lowerBackPercent: number;
  hamstringsPercent: number;
  glutesPercent: number;
  shouldersPercent: number;
  bicepsPercent: number;
  chestPercent: number;
  quadricepsPercent: number;
  calvesPercent: number;
  tricepsPercent: number;
}

export function sumMusclePercentages(p: MusclePercentages): number {
  return (
    p.abdomenPercent +
    p.latissimusPercent +
    p.trapeziusPercent +
    p.lowerBackPercent +
    p.hamstringsPercent +
    p.glutesPercent +
    p.shouldersPercent +
    p.bicepsPercent +
    p.chestPercent +
    p.quadricepsPercent +
    p.calvesPercent +
    p.tricepsPercent
  );
}

/** Primary muscle = the max-percent column. Ties break on enum declaration order. */
export function derivePrimaryMuscle(p: MusclePercentages): MuscleGroup {
  let best = MuscleGroup.CHEST;
  let bestValue = -1;
  for (const muscle of Object.values(MuscleGroup)) {
    const value = p[MUSCLE_PERCENT_FIELD[muscle] as keyof MusclePercentages];
    if (value > bestValue) {
      bestValue = value;
      best = muscle;
    }
  }
  return best;
}
