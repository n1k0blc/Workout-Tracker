import { IsArray, ArrayMinSize } from 'class-validator';

export class ReorderExercisesDto {
  @IsArray()
  @ArrayMinSize(1)
  exerciseIds: string[];
}
