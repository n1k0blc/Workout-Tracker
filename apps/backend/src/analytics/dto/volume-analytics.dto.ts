export class VolumeDataPoint {
  date: string;
  volume: number;
  workoutId?: string;
}

export class VolumeByMuscleGroup {
  muscleGroup: string;
  volume: number;
  percentage: number;
}

export class VolumeAnalyticsDto {
  totalVolume: number;
  period: string;
  dataPoints: VolumeDataPoint[];
  byMuscleGroup?: VolumeByMuscleGroup[];
}
