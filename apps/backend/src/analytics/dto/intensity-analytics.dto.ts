// PR3 (§3.10): ORM% -> Intensity. Weight-independent (`3000 / (30 + reps + rir)` per working
// set, averaged), so unlike the old %ORM/PR system it needs no benchmark and applies to every
// workout and every gym.
export class IntensityDataPoint {
  date: string;
  intensity: number; // percent, weight-independent
  workoutId: string;
  trainingDay?: number; // cycle-anchored mode only
  weekNumber?: number;
  weekLabel?: string;
  weekStartDate?: string;
  weekEndDate?: string;
  workoutCount?: number;
}

export class IntensityAnalyticsDto {
  cycleId?: string;
  cycleName?: string;
  averageIntensity: number;
  period?: string;
  totalWorkouts: number;
  dataPoints: IntensityDataPoint[];
}
