import {
  IsBoolean,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class StartWorkoutExerciseDto {
  @IsString()
  exerciseId: string;

  @IsInt()
  @Min(1)
  order: number;
}

export class StartWorkoutDto {
  @IsOptional()
  @IsBoolean()
  isFreeWorkout?: boolean;

  @IsOptional()
  @IsString()
  cycleId?: string;

  @IsOptional()
  @IsString()
  workoutDayId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StartWorkoutExerciseDto)
  @ArrayMinSize(1)
  exercises?: StartWorkoutExerciseDto[];
}
