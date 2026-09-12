'use client';

import Link from 'next/link';
import { IconChevronRight, IconPlus } from '@tabler/icons-react';
import { NutritionDaySlot } from '@/types';
import { Button } from '@/components/ui/button';
import { formatKcal } from '@/lib/nutrition';
import { SlotIcon } from './slot-icon';

/**
 * One Abschnitt row on the Tagesansicht. The body links through to the Abschnitt page for the
 * day in view; the "+" opens the food picker for this slot (#144). An archived Abschnitt only
 * appears here on a past day that has entries in it, and renders read-only -- no "+", muted
 * label (#142).
 */
export function MealSlotRow({
  slot,
  date,
  onQuickAdd,
}: {
  slot: NutritionDaySlot;
  date: string;
  onQuickAdd: () => void;
}) {
  const subtitle = slot.entries.length
    ? slot.entries.map((e) => e.name).join(', ')
    : 'Noch nichts erfasst';

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex size-10 shrink-0 items-center justify-center bg-muted text-foreground">
        <SlotIcon name={slot.name} className="size-5" />
      </div>

      <Link
        href={`/nutrition/slots/${slot.id}?date=${date}`}
        className="min-w-0 flex-1"
      >
        <div className="flex items-center gap-1.5">
          <span
            className={`text-sm font-semibold uppercase tracking-wide ${
              slot.archived ? 'text-muted-foreground' : ''
            }`}
          >
            {slot.name}
          </span>
          <IconChevronRight className="size-3.5 text-muted-foreground" />
          {slot.archived && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              archiviert
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[13px] font-semibold">
          {formatKcal(slot.totals.kcal)} kcal
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</div>
      </Link>

      {!slot.archived && (
        <Button
          variant="outline"
          size="icon"
          aria-label={`${slot.name}: Lebensmittel hinzufügen`}
          onClick={onQuickAdd}
        >
          <IconPlus />
        </Button>
      )}
    </div>
  );
}
