'use client';

import { useTranslations } from 'next-intl';

interface WorkoutTimerProps {
  workoutDuration: number;
}

export default function WorkoutTimer({
  workoutDuration,
}: WorkoutTimerProps) {
  const t = useTranslations('ActiveWorkout');
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-end">
      <div className="text-sm text-muted-foreground">{t('duration')}</div>
      <div className="text-2xl font-bold text-foreground tabular-nums">
        {formatTime(workoutDuration)}
      </div>
    </div>
  );
}
