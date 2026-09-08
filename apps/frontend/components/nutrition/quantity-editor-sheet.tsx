'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { IconMinus, IconPlus } from '@tabler/icons-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { DiaryEntry } from '@/types';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatKcal } from '@/lib/nutrition';

const STEP = 0.5;
const MIN = 0.5;
const QUICK_FACTORS = [0.5, 1, 1.5, 2];

function formatFactor(n: number): string {
  return `${n.toLocaleString('de-DE')}×`;
}

/**
 * Changes an Eintrag's quantity. The snapshot rescales proportionally: the preview and the
 * saved values are the stored nutrients times newQuantity / current quantity. Bare
 * Schnelleinträge have no unit, so the control is a plain multiplier -- a unit-aware editor
 * for food and meal entries comes with #144 / #147.
 */
export function QuantityEditorSheet({
  open,
  onOpenChange,
  entry,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: DiaryEntry | null;
  onSaved: () => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);

  // Seed the stepper from the entry on the closed -> open transition (adjust-state-on-prop-
  // change, done in render so there is no flash of a stale quantity).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && entry) {
      setQuantity(entry.quantity);
      setSaving(false);
    }
  }

  if (!entry) return null;

  const ratio = quantity / entry.quantity;
  const preview = {
    kcal: entry.kcal * ratio,
    carbs: entry.carbs * ratio,
    protein: entry.protein * ratio,
    fat: entry.fat * ratio,
  };
  const changed = quantity !== entry.quantity;

  async function handleSave() {
    if (!entry || !changed || saving) return;
    setSaving(true);
    try {
      await apiClient.updateDiaryEntryQuantity(entry.id, quantity);
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error('Menge konnte nicht geändert werden');
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader>
          <DrawerTitle>Menge ändern</DrawerTitle>
        </DrawerHeader>

        <div className="flex flex-col gap-5 px-4 pb-2">
          <div className="text-sm font-medium">{entry.name}</div>

          <div className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Menge
            </span>
            <div className="flex items-center border">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Weniger"
                disabled={quantity - STEP < MIN}
                onClick={() => setQuantity((q) => Math.max(MIN, Math.round((q - STEP) * 100) / 100))}
              >
                <IconMinus />
              </Button>
              <span className="min-w-[76px] text-center text-sm font-semibold">
                {formatFactor(quantity)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Mehr"
                onClick={() => setQuantity((q) => Math.round((q + STEP) * 100) / 100)}
              >
                <IconPlus />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_FACTORS.map((factor) => (
              <button
                key={factor}
                type="button"
                onClick={() => setQuantity(factor)}
                className={cn(
                  'h-9 border px-4 text-xs font-semibold tracking-[0.08em]',
                  factor === quantity
                    ? 'border-transparent bg-primary text-primary-foreground'
                    : 'border-border bg-transparent text-muted-foreground',
                )}
              >
                {formatFactor(factor)}
              </button>
            ))}
          </div>

          <div className="text-xs text-muted-foreground">
            {formatKcal(preview.kcal)} kcal · {Math.round(preview.carbs)} KH ·{' '}
            {Math.round(preview.protein)} P · {Math.round(preview.fat)} F
          </div>
        </div>

        <div className="mt-auto flex gap-2 border-t p-4">
          <Button className="flex-1" onClick={handleSave} disabled={!changed || saving}>
            Übernehmen
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
