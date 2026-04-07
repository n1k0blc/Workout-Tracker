export class WorkoutTemplateSetDto {
  id: string;
  order: number;
  isWarmup: boolean;
  targetReps: number;
  targetWeight: number;
  targetRir: number;
}

export class WorkoutTemplateExerciseDto {
  id: string;
  order: number;
  exerciseId: string;
  exerciseName?: string;
  sets: WorkoutTemplateSetDto[];
}

export class WorkoutTemplateDto {
  id: string;
  name: string;
  isCustom: boolean;
  userId?: string;
  recommendedGymId?: string;
  recommendedGymName?: string;
  createdAt: Date;
  exercises?: WorkoutTemplateExerciseDto[];
  totalExercises?: number;
  totalSets?: number;
}
