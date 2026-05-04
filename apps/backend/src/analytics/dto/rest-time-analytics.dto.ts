export class RestTimeDataPoint {
  date: string;
  averageRestTime: number; // in seconds
  workoutId: string;
  trainingDay?: number; // For cycle mode
  weekNumber?: number;
  weekLabel?: string;
  weekStartDate?: string;
  weekEndDate?: string;
  workoutCount?: number;
}

export class RestTimeAnalyticsDto {
  overallAverage: number; // in seconds
  period: string;
  dataPoints: RestTimeDataPoint[];
}

export class RestTimeByCycleDto {
  cycleId: string;
  cycleName: string;
  dataPoints: RestTimeDataPoint[];
  overallAverage: number; // in seconds
  totalWorkouts: number;
}
