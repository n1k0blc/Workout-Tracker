'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { macroConsistencyHint, parseAmount } from '@/lib/nutrition';

export interface QuickEntrySlot {
  id: string;
  name: string;
}

/**
 * The Schnelleintrag form (design screen 05), as a bottom sheet: name, kcal, the three macro
 * fields, and Abschnitt chips defaulting to the slot it was opened from. The consistency hint
 * spells out what the macros imply without changing what gets saved. The "Als Lebensmittel
 * speichern" toggle is deliberately absent -- it needs the Food model (#144).
 */
export function QuickEntrySheet({
  open,
  onOpenChange,
  slots,
  defaultSlotId,
  date,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slots: QuickEntrySlot[];
  defaultSlotId: string | null;
  date: string;
  onCreated: () => void;
}) {
  const [slotId, setSlotId] = useState<string | null>(defaultSlotId);
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [carbs, setCarbs] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset to a clean form on the closed -> open transition, seeded with the slot it opened
  // for. Done during render (the "adjust state when a prop changes" pattern) rather than in an
  // effect, so there is no post-paint flash of the previous entry's values.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSlotId(defaultSlotId ?? slots[0]?.id ?? null);
      setName('');
      setKcal('');
      setCarbs('');
      setProtein('');
      setFat('');
      setSaving(false);
    }
  }

  const kcalValue = parseAmount(kcal);
  const macros = {
    carbs: parseAmount(carbs) ?? 0,
    protein: parseAmount(protein) ?? 0,
    fat: parseAmount(fat) ?? 0,
  };
  const hint = kcalValue === null ? null : macroConsistencyHint(kcalValue, macros);
  const canSave = !saving && slotId !== null && name.trim() !== '' && kcalValue !== null;

  async function handleSave() {
    if (!canSave || slotId === null || kcalValue === null) return;
    setSaving(true);
    try {
      await apiClient.createDiaryEntry({
        mealSlotId: slotId,
        localDate: date,
        name: name.trim(),
        kcal: kcalValue,
        carbs: macros.carbs,
        protein: macros.protein,
        fat: macros.fat,
      });
      onOpenChange(false);
      onCreated();
    } catch {
      toast.error('Eintrag konnte nicht gespeichert werden');
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader>
          <DrawerTitle>Schnelleintrag</DrawerTitle>
          <DrawerDescription>
            Nur für diesen Tag. Wird nicht als Lebensmittel gespeichert.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-2">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Bezeichnung
            </span>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Kantine · Gemüsepfanne"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Kalorien
            </span>
            <div className="flex items-baseline gap-2 border-b border-b-foreground">
              <Input
                inputMode="decimal"
                value={kcal}
                onChange={(e) => setKcal(e.target.value)}
                placeholder="0"
                className="border-b-0 text-2xl font-bold"
              />
              <span className="text-[13px] text-muted-foreground">kcal</span>
            </div>
          </label>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Kohlenh.', value: carbs, set: setCarbs },
              { label: 'Protein', value: protein, set: setProtein },
              { label: 'Fett', value: fat, set: setFat },
            ].map((field) => (
              <label key={field.label} className="block">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {field.label}
                </span>
                <div className="flex items-baseline gap-1">
                  <Input
                    inputMode="decimal"
                    value={field.value}
                    onChange={(e) => field.set(e.target.value)}
                    placeholder="0"
                  />
                  <span className="text-xs text-muted-foreground">g</span>
                </div>
              </label>
            ))}
          </div>

          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Abschnitt
            </div>
            <div className="flex flex-wrap gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => setSlotId(slot.id)}
                  className={cn(
                    'h-9 border px-4 text-[11px] font-semibold uppercase tracking-[0.12em]',
                    slot.id === slotId
                      ? 'border-transparent bg-primary text-primary-foreground'
                      : 'border-border bg-transparent text-foreground',
                  )}
                >
                  {slot.name}
                </button>
              ))}
            </div>
          </div>

          {hint && (
            <div className="flex items-start gap-2.5 border p-3.5 text-xs text-muted-foreground">
              <span>{hint}</span>
            </div>
          )}
        </div>

        <DrawerFooterButtons
          onCancel={() => onOpenChange(false)}
          onSave={handleSave}
          canSave={canSave}
        />
      </DrawerContent>
    </Drawer>
  );
}

function DrawerFooterButtons({
  onCancel,
  onSave,
  canSave,
}: {
  onCancel: () => void;
  onSave: () => void;
  canSave: boolean;
}) {
  return (
    <div className="mt-auto flex gap-2 border-t p-4">
      <Button className="flex-1" onClick={onSave} disabled={!canSave}>
        Speichern
      </Button>
      <Button variant="outline" onClick={onCancel}>
        Abbrechen
      </Button>
    </div>
  );
}
