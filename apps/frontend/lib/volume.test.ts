import { describe, expect, it } from 'vitest';
import { setWorkingVolume } from './volume';
import { SetType } from '@/types';

/**
 * Direct coverage for the shared frontend volume helper -- the twin of the
 * backend `setWorkingVolume`. Locks in the four flag combinations plus the
 * warmup exclusion so the semantic change in the follow-up ticket is a single
 * visible edit here and in the backend.
 */
const workingSet = { setType: SetType.WORKING, reps: 10, weight: 50 };

describe('setWorkingVolume', () => {
  it('multiplies reps × weight for a plain working set', () => {
    expect(
      setWorkingVolume(workingSet, { isUnilateral: false, isDoubleWeight: false }),
    ).toBe(500);
  });

  it('doubles for a unilateral exercise', () => {
    expect(
      setWorkingVolume(workingSet, { isUnilateral: true, isDoubleWeight: false }),
    ).toBe(1000);
  });

  it('doubles for a double-weight exercise', () => {
    expect(
      setWorkingVolume(workingSet, { isUnilateral: false, isDoubleWeight: true }),
    ).toBe(1000);
  });

  it('quadruples when the exercise is both unilateral and double-weight', () => {
    expect(
      setWorkingVolume(workingSet, { isUnilateral: true, isDoubleWeight: true }),
    ).toBe(2000);
  });

  it('excludes warmup sets regardless of flags', () => {
    expect(
      setWorkingVolume(
        { setType: SetType.WARMUP, reps: 10, weight: 50 },
        { isUnilateral: true, isDoubleWeight: true },
      ),
    ).toBe(0);
  });

  it('treats missing flags as not set', () => {
    expect(setWorkingVolume(workingSet, {})).toBe(500);
  });
});
