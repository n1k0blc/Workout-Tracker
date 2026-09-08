'use client';

import { useMemo, useState } from 'react';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildQuantityStops, parseAmount } from '@/lib/nutrition';

export interface StepperPortion {
  label: string;
  grams: number;
  order: number;
}

/**
 * Picks an amount of a food: arrows step through the food's named portions and then round
 * gram/ml presets; the "Frei" field takes any exact amount. Controlled -- the parent holds
 * `{ grams, portionLabel }` (portionLabel `null` for a free amount) and applies the entry's
 * unit label with `formatQuantityLabel`.
 */
export function QuantityStepper({
  portions,
  isLiquid,
  grams,
  portionLabel,
  onChange,
}: {
  portions: StepperPortion[];
  isLiquid: boolean;
  grams: number;
  portionLabel: string | null;
  onChange: (grams: number, portionLabel: string | null) => void;
}) {
  const stops = useMemo(() => buildQuantityStops(portions), [portions]);
  const unit = isLiquid ? 'ml' : 'g';
  const [freeText, setFreeText] = useState('');

  const currentIndex =
    portionLabel === null && freeText.trim() === ''
      ? stops.findIndex((s) => s.label === null && Math.round(s.grams) === Math.round(grams))
      : portionLabel === null
        ? -1
        : stops.findIndex(
            (s) => s.label === portionLabel && Math.round(s.grams) === Math.round(grams),
          );

  function step(delta: number) {
    setFreeText('');
    const from = currentIndex >= 0 ? currentIndex : 0;
    const next = stops[Math.max(0, Math.min(stops.length - 1, from + delta))];
    if (next) onChange(next.grams, next.label);
  }

  function onFreeChange(text: string) {
    setFreeText(text);
    const value = parseAmount(text);
    if (value !== null && value > 0) onChange(value, null);
  }

  const usingFree = freeText.trim() !== '';
  const valueText = portionLabel && !usingFree ? portionLabel : `${Math.round(grams)} ${unit}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Menge
        </span>
        <div className="flex items-center border">
          <Button variant="ghost" size="icon-sm" aria-label="Weniger" onClick={() => step(-1)}>
            <IconChevronLeft />
          </Button>
          <span className="min-w-[110px] px-1 text-center text-sm font-semibold">
            {valueText}
          </span>
          <Button variant="ghost" size="icon-sm" aria-label="Mehr" onClick={() => step(1)}>
            <IconChevronRight />
          </Button>
        </div>
        {portionLabel && !usingFree && (
          <span className="text-xs text-muted-foreground">
            = {Math.round(grams)} {unit}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Frei
        </span>
        <div className="flex w-24 items-baseline gap-1 border-b border-b-input">
          <Input
            inputMode="decimal"
            value={freeText}
            onChange={(e) => onFreeChange(e.target.value)}
            placeholder={String(Math.round(grams))}
            className="h-9 border-b-0"
          />
          <span className="text-xs text-muted-foreground">{unit}</span>
        </div>
      </div>
    </div>
  );
}
