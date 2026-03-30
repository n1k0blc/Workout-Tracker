import { IsString } from 'class-validator';

export class ReplaceExerciseDto {
  @IsString()
  newExerciseId: string;
}
