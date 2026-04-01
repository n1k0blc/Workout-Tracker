import { IsString, IsEnum, IsOptional, MaxLength, IsBoolean } from 'class-validator';

export enum MuscleGroup {
  CHEST = 'CHEST',
  BACK = 'BACK',
  BICEPS = 'BICEPS',
  TRICEPS = 'TRICEPS',
  ABS = 'ABS',
  SHOULDERS = 'SHOULDERS',
  LEGS = 'LEGS',
}

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

  @IsEnum(MuscleGroup, { message: 'Invalid muscle group' })
  muscleGroup: MuscleGroup;

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
}
