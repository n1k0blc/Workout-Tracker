import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WorkoutExerciseInputDto } from '../../common/dto/workout-tree.dto';
import { BaseText, EXERCISES_PER_WORKOUT_MAX, NAME_MAX } from '../../common/validation/field-rules';

export class CreateWorkoutTemplateDto {
  @BaseText(NAME_MAX)
  name: string;

  @IsOptional()
  @IsString()
  recommendedGymId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkoutExerciseInputDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(EXERCISES_PER_WORKOUT_MAX)
  exercises: WorkoutExerciseInputDto[];
}
