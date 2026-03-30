import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { BlueprintExerciseDto } from './create-cycle.dto';

export class UpdateBlueprintDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlueprintExerciseDto)
  @ArrayMinSize(1)
  exercises: BlueprintExerciseDto[];
}
