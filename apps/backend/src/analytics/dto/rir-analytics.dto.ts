export class RIRAnalyticsDataPoint {
  date: string;
  rir0Count: number;
  rir1Count: number;
  rir2Count: number;
  workoutId: string;
  weekNumber?: number;
  weekLabel?: string;
  weekStartDate?: string;
  weekEndDate?: string;
  workoutCount?: number;
}

export class RIRAnalyticsDto {
  totalSets: number;
  period: string;
  dataPoints: RIRAnalyticsDataPoint[];
}
