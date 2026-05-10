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
  // Muscle group distribution percentages
  abdomenPercent: number;
  latissimusPercent: number;
  trapeziusPercent: number;
  lowerBackPercent: number;
  hamstringsPercent: number;
  glutesPercent: number;
  shouldersPercent: number;
  bicepsPercent: number;
  chestPercent: number;
  quadricepsPercent: number;
  calvesPercent: number;
  tricepsPercent: number;
}
