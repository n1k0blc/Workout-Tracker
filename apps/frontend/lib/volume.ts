import { SetType } from '@/types';

/**
 * The one frontend volume helper -- the twin of the backend primitive
 * `setWorkingVolume` in `apps/backend/src/common/utils/volume.util.ts`.
 *
 * The frontend cannot import from the backend, so the volume formula
 * (`reps × weight × unilateral × doubleWeight`, warmups excluded) lives in
 * two places. Any change to one MUST be mirrored in the other -- they are
 * meant to move together.
 */
export function setWorkingVolume(
  set: { setType?: SetType; reps: number; weight: number },
  exercise: { isUnilateral?: boolean; isDoubleWeight?: boolean },
): number {
  if (set.setType !== SetType.WORKING) {
    return 0;
  }
  let multiplier = 1;
  if (exercise.isUnilateral) multiplier *= 2;
  if (exercise.isDoubleWeight) multiplier *= 2;
  return set.reps * set.weight * multiplier;
}
