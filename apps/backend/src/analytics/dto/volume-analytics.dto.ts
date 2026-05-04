export class VolumeDataPoint {
  date: string;
  volume: number;
  workoutId?: string;
  trainingDay?: number; // Added for cycle mode
  weekNumber?: number; // Week number for cycle mode
  weekLabel?: string; // "KW 18" or "Woche 3"
  weekStartDate?: string; // Start of week for tooltip
  weekEndDate?: string; // End of week for tooltip
  workoutCount?: number; // Number of workouts in this week
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
