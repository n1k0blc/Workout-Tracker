'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { NutritionDay } from '@/types';
import { fromLocalDateString, toLocalDateString } from '@/lib/local-date';
import { formatKcal, relativeDayLabel } from '@/lib/nutrition';

function formatFullDate(localDate: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(fromLocalDateString(localDate));
}

/**
 * "Von einem anderen Tag kopieren" (#151): pick a previous day and copy that day's entries
 * onto the day this Abschnitt page is scoped to. The date picker only offers days that have
 * entries. Copying either just this Abschnitt or the whole day -- copied entries are fresh
 * snapshots of the source entries (ADR-0002), so a copy never re-reads the current food
 * values.
 */
export function CopyFromDaySheet({
  open,
  onOpenChange,
  slotId,
  slotName,
  date,
  onCopied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slotId: string;
  slotName: string;
  /** The day the Abschnitt page is scoped to -- the copy target. */
  date: string;
  onCopied: () => void;
}) {
  const [sourceDates, setSourceDates] = useState<string[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [preview, setPreview] = useState<NutritionDay | null>(null);
  const [busy, setBusy] = useState(false);

  // Reset on the closed -> open transition (the "adjust state when a prop changes" pattern),
  // so a reopen never flashes the previous run's picked day.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSourceDates(null);
      setPicked(null);
      setPreview(null);
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    let active = true;
    apiClient
      .getDiaryCopySourceDates(date)
      .then((dates) => {
        if (active) setSourceDates(dates);
      })
      .catch(() => {
        if (active) setSourceDates([]);
      });
    return () => {
      active = false;
    };
  }, [open, date]);

  // `preview` is cleared in the select handler, so the effect only ever fills it in -- no
  // synchronous setState in the effect body.
  useEffect(() => {
    if (!picked) return;
    let active = true;
    apiClient
      .getNutritionDay(picked)
      .then((day) => {
        if (active) setPreview(day);
      })
      .catch(() => {
        if (active) toast.error('Vorschau konnte nicht geladen werden');
      });
    return () => {
      active = false;
    };
  }, [picked]);

  const pick = useCallback((day: Date | undefined) => {
    setPreview(null);
    setPicked(day ? toLocalDateString(day) : null);
  }, []);

  const allowed = new Set(sourceDates ?? []);
  const previewSlot = preview?.slots.find((s) => s.id === slotId);
  const canCopySlot = !busy && !!previewSlot && previewSlot.entries.length > 0;
  const canCopyDay = !busy && !!preview && preview.slots.length > 0;

  const run = useCallback(
    async (action: () => Promise<{ count: number }>) => {
      setBusy(true);
      try {
        const { count } = await action();
        onOpenChange(false);
        onCopied();
        toast(
          count === 0
            ? 'Nichts zu übernehmen'
            : `${count} ${count === 1 ? 'Eintrag' : 'Einträge'} übernommen`,
        );
      } catch {
        toast.error('Übernehmen fehlgeschlagen');
        setBusy(false);
      }
    },
    [onOpenChange, onCopied],
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader>
          <DrawerTitle>Von einem anderen Tag kopieren</DrawerTitle>
          <DrawerDescription>
            Überträgt Einträge auf {relativeDayLabel(date, toLocalDateString(new Date()))} ·{' '}
            {formatFullDate(date)}. Kopien sind eigenständige Schnappschüsse.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-2">
          {sourceDates === null ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Lädt …</p>
          ) : sourceDates.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Keine früheren Tage mit Einträgen.
            </p>
          ) : (
            <>
              <div className="flex justify-center border bg-card">
                <Calendar
                  mode="single"
                  selected={picked ? fromLocalDateString(picked) : undefined}
                  defaultMonth={fromLocalDateString(picked ?? sourceDates[0] ?? date)}
                  disabled={(day: Date) => !allowed.has(toLocalDateString(day))}
                  onSelect={pick}
                />
              </div>

              {picked && (
                <div>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    {formatFullDate(picked)}
                  </div>
                  {preview === null ? (
                    <p className="border bg-card p-4 text-center text-sm text-muted-foreground">
                      Lädt …
                    </p>
                  ) : preview.slots.length === 0 ? (
                    <p className="border bg-card p-4 text-center text-sm text-muted-foreground">
                      Nichts erfasst
                    </p>
                  ) : (
                    <div className="divide-y border bg-card">
                      {preview.slots.map((s) => (
                        <div
                          key={s.id}
                          className={cn(
                            'flex items-center justify-between gap-2 px-3.5 py-2.5',
                            s.id === slotId && 'bg-muted/50',
                          )}
                        >
                          <span className="truncate text-[13px] font-medium uppercase tracking-[0.05em]">
                            {s.name}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {s.entries.length}{' '}
                            {s.entries.length === 1 ? 'Eintrag' : 'Einträge'} ·{' '}
                            {formatKcal(s.totals.kcal)} kcal
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-2 border-t p-4">
          <Button
            className="w-full"
            disabled={!picked || !canCopySlot}
            onClick={() =>
              picked &&
              run(() =>
                apiClient.copyDiarySlot({ fromDate: picked, toDate: date, mealSlotId: slotId }),
              )
            }
          >
            Nur {slotName} übernehmen
          </Button>
          <Button
            variant="outline"
            className="w-full"
            disabled={!picked || !canCopyDay}
            onClick={() =>
              picked && run(() => apiClient.copyDiaryDay({ fromDate: picked, toDate: date }))
            }
          >
            Ganzen Tag übernehmen
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
