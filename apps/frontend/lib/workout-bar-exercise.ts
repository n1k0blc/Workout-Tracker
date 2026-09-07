import { ExerciseLog } from '@/types';

export interface ExerciseLine {
  /** 1-based position of the exercise within the workout. */
  index: number;
  exerciseName: string;
}

/**
 * The exercise to name on the minimized workout bar. The app has no cursor, so it
 * is derived from the workout:
 *
 * - Nothing logged yet -> the first exercise.
 * - The user last logged a set on some exercise and it still has planned sets to
 *   go -> that exercise (they are mid-way through it). A free/added exercise has no
 *   plan, so "last logged" always counts as still-in-progress.
 * - That exercise's plan is complete -> the earliest exercise with nothing logged
 *   (a skipped one included), or the last exercise once every one has been started.
 * - `null` only for a workout with no exercises.
 */
export function barExerciseLine(
  exercises: Pick<ExerciseLog, 'exerciseName' | 'sets' | 'plannedSets'>[],
): ExerciseLine | null {
  if (exercises.length === 0) return null;

  const line = (i: number): ExerciseLine => ({
    index: i + 1,
    exerciseName: exercises[i].exerciseName,
  });

  let workingIndex = -1;
  exercises.forEach((exercise, i) => {
    if (exercise.sets.length > 0) workingIndex = i;
  });

  if (workingIndex === -1) return line(0);

  const working = exercises[workingIndex];
  const plannedCount = working.plannedSets?.length ?? 0;
  const planComplete = plannedCount > 0 && working.sets.length >= plannedCount;
  if (!planComplete) return line(workingIndex);

  const nextUnstarted = exercises.findIndex((exercise) => exercise.sets.length === 0);
  return line(nextUnstarted >= 0 ? nextUnstarted : exercises.length - 1);
}
