import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CycleFormData } from './cycle-wizard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/field';
import { useFormErrors } from '@/hooks/useFormErrors';
import {
  CYCLE_DURATION_MAX,
  CYCLE_DURATION_MIN,
  NAME_MAX,
  checkBaseText,
  checkStartDate,
} from '@/lib/field-rules';
import { addLocalYears, toLocalDateString } from '@/lib/local-date';

interface BasicInfoStepProps {
  formData: CycleFormData;
  updateFormData: (data: Partial<CycleFormData>) => void;
  onNext: () => void;
}

/** A typed duration pulled into 1-52 weeks; anything unparseable becomes the minimum. */
function clampDuration(raw: string): number {
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed)
    ? CYCLE_DURATION_MIN
    : Math.min(CYCLE_DURATION_MAX, Math.max(CYCLE_DURATION_MIN, parsed));
}

export default function BasicInfoStep({
  formData,
  updateFormData,
  onNext,
}: BasicInfoStepProps) {
  const t = useTranslations('BasicInfoStep');
  const [durationInput, setDurationInput] = useState(String(formData.duration));
  const [form, formRef] = useFormErrors({
    fields: ['name', 'startDate'],
    messageValues: { name: { max: NAME_MAX } },
  });
  const today = toLocalDateString(new Date());

  const applyDuration = () => {
    const clamped = clampDuration(durationInput);
    setDurationInput(String(clamped));
    updateFormData({ duration: clamped });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Enter submits without a blur, so the duration is held to its limit here as well.
    applyDuration();
    const valid = form.setConstraints({
      name: checkBaseText(formData.name, NAME_MAX),
      startDate: checkStartDate(formData.startDate, today),
    });
    if (valid) onNext();
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">{t('nameLabel')}</Label>
        <Input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => {
            updateFormData({ name: e.target.value });
            form.clear('name');
          }}
          placeholder={t('namePlaceholder')}
          {...form.fieldProps('name')}
        />
        <FieldError id={form.errorId('name')}>{form.errors.name}</FieldError>
      </div>

      <div className="space-y-2">
        <Label htmlFor="duration">{t('durationLabel')}</Label>
        <Input
          id="duration"
          type="number"
          value={durationInput}
          onChange={(e) => {
            const raw = e.target.value;
            setDurationInput(raw);
            const parsed = parseInt(raw, 10);
            if (!isNaN(parsed)) {
              updateFormData({ duration: parsed });
            }
          }}
          onBlur={applyDuration}
          min={CYCLE_DURATION_MIN}
          max={CYCLE_DURATION_MAX}
          step={1}
        />
        <p className="text-sm text-muted-foreground">
          {t('durationHint')}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="startDate">{t('startDateLabel')}</Label>
        <Input
          id="startDate"
          type="date"
          value={formData.startDate}
          onChange={(e) => {
            updateFormData({ startDate: e.target.value });
            form.clear('startDate');
          }}
          min={today}
          max={addLocalYears(today, 1)}
          {...form.fieldProps('startDate')}
        />
        <FieldError id={form.errorId('startDate')}>{form.errors.startDate}</FieldError>
      </div>

      <div className="pt-2">
        <Button type="submit" className="w-full">
          {t('next')}
        </Button>
      </div>
    </form>
  );
}
