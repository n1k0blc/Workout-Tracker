import { IsOptional, IsEnum, IsIn } from 'class-validator';
import { MuscleGroup } from '../../common/muscle.util';
import { Equipment } from './create-exercise.dto';
import { SearchTerm } from '../../common/validation/field-rules';

export class FilterExerciseDto {
  @IsOptional()
  @SearchTerm()
  search?: string;

  // Filters on the derived primary muscle (max-percent column).
  @IsOptional()
  @IsEnum(MuscleGroup)
  primaryMuscle?: MuscleGroup;

  @IsOptional()
  @IsEnum(Equipment)
  equipment?: Equipment;

  @IsOptional()
  @IsIn(['true', 'false'])
  includeCustom?: string;
}
