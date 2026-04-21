export class SetsDataPoint {
  date: string;
  sets: number; // Total working sets for workout
  workoutId: string;
  trainingDay?: number; // For cycle mode
}

export class SetsAnalyticsDto {
  totalSets: number;
  averageSets: number;
  period: string;
  dataPoints: SetsDataPoint[];
}

export class SetsByCycleDto {
  cycleId: string;
  cycleName: string;
  dataPoints: SetsDataPoint[];
  totalSets: number;
  averageSets: number;
  totalWorkouts: number;
}
