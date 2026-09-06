/**
 * Thresholds for the drag-to-minimize gesture (issue #131), kept together so the
 * design pass can tune them without hunting.
 */
export const DRAG_TO_MINIMIZE = {
  /** Release past this fraction of the viewport height commits the collapse. */
  commitDistanceFraction: 0.25,
  /** A downward flick at or above this speed (px/ms) commits regardless of distance. */
  commitFlickVelocity: 0.5,
  /** Commit and spring-back animation duration, ms. */
  animationMs: 200,
  /** Pointer travel (px) below which a gesture is a tap, not a drag. */
  tapSlop: 4,
} as const;

/**
 * Whether releasing the drag here should collapse the workout (vs. spring back).
 * `velocity` is px/ms, positive downward.
 */
export function shouldCommitDrag(params: {
  dragY: number;
  velocity: number;
  viewportHeight: number;
}): boolean {
  const { dragY, velocity, viewportHeight } = params;
  if (dragY <= 0) return false;
  if (velocity >= DRAG_TO_MINIMIZE.commitFlickVelocity) return true;
  return dragY > viewportHeight * DRAG_TO_MINIMIZE.commitDistanceFraction;
}

/** The commit / spring-back duration, or 0 when the viewer asked for reduced motion. */
export function dragAnimationMs(): number {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) {
    return 0;
  }
  return DRAG_TO_MINIMIZE.animationMs;
}
