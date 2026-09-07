'use client';

import { Workout } from '@/types';
import { barExerciseLine } from '@/lib/workout-bar-exercise';
import { RestTimerDisplay } from '@/components/workout/rest-timer-display';

interface MinimizedWorkoutBarProps {
  workout: Workout;
  onExpand: () => void;
}

/**
 * The overlay's own top edge once the session is collapsed (issue #129). Tapping
 * the bar expands the workout; the rest-timer chip (issue #130) stops the tap from
 * bubbling, so pausing the rest never also expands.
 */
export function MinimizedWorkoutBar({ workout, onExpand }: MinimizedWorkoutBarProps) {
  const name = workout.isFreeWorkout
    ? workout.originTemplateName || 'Freies Workout'
    : workout.workoutDayName || 'Workout';
  const exercise = barExerciseLine(workout.exercises);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onExpand}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onExpand();
        }
      }}
      aria-label="Workout öffnen"
      className="flex h-[72px] w-full cursor-pointer flex-col rounded-none bg-primary text-left text-primary-foreground"
    >
      {/* Pull-up handle -- same language as the collapsed set-progress bars, inverted. */}
      <span aria-hidden className="flex h-5 shrink-0 items-center justify-center">
        <span className="h-1 w-[72px] rounded-[1px] bg-primary-foreground/35" />
      </span>

      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 pt-0.5 pb-[18px]">
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold leading-tight">{name}</span>
          {exercise && (
            <span className="truncate text-xs leading-snug opacity-65 dark:opacity-70">
              #{exercise.index} {exercise.exerciseName}
            </span>
          )}
        </div>

        <RestTimerDisplay variant="bar" className="shrink-0" />
      </div>
    </div>
  );
}
