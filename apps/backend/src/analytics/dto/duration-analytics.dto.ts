export class DurationDataPoint {
  date: string;
  duration: number; // in minutes
  workoutId: string;
  trainingDay?: number; // cycle-anchored mode only
  weekNumber?: number;
  weekLabel?: string;
  weekStartDate?: string;
  weekEndDate?: string;
  workoutCount?: number;
}

export class DurationAnalyticsDto {
  cycleId?: string;
  cycleName?: string;
  averageDuration: number; // in minutes
  period?: string;
  totalWorkouts: number;
  dataPoints: DurationDataPoint[];
}
