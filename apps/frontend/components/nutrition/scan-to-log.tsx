'use client';

import { useTranslations } from 'next-intl';
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
  onCancel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slotId: string;
  slotName: string;
  date: string;
  /** An Eintrag was written -- reload the day behind this. */
  onLogged: () => void;
  /** The user dismissed the scanner without logging anything -- see {@link ScanFlow}. */
  onCancel?: () => void;
}) {
  const t = useTranslations('ScanToLog');

  async function logScanned(food: Food, grams: number, quantityLabel: string) {
    await apiClient.createDiaryEntriesBatch({
      mealSlotId: slotId,
      localDate: date,
      items: [{ foodId: food.id, grams, quantityLabel }],
    });
    toast.success(t('added', { food: food.name, slot: slotName }), { description: quantityLabel });
    onLogged();
  }

  return (
    <ScanFlow
      open={open}
      onOpenChange={onOpenChange}
      mode={{ kind: 'log', slotName, onLog: logScanned }}
      onCancel={onCancel}
    />
  );
}
