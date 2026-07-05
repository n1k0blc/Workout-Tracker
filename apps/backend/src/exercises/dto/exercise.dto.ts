import { MuscleGroup } from '../../common/muscle.util';
import { Equipment } from './create-exercise.dto';

export class ExerciseDto {
  id: string;
  name: string;
  // Derived (max-percent column), not stored -- see common/muscle.util.ts.
  primaryMuscle: MuscleGroup;
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
