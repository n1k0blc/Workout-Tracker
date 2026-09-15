'use client';

import { useTranslations, useFormatter } from 'next-intl';
import { PersonalRecord } from '@/types';
import { prValueParts } from '@/lib/prUtils';
import { GymTag } from './GymTag';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PersonalRecordCardProps {
  pr: PersonalRecord;
  /** Show the date line (default: true) */
  showDate?: boolean;
  /** Additional classes for density adjustments (e.g. in tight grids) */
  className?: string;
}

/**
 * Unified Personal Record card with the preferred gradient design
 * + consistent Gym Tag below the exercise name.
 *
 * Used on: Dashboard, Analytics, Cycle Detail, and Post-Workout Celebration.
 */
export function PersonalRecordCard({
  pr,
  showDate = true,
  className = '',
}: PersonalRecordCardProps) {
  const t = useTranslations('PersonalRecordCard');
  const format = useFormatter();

  const prTypeLabel = (type: string): string => {
    switch (type) {
      case 'weight':
        return t('typeWeight');
      case 'reps':
        return t('typeReps');
      case 'volume':
        return t('typeVolume');
      case 'one_rm':
        return t('typeOneRepMax');
      default:
        return type;
    }
  };

  const { value, unit } = prValueParts(pr);
  const prValueLabel =
    unit === 'kg' ? `${format.number(value)} kg` : t('reps', { count: value });

  /** `format.dateTime` (unlike the old `toLocaleDateString`) throws on an invalid Date --
   *  fall back to the raw string rather than crashing the card render. */
  const formattedPrDate = (() => {
    const date = new Date(pr.date);
    if (Number.isNaN(date.getTime())) return pr.date;
    return format.dateTime(date, { day: '2-digit', month: '2-digit', year: 'numeric' });
  })();

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="font-semibold">{pr.exerciseName}</div>

            {/* Gym Tag directly below exercise name */}
            <div className="mt-1.5">
              <GymTag homeGym={pr.homeGym} />
            </div>

            {showDate && (
              <div className="text-sm text-muted-foreground mt-2">
                {t('prLabel', { type: prTypeLabel(pr.type), date: formattedPrDate })}
              </div>
            )}
          </div>

          <div className="text-right shrink-0">
            <div className="text-2xl font-bold text-primary">
              {prValueLabel}
            </div>
            {pr.details?.weight && pr.details?.reps && (
              <div className="text-sm text-muted-foreground mt-1">
                {format.number(pr.details.weight)} kg × {format.number(pr.details.reps)}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
