import { ExerciseLog } from '@/types';

export interface ExerciseLine {
  /** 1-based position of the exercise within the workout. */
  index: number;
  exerciseName: string;
}

/**
 * The exercise to name on the minimized workout bar (issue #130): the next one
 * the user has logged nothing for, so a glance says what is coming up. The app
 * has no cursor or "current exercise", so this is derived from the workout.
 *
 * Once every exercise has at least one set -- the final stretch, or after
 * backfilling out of order -- there is no "next" one, so it falls back to the
 * last exercise in the list. `null` only for a workout with no exercises.
 */
export function nextExerciseLine(
  exercises: Pick<ExerciseLog, 'exerciseName' | 'sets'>[],
): ExerciseLine | null {
  if (exercises.length === 0) return null;

  const nextIndex = exercises.findIndex((exercise) => exercise.sets.length === 0);
  const index = nextIndex >= 0 ? nextIndex : exercises.length - 1;
  return { index: index + 1, exerciseName: exercises[index].exerciseName };
}
