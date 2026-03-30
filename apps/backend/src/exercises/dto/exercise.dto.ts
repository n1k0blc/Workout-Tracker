import { MuscleGroup, Equipment } from './create-exercise.dto';

export class ExerciseDto {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  isCustom: boolean;
  userId?: string;
}
