'use client';

import { Food } from '@/types';
import { ScanFlow } from './scan-flow';

/**
 * Scanning a product into the picker's basket (#149): {@link ScanFlow} resolves the barcode,
 * this hands the food and its amount to the caller at the end of it. Nothing is written here --
 * the Eintrag is created when the basket is saved, together with whatever was picked by search.
 *
 * Render it from the page, not from the picker drawer -- see the note on `ScanFlow`.
 */
export function ScanToLog({
  open,
  onOpenChange,
  slotName,
  onScanned,
  onCancel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slotName: string;
  /** A scanned food with its chosen amount -- put it in the basket. */
  onScanned: (food: Food, grams: number, quantityLabel: string) => void;
  /** The user dismissed the scanner -- see {@link ScanFlow}. */
  onCancel?: () => void;
}) {
  return (
    <ScanFlow
      open={open}
      onOpenChange={onOpenChange}
      mode={{
        kind: 'log',
        slotName,
        onLog: async (food, grams, quantityLabel) => onScanned(food, grams, quantityLabel),
      }}
      onCancel={onCancel}
    />
  );
}
