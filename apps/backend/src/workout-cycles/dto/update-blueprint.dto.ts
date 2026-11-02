import { IsArray, ValidateNested, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { WorkoutExerciseInputDto } from '../../common/dto/workout-tree.dto';
import { EXERCISES_PER_WORKOUT_MAX } from '../../common/validation/field-rules';

export class UpdateBlueprintDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkoutExerciseInputDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(EXERCISES_PER_WORKOUT_MAX)
  exercises: WorkoutExerciseInputDto[];
}
