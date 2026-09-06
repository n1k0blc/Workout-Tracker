'use client';

import { Workout } from '@/types';
import { currentExerciseLine } from '@/lib/workout-current-exercise';

interface MinimizedWorkoutBarProps {
  workout: Workout;
  onExpand: () => void;
}

/**
 * The overlay's own top edge once the session is collapsed (issue #129). Tapping
 * anywhere brings the workout back. Kept to name + current exercise for now; the
 * rest timer and next-exercise line land in issue #130, so the layout already
 * reserves the room.
 */
export function MinimizedWorkoutBar({ workout, onExpand }: MinimizedWorkoutBarProps) {
  const name = workout.isFreeWorkout
    ? workout.originTemplateName || 'Freies Workout'
    : workout.workoutDayName || 'Workout';
  const current = currentExerciseLine(workout.exercises);

  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label="Workout öffnen"
      className="flex h-[72px] w-full flex-col rounded-none bg-primary text-left text-primary-foreground"
    >
      {/* Pull-up handle -- same language as the collapsed set-progress bars, inverted. */}
      <span className="flex h-5 shrink-0 items-center justify-center">
        <span className="h-1 w-[72px] rounded-[1px] bg-primary-foreground/35" />
      </span>

      <span className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 pt-0.5 pb-[18px]">
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold leading-tight">{name}</span>
          {current && (
            <span className="truncate text-xs leading-snug opacity-65 dark:opacity-70">
              #{current.index} {current.exerciseName}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
