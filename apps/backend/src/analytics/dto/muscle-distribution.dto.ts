export class MuscleDistributionItem {
  muscleGroup: string;
  volume: number;
  percentage: number;
  workoutCount: number;
}

export class MuscleDistributionDto {
  period: string;
  distribution: MuscleDistributionItem[];
}
