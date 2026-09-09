'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  IconAlertTriangle,
  IconCheck,
  IconExternalLink,
  IconSearch,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import {
  buildQuantityStops,
  defaultQuantityStopIndex,
  foodSourceLabel,
  formatQuantityLabel,
} from '@/lib/nutrition';
import { BarcodeLookup, Food } from '@/types';
import { BarcodeCapture, CaptureSheet } from './barcode-capture';
import { QuantityStepper } from './quantity-stepper';

/**
 * The barcode miss chain on screen (#149), screens 06 / 06b.
 *
 * {@link BarcodeCapture} gets the code; this runs it through `GET /foods/barcode/:barcode`
 * and shows what came back. Three result shapes: a library hit (with its per-100 grid), an
 * Open Food Facts hit (with its ODbL note), and no hit at all — which offers to create the
 * food with the barcode already filled in.
 *
 * Two callers, which `mode` distinguishes: the Abschnitt picker logs the hit into the day
 * after a quantity step, the Lebensmittel tab opens the food instead.
 */

export type ScannerMode =
  | {
      kind: 'log';
      /** The Abschnitt the primary button names ("Zu Frühstück"). */
      slotName: string;
      onLog: (food: Food, grams: number, quantityLabel: string) => Promise<void>;
    }
  | { kind: 'open'; onOpen: (food: Food) => void };

type Phase =
  | { step: 'scanning' }
  | { step: 'looking-up'; barcode: string }
  | { step: 'result'; lookup: BarcodeLookup };

function fmt1(value: number): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function BarcodeScannerSheet({
  open,
  onOpenChange,
  mode,
  onCreateFood,
  onOpenFood,
  initialResult,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ScannerMode;
  /** Both misses: open "Lebensmittel anlegen" with this barcode prefilled. */
  onCreateFood: (barcode: string) => void;
  /** "Prüfen" on an Open Food Facts hit -- its values in full, before logging them. */
  onOpenFood?: (food: Food) => void;
  /**
   * Open straight onto a result instead of the viewfinder. Used to resume a scan the user had
   * to leave: a double miss sends them to "Lebensmittel anlegen", and the food they create
   * there comes back here so the amount step still happens and the entry is actually logged.
   * The caller remounts on change, so this is read once, as the initial phase.
   */
  initialResult?: BarcodeLookup | null;
}) {
  const [phase, setPhase] = useState<Phase>(
    initialResult ? { step: 'result', lookup: initialResult } : { step: 'scanning' },
  );
  const [lookupError, setLookupError] = useState<string | null>(null);

  const lookup = useCallback(async (barcode: string) => {
    setLookupError(null);
    setPhase({ step: 'looking-up', barcode });
    try {
      setPhase({ step: 'result', lookup: await apiClient.lookupBarcode(barcode) });
    } catch (error) {
      setPhase({ step: 'scanning' });
      setLookupError(
        error instanceof Error ? error.message : 'Der Barcode konnte nicht geprüft werden.',
      );
    }
  }, []);

  function rescan() {
    setLookupError(null);
    setPhase({ step: 'scanning' });
  }

  return (
    <BarcodeCapture
      open={open}
      onOpenChange={(next) => {
        if (!next) rescan();
        onOpenChange(next);
      }}
      onBarcode={lookup}
      // The camera stops while a result is up: nothing is being scanned, and a live stream
      // behind the sheet would keep re-reading the same code and the phone's light burning.
      paused={phase.step !== 'scanning'}
      busy={phase.step === 'looking-up'}
    >
      {lookupError && phase.step === 'scanning' && (
        <CaptureSheet>
          <p className="flex items-center gap-1.5 py-1 text-sm text-destructive" role="alert">
            <IconAlertTriangle className="size-4 shrink-0" />
            {lookupError}
          </p>
        </CaptureSheet>
      )}

      {phase.step === 'looking-up' && (
        <CaptureSheet>
          <p className="py-2 text-sm text-muted-foreground">
            <span className="font-mono">{phase.barcode}</span> wird geprüft …
          </p>
        </CaptureSheet>
      )}

      {phase.step === 'result' && (
        <CaptureSheet>
          <ResultBody
            lookup={phase.lookup}
            mode={mode}
            // Reset before handing off: the caller closes this to show the create form, which
            // skips the close handler below. Without this, abandoning that form and scanning
            // again reopens onto the stale result -- with the camera still paused behind it.
            onCreateFood={(barcode) => {
              rescan();
              onCreateFood(barcode);
            }}
            onOpenFood={onOpenFood}
            onRescan={rescan}
          />
        </CaptureSheet>
      )}
    </BarcodeCapture>
  );
}

function ResultBody({
  lookup,
  mode,
  onCreateFood,
  onOpenFood,
  onRescan,
}: {
  lookup: BarcodeLookup;
  mode: ScannerMode;
  onCreateFood: (barcode: string) => void;
  onOpenFood?: (food: Food) => void;
  onRescan: () => void;
}) {
  if (lookup.status === 'notFound' || !lookup.food) {
    return (
      <>
        <ResultLabel icon={<IconSearch className="size-4" />} muted>
          Kein Treffer
        </ResultLabel>
        <p className="mt-2.5 text-sm">
          Zu <span className="font-mono">{lookup.barcode}</span> gibt es weder ein eigenes
          Lebensmittel noch einen Open-Food-Facts-Eintrag.
        </p>
        <div className="mt-3.5 flex gap-2">
          <Button className="flex-1" onClick={() => onCreateFood(lookup.barcode)}>
            Lebensmittel anlegen
          </Button>
          <Button variant="outline" onClick={onRescan}>
            Erneut
          </Button>
        </div>
      </>
    );
  }

  return (
    <FoodResult
      food={lookup.food}
      mode={mode}
      onOpenFood={onOpenFood}
      onRescan={onRescan}
    />
  );
}

function FoodResult({
  food,
  mode,
  onOpenFood,
  onRescan,
}: {
  food: Food;
  mode: ScannerMode;
  onOpenFood?: (food: Food) => void;
  onRescan: () => void;
}) {
  const stops = useMemo(() => buildQuantityStops(food.portions), [food.portions]);
  const [amount, setAmount] = useState(() => {
    const index = defaultQuantityStopIndex(
      stops,
      food.portions.find((p) => p.isDefault)?.label ?? null,
    );
    return { grams: stops[index]?.grams ?? 100, portionLabel: stops[index]?.label ?? null };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unit = food.isLiquid ? 'ml' : 'g';
  // Keyed off the food, not off where the miss chain stopped: an Open Food Facts product
  // scanned a second time is a *local* hit, and still owes its ODbL note.
  const fromOpenFoodFacts = food.source === 'OPEN_FOOD_FACTS';
  // "Eigenes" / "System" / "Open Food Facts", the same badges the Lebensmittel tab shows;
  // null for another user's food, which carries no badge anywhere in the app.
  const sourceLabel = foodSourceLabel(food);

  async function log() {
    if (mode.kind !== 'log' || saving) return;
    setSaving(true);
    setError(null);
    try {
      await mode.onLog(
        food,
        amount.grams,
        formatQuantityLabel(amount.portionLabel, amount.grams, food.isLiquid),
      );
      // Left on the result, not closed: the caller decides what a logged entry means for the
      // surface underneath, and scanning the next item should not need the button again.
      onRescan();
    } catch {
      setError('Der Eintrag konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ResultLabel
        icon={
          fromOpenFoodFacts ? (
            <IconExternalLink className="size-4" />
          ) : (
            <IconCheck className="size-4" />
          )
        }
      >
        Treffer ·{' '}
        {sourceLabel === 'Eigenes' ? 'Eigenes Lebensmittel' : (sourceLabel ?? 'Lebensmittel')}
      </ResultLabel>

      <div className="mt-2.5 text-lg font-semibold">{food.name}</div>
      {food.barcode && (
        <div className="mt-0.5 font-mono text-xs text-muted-foreground">EAN {food.barcode}</div>
      )}

      {fromOpenFoodFacts ? (
        <p className="mt-2.5 text-xs text-muted-foreground">
          {Math.round(food.kcal)} kcal · {fmt1(food.carbs)} g KH · {fmt1(food.protein)} g Protein ·{' '}
          {fmt1(food.fat)} g Fett je 100 {unit}
        </p>
      ) : (
        <>
          <div className="mt-3.5 grid grid-cols-4 border">
            <Per100Cell value={String(Math.round(food.kcal))} label="kcal" border="border-r" />
            <Per100Cell value={fmt1(food.carbs)} label="KH g" border="border-r" />
            <Per100Cell value={fmt1(food.protein)} label="Prot. g" border="border-r" />
            <Per100Cell value={fmt1(food.fat)} label="Fett g" border="" />
          </div>
          <div className="mt-1.5 text-xs text-muted-foreground">Werte je 100 {unit}</div>
        </>
      )}

      {fromOpenFoodFacts && (
        <p className="mt-3 border-t pt-2.5 text-xs text-muted-foreground">
          Daten aus Open Food Facts (ODbL). Werte können unvollständig sein — vor dem Speichern
          prüfen.
        </p>
      )}

      {mode.kind === 'log' ? (
        <div className="mt-3.5 space-y-3">
          <QuantityStepper
            portions={food.portions}
            isLiquid={food.isLiquid}
            grams={amount.grams}
            portionLabel={amount.portionLabel}
            onChange={(grams, portionLabel) => setAmount({ grams, portionLabel })}
          />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={log} disabled={saving}>
              {saving ? 'Speichert …' : `Zu ${mode.slotName}`}
            </Button>
            {onOpenFood && (
              <Button variant="outline" onClick={() => onOpenFood(food)}>
                Prüfen
              </Button>
            )}
            <Button variant="outline" onClick={onRescan}>
              Erneut
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3.5 flex gap-2">
          <Button className="flex-1" onClick={() => mode.onOpen(food)}>
            {fromOpenFoodFacts ? 'Prüfen' : 'Öffnen'}
          </Button>
          <Button variant="outline" onClick={onRescan}>
            Erneut
          </Button>
        </div>
      )}

      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive" role="alert">
          <IconAlertTriangle className="size-3.5" />
          {error}
        </p>
      )}
    </>
  );
}

function ResultLabel({
  icon,
  muted,
  children,
}: {
  icon: React.ReactNode;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex items-center gap-2 ${muted ? 'text-muted-foreground' : ''}`}>
      {icon}
      <span className="text-[10px] font-semibold uppercase tracking-[0.15em]">{children}</span>
    </div>
  );
}

function Per100Cell({
  value,
  label,
  border,
}: {
  value: string;
  label: string;
  border: string;
}) {
  return (
    <div className={`px-1.5 py-2.5 text-center ${border}`}>
      <div className="text-[15px] font-bold">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
