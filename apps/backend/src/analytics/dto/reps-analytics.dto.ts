export class RepsDataPoint {
  date: string;
  reps: number; // Total reps for workout
  workoutId: string;
  trainingDay?: number; // cycle-anchored mode only
  weekNumber?: number;
  weekLabel?: string;
  weekStartDate?: string;
  weekEndDate?: string;
  workoutCount?: number;
}

export class RepsAnalyticsDto {
  cycleId?: string;
  cycleName?: string;
  totalReps: number;
  averageReps: number;
  period?: string;
  totalWorkouts: number;
  dataPoints: RepsDataPoint[];
}
