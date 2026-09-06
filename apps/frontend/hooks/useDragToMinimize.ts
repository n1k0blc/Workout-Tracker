'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DRAG_TO_MINIMIZE, dragAnimationMs, shouldCommitDrag } from '@/lib/drag-to-minimize';

export type DragPhase = 'idle' | 'dragging' | 'committing' | 'springing';

/** Ignore pointer samples closer together than this when measuring release speed. */
const VELOCITY_WINDOW_MS = 20;

interface UseDragToMinimize {
  /** `dragging` follows the finger; `committing`/`springing` animate to rest. */
  phase: DragPhase;
  /** Downward offset while dragging, px (never negative -- pulling up resists). */
  dragY: number;
  /** Commit / spring-back duration to drive the CSS transition (0 under reduced motion). */
  animationMs: number;
  /** Spread onto the drag handle. */
  onPointerDown: (e: React.PointerEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}

/**
 * Pointer-driven drag on the workout handle that collapses the session (issue #131).
 * Pointer events, so a mouse works too; window-level move/up listeners so the drag
 * survives the finger leaving the 28px handle. `onMinimize` is the shared minimize
 * action -- a committed drag and a plain tap both route through it.
 *
 * Deliberately separate from the horizontal, document-level `useSwipe`: this one is
 * vertical, handle-scoped, and must not disturb row swipes or list scrolling.
 */
export function useDragToMinimize(onMinimize: () => void): UseDragToMinimize {
  const [phase, setPhase] = useState<DragPhase>('idle');
  const [dragY, setDragY] = useState(0);

  const onMinimizeRef = useRef(onMinimize);
  useEffect(() => {
    onMinimizeRef.current = onMinimize;
  });

  // Read inside the per-gesture pointerdown handler (a stable useCallback).
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Whether the current gesture ever moved past the tap slop, in any direction --
  // a moved gesture is a drag, so its trailing click must not also minimize.
  const movedRef = useRef(false);

  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  const settle = useCallback((next: 'committing' | 'springing') => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    setPhase(next);
    settleTimer.current = setTimeout(() => {
      if (next === 'committing') onMinimizeRef.current();
      setPhase('idle');
      setDragY(0);
    }, dragAnimationMs());
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Ignore a re-grab while a previous gesture is still animating out.
    if (phaseRef.current !== 'idle') return;

    const pointerId = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;
    movedRef.current = false;
    let dragging = false;
    let prev = { y: startY, t: e.timeStamp };
    let latest = prev;

    const sample = (y: number, t: number) => {
      if (t - prev.t >= VELOCITY_WINDOW_MS) prev = latest;
      latest = { y, t };
    };

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const dy = ev.clientY - startY;
      if (!movedRef.current && Math.hypot(ev.clientX - startX, dy) > DRAG_TO_MINIMIZE.tapSlop) {
        movedRef.current = true;
      }
      // Only a *downward* pull moves the sheet; pulling up resists (does nothing).
      if (!dragging && dy > DRAG_TO_MINIMIZE.tapSlop) {
        dragging = true;
        setPhase('dragging');
      }
      if (!dragging) return;
      sample(ev.clientY, ev.timeStamp);
      setDragY(Math.max(0, dy));
      ev.preventDefault(); // stop the gesture also scrolling the list on touch
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (!dragging) return; // a tap, or a pure upward pull -- nothing to settle

      sample(ev.clientY, ev.timeStamp);
      const dt = latest.t - prev.t;
      const velocity = dt > 0 ? (latest.y - prev.y) / dt : 0;
      const commit = shouldCommitDrag({
        dragY: Math.max(0, ev.clientY - startY),
        velocity,
        viewportHeight: window.innerHeight,
      });
      settle(commit ? 'committing' : 'springing');
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }, [settle]);

  const onClick = useCallback((e: React.MouseEvent) => {
    // Keyboard activation (Enter/Space) reports detail 0 and can't have dragged.
    if (e.detail === 0) {
      onMinimizeRef.current();
      return;
    }
    if (!movedRef.current && phaseRef.current === 'idle') onMinimizeRef.current();
  }, []);

  return { phase, dragY, animationMs: dragAnimationMs(), onPointerDown, onClick };
}
