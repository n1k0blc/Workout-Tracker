'use client';

import { useEffect, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { IconBarcode, IconPlus, IconTrash, IconX, IconChevronRight } from '@tabler/icons-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api';
import { parseAmount } from '@/lib/nutrition';
import { Food, FoodInput, SimilarFood } from '@/types';
import { BarcodeCapture } from '@/components/nutrition/barcode-capture';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';

interface PortionRow {
  key: string;
  label: string;
  grams: string;
  isDefault: boolean;
}

let portionKeySeq = 0;
const newPortionKey = () => `p${++portionKeySeq}`;

function toRows(food: Food | undefined): PortionRow[] {
  return (food?.portions ?? []).map((p) => ({
    key: newPortionKey(),
    label: p.label,
    grams: String(p.grams),
    isDefault: p.isDefault,
  }));
}

function readOnlyReason(
  food: Food,
  t: ReturnType<typeof useTranslations>,
): { note: string; odbl: boolean; label: string | null } {
  if (food.source === 'SEED') {
    return { note: t('readOnlySeed'), odbl: false, label: t('sourceSystem') };
  }
  if (food.source === 'OPEN_FOOD_FACTS') {
    return { note: t('readOnlyImported'), odbl: true, label: 'Open Food Facts' };
  }
  return { note: t('readOnlyOther'), odbl: false, label: null };
}

export function FoodEditorDialog({
  open,
  onOpenChange,
  food,
  initialBarcode,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  food?: Food;
  /** Prefills the EAN field when creating -- a scan that matched nothing anywhere (#149). */
  initialBarcode?: string;
  /** Receives the saved food, so a caller mid-flow can carry on with it (#149). */
  onChanged: (saved?: Food) => void;
}) {
  const t = useTranslations('FoodEditorDialog');
  const apiError = useApiErrorMessage();
  const [forceForm, setForceForm] = useState(false); // "Eigene Kopie anlegen" from read-only
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [isLiquid, setIsLiquid] = useState(false);
  const [kcal, setKcal] = useState('');
  const [carbs, setCarbs] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [portions, setPortions] = useState<PortionRow[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [similar, setSimilar] = useState<SimilarFood[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);

  const isReadOnly = !!food && !food.editable && !forceForm;
  const isEdit = !!food && food.editable && !forceForm;

  useEffect(() => {
    if (!open) return;
    setForceForm(false);
    setError('');
    setSaving(false);
    setConfirmDelete(false);
    setSimilar([]);
    setScannerOpen(false);
    setName(food?.name ?? '');
    setBarcode(food?.barcode ?? initialBarcode ?? '');
    setIsLiquid(food?.isLiquid ?? false);
    setKcal(food ? String(food.kcal) : '');
    setCarbs(food ? String(food.carbs) : '');
    setProtein(food ? String(food.protein) : '');
    setFat(food ? String(food.fat) : '');
    setPortions(toRows(food));
  }, [open, food, initialBarcode]);

  // Duplicate-avoidance hint: the current user's own foods matching what they're typing.
  // Only while creating (or copying) -- editing an existing food, matches are just noise.
  const hintActive = open && !isReadOnly && !isEdit;
  useEffect(() => {
    if (!hintActive || name.trim().length < 2) {
      setSimilar([]);
      return;
    }
    const id = setTimeout(async () => {
      try {
        setSimilar(await apiClient.getSimilarFoods(name.trim()));
      } catch {
        /* the hint is best-effort */
      }
    }, 300);
    return () => clearTimeout(id);
  }, [name, hintActive]);

  // Similar entries on the read-only view (07c).
  useEffect(() => {
    if (!open || !isReadOnly || !food) return;
    let cancelled = false;
    apiClient
      .getSimilarFoods(food.name)
      .then((rows) => !cancelled && setSimilar(rows))
      .catch(() => !cancelled && setSimilar([]));
    return () => {
      cancelled = true;
    };
  }, [open, isReadOnly, food]);

  const unit = isLiquid ? 'ml' : 'g';

  function setDefaultPortion(key: string) {
    setPortions((prev) => prev.map((p) => ({ ...p, isDefault: p.key === key })));
  }

  function addPortion() {
    setPortions((prev) => [
      ...prev,
      // Label left blank so the combobox suggestions drop down on focus -- a prefilled
      // value hides them and has to be cleared first.
      { key: newPortionKey(), label: '', grams: '', isDefault: prev.length === 0 },
    ]);
  }

  function removePortion(key: string) {
    setPortions((prev) => {
      const next = prev.filter((p) => p.key !== key);
      if (next.length > 0 && !next.some((p) => p.isDefault)) next[0].isDefault = true;
      return next;
    });
  }

  function startCopy() {
    setForceForm(true);
    setBarcode(''); // a copy must not claim the original's barcode
    setError('');
  }

  async function handleSave() {
    setError('');
    if (!name.trim()) {
      setError(t('nameRequired'));
      return;
    }
    const nutrients = {
      kcal: parseAmount(kcal),
      carbs: parseAmount(carbs),
      protein: parseAmount(protein),
      fat: parseAmount(fat),
    };
    if (Object.values(nutrients).some((v) => v === null)) {
      setError(t('nutrientsInvalid'));
      return;
    }
    if (barcode.trim() && !/^\d{8,14}$/.test(barcode.trim())) {
      setError(t('barcodeInvalid'));
      return;
    }
    const parsedPortions = portions.map((p) => ({
      label: p.label.trim(),
      grams: parseAmount(p.grams),
      isDefault: p.isDefault,
    }));
    if (parsedPortions.some((p) => !p.label || p.grams === null || p.grams <= 0)) {
      setError(t('portionInvalid'));
      return;
    }
    if (parsedPortions.length > 0 && parsedPortions.filter((p) => p.isDefault).length !== 1) {
      setError(t('portionDefault'));
      return;
    }

    const input: FoodInput = {
      name: name.trim(),
      barcode: barcode.trim() || undefined,
      isLiquid,
      kcal: nutrients.kcal!,
      carbs: nutrients.carbs!,
      protein: nutrients.protein!,
      fat: nutrients.fat!,
      portions: parsedPortions.length
        ? parsedPortions.map((p) => ({ label: p.label, grams: p.grams!, isDefault: p.isDefault }))
        : undefined,
    };

    setSaving(true);
    try {
      const saved = isEdit && food
        ? await apiClient.updateFood(food.id, input)
        : await apiClient.createFood(input);
      onChanged(saved);
      onOpenChange(false);
    } catch (err) {
      setError(apiError(err));
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!food) return;
    try {
      await apiClient.deleteFood(food.id);
      onChanged();
      onOpenChange(false);
    } catch (err) {
      setError(apiError(err));
    }
  }

  const title = isReadOnly
    ? t('titleReadOnly')
    : isEdit
      ? t('titleEdit')
      : t('titleCreate');

  return (
    // Non-modal while the scanner is up. The scanner is a full-screen overlay portaled to the
    // body, so it sits outside this dialog's content: a modal dialog would trap focus away
    // from its EAN field, disable pointer events on every control in it, and treat the first
    // tap as an outside interaction -- closing this editor and losing the half-filled form.
    // Radix binds both the focus trap and the pointer-events block to `modal`, so dropping it
    // removes all three, and `onInteractOutside` keeps the editor open underneath.
    <Dialog open={open} onOpenChange={onOpenChange} modal={!scannerOpen}>
      <DialogContent
        className="max-h-[90vh] max-w-lg overflow-y-auto"
        onInteractOutside={(event) => {
          if (scannerOpen) event.preventDefault();
        }}
      >
        <DialogHeader className="flex-row items-center justify-between">
          <DialogTitle>{title}</DialogTitle>
          {isEdit && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive"
              aria-label={t('delete')}
              onClick={() => setConfirmDelete(true)}
            >
              <IconTrash />
            </Button>
          )}
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {isReadOnly && food ? (
          <ReadOnlyView food={food} similar={similar} />
        ) : (
          <div className="space-y-5">
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                {t('name')}
              </span>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              {similar.length > 0 && (
                <div className="mt-2">
                  <SimilarList items={similar} />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {t('avoidDuplicates')}
                  </p>
                </div>
              )}
            </label>

            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                {t('ean')} <span className="font-normal normal-case tracking-normal">{t('optional')}</span>
              </span>
              <div className="flex items-center gap-2 border-b border-b-input">
                <Input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  inputMode="numeric"
                  className="border-b-0 font-mono"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('scanBarcode')}
                  onClick={() => setScannerOpen(true)}
                >
                  <IconBarcode />
                </Button>
              </div>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isLiquid}
                onChange={(e) => setIsLiquid(e.target.checked)}
                className="size-4 accent-primary"
              />
              <span className="text-sm">{t('liquid')}</span>
            </label>

            <div>
              <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                {t('nutrientsPer100', { unit })}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                {[
                  { label: t('kcal'), value: kcal, set: setKcal, suffix: 'kcal' },
                  { label: t('carbs'), value: carbs, set: setCarbs, suffix: 'g' },
                  { label: t('protein'), value: protein, set: setProtein, suffix: 'g' },
                  { label: t('fat'), value: fat, set: setFat, suffix: 'g' },
                ].map((f) => (
                  <label key={f.label} className="block">
                    <span className="text-xs text-muted-foreground">{f.label}</span>
                    <div className="flex items-baseline gap-1 border-b border-b-input">
                      <Input
                        inputMode="decimal"
                        value={f.value}
                        onChange={(e) => f.set(e.target.value)}
                        className="border-b-0"
                        placeholder="0"
                      />
                      <span className="text-xs text-muted-foreground">{f.suffix}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <datalist id="food-portion-labels">
                {(t.raw('portionPresets') as string[]).map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  {t('portions')}
                </span>
                <Button variant="outline" size="xs" onClick={addPortion}>
                  <IconPlus data-icon="inline-start" />
                  {t('addPortion')}
                </Button>
              </div>
              {portions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t('noPortions')}
                </p>
              ) : (
                <div className="divide-y rounded-md border">
                  {portions.map((p) => (
                    <div key={p.key} className="flex items-center gap-2 p-2">
                      <Input
                        list="food-portion-labels"
                        value={p.label}
                        onChange={(e) =>
                          setPortions((prev) =>
                            prev.map((x) =>
                              x.key === p.key ? { ...x, label: e.target.value } : x,
                            ),
                          )
                        }
                        placeholder={t('portionPlaceholder')}
                        className="h-9 flex-1"
                      />
                      <div className="flex w-24 items-baseline gap-1 border-b border-b-input">
                        <Input
                          inputMode="decimal"
                          value={p.grams}
                          onChange={(e) =>
                            setPortions((prev) =>
                              prev.map((x) =>
                                x.key === p.key ? { ...x, grams: e.target.value } : x,
                              ),
                            )
                          }
                          className="h-9 border-b-0"
                          placeholder="0"
                        />
                        <span className="text-xs text-muted-foreground">{unit}</span>
                      </div>
                      <Button
                        type="button"
                        variant={p.isDefault ? 'default' : 'outline'}
                        size="xs"
                        onClick={() => setDefaultPortion(p.key)}
                        aria-pressed={p.isDefault}
                      >
                        {t('portionDefaultButton')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('removePortion')}
                        onClick={() => removePortion(p.key)}
                      >
                        <IconX />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-2 flex gap-2 border-t pt-4">
          {isReadOnly ? (
            <Button variant="outline" className="flex-1" onClick={startCopy}>
              {t('copy')}
            </Button>
          ) : (
            <>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? t('saving') : t('save')}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('cancel')}
              </Button>
            </>
          )}
        </div>
      </DialogContent>

      {/* The EAN field's scan button: the digits are the whole answer, so no lookup runs. */}
      <BarcodeCapture
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onBarcode={(scanned) => {
          setBarcode(scanned);
          setScannerOpen(false);
        }}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t('deleteConfirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

function SimilarList({ items }: { items: SimilarFood[] }) {
  const t = useTranslations('FoodEditorDialog');
  return (
    <div className="divide-y rounded-md border bg-card">
      {items.map((f) => (
        <div key={f.id} className="flex items-center gap-3 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-sm">{f.name}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {Math.round(f.kcal)} kcal / 100 {f.isLiquid ? 'ml' : 'g'} · {t('usedTimes', { count: f.usageCount })}
            </div>
          </div>
          <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </div>
      ))}
    </div>
  );
}

function ReadOnlyView({ food, similar }: { food: Food; similar: SimilarFood[] }) {
  const t = useTranslations('FoodEditorDialog');
  const format = useFormatter();
  const fmt1 = (n: number) =>
    format.number(n, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const { note, odbl, label } = readOnlyReason(food, t);
  const unit = food.isLiquid ? 'ml' : 'g';

  return (
    <div className="space-y-4">
      <div>
        {label && (
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {label}
          </div>
        )}
        <h3 className="mt-1 text-lg font-semibold">{food.name}</h3>
        {food.barcode && (
          <div className="mt-1 font-mono text-xs text-muted-foreground">EAN {food.barcode}</div>
        )}
      </div>

      <div className="grid grid-cols-2 rounded-lg border bg-card">
        {[
          { label: t('kcal'), value: `${Math.round(food.kcal)} kcal`, br: 'border-b border-r' },
          { label: t('carbs'), value: `${fmt1(food.carbs)} g`, br: 'border-b' },
          { label: t('protein'), value: `${fmt1(food.protein)} g`, br: 'border-r' },
          { label: t('fat'), value: `${fmt1(food.fat)} g`, br: '' },
        ].map((c) => (
          <div key={c.label} className={`p-3.5 ${c.br}`}>
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className="mt-1 text-base font-semibold">{c.value}</div>
          </div>
        ))}
      </div>
      <div className="-mt-2 text-xs text-muted-foreground">{t('values100', { unit })}</div>

      <div className="rounded-md border p-3.5 text-sm">
        <div>{note}</div>
        {odbl && (
          <div className="mt-1 text-xs text-muted-foreground">
            {t('odbl')}
          </div>
        )}
      </div>

      {similar.length > 0 && (
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {t('similarOwn')}
          </div>
          <SimilarList items={similar} />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t('avoidDuplicates')}
          </p>
        </div>
      )}
    </div>
  );
}
