export class RepsDataPoint {
  date: string;
  reps: number; // Total reps for workout
  workoutId: string;
  trainingDay?: number; // For cycle mode
  weekNumber?: number;
  weekLabel?: string;
  weekStartDate?: string;
  weekEndDate?: string;
  workoutCount?: number;
}

export class RepsAnalyticsDto {
  totalReps: number;
  averageReps: number;
  period: string;
  dataPoints: RepsDataPoint[];
}

export class RepsByCycleDto {
  cycleId: string;
  cycleName: string;
  dataPoints: RepsDataPoint[];
  totalReps: number;
  averageReps: number;
  totalWorkouts: number;
}
