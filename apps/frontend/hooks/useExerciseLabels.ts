'use client';

import { useTranslations } from 'next-intl';
import { Equipment, MuscleGroup } from '@/types';

/**
 * Localized MuscleGroup/Equipment labels (#180). Analytics, the exercise editor and the
 * exercise selection modal each translated these enums with their own hardcoded German
 * map; centralizing them here is what keeps a locale switch from being correct in one
 * surface and stale in the other three.
 */
export function useExerciseLabels() {
  const tMuscleGroup = useTranslations('Exercises.muscleGroups');
  const tEquipment = useTranslations('Exercises.equipment');

  return {
    // Accepts `string` too: analytics renders muscle groups straight off the API response
    // (`VolumeByMuscleGroup.muscleGroup: string`), so an unrecognized value falls back to
    // itself instead of throwing, the same as the hardcoded maps this replaced.
    translateMuscleGroup: (muscleGroup: MuscleGroup | string): string =>
      tMuscleGroup.has(muscleGroup) ? tMuscleGroup(muscleGroup) : muscleGroup,
    translateEquipment: (equipment: Equipment | string): string =>
      tEquipment.has(equipment) ? tEquipment(equipment) : equipment,
  };
}
