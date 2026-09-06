'use client';

import { cn } from '@/lib/utils';
import type { DragPhase } from '@/hooks/useDragToMinimize';

interface WorkoutDragHandleProps {
  phase: DragPhase;
  onPointerDown: (e: React.PointerEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}

/**
 * The grab strip at the top of the workout screen (issue #128 / #131). Deliberately
 * a short bar, not a chevron -- the same visual language as the collapsed
 * set-progress indicators, one notch heavier so it reads as grabbable. Drag it down
 * to collapse the session; a plain tap collapses it too.
 */
export function WorkoutDragHandle({ phase, onPointerDown, onClick }: WorkoutDragHandleProps) {
  return (
    <button
      type="button"
      aria-label="Workout minimieren"
      onPointerDown={onPointerDown}
      onClick={onClick}
      className="flex h-7 w-full shrink-0 touch-none cursor-grab items-center justify-center bg-background active:cursor-grabbing"
    >
      <span
        className={cn(
          'h-1 rounded-[1px] bg-muted-foreground/30 transition-[width,background-color] duration-[120ms]',
          phase === 'dragging' ? 'w-24 bg-muted-foreground/75' : 'w-[72px]',
        )}
      />
    </button>
  );
}
