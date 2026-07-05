export class MuscleDistributionItem {
  muscleGroup: string;
  volume: number;
  percentage: number;
  workoutCount: number;
}

export class MuscleDistributionDto {
  cycleId?: string;
  cycleName?: string;
  period?: string;
  distribution: MuscleDistributionItem[];
}
