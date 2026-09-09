'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { IconAdjustmentsHorizontal } from '@tabler/icons-react';
import { ProtectedRoute } from '@/components/protected-route';
import { Button } from '@/components/ui/button';
import { useSwipe } from '@/hooks/useSwipe';
import { apiClient } from '@/lib/api';
import { NutritionDay } from '@/types';
import { toLocalDateString } from '@/lib/local-date';
import { addDays } from '@/lib/nutrition';
import { NutritionDayBar } from '@/components/nutrition/nutrition-day-bar';
import { NutritionTotalsCard } from '@/components/nutrition/nutrition-totals-card';
import { MealSlotRow } from '@/components/nutrition/meal-slot-row';
import { FoodPickerSheet } from '@/components/nutrition/food-picker-sheet';
import { ScanToLog } from '@/components/nutrition/scan-to-log';
import { ManageSlotsSheet } from '@/components/nutrition/manage-slots-sheet';

export default function NutritionPage() {
  const today = useMemo(() => toLocalDateString(new Date()), []);
  const [date, setDate] = useState(today);
  const [day, setDay] = useState<NutritionDay | null>(null);
  const [loading, setLoading] = useState(true);

  // Which Abschnitt the picker is for, and whether it is showing. Kept apart on purpose: the
  // sheet stays mounted while it animates closed, and clearing the slot in the same breath
  // left it briefly logging against no Abschnitt at all (a 400 from the batch endpoint).
  const [pickerSlot, setPickerSlot] = useState<{ id: string; name: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

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

  // Horizontal swipe moves between days, the same gesture the design calls for. Suspended
  // while a sheet is open so a swipe (or a slot drag) inside it doesn't change the day behind.
  const sheetOpen = pickerOpen || scanOpen || manageOpen;
  useSwipe({
    onSwipeLeft: sheetOpen ? undefined : () => setDate((d) => addDays(d, 1)),
    onSwipeRight: sheetOpen ? undefined : () => setDate((d) => addDays(d, -1)),
  });

  return (
    <ProtectedRoute>
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-6">
        <div className="flex-1 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Ernährung</h2>
            <p className="mt-1 text-sm text-muted-foreground">Kalorien und Makros pro Tag</p>
          </div>

          <NutritionDayBar date={date} today={today} onChange={setDate} />

          {day ? (
            <>
              <NutritionTotalsCard totals={day.totals} targets={day.targets} />

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-lg font-semibold uppercase tracking-[0.05em]">
                    Abschnitte
                  </div>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => setManageOpen(true)}
                  >
                    <IconAdjustmentsHorizontal data-icon="inline-start" />
                    Verwalten
                  </Button>
                </div>

                <div className="divide-y border bg-card">
                  {day.slots.map((slot) => (
                    <MealSlotRow
                      key={slot.id}
                      slot={slot}
                      date={date}
                      onQuickAdd={() => {
                        setPickerSlot({ id: slot.id, name: slot.name });
                        setPickerOpen(true);
                      }}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {loading ? 'Lädt …' : 'Konnte nicht geladen werden'}
            </p>
          )}
        </div>
      </main>

      {pickerSlot && (
        <FoodPickerSheet
          onScanRequest={() => {
            // The picker closes first: the scanner must not open under a modal drawer.
            setPickerOpen(false);
            setScanOpen(true);
          }}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          slotId={pickerSlot.id}
          slotName={pickerSlot.name}
          date={date}
          onCommitted={load}
        />
      )}
      {pickerSlot && (
        <ScanToLog
          open={scanOpen}
          onOpenChange={setScanOpen}
          slotId={pickerSlot.id}
          slotName={pickerSlot.name}
          date={date}
          onLogged={load}
        />
      )}

      <ManageSlotsSheet
        open={manageOpen}
        onOpenChange={setManageOpen}
        onChanged={load}
      />
    </ProtectedRoute>
  );
}
