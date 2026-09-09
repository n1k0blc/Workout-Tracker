'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { BarcodeLookup, Food } from '@/types';
import { FoodEditorDialog } from '@/components/templates/food-editor-dialog';
import { BarcodeScannerSheet } from './barcode-scanner-sheet';

/**
 * Scanning a product into an Abschnitt (#149): the scanner, the "Lebensmittel anlegen" form a
 * double miss leads to, and the Eintrag at the end of it.
 *
 * **This must be rendered by the page, never inside the picker drawer.** The scanner is a
 * full-screen overlay portaled to `document.body`, so nesting it in a drawer put it inside
 * that drawer's React tree and outside its DOM tree. Every consequence of that mismatch was a
 * bug: the drawer's modal layer disabled pointer events on everything outside its own content,
 * its focus trap pulled focus out of the EAN field, and taps on the overlay counted as
 * interaction *outside* the drawer and silently dismissed it -- which took the Abschnitt with
 * it and logged the Eintrag against nothing.
 *
 * As a sibling of the picker there is no modal layer above it, and none of that applies. The
 * page closes the picker before opening this, so the two are never up at once.
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
  // A scanned barcode that matched nothing: the create form opens with it prefilled.
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  // "Prüfen" on an Open Food Facts hit -- its read-only values, before logging them.
  const [inspecting, setInspecting] = useState<Food | null>(null);
  // A food just created from a double miss, handed back to the scanner so the amount step
  // still happens. Scanning was a request to *log* something; creating the Lebensmittel is
  // only half of it.
  const [createdFromScan, setCreatedFromScan] = useState<BarcodeLookup | null>(null);

  useEffect(() => {
    if (open) {
      setScannedBarcode(null);
      setInspecting(null);
      setCreatedFromScan(null);
    }
  }, [open]);

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
    <>
      <BarcodeScannerSheet
        // Remounted when a created food arrives, so it opens on that result rather than the
        // viewfinder -- `initialResult` is read once, as the initial phase.
        key={createdFromScan?.food?.id ?? 'scan'}
        initialResult={createdFromScan}
        open={open}
        onOpenChange={onOpenChange}
        mode={{ kind: 'log', slotName, onLog: logScanned }}
        onCreateFood={(barcode) => {
          onOpenChange(false);
          setScannedBarcode(barcode);
        }}
        // The scanner stays open underneath: "Prüfen" is a look at the values, and closing
        // the editor has to land back on the result you were deciding about.
        onOpenFood={setInspecting}
      />

      <FoodEditorDialog
        open={scannedBarcode !== null || inspecting !== null}
        onOpenChange={(next) => {
          if (!next) {
            setScannedBarcode(null);
            setInspecting(null);
          }
        }}
        food={inspecting ?? undefined}
        initialBarcode={scannedBarcode ?? undefined}
        onChanged={(saved) => {
          // Created from a "Kein Treffer": go back to the scanner showing it, so the user can
          // pick an amount and finish the log they started. Only that path resumes -- a copy
          // made from "Prüfen" deliberately drops the barcode, so there is no scan to return to.
          if (saved && scannedBarcode) {
            setCreatedFromScan({ status: 'local', barcode: scannedBarcode, food: saved });
            onOpenChange(true);
          }
          setScannedBarcode(null);
          setInspecting(null);
        }}
      />
    </>
  );
}
