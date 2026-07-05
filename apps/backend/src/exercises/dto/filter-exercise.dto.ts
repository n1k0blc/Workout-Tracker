import { IsOptional, IsEnum, IsString } from 'class-validator';
import { MuscleGroup } from '../../common/muscle.util';
import { Equipment } from './create-exercise.dto';

export class FilterExerciseDto {
  @IsOptional()
  @IsString()
  search?: string;

  // Filters on the derived primary muscle (max-percent column).
  @IsOptional()
  @IsEnum(MuscleGroup)
  primaryMuscle?: MuscleGroup;

  @IsOptional()
  @IsEnum(Equipment)
  equipment?: Equipment;

  @IsOptional()
  @IsString()
  includeCustom?: string; // 'true' or 'false'
}
