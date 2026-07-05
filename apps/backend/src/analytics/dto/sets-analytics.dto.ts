export class SetsDataPoint {
  date: string;
  sets: number; // Total working sets for workout
  workoutId: string;
  trainingDay?: number; // cycle-anchored mode only
  weekNumber?: number;
  weekLabel?: string;
  weekStartDate?: string;
  weekEndDate?: string;
  workoutCount?: number;
}

export class SetsAnalyticsDto {
  cycleId?: string;
  cycleName?: string;
  totalSets: number;
  averageSets: number;
  period?: string;
  totalWorkouts: number;
  dataPoints: SetsDataPoint[];
}
