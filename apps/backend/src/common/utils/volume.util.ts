import { SetType } from '../types';

/**
 * The one volume primitive (§4.5) -- replaces ~5 independent reimplementations
 * (analytics volume/muscle-distribution, cycle details, workouts.findAll, and a buggy
 * dashboard version that read a nonexistent `set.isUnilateral` and never applied
 * `isDoubleWeight` or excluded warmups). Every site should call this instead of
 * re-deriving working volume itself.
 *
 * `isUnilateral` is no longer a loading coefficient (issue #65/#99): it is purely a
 * set shape. Where a set carries per-side data, its volume is the left side's
 * contribution plus the right side's; where it does not, volume is the plain
 * `reps × weight` product. Because the #97 backfill made both sides equal to the
 * pre-existing aggregate, summing them reproduces the old unilateral doubling
 * exactly, so every historical figure is unchanged. `isDoubleWeight` still applies
 * its ×2 on top in both cases.
 *
 * The frontend cannot import from this file, so it keeps a hand-mirrored twin
 * in `apps/frontend/lib/volume.ts`. Any change to the formula here MUST be
 * mirrored there -- the two are meant to move together.
 */
export function setWorkingVolume(
  set: {
    setType: SetType;
    reps: number;
    weight: number;
    repsLeft?: number | null;
    repsRight?: number | null;
    weightLeft?: number | null;
    weightRight?: number | null;
  },
  exercise: { isDoubleWeight: boolean },
): number {
  if (set.setType !== SetType.WORKING) {
    return 0;
  }
  const doubleWeightMultiplier = exercise.isDoubleWeight ? 2 : 1;
  const hasPerSide =
    set.repsLeft != null &&
    set.repsRight != null &&
    set.weightLeft != null &&
    set.weightRight != null;
  const base = hasPerSide
    ? set.repsLeft! * set.weightLeft! + set.repsRight! * set.weightRight!
    : set.reps * set.weight;
  return base * doubleWeightMultiplier;
}
