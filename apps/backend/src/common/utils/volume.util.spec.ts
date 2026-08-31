import { setWorkingVolume } from './volume.util';
import { SetType } from '../types';

/**
 * Direct coverage for the one volume primitive -- the twin of the frontend
 * `setWorkingVolume`. Pins the per-side semantics from issue #99: `isUnilateral`
 * is no longer a multiplier, a per-side set sums its two sides, and a symmetric
 * per-side set stays exactly equal to the legacy unilateral doubling so the
 * migration's central invariant is caught here at the primitive if it regresses.
 */
const workingSet = { setType: SetType.WORKING, reps: 10, weight: 50 };

describe('setWorkingVolume', () => {
  it('multiplies reps × weight for a plain working set', () => {
    expect(setWorkingVolume(workingSet, { isDoubleWeight: false })).toBe(500);
  });

  it('doubles for a double-weight exercise', () => {
    expect(setWorkingVolume(workingSet, { isDoubleWeight: true })).toBe(1000);
  });

  it('applies no unilateral multiplier to a set without per-side data', () => {
    expect(setWorkingVolume(workingSet, { isDoubleWeight: false })).toBe(500);
  });

  it('sums the two sides for a per-side set, with no unilateral multiplier', () => {
    expect(
      setWorkingVolume(
        { ...workingSet, repsLeft: 10, repsRight: 10, weightLeft: 50, weightRight: 50 },
        { isDoubleWeight: false },
      ),
    ).toBe(1000);
  });

  it('keeps a symmetric per-side set equal to the legacy unilateral doubling', () => {
    const legacyDoubling = workingSet.reps * workingSet.weight * 2;
    expect(
      setWorkingVolume(
        { ...workingSet, repsLeft: 10, repsRight: 10, weightLeft: 50, weightRight: 50 },
        { isDoubleWeight: false },
      ),
    ).toBe(legacyDoubling);
  });

  it('applies isDoubleWeight on top of the per-side sum', () => {
    expect(
      setWorkingVolume(
        { ...workingSet, repsLeft: 10, repsRight: 10, weightLeft: 50, weightRight: 50 },
        { isDoubleWeight: true },
      ),
    ).toBe(2000);
  });

  it('contributes the true sum of an asymmetric set, not twice the aggregate', () => {
    // Sides: 10×50 + 8×40 = 820. Twice the stored aggregate (9×45) would be 810.
    expect(
      setWorkingVolume(
        {
          setType: SetType.WORKING,
          reps: 9,
          weight: 45,
          repsLeft: 10,
          repsRight: 8,
          weightLeft: 50,
          weightRight: 40,
        },
        { isDoubleWeight: false },
      ),
    ).toBe(820);
  });

  it('falls back to the aggregate when per-side data is incomplete', () => {
    expect(
      setWorkingVolume({ ...workingSet, repsLeft: 10, weightLeft: 50 }, { isDoubleWeight: false }),
    ).toBe(500);
  });

  it('treats a zero per-side weight as present, not missing', () => {
    expect(
      setWorkingVolume(
        {
          setType: SetType.WORKING,
          reps: 10,
          weight: 25,
          repsLeft: 10,
          repsRight: 10,
          weightLeft: 50,
          weightRight: 0,
        },
        { isDoubleWeight: false },
      ),
    ).toBe(500);
  });

  it('excludes non-working sets regardless of per-side data', () => {
    expect(
      setWorkingVolume(
        {
          setType: SetType.WARMUP,
          reps: 10,
          weight: 50,
          repsLeft: 10,
          repsRight: 10,
          weightLeft: 50,
          weightRight: 50,
        },
        { isDoubleWeight: true },
      ),
    ).toBe(0);
  });
});
