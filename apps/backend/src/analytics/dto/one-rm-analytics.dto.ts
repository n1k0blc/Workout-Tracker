export class OneRMDataPoint {
  date: string;
  oneRepMax: number;
  weight: number;
  reps: number;
  workoutId: string;
}

export class OneRMAnalyticsDto {
  exerciseId: string;
  exerciseName: string;
  currentOneRM: number;
  bestOneRM: number;
  improvement: number; // percentage
  history: OneRMDataPoint[];
}
