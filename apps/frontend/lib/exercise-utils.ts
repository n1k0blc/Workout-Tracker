import { Exercise, MuscleGroup } from '@/types';

/**
 * Maps MuscleGroup enum to German display names
 */
export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  [MuscleGroup.ABDOMEN]: 'Bauch',
  [MuscleGroup.LATISSIMUS]: 'Latissimus',
  [MuscleGroup.TRAPEZIUS]: 'Trapez',
  [MuscleGroup.LOWER_BACK]: 'Unterer Rücken',
  [MuscleGroup.HAMSTRINGS]: 'Beinbeuger',
  [MuscleGroup.GLUTES]: 'Glutes',
  [MuscleGroup.SHOULDERS]: 'Schultern',
  [MuscleGroup.BICEPS]: 'Bizeps',
  [MuscleGroup.CHEST]: 'Brust',
  [MuscleGroup.QUADRICEPS]: 'Quadrizeps',
  [MuscleGroup.CALVES]: 'Waden',
  [MuscleGroup.TRICEPS]: 'Trizeps',
};

/**
 * Gets the secondary muscle groups (>0% and not the primary muscle)
 * Returns array of { muscleGroup, percent }
 */
export function getSecondaryMuscleGroups(exercise: Exercise): Array<{ muscleGroup: MuscleGroup; percent: number; label: string }> {
  const percentages: Array<{ muscleGroup: MuscleGroup; percent: number; field: keyof Exercise }> = [
    { muscleGroup: MuscleGroup.ABDOMEN, percent: exercise.abdomenPercent, field: 'abdomenPercent' },
    { muscleGroup: MuscleGroup.LATISSIMUS, percent: exercise.latissimusPercent, field: 'latissimusPercent' },
    { muscleGroup: MuscleGroup.TRAPEZIUS, percent: exercise.trapeziusPercent, field: 'trapeziusPercent' },
    { muscleGroup: MuscleGroup.LOWER_BACK, percent: exercise.lowerBackPercent, field: 'lowerBackPercent' },
    { muscleGroup: MuscleGroup.HAMSTRINGS, percent: exercise.hamstringsPercent, field: 'hamstringsPercent' },
    { muscleGroup: MuscleGroup.GLUTES, percent: exercise.glutesPercent, field: 'glutesPercent' },
    { muscleGroup: MuscleGroup.SHOULDERS, percent: exercise.shouldersPercent, field: 'shouldersPercent' },
    { muscleGroup: MuscleGroup.BICEPS, percent: exercise.bicepsPercent, field: 'bicepsPercent' },
    { muscleGroup: MuscleGroup.CHEST, percent: exercise.chestPercent, field: 'chestPercent' },
    { muscleGroup: MuscleGroup.QUADRICEPS, percent: exercise.quadricepsPercent, field: 'quadricepsPercent' },
    { muscleGroup: MuscleGroup.CALVES, percent: exercise.calvesPercent, field: 'calvesPercent' },
    { muscleGroup: MuscleGroup.TRICEPS, percent: exercise.tricepsPercent, field: 'tricepsPercent' },
  ];

  return percentages
    .filter(({ percent, muscleGroup }) => percent > 0 && muscleGroup !== exercise.primaryMuscle)
    .sort((a, b) => b.percent - a.percent)
    .map(({ muscleGroup, percent }) => ({
      muscleGroup,
      percent,
      label: MUSCLE_GROUP_LABELS[muscleGroup],
    }));
}

/**
 * Formats secondary muscle groups as a display string
 * Example: "Trizeps 25%, Schultern 15%"
 */
export function formatSecondaryMuscleGroups(exercise: Exercise): string {
  const secondary = getSecondaryMuscleGroups(exercise);
  if (secondary.length === 0) return '';

  return secondary
    .map(({ label, percent }) => `${label} ${percent}%`)
    .join(', ');
}

/**
 * Gets all muscle groups that this exercise targets (including the primary one)
 * Returns array of { muscleGroup, percent, label, isMain }
 */
export function getAllMuscleGroups(exercise: Exercise): Array<{
  muscleGroup: MuscleGroup;
  percent: number;
  label: string;
  isMain: boolean;
}> {
  const percentages: Array<{ muscleGroup: MuscleGroup; percent: number }> = [
    { muscleGroup: MuscleGroup.ABDOMEN, percent: exercise.abdomenPercent },
    { muscleGroup: MuscleGroup.LATISSIMUS, percent: exercise.latissimusPercent },
    { muscleGroup: MuscleGroup.TRAPEZIUS, percent: exercise.trapeziusPercent },
    { muscleGroup: MuscleGroup.LOWER_BACK, percent: exercise.lowerBackPercent },
    { muscleGroup: MuscleGroup.HAMSTRINGS, percent: exercise.hamstringsPercent },
    { muscleGroup: MuscleGroup.GLUTES, percent: exercise.glutesPercent },
    { muscleGroup: MuscleGroup.SHOULDERS, percent: exercise.shouldersPercent },
    { muscleGroup: MuscleGroup.BICEPS, percent: exercise.bicepsPercent },
    { muscleGroup: MuscleGroup.CHEST, percent: exercise.chestPercent },
    { muscleGroup: MuscleGroup.QUADRICEPS, percent: exercise.quadricepsPercent },
    { muscleGroup: MuscleGroup.CALVES, percent: exercise.calvesPercent },
    { muscleGroup: MuscleGroup.TRICEPS, percent: exercise.tricepsPercent },
  ];

  return percentages
    .filter(({ percent }) => percent > 0)
    .sort((a, b) => b.percent - a.percent)
    .map(({ muscleGroup, percent }) => ({
      muscleGroup,
      percent,
      label: MUSCLE_GROUP_LABELS[muscleGroup],
      isMain: muscleGroup === exercise.primaryMuscle,
    }));
}

/**
 * Validates that muscle group percentages sum to 100
 */
export function validateMusclePercentages(percentages: Record<string, number>): { valid: boolean; sum: number } {
  const sum = Object.values(percentages).reduce((acc, val) => acc + (val || 0), 0);
  return { valid: sum === 100, sum };
}

/**
 * Creates a preset muscle distribution (100% on one muscle group)
 */
export function createIsolationPreset(muscleGroup: MuscleGroup): Record<string, number> {
  const preset: Record<string, number> = {
    abdomenPercent: 0,
    latissimusPercent: 0,
    trapeziusPercent: 0,
    lowerBackPercent: 0,
    hamstringsPercent: 0,
    glutesPercent: 0,
    shouldersPercent: 0,
    bicepsPercent: 0,
    chestPercent: 0,
    quadricepsPercent: 0,
    calvesPercent: 0,
    tricepsPercent: 0,
  };

  const muscleGroupToField: Record<MuscleGroup, keyof typeof preset> = {
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

  const field = muscleGroupToField[muscleGroup];
  if (field) {
    preset[field] = 100;
  }

  return preset;
}
