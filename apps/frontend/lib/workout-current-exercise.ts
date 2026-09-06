import { ExerciseLog } from '@/types';

export interface CurrentExerciseLine {
  /** 1-based position of the exercise within the workout. */
  index: number;
  exerciseName: string;
}

/**
 * The exercise to surface on the minimized workout bar (issue #128 / #129).
 *
 * "Current" is the last exercise that already has a logged set -- that is the one
 * the user is working through -- and, before anything is logged, the first
 * exercise. Returns `null` only for a workout with no exercises at all.
 *
 * This is intentionally a small, pure derivation: issue #130 grows it into a
 * fuller "what's next" module with its own tests.
 */
export function currentExerciseLine(
  exercises: Pick<ExerciseLog, 'exerciseName' | 'sets'>[],
): CurrentExerciseLine | null {
  if (exercises.length === 0) return null;

  let lastLoggedIndex = -1;
  exercises.forEach((exercise, index) => {
    if (exercise.sets.length > 0) lastLoggedIndex = index;
  });

  const index = lastLoggedIndex >= 0 ? lastLoggedIndex : 0;
  return { index: index + 1, exerciseName: exercises[index].exerciseName };
}
