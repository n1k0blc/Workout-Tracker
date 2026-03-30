import { IsOptional, IsEnum, IsString } from 'class-validator';
import { MuscleGroup, Equipment } from './create-exercise.dto';

export class FilterExerciseDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(MuscleGroup)
  muscleGroup?: MuscleGroup;

  @IsOptional()
  @IsEnum(Equipment)
  equipment?: Equipment;

  @IsOptional()
  @IsString()
  includeCustom?: string; // 'true' or 'false'
}
