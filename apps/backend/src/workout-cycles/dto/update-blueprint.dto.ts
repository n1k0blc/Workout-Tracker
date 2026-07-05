import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { WorkoutExerciseInputDto } from '../../common/dto/workout-tree.dto';

export class UpdateBlueprintDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkoutExerciseInputDto)
  @ArrayMinSize(1)
  exercises: WorkoutExerciseInputDto[];
}
