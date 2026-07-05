import { IsString, IsEnum, IsOptional, MaxLength, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { MuscleGroup } from '../../common/muscle.util';

export { MuscleGroup };

export enum Equipment {
  CABLE = 'CABLE',
  MACHINE = 'MACHINE',
  DUMBBELL = 'DUMBBELL',
  BARBELL = 'BARBELL',
  BODYWEIGHT = 'BODYWEIGHT',
  SMITH_MACHINE = 'SMITH_MACHINE',
  EZ_BAR = 'EZ_BAR',
}

export class CreateExerciseDto {
  @IsString()
  @MaxLength(100, { message: 'Exercise name must not exceed 100 characters' })
  name: string;

  // Used only as a convenience: if no percentages are provided, this muscle is set to 100%.
  // Not stored directly -- the percent distribution is the single source of truth (§3.7).
  @IsOptional()
  @IsEnum(MuscleGroup, { message: 'Invalid muscle group' })
  primaryMuscle?: MuscleGroup;

  @IsEnum(Equipment, { message: 'Invalid equipment type' })
  equipment: Equipment;

  @IsOptional()
  @IsBoolean()
  isUnilateral?: boolean;

  @IsOptional()
  @IsBoolean()
  isDoubleWeight?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  // Muscle group distribution percentages (must sum to 100)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  abdomenPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  latissimusPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  trapeziusPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  lowerBackPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  hamstringsPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  glutesPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  shouldersPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  bicepsPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  chestPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  quadricepsPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  calvesPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  tricepsPercent?: number;
}
