export class DurationDataPoint {
  date: string;
  duration: number; // in minutes
  workoutId: string;
  trainingDay?: number; // For cycle mode
  weekNumber?: number;
  weekLabel?: string;
  weekStartDate?: string;
  weekEndDate?: string;
  workoutCount?: number;
}

export class DurationAnalyticsDto {
  averageDuration: number; // in minutes
  period: string;
  dataPoints: DurationDataPoint[];
}

export class DurationByCycleDto {
  cycleId: string;
  cycleName: string;
  dataPoints: DurationDataPoint[];
  averageDuration: number; // in minutes
  totalWorkouts: number;
}
