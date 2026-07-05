import { SetType } from '../types';

/**
 * The one volume primitive (§4.5) -- replaces ~5 independent reimplementations
 * (analytics volume/muscle-distribution, cycle details, workouts.findAll, and a buggy
 * dashboard version that read a nonexistent `set.isUnilateral` and never applied
 * `isDoubleWeight` or excluded warmups). Every site should call this instead of
 * re-deriving working volume itself.
 */
export function setWorkingVolume(
  set: { setType: SetType; reps: number; weight: number },
  exercise: { isUnilateral: boolean; isDoubleWeight: boolean },
): number {
  if (set.setType !== SetType.WORKING) {
    return 0;
  }
  let multiplier = 1;
  if (exercise.isUnilateral) multiplier *= 2;
  if (exercise.isDoubleWeight) multiplier *= 2;
  return set.reps * set.weight * multiplier;
}
