'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildQuantityStops } from '@/lib/nutrition';
import { FieldError } from '@/components/ui/field';
import { useValidationMessage } from '@/hooks/useApiErrorMessage';
import { AMOUNT_MAX, AMOUNT_MIN, checkAmountText } from '@/lib/field-rules';

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
  onValidityChange,
}: {
  portions: StepperPortion[];
  isLiquid: boolean;
  grams: number;
  portionLabel: string | null;
  onChange: (grams: number, portionLabel: string | null) => void;
  /** False while the free field holds an amount that is not applied, so the caller can hold back its save. */
  onValidityChange?: (valid: boolean) => void;
}) {
  const t = useTranslations('QuantityStepper');
  const stops = useMemo(() => buildQuantityStops(portions), [portions]);
  const unit = isLiquid ? 'ml' : 'g';
  const [freeText, setFreeText] = useState('');
  const validationMessage = useValidationMessage();
  const freeProblem =
    freeText.trim() === '' ? null : checkAmountText(freeText, AMOUNT_MIN, AMOUNT_MAX);
  const freeMessage = freeProblem
    ? validationMessage('grams', freeProblem, { min: AMOUNT_MIN, max: AMOUNT_MAX, unit })
    : undefined;

  // The caller's callback is usually a fresh closure each render; it is read through a ref so the
  // effect below reports only when the free field's validity changes.
  const onValidityChangeRef = useRef(onValidityChange);
  useEffect(() => {
    onValidityChangeRef.current = onValidityChange;
  });
  useEffect(() => {
    onValidityChangeRef.current?.(!freeProblem);
    return () => onValidityChangeRef.current?.(true);
  }, [freeProblem]);

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
    if (text.trim() !== '' && !checkAmountText(text, AMOUNT_MIN, AMOUNT_MAX)) {
      onChange(Number(text.trim().replace(',', '.')), null);
    }
  }

  const usingFree = freeText.trim() !== '';
  const valueText = portionLabel && !usingFree ? portionLabel : `${Math.round(grams)} ${unit}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {t('amount')}
        </span>
        <div className="flex items-center border">
          <Button variant="ghost" size="icon-sm" aria-label={t('less')} onClick={() => step(-1)}>
            <IconChevronLeft />
          </Button>
          <span className="min-w-[110px] px-1 text-center text-sm font-semibold">
            {valueText}
          </span>
          <Button variant="ghost" size="icon-sm" aria-label={t('more')} onClick={() => step(1)}>
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
          {t('free')}
        </span>
        <div className="flex w-24 items-baseline gap-1 border-b border-b-input">
          <Input
            inputMode="decimal"
            value={freeText}
            onChange={(e) => onFreeChange(e.target.value)}
            placeholder={String(Math.round(grams))}
            className="h-9 border-b-0"
            aria-invalid={freeMessage ? true : undefined}
            aria-describedby={freeMessage ? 'free-amount-error' : undefined}
          />
          <span className="text-xs text-muted-foreground">{unit}</span>
        </div>
      </div>
      <FieldError id="free-amount-error">{freeMessage}</FieldError>
    </div>
  );
}
