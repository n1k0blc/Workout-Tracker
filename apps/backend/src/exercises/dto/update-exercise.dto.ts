import { MuscleGroup, Equipment } from '@prisma/client';
import { IsString, IsEnum, IsBoolean, IsOptional } from 'class-validator';

export class UpdateExerciseDto {
  @IsString()
  name: string;

  @IsEnum(MuscleGroup)
  muscleGroup: MuscleGroup;

  @IsEnum(Equipment)
  equipment: Equipment;

  @IsBoolean()
  @IsOptional()
  isUnilateral?: boolean;

  @IsBoolean()
  @IsOptional()
  isDoubleWeight?: boolean;
}
