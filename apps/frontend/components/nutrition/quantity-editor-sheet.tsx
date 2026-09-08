'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { IconMinus, IconPlus } from '@tabler/icons-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { DiaryEntry, FoodPortion } from '@/types';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatKcal, formatQuantityLabel } from '@/lib/nutrition';
import { QuantityStepper } from './quantity-stepper';

const STEP = 0.5;
const MIN = 0.5;
const QUICK_FACTORS = [0.5, 1, 1.5, 2];

function formatFactor(n: number): string {
  return `${n.toLocaleString('de-DE')}×`;
}

interface FoodInfo {
  portions: FoodPortion[];
  isLiquid: boolean;
}

/** Seed the stepper from the entry: match its amount to a portion, else start on free g/ml. */
function seedAmount(entry: DiaryEntry, portions: FoodPortion[]) {
  const portion = portions.find(
    (p) =>
      Math.round(p.grams) === Math.round(entry.quantity) &&
      (entry.quantityLabel ?? '').startsWith(p.label),
  );
  return { grams: entry.quantity, portionLabel: portion ? portion.label : null };
}

/**
 * Changes an Eintrag's quantity. A food-backed entry is edited in real g/ml, stepping through
 * the food's portions -- the snapshot rescales by newQuantity / oldQuantity and the
 * `quantityLabel` is kept in sync. A bare Schnelleintrag has no unit, so it stays a plain
 * multiplier.
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
  const isFoodBacked = entry?.foodId != null;

  const [multiplier, setMultiplier] = useState(1);
  const [amount, setAmount] = useState<{ grams: number; portionLabel: string | null } | null>(
    null,
  );
  const [food, setFood] = useState<FoodInfo | null>(null);
  const [saving, setSaving] = useState(false);

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && entry) {
      setMultiplier(entry.quantity);
      setAmount(null);
      setFood(null);
      setSaving(false);
    }
  }

  // Food-backed: load the food for its portions and unit, then seed the stepper from the entry.
  useEffect(() => {
    if (!open || !entry?.foodId) return;
    let cancelled = false;
    apiClient
      .getFood(entry.foodId)
      .then((f) => {
        if (cancelled) return;
        setFood({ portions: f.portions, isLiquid: f.isLiquid });
        setAmount(seedAmount(entry, f.portions));
      })
      .catch(() => {
        if (cancelled) return;
        setFood({ portions: [], isLiquid: (entry.quantityLabel ?? '').includes('ml') });
        setAmount({ grams: entry.quantity, portionLabel: null });
      });
    return () => {
      cancelled = true;
    };
  }, [open, entry]);

  if (!entry) return null;

  const currentQty = isFoodBacked ? (amount?.grams ?? entry.quantity) : multiplier;
  const ratio = currentQty / entry.quantity;
  const preview = {
    kcal: entry.kcal * ratio,
    carbs: entry.carbs * ratio,
    protein: entry.protein * ratio,
    fat: entry.fat * ratio,
  };
  const changed = currentQty !== entry.quantity;

  async function handleSave() {
    if (!entry || !changed || saving) return;
    setSaving(true);
    try {
      if (isFoodBacked && amount && food) {
        await apiClient.updateDiaryEntryQuantity(
          entry.id,
          amount.grams,
          formatQuantityLabel(amount.portionLabel, amount.grams, food.isLiquid),
        );
      } else {
        await apiClient.updateDiaryEntryQuantity(entry.id, multiplier);
      }
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

          {isFoodBacked ? (
            !food || !amount ? (
              <p className="py-4 text-sm text-muted-foreground">Lädt …</p>
            ) : (
              <QuantityStepper
                portions={food.portions}
                isLiquid={food.isLiquid}
                grams={amount.grams}
                portionLabel={amount.portionLabel}
                onChange={(grams, portionLabel) => setAmount({ grams, portionLabel })}
              />
            )
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Menge
                </span>
                <div className="flex items-center border">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Weniger"
                    disabled={multiplier - STEP < MIN}
                    onClick={() =>
                      setMultiplier((q) => Math.max(MIN, Math.round((q - STEP) * 100) / 100))
                    }
                  >
                    <IconMinus />
                  </Button>
                  <span className="min-w-[76px] text-center text-sm font-semibold">
                    {formatFactor(multiplier)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Mehr"
                    onClick={() => setMultiplier((q) => Math.round((q + STEP) * 100) / 100)}
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
                    onClick={() => setMultiplier(factor)}
                    className={cn(
                      'h-9 border px-4 text-xs font-semibold tracking-[0.08em]',
                      factor === multiplier
                        ? 'border-transparent bg-primary text-primary-foreground'
                        : 'border-border bg-transparent text-muted-foreground',
                    )}
                  >
                    {formatFactor(factor)}
                  </button>
                ))}
              </div>
            </>
          )}

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
