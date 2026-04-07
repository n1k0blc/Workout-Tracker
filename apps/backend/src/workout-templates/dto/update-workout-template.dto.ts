import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateWorkoutTemplateExerciseDto } from './create-workout-template.dto';

export class UpdateWorkoutTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  recommendedGymId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkoutTemplateExerciseDto)
  exercises?: CreateWorkoutTemplateExerciseDto[];
}
