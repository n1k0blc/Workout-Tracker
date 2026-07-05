import { WorkoutExerciseResponseDto } from '../../common/dto/workout-tree.dto';

export class WorkoutTemplateDto {
  id: string;
  name: string;
  isCustom: boolean;
  userId?: string;
  recommendedGymId?: string;
  recommendedGymName?: string;
  createdAt: Date;
  exercises?: WorkoutExerciseResponseDto[];
  totalExercises?: number;
  totalSets?: number;
}
