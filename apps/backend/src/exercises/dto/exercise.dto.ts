import { MuscleGroup, Equipment } from './create-exercise.dto';

export class ExerciseDto {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  isUnilateral: boolean;
  isDoubleWeight: boolean;
  isCustom: boolean;
  userId?: string;
}
