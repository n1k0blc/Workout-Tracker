export class ORMDataPoint {
  date: string;
  trainingDay: number; // Day 1, Day 2, etc. in the cycle
  percentORM: number; // Average %ORM for all exercises matching filters that day
  workoutId: string;
}

export class ORMByCycleDto {
  cycleId: string;
  cycleName: string;
  dataPoints: ORMDataPoint[];
  // Summary stats
  averagePercentORM: number;
  totalWorkouts: number;
}
