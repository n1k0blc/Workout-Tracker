import { SetType } from '@/types';

/**
 * The one frontend volume helper -- the twin of the backend primitive
 * `setWorkingVolume` in `apps/backend/src/common/utils/volume.util.ts`.
 *
 * `isUnilateral` is no longer a loading coefficient (issue #65/#99): it is purely
 * a set shape. Where a set carries per-side data, volume is the left side's
 * contribution plus the right side's; where it does not, volume is the plain
 * `reps × weight` product. The #97 backfill made both sides equal to the existing
 * aggregate, so summing them reproduces the old unilateral doubling exactly and
 * every historical figure is unchanged. `isDoubleWeight` still applies its ×2 on
 * top in both cases. Warmups are excluded.
 *
 * The frontend cannot import from the backend, so this formula lives in two
 * places. Any change to one MUST be mirrored in the other -- they move together.
 */
export function setWorkingVolume(
  set: {
    setType?: SetType;
    reps: number;
    weight: number;
    repsLeft?: number | null;
    repsRight?: number | null;
    weightLeft?: number | null;
    weightRight?: number | null;
  },
  exercise: { isDoubleWeight?: boolean },
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
