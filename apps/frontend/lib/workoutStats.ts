import { Workout, PersonalRecord, SetType } from '@/types';
import { setWorkingVolume } from './volume';

export interface WorkoutStats {
  totalVolume: number; // in kg
  duration: number; // in seconds
  exerciseCount: number;
  setCount: number; // working sets only
  personalRecords: PersonalRecord[];
}

/**
 * Calculate workout statistics for the completion modal
 */
export function calculateWorkoutStats(
  workout: Workout,
  personalRecords: PersonalRecord[] = []
): WorkoutStats {
  let totalVolume = 0;
  let setCount = 0;

  // Calculate volume and count sets
  for (const exerciseLog of workout.exercises) {
    for (const set of exerciseLog.sets) {
      // Skip warmup sets
      if (set.setType === SetType.WARMUP) continue;

      totalVolume += setWorkingVolume(set, exerciseLog);
      setCount++;
    }
  }

  // Filter PRs for this workout
  const workoutPRs = personalRecords.filter(pr => pr.workoutId === workout.id);

  return {
    totalVolume,
    duration: workout.totalDuration || 0,
    exerciseCount: workout.exercises.length,
    setCount,
    personalRecords: workoutPRs,
  };
}

/**
 * Format duration in seconds to readable string
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes} min`;
}

/**
 * Format volume number with thousand separators
 */
export function formatVolume(kg: number): string {
  return new Intl.NumberFormat('de-DE').format(Math.round(kg));
}
