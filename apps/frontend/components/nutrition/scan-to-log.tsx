'use client';

import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { Food } from '@/types';
import { ScanFlow } from './scan-flow';

/**
 * Scanning a product into an Abschnitt (#149): {@link ScanFlow} resolves the barcode, this
 * writes the Eintrag at the end of it.
 *
 * Render it from the page, not from the picker drawer -- see the note on `ScanFlow`.
 */
export function ScanToLog({
  open,
  onOpenChange,
  slotId,
  slotName,
  date,
  onLogged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slotId: string;
  slotName: string;
  date: string;
  /** An Eintrag was written -- reload the day behind this. */
  onLogged: () => void;
}) {
  async function logScanned(food: Food, grams: number, quantityLabel: string) {
    await apiClient.createDiaryEntriesBatch({
      mealSlotId: slotId,
      localDate: date,
      items: [{ foodId: food.id, grams, quantityLabel }],
    });
    toast.success(`${food.name} zu ${slotName} hinzugefügt`, { description: quantityLabel });
    onLogged();
  }

  return (
    <ScanFlow
      open={open}
      onOpenChange={onOpenChange}
      mode={{ kind: 'log', slotName, onLog: logScanned }}
    />
  );
}
