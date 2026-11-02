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
import { Food, FoodInput, SimilarFood } from '@/types';
import { BarcodeCapture } from '@/components/nutrition/barcode-capture';
import { useApiErrorMessage, useValidationMessage } from '@/hooks/useApiErrorMessage';
import { FieldError } from '@/components/ui/field';
import { useFormErrors } from '@/hooks/useFormErrors';
import { notify } from '@/lib/toast';
import { normalizeBarcode } from '@/lib/barcode';
import {
  AMOUNT_MAX,
  AMOUNT_MIN,
  FOOD_NAME_MAX,
  KCAL_MAX_DECIMALS,
  KCAL_PER_100_MAX,
  MACRO_PER_100_MAX,
  PORTIONS_PER_FOOD_MAX,
  PORTION_LABEL_MAX,
  checkAmountText,
  checkBaseText,
  checkEan,
  checkMacroSum,
} from '@/lib/field-rules';

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
  const validationMessage = useValidationMessage();
  const [forceForm, setForceForm] = useState(false); // "Eigene Kopie anlegen" from read-only
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [isLiquid, setIsLiquid] = useState(false);
  const [kcal, setKcal] = useState('');
  const [carbs, setCarbs] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [portions, setPortions] = useState<PortionRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [similar, setSimilar] = useState<SimilarFood[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);

  const unit = isLiquid ? 'ml' : 'g';
  // Server rejections of a portion arrive as `portions.<row>.label|grams`, so those are the keys.
  const portionKeys = portions.flatMap((_, i) => [`portions.${i}.label`, `portions.${i}.grams`]);
  const [form, formRef] = useFormErrors({
    fields: ['name', 'barcode', 'kcal', 'carbs', 'protein', 'fat', 'portions', ...portionKeys],
    codeFields: {
      FOOD_BARCODE_TAKEN: 'barcode',
      FOOD_PORTION_DEFAULT_COUNT_INVALID: 'portions',
    },
    messageValues: {
      name: { max: FOOD_NAME_MAX },
      kcal: { max: KCAL_PER_100_MAX },
      carbs: { max: MACRO_PER_100_MAX },
      protein: { max: MACRO_PER_100_MAX },
      fat: { max: MACRO_PER_100_MAX },
      portions: { max: PORTIONS_PER_FOOD_MAX },
      label: { max: PORTION_LABEL_MAX },
      grams: { min: AMOUNT_MIN, max: AMOUNT_MAX, unit },
    },
  });

  const isReadOnly = !!food && !food.editable && !forceForm;
  const isEdit = !!food && food.editable && !forceForm;

  useEffect(() => {
    if (!open) return;
    setForceForm(false);
    form.setConstraints({});
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function setDefaultPortion(key: string) {
    setPortions((prev) => prev.map((p) => ({ ...p, isDefault: p.key === key })));
  }

  function addPortion() {
    if (portions.length >= PORTIONS_PER_FOOD_MAX) {
      notify.warning(
        validationMessage('portions', 'arrayMaxSize', { max: PORTIONS_PER_FOOD_MAX }) ?? apiError(undefined),
      );
      return;
    }
    setPortions((prev) => [
      ...prev,
      // Label left blank so the combobox suggestions drop down on focus -- a prefilled
      // value hides them and has to be cleared first.
      { key: newPortionKey(), label: '', grams: '', isDefault: prev.length === 0 },
    ]);
  }

  function removePortion(key: string) {
    // The rows after the removed one shift up, so their errors would sit under the wrong row.
    portionKeys.forEach((k) => form.clear(k));
    form.clear('portions');
    setPortions((prev) => {
      const next = prev.filter((p) => p.key !== key);
      if (next.length > 0 && !next.some((p) => p.isDefault)) next[0].isDefault = true;
      return next;
    });
  }

  function startCopy() {
    setForceForm(true);
    setBarcode(''); // a copy must not claim the original's barcode
    form.setConstraints({});
  }

  async function handleSave() {
    const decimal = (raw: string) => raw.trim().replace(',', '.');
    const defaults = portions.filter((p) => p.isDefault).length;
    const valid = form.setConstraints({
      name: checkBaseText(name, FOOD_NAME_MAX),
      barcode: barcode.trim() ? checkEan(barcode) : null,
      kcal: checkAmountText(kcal, 0, KCAL_PER_100_MAX, KCAL_MAX_DECIMALS),
      carbs: checkAmountText(carbs, 0, MACRO_PER_100_MAX),
      protein: checkAmountText(protein, 0, MACRO_PER_100_MAX),
      // The sum rule rides on the last macro, where the server reports it.
      fat:
        checkAmountText(fat, 0, MACRO_PER_100_MAX) ??
        checkMacroSum([carbs, protein, fat].map(decimal)),
      portions:
        portions.length > PORTIONS_PER_FOOD_MAX
          ? 'arrayMaxSize'
          : portions.length > 0 && defaults !== 1
            ? 'portionDefault'
            : null,
      ...Object.fromEntries(
        portions.flatMap((p, i) => [
          [`portions.${i}.label`, checkBaseText(p.label, PORTION_LABEL_MAX)],
          [`portions.${i}.grams`, checkAmountText(p.grams, AMOUNT_MIN, AMOUNT_MAX)],
        ]),
      ),
    });
    if (!valid) return;

    const input: FoodInput = {
      name: name.trim(),
      barcode: (barcode.trim() && normalizeBarcode(barcode)) || undefined,
      isLiquid,
      kcal: Number(decimal(kcal)),
      carbs: Number(decimal(carbs)),
      protein: Number(decimal(protein)),
      fat: Number(decimal(fat)),
      portions: portions.length
        ? portions.map((p) => ({
            label: p.label.trim(),
            grams: Number(decimal(p.grams)),
            isDefault: p.isDefault,
          }))
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
      form.showApiError(err);
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
      notify.error(apiError(err));
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

        {isReadOnly && food ? (
          <ReadOnlyView food={food} similar={similar} />
        ) : (
          <div ref={formRef} className="space-y-5">
            <div className="block">
              <label
                htmlFor="food-name"
                className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground"
              >
                {t('name')}
              </label>
              <Input
                id="food-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  form.clear('name');
                }}
                autoFocus
                {...form.fieldProps('name')}
              />
              <FieldError id={form.errorId('name')}>{form.errors.name}</FieldError>
              {similar.length > 0 && (
                <div className="mt-2">
                  <SimilarList items={similar} />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {t('avoidDuplicates')}
                  </p>
                </div>
              )}
            </div>

            <div className="block">
              <label
                htmlFor="food-barcode"
                className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground"
              >
                {t('ean')} <span className="font-normal normal-case tracking-normal">{t('optional')}</span>
              </label>
              <div className="flex items-center gap-2 border-b border-b-input">
                <Input
                  id="food-barcode"
                  value={barcode}
                  onChange={(e) => {
                    setBarcode(e.target.value);
                    form.clear('barcode');
                  }}
                  inputMode="numeric"
                  className="border-b-0 font-mono"
                  {...form.fieldProps('barcode')}
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
              <FieldError id={form.errorId('barcode')}>{form.errors.barcode}</FieldError>
            </div>

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
                  { key: 'kcal', label: t('kcal'), value: kcal, set: setKcal, suffix: 'kcal' },
                  { key: 'carbs', label: t('carbs'), value: carbs, set: setCarbs, suffix: 'g' },
                  { key: 'protein', label: t('protein'), value: protein, set: setProtein, suffix: 'g' },
                  { key: 'fat', label: t('fat'), value: fat, set: setFat, suffix: 'g' },
                ].map((f) => (
                  <div key={f.key} className="block">
                    <label htmlFor={`food-${f.key}`} className="text-xs text-muted-foreground">
                      {f.label}
                    </label>
                    <div className="flex items-baseline gap-1 border-b border-b-input">
                      <Input
                        id={`food-${f.key}`}
                        inputMode="decimal"
                        value={f.value}
                        onChange={(e) => {
                          f.set(e.target.value);
                          form.clear(f.key);
                        }}
                        className="border-b-0"
                        placeholder="0"
                        {...form.fieldProps(f.key)}
                      />
                      <span className="text-xs text-muted-foreground">{f.suffix}</span>
                    </div>
                    <FieldError id={form.errorId(f.key)}>{form.errors[f.key]}</FieldError>
                  </div>
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
                  {portions.map((p, i) => (
                    <div key={p.key} className="p-2">
                    <div className="flex items-center gap-2">
                      <Input
                        list="food-portion-labels"
                        value={p.label}
                        onChange={(e) => {
                          setPortions((prev) =>
                            prev.map((x) =>
                              x.key === p.key ? { ...x, label: e.target.value } : x,
                            ),
                          );
                          form.clear(`portions.${i}.label`);
                        }}
                        placeholder={t('portionPlaceholder')}
                        className="h-9 flex-1"
                        {...form.fieldProps(`portions.${i}.label`)}
                      />
                      <div className="flex w-24 items-baseline gap-1 border-b border-b-input">
                        <Input
                          inputMode="decimal"
                          value={p.grams}
                          onChange={(e) => {
                            setPortions((prev) =>
                              prev.map((x) =>
                                x.key === p.key ? { ...x, grams: e.target.value } : x,
                              ),
                            );
                            form.clear(`portions.${i}.grams`);
                          }}
                          className="h-9 border-b-0"
                          placeholder="0"
                          {...form.fieldProps(`portions.${i}.grams`)}
                        />
                        <span className="text-xs text-muted-foreground">{unit}</span>
                      </div>
                      <Button
                        type="button"
                        variant={p.isDefault ? 'default' : 'outline'}
                        size="xs"
                        onClick={() => {
                          setDefaultPortion(p.key);
                          form.clear('portions');
                        }}
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
                    <FieldError id={form.errorId(`portions.${i}.label`)}>
                      {form.errors[`portions.${i}.label`]}
                    </FieldError>
                    <FieldError id={form.errorId(`portions.${i}.grams`)}>
                      {form.errors[`portions.${i}.grams`]}
                    </FieldError>
                    </div>
                  ))}
                </div>
              )}
              <FieldError id={form.errorId('portions')}>{form.errors.portions}</FieldError>
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
