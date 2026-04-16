export class RIRDataPoint {
  date: string;
  trainingDay: number; // Day 1, Day 2, etc. in the cycle
  rir0Count: number; // Number of working sets with RIR 0
  rir1Count: number; // Number of working sets with RIR 1
  rir2Count: number; // Number of working sets with RIR 2
  workoutId: string;
}

export class RIRByCycleDto {
  cycleId: string;
  cycleName: string;
  dataPoints: RIRDataPoint[];
  // Summary stats
  totalSets: number;
  totalWorkouts: number;
}
