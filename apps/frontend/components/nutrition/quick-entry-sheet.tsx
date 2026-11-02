'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useSlotName } from '@/hooks/useSlotName';
import { kcalFromMacros, parseAmount } from '@/lib/nutrition';
import { FieldError } from '@/components/ui/field';
import { useFormErrors } from '@/hooks/useFormErrors';
import {
  FOOD_NAME_MAX,
  QUICK_ENTRY_KCAL_MAX,
  QUICK_ENTRY_MACRO_MAX,
  checkAmountText,
  checkBaseText,
  checkFitsFood,
} from '@/lib/field-rules';

export interface QuickEntrySlot {
  id: string;
  name: string;
  seedKey: string | null;
}

/**
 * The Schnelleintrag form (design screen 05), as a bottom sheet: name, kcal, the three macro
 * fields, and Abschnitt chips defaulting to the slot it was opened from. The consistency hint
 * spells out what the macros imply without changing what gets saved. The "Als Lebensmittel
 * speichern" toggle is deliberately absent -- it needs the Food model (#144).
 */
export function QuickEntrySheet({
  open,
  onOpenChange,
  slots,
  defaultSlotId,
  date,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slots: QuickEntrySlot[];
  defaultSlotId: string | null;
  date: string;
  onCreated: () => void;
}) {
  const t = useTranslations('QuickEntrySheet');
  const slotLabel = useSlotName();
  const [slotId, setSlotId] = useState<string | null>(defaultSlotId);
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [carbs, setCarbs] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [saveAsFood, setSaveAsFood] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, formRef] = useFormErrors({
    fields: ['name', 'kcal', 'carbs', 'protein', 'fat', 'saveAsFood'],
    codeFields: { QUICK_ENTRY_NOT_A_FOOD: 'saveAsFood' },
    messageValues: {
      name: { max: FOOD_NAME_MAX },
      kcal: { max: QUICK_ENTRY_KCAL_MAX },
      carbs: { max: QUICK_ENTRY_MACRO_MAX },
      protein: { max: QUICK_ENTRY_MACRO_MAX },
      fat: { max: QUICK_ENTRY_MACRO_MAX },
    },
  });

  // Reset to a clean form on the closed -> open transition, seeded with the slot it opened
  // for. Done during render (the "adjust state when a prop changes" pattern) rather than in an
  // effect, so there is no post-paint flash of the previous entry's values.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSlotId(defaultSlotId ?? slots[0]?.id ?? null);
      setName('');
      setKcal('');
      setCarbs('');
      setProtein('');
      setFat('');
      setSaveAsFood(false);
      setSaving(false);
      form.setConstraints({});
    }
  }

  const kcalValue = parseAmount(kcal);
  const macros = {
    carbs: parseAmount(carbs) ?? 0,
    protein: parseAmount(protein) ?? 0,
    fat: parseAmount(fat) ?? 0,
  };
  const macroKcal = kcalFromMacros(macros);
  const hint =
    kcalValue === null || kcalValue <= 0 || macroKcal === kcalValue
      ? null
      : t('macroHint', { macroKcal, enteredKcal: kcalValue });
  const canSave = !saving && slotId !== null;

  // A macro left blank counts as 0 grams; a kcal value is required.
  const macroProblem = (raw: string) =>
    raw.trim() === '' ? null : checkAmountText(raw, 0, QUICK_ENTRY_MACRO_MAX);

  async function handleSave() {
    if (!canSave || slotId === null) return;
    const kcalProblem = checkAmountText(kcal, 0, QUICK_ENTRY_KCAL_MAX);
    const valid = form.setConstraints({
      name: checkBaseText(name, FOOD_NAME_MAX),
      kcal: kcalProblem,
      carbs: macroProblem(carbs),
      protein: macroProblem(protein),
      fat: macroProblem(fat),
      // The numbers become a Lebensmittel's per-100 values, so they need its tighter limits.
      saveAsFood:
        saveAsFood && !kcalProblem && kcalValue !== null
          ? checkFitsFood({ kcal: kcalValue, ...macros })
          : null,
    });
    if (!valid || kcalValue === null) return;
    setSaving(true);
    try {
      await apiClient.createDiaryEntry({
        mealSlotId: slotId,
        localDate: date,
        name: name.trim(),
        kcal: kcalValue,
        carbs: macros.carbs,
        protein: macros.protein,
        fat: macros.fat,
        saveAsFood: saveAsFood || undefined,
      });
      onOpenChange(false);
      onCreated();
    } catch (err) {
      form.showApiError(err);
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader>
          <DrawerTitle>{t('title')}</DrawerTitle>
          <DrawerDescription>{t('description')}</DrawerDescription>
        </DrawerHeader>

        <div ref={formRef} className="flex flex-col gap-5 overflow-y-auto px-4 pb-2">
          <div className="block">
            <label
              htmlFor="quick-name"
              className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground"
            >
              {t('name')}
            </label>
            <Input
              id="quick-name"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                form.clear('name');
              }}
              placeholder={t('namePlaceholder')}
              {...form.fieldProps('name')}
            />
            <FieldError id={form.errorId('name')}>{form.errors.name}</FieldError>
          </div>

          <div className="block">
            <label
              htmlFor="quick-kcal"
              className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground"
            >
              {t('calories')}
            </label>
            <div className="flex items-baseline gap-2 border-b border-b-foreground">
              <Input
                id="quick-kcal"
                inputMode="decimal"
                value={kcal}
                onChange={(e) => {
                  setKcal(e.target.value);
                  form.clear('kcal');
                  form.clear('saveAsFood');
                }}
                placeholder="0"
                className="border-b-0 text-2xl font-bold"
                {...form.fieldProps('kcal')}
              />
              <span className="text-[13px] text-muted-foreground">kcal</span>
            </div>
            <FieldError id={form.errorId('kcal')}>{form.errors.kcal}</FieldError>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'carbs', label: t('carbs'), value: carbs, set: setCarbs },
              { key: 'protein', label: t('protein'), value: protein, set: setProtein },
              { key: 'fat', label: t('fat'), value: fat, set: setFat },
            ].map((field) => (
              <div key={field.key} className="block">
                <label
                  htmlFor={`quick-${field.key}`}
                  className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                >
                  {field.label}
                </label>
                <div className="flex items-baseline gap-1">
                  <Input
                    id={`quick-${field.key}`}
                    inputMode="decimal"
                    value={field.value}
                    onChange={(e) => {
                      field.set(e.target.value);
                      form.clear(field.key);
                      form.clear('saveAsFood');
                    }}
                    placeholder="0"
                    {...form.fieldProps(field.key)}
                  />
                  <span className="text-xs text-muted-foreground">g</span>
                </div>
                <FieldError id={form.errorId(field.key)}>{form.errors[field.key]}</FieldError>
              </div>
            ))}
          </div>

          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              {t('slot')}
            </div>
            <div className="flex flex-wrap gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => setSlotId(slot.id)}
                  className={cn(
                    'h-9 border px-4 text-[11px] font-semibold uppercase tracking-[0.12em]',
                    slot.id === slotId
                      ? 'border-transparent bg-primary text-primary-foreground'
                      : 'border-border bg-transparent text-foreground',
                  )}
                >
                  {slotLabel(slot)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-3 border p-3.5">
              <input
                type="checkbox"
                checked={saveAsFood}
                onChange={(e) => {
                  setSaveAsFood(e.target.checked);
                  form.clear('saveAsFood');
                }}
                className="size-4 shrink-0 accent-primary"
                {...form.fieldProps('saveAsFood')}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{t('saveAsFood')}</span>
                <span className="block text-xs text-muted-foreground">{t('saveAsFoodHint')}</span>
              </span>
            </label>
            <FieldError id={form.errorId('saveAsFood')} className="mt-1">
              {form.errors.saveAsFood}
            </FieldError>
          </div>

          {hint && (
            <div className="flex items-start gap-2.5 border p-3.5 text-xs text-muted-foreground">
              <span>{hint}</span>
            </div>
          )}
        </div>

        <DrawerFooterButtons
          onCancel={() => onOpenChange(false)}
          onSave={handleSave}
          canSave={canSave}
        />
      </DrawerContent>
    </Drawer>
  );
}

function DrawerFooterButtons({
  onCancel,
  onSave,
  canSave,
}: {
  onCancel: () => void;
  onSave: () => void;
  canSave: boolean;
}) {
  const t = useTranslations('QuickEntrySheet');
  return (
    <div className="mt-auto flex gap-2 border-t p-4">
      <Button className="flex-1" onClick={onSave} disabled={!canSave}>
        {t('save')}
      </Button>
      <Button variant="outline" onClick={onCancel}>
        {t('cancel')}
      </Button>
    </div>
  );
}
