'use client';

import { useTranslations } from 'next-intl';
import { Exercise } from '@/types';
import { IconTrash, IconRefresh } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';

interface SelectedExerciseCardProps {
  exercise: Exercise;
  onRemove: () => void;
  onReplace: () => void;
}

export default function SelectedExerciseCard({
  exercise,
  onRemove,
  onReplace,
}: SelectedExerciseCardProps) {
  const t = useTranslations('SelectedExerciseCard');
  return (
    <div className="bg-card border border-border rounded-lg p-4 relative">
      {/* Action buttons - top right */}
      <div className="absolute top-3 right-3 flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onReplace}
          title={t('swapExercise')}
        >
          <IconRefresh className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-destructive hover:text-destructive"
          onClick={onRemove}
          title={t('removeExercise')}
        >
          <IconTrash className="size-4" />
        </Button>
      </div>

      {/* Exercise details */}
      <div className="pr-20">
        <div className="font-semibold text-foreground">{exercise.name}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{t('filteredByExercise')}</div>
      </div>
    </div>
  );
}
