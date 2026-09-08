'use client';

import { useRef, useState } from 'react';
import { IconChevronRight, IconTrash } from '@tabler/icons-react';
import { DiaryEntry } from '@/types';
import { formatKcal } from '@/lib/nutrition';

const REVEAL_PX = 92; // width of the destructive pane, matches the design
const DELETE_THRESHOLD = 56; // release past this (leftward) and the entry is deleted

/**
 * An Eintrag row. Tap opens the quantity editor; a left swipe past roughly half the pane
 * deletes it immediately (the parent shows the undo toast). The red "Löschen" pane sits
 * behind the row and is uncovered as it slides.
 */
export function DiaryEntryRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: DiaryEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<'undecided' | 'horizontal' | 'vertical'>('undecided');
  const swiped = useRef(false);

  const macroLine = `${Math.round(entry.carbs)} KH · ${Math.round(entry.protein)} P · ${Math.round(
    entry.fat,
  )} F`;

  function onPointerDown(e: React.PointerEvent) {
    start.current = { x: e.clientX, y: e.clientY };
    axis.current = 'undecided';
    swiped.current = false;
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;

    if (axis.current === 'undecided') {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      if (axis.current === 'horizontal') {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    }
    if (axis.current !== 'horizontal') return;

    swiped.current = true;
    setDragX(Math.max(-REVEAL_PX, Math.min(0, dx)));
  }

  function onPointerUp() {
    const shouldDelete = dragX <= -DELETE_THRESHOLD;
    start.current = null;
    setDragging(false);
    setDragX(0);
    if (shouldDelete) onDelete();
  }

  return (
    <div className="relative overflow-hidden">
      <div
        className="absolute inset-y-0 right-0 flex w-[92px] flex-col items-center justify-center gap-1 bg-destructive text-white"
        aria-hidden={dragX === 0}
      >
        <IconTrash className="size-5" />
        <span className="text-[10px] font-semibold uppercase tracking-wider">Löschen</span>
      </div>

      <button
        type="button"
        onClick={() => {
          if (swiped.current) {
            swiped.current = false;
            return;
          }
          onEdit();
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? 'none' : 'transform 150ms ease',
        }}
        className="relative flex w-full touch-pan-y items-center gap-3 bg-card px-3.5 py-3 text-left select-none"
      >
        <div className="min-w-0 flex-1">
          <div className="text-sm">{entry.name}</div>
          {entry.quantityLabel && (
            <div className="mt-0.5 text-xs text-muted-foreground">{entry.quantityLabel}</div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[13px] font-semibold">{formatKcal(entry.kcal)} kcal</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{macroLine}</div>
        </div>
        <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </div>
  );
}
