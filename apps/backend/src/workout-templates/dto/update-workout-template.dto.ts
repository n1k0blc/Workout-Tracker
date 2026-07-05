import { IsString, IsOptional, IsArray, ValidateNested, MinLength, MaxLength, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { WorkoutExerciseInputDto } from '../../common/dto/workout-tree.dto';

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
  @Type(() => WorkoutExerciseInputDto)
  @ArrayMinSize(1)
  exercises?: WorkoutExerciseInputDto[];
}
