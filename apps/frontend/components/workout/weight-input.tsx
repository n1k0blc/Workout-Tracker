'use client';

import { useState, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { useUnitSystem } from '@/lib/use-units';
import { setWeightLimit } from '@/lib/field-rules';
import { weightInputString, weightToKg } from '@/lib/units';

/** Decimals a weight may be typed with, in the user's own unit (#227). Client only. */
const WEIGHT_MAX_DECIMALS = 3;

/** True when the number-input value has more decimals than a weight may carry. */
function hasTooManyDecimals(typed: string): boolean {
  return (typed.split('.')[1]?.length ?? 0) > WEIGHT_MAX_DECIMALS;
}

type WeightInputProps = Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  /** Canonical kg as a string -- the form state stays kg; conversion never enters it. */
  valueKg: string;
  /** Called only when the user types, with the typed number converted once to kg. */
  onChangeKg: (kg: string) => void;
};

/**
 * A weight field that shows the user's unit system over kg form state (#186, ADR-0005).
 * Untouched fields display `valueKg` converted and rounded but never write anything back;
 * on an edit the typed number is exact in the user's own unit and converted once. `type` stays
 * "number" so `.value` is period-normalised regardless of locale. Up to three decimals can be
 * typed (micro-plates, pound fractions); a fourth is refused like `e` and `-` are, so the field
 * never holds a value it cannot log exactly.
 */
export function WeightInput({ valueKg, onChangeKg, ...props }: WeightInputProps) {
  const system = useUnitSystem();
  // What the user last typed, kept only while it still describes `valueKg`.
  const [draft, setDraft] = useState<string | null>(null);

  const kg = valueKg.trim() === '' ? NaN : parseFloat(valueKg);
  const draftKg = draft === null ? null : weightToKg(draft, system);
  const draftIsCurrent =
    draft !== null && (draft === '' ? Number.isNaN(kg) : draftKg !== null && Math.abs(draftKg - kg) < 1e-9);
  const shown = draftIsCurrent ? draft : Number.isNaN(kg) ? valueKg : weightInputString(kg, system);

  return (
    <Input
      {...props}
      type="number"
      min={0}
      max={setWeightLimit(system)}
      step="any"
      value={shown}
      onChange={(e) => {
        const typed = e.target.value;
        if (hasTooManyDecimals(typed)) return;
        setDraft(typed);
        const next = weightToKg(typed, system);
        onChangeKg(next === null ? '' : String(next));
      }}
      onBlur={(e) => {
        setDraft(null);
        props.onBlur?.(e);
      }}
    />
  );
}
