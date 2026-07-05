export class VolumeDataPoint {
  date: string;
  volume: number;
  workoutId?: string;
  trainingDay?: number; // cycle-anchored mode only
  weekNumber?: number;
  weekLabel?: string; // "KW 18" or "Woche 3"
  weekStartDate?: string;
  weekEndDate?: string;
  workoutCount?: number;
}

export class VolumeByMuscleGroup {
  muscleGroup: string;
  volume: number;
  percentage: number;
}

export class VolumeAnalyticsDto {
  cycleId?: string;
  cycleName?: string;
  totalVolume: number;
  period?: string;
  dataPoints: VolumeDataPoint[];
  byMuscleGroup?: VolumeByMuscleGroup[];
}
