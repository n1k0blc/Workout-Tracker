export class RIRDataPoint {
  date: string;
  trainingDay?: number; // cycle-anchored mode only
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
  cycleId?: string;
  cycleName?: string;
  totalSets: number;
  period?: string;
  totalWorkouts: number;
  dataPoints: RIRDataPoint[];
}
