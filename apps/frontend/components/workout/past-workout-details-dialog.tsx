'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/field';
import { useFormErrors } from '@/hooks/useFormErrors';
import { WORKOUT_DATE_MIN_YEAR, checkWorkoutDate } from '@/lib/field-rules';
import { toLocalDateString } from '@/lib/local-date';
import {
  TYPED_DURATION_MAX_MINUTES,
  TYPED_DURATION_MIN_MINUTES,
  checkTypedDuration,
} from '@/lib/workout-duration';

interface PastWorkoutDetailsDialogProps {
  onBack: () => void;
  /** `date` is the user's `YYYY-MM-DD`; the duration is in seconds, as the workout stores it. */
  onConfirm: (details: { date: string; durationSeconds: number }) => void;
}

/**
 * The Workout-Details step of tracking a workout afterwards (#230): its date and a typed duration.
 * Mount it when the step opens; it starts on the user's own today with an hour.
 */
export default function PastWorkoutDetailsDialog({ onBack, onConfirm }: PastWorkoutDetailsDialogProps) {
  const t = useTranslations('WorkoutStart');
  const today = toLocalDateString(new Date());
  const [date, setDate] = useState(today);
  const [minutes, setMinutes] = useState('60');
  const [form, formRef] = useFormErrors({
    fields: ['workoutDate', 'durationMinutes'],
    messageValues: {
      durationMinutes: { min: TYPED_DURATION_MIN_MINUTES, max: TYPED_DURATION_MAX_MINUTES },
    },
  });

  const handleConfirm = () => {
    const valid = form.setConstraints({
      workoutDate: checkWorkoutDate(date, today),
      durationMinutes: checkTypedDuration(minutes),
    });
    if (valid) onConfirm({ date, durationSeconds: Number(minutes) * 60 });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onBack()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pastDetails.title')}</DialogTitle>
          <DialogDescription>{t('pastDetails.description')}</DialogDescription>
        </DialogHeader>

        <div ref={formRef} className="space-y-4 py-4">
          <div>
            <Label htmlFor="pastDetailsDate">{t('pastDetails.dateLabel')}</Label>
            <Input
              id="pastDetailsDate"
              type="date"
              value={date}
              min={`${WORKOUT_DATE_MIN_YEAR}-01-01`}
              max={today}
              onChange={(e) => {
                setDate(e.target.value);
                form.clear('workoutDate');
              }}
              {...form.fieldProps('workoutDate')}
            />
            <FieldError id={form.errorId('workoutDate')}>{form.errors.workoutDate}</FieldError>
          </div>

          <div>
            <Label htmlFor="pastDetailsMinutes">{t('pastDetails.durationLabel')}</Label>
            <Input
              id="pastDetailsMinutes"
              type="number"
              inputMode="numeric"
              min={TYPED_DURATION_MIN_MINUTES}
              max={TYPED_DURATION_MAX_MINUTES}
              step={1}
              value={minutes}
              onChange={(e) => {
                setMinutes(e.target.value);
                form.clear('durationMinutes');
              }}
              className="text-base"
              {...form.fieldProps('durationMinutes')}
            />
            <FieldError id={form.errorId('durationMinutes')}>{form.errors.durationMinutes}</FieldError>
          </div>
        </div>

        <DialogFooter className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-1">
            {t('common.back')}
          </Button>
          <Button onClick={handleConfirm} className="flex-1">
            {t('pastDetails.next')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
