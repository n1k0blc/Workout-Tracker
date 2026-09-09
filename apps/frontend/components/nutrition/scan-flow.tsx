'use client';

import { useState } from 'react';
import { BarcodeLookup, Food } from '@/types';
import { FoodEditorDialog } from '@/components/templates/food-editor-dialog';
import { BarcodeScannerSheet, type ScannerMode } from './barcode-scanner-sheet';

/**
 * Everything between "the user wants to scan" and "here is a Lebensmittel" (#149): the
 * scanner, the miss chain behind it, the "Lebensmittel anlegen" form a double miss leads to,
 * and the resumption afterwards. What the food is *for* is the caller's business, expressed
 * as `mode` -- an Eintrag in an Abschnitt, or a Zutat in a Mahlzeit.
 *
 * **Render this from a page, never from inside a drawer or a dialog.** The scanner is a
 * full-screen overlay portaled to `document.body`, so nesting it in a modal put it inside that
 * modal's React tree and outside its DOM tree, and every consequence was a bug: pointer events
 * disabled on its controls, focus dragged out of its EAN field, and the first tap dismissing
 * the modal underneath.
 *
 * The resumption is the point of the whole thing. Scanning is a request to *do* something with
 * a product; creating the Lebensmittel is only half of it, so the flow carries on where it left
 * off instead of dropping the user back at a list having quietly done half the job.
 */
export function ScanFlow({
  open,
  onOpenChange,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ScannerMode;
}) {
  // A scanned barcode that matched nothing: the create form opens with it prefilled.
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  // "Prüfen" on an Open Food Facts hit -- its read-only values, before committing to it.
  const [inspecting, setInspecting] = useState<Food | null>(null);
  // A food just created from a double miss, handed back to the scanner so its amount step
  // still happens. Only `log` needs this; `pick` has nothing left to ask and finishes directly.
  const [createdFromScan, setCreatedFromScan] = useState<BarcodeLookup | null>(null);

  // No reset-on-open here, deliberately. Resuming a `log` *reopens* the scanner, so anything
  // keyed on `open` would clear the seed on the very transition that carries it. Each value is
  // cleared where it is finished with, and the seed is only read at mount (through `key`).

  return (
    <>
      <BarcodeScannerSheet
        // Remounted when a created food arrives, so it opens on that result rather than the
        // viewfinder -- `initialResult` is read once, as the initial phase.
        key={createdFromScan?.food?.id ?? 'scan'}
        initialResult={createdFromScan}
        open={open}
        onOpenChange={onOpenChange}
        mode={mode}
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
          // Only a create-from-miss resumes. A copy made from "Prüfen" deliberately drops the
          // barcode, so there is no scan to return to.
          if (saved && scannedBarcode) {
            if (mode.kind === 'log') {
              // Back to the scanner showing it, so the amount can be picked and the Eintrag
              // written -- the log the user actually started.
              setCreatedFromScan({ status: 'local', barcode: scannedBarcode, food: saved });
              onOpenChange(true);
            } else {
              // Nothing left to ask: take the food and close.
              mode.onPick(saved);
              onOpenChange(false);
            }
          }
          setScannedBarcode(null);
          setInspecting(null);
        }}
      />
    </>
  );
}
