'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { IconArrowLeft, IconPencil, IconPlus } from '@tabler/icons-react';
import { ProtectedRoute } from '@/components/protected-route';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { DiaryEntry, NutritionDay, NutritionDaySlot } from '@/types';
import { isLocalDate, toLocalDateString } from '@/lib/local-date';
import { formatKcal } from '@/lib/nutrition';
import { DiaryEntryRow } from '@/components/nutrition/diary-entry-row';
import { QuickEntrySheet } from '@/components/nutrition/quick-entry-sheet';
import { QuantityEditorSheet } from '@/components/nutrition/quantity-editor-sheet';

function formatGrams(value: number): string {
  return `${value.toLocaleString('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} g`;
}

function TotalsCell({
  value,
  label,
  border,
}: {
  value: string;
  label: string;
  border: string;
}) {
  return (
    <div className={`p-4 text-center ${border}`}>
      <div className="text-xl font-bold">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

export default function AbschnittPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slotId = params?.slotId as string;

  const today = useMemo(() => toLocalDateString(new Date()), []);
  const dateParam = searchParams.get('date');
  // The Abschnitt page is scoped to the day it was opened from -- there is no day navigation
  // here (design decision, supersedes the epic's prev/next arrows).
  const date = dateParam && isLocalDate(dateParam) ? dateParam : today;

  const [day, setDay] = useState<NutritionDay | null>(null);
  const [loading, setLoading] = useState(true);

  const [quickOpen, setQuickOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<DiaryEntry | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDay(await apiClient.getNutritionDay(date));
    } catch (error) {
      console.error('Failed to load nutrition day:', error);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const slot: NutritionDaySlot | undefined = day?.slots.find((s) => s.id === slotId);

  async function handleDelete(entry: DiaryEntry) {
    try {
      await apiClient.deleteDiaryEntry(entry.id);
      await load();
      toast('Eintrag gelöscht', {
        description: `${entry.name} · ${formatKcal(entry.kcal)} kcal`,
        action: {
          label: 'Widerrufen',
          onClick: async () => {
            try {
              await apiClient.createDiaryEntry({
                mealSlotId: entry.mealSlotId,
                localDate: entry.localDate,
                name: entry.name,
                kcal: entry.kcal,
                carbs: entry.carbs,
                protein: entry.protein,
                fat: entry.fat,
                quantity: entry.quantity,
                quantityLabel: entry.quantityLabel ?? undefined,
              });
              await load();
            } catch {
              toast.error('Wiederherstellen fehlgeschlagen');
            }
          },
        },
      });
    } catch {
      toast.error('Eintrag konnte nicht gelöscht werden');
    }
  }

  return (
    <ProtectedRoute>
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col">
        <header className="relative flex h-16 items-center justify-between border-b px-2">
          <Button variant="ghost" size="icon" asChild aria-label="Zurück">
            <Link href={`/nutrition?date=${date}`}>
              <IconArrowLeft />
            </Link>
          </Button>
          <div className="absolute left-1/2 -translate-x-1/2 text-lg font-semibold uppercase tracking-[0.05em]">
            {slot?.name ?? 'Abschnitt'}
          </div>
          {/* Renaming an Abschnitt is part of "Abschnitte verwalten" (#142). */}
          <Button variant="ghost" size="icon" disabled aria-label="Abschnitt bearbeiten">
            <IconPencil />
          </Button>
        </header>

        {slot ? (
          <>
            <div className="flex-1 space-y-5 px-4 pt-5">
              <div className="grid grid-cols-2 border bg-card">
                <TotalsCell
                  value={formatKcal(slot.totals.kcal)}
                  label="kcal"
                  border="border-b border-r"
                />
                <TotalsCell
                  value={formatGrams(slot.totals.carbs)}
                  label="Kohlenhydrate"
                  border="border-b"
                />
                <TotalsCell
                  value={formatGrams(slot.totals.protein)}
                  label="Protein"
                  border="border-r"
                />
                <TotalsCell value={formatGrams(slot.totals.fat)} label="Fett" border="" />
              </div>

              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Einzeleinträge
                </div>
                {slot.entries.length > 0 ? (
                  <>
                    {/* TODO(#147): entries sharing a mealId group under the meal's name. */}
                    <div className="divide-y border bg-card">
                      {slot.entries.map((entry) => (
                        <DiaryEntryRow
                          key={entry.id}
                          entry={entry}
                          onEdit={() => {
                            setEditEntry(entry);
                            setEditOpen(true);
                          }}
                          onDelete={() => handleDelete(entry)}
                        />
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Tippen bearbeitet die Menge · Nach links wischen löscht
                    </p>
                  </>
                ) : (
                  <div className="border bg-card p-8 text-center text-sm text-muted-foreground">
                    Noch nichts erfasst
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 border-t bg-background p-4">
              {slot.archived ? (
                <p className="text-center text-xs text-muted-foreground">
                  Dieser Abschnitt ist archiviert · nur die vorhandenen Einträge lassen sich
                  noch bearbeiten.
                </p>
              ) : (
                <div className="flex gap-2">
                  {/* TODO(#144): "Hinzufügen" opens the food / meal picker; both open Schnelleintrag for now. */}
                  <Button className="flex-1" onClick={() => setQuickOpen(true)}>
                    <IconPlus data-icon="inline-start" />
                    Hinzufügen
                  </Button>
                  <Button variant="outline" onClick={() => setQuickOpen(true)}>
                    Schnelleintrag
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {loading ? 'Lädt …' : 'Abschnitt nicht gefunden'}
            </p>
            {!loading && (
              <Button variant="outline" asChild>
                <Link href={`/nutrition?date=${date}`}>Zur Tagesansicht</Link>
              </Button>
            )}
          </div>
        )}
      </div>

      <QuickEntrySheet
        open={quickOpen}
        onOpenChange={setQuickOpen}
        slots={(day?.slots ?? [])
          .filter((s) => !s.archived)
          .map((s) => ({ id: s.id, name: s.name }))}
        defaultSlotId={slotId}
        date={date}
        onCreated={load}
      />
      <QuantityEditorSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        entry={editEntry}
        onSaved={load}
      />
    </ProtectedRoute>
  );
}
