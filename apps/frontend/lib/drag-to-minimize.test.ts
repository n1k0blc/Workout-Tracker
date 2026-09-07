import { describe, it, expect } from 'vitest';
import { shouldCommitDrag, DRAG_TO_MINIMIZE } from '@/lib/drag-to-minimize';

const viewportHeight = 800; // quarter = 200px

describe('shouldCommitDrag', () => {
  it('does not commit a gesture that never moved down', () => {
    expect(shouldCommitDrag({ dragY: 0, velocity: 0, viewportHeight })).toBe(false);
    expect(shouldCommitDrag({ dragY: -50, velocity: 0, viewportHeight })).toBe(false);
  });

  it('springs back below a quarter of the viewport when released slowly', () => {
    expect(shouldCommitDrag({ dragY: 199, velocity: 0.1, viewportHeight })).toBe(false);
  });

  it('commits past a quarter of the viewport even when released slowly', () => {
    expect(shouldCommitDrag({ dragY: 201, velocity: 0, viewportHeight })).toBe(true);
  });

  it('treats exactly a quarter of the viewport as not far enough', () => {
    expect(shouldCommitDrag({ dragY: 200, velocity: 0, viewportHeight })).toBe(false);
  });

  it('commits a short drag on a fast downward flick', () => {
    expect(
      shouldCommitDrag({ dragY: 40, velocity: DRAG_TO_MINIMIZE.commitFlickVelocity, viewportHeight }),
    ).toBe(true);
  });

  it('ignores a fast upward flick (no downward distance)', () => {
    expect(shouldCommitDrag({ dragY: 0, velocity: -2, viewportHeight })).toBe(false);
  });
});
