'use client';

import { IconChevronLeft, IconChevronRight, IconCalendar } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { addDays, relativeDayLabel } from '@/lib/nutrition';
import { fromLocalDateString, toLocalDateString } from '@/lib/local-date';

function formatFullDate(localDate: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(fromLocalDateString(localDate));
}

/**
 * The Tagesansicht date bar: prev/next arrows, a calendar popover, and the day's label
 * ("Heute" / weekday) with its full date. Day changes flow up through `onChange`.
 */
export function NutritionDayBar({
  date,
  today,
  onChange,
}: {
  date: string;
  today: string;
  onChange: (date: string) => void;
}) {
  return (
    <div className="flex h-14 items-center justify-between border bg-card px-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Vorheriger Tag"
        onClick={() => onChange(addDays(date, -1))}
      >
        <IconChevronLeft />
      </Button>

      <div className="text-center">
        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {relativeDayLabel(date, today)}
        </div>
        <div className="mt-0.5 text-sm font-semibold">{formatFullDate(date)}</div>
      </div>

      <div className="flex items-center">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Datum wählen">
              <IconCalendar />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={fromLocalDateString(date)}
              defaultMonth={fromLocalDateString(date)}
              onSelect={(picked) => {
                if (picked) onChange(toLocalDateString(picked));
              }}
            />
          </PopoverContent>
        </Popover>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Nächster Tag"
          onClick={() => onChange(addDays(date, 1))}
        >
          <IconChevronRight />
        </Button>
      </div>
    </div>
  );
}
