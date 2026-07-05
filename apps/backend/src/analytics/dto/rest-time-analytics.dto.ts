export class RestTimeDataPoint {
  date: string;
  averageRestTime: number; // in seconds
  workoutId: string;
  trainingDay?: number; // cycle-anchored mode only
  weekNumber?: number;
  weekLabel?: string;
  weekStartDate?: string;
  weekEndDate?: string;
  workoutCount?: number;
}

export class RestTimeAnalyticsDto {
  cycleId?: string;
  cycleName?: string;
  overallAverage: number; // in seconds
  period?: string;
  totalWorkouts: number;
  dataPoints: RestTimeDataPoint[];
}
