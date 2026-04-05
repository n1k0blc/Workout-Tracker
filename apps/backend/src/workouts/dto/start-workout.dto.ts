import {
  IsBoolean,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsInt,
  Min,
  IsDateString,
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

  @IsOptional()
  @IsString()
  homeGymId?: string;

  @IsOptional()
  @IsBoolean()
  isPastWorkout?: boolean;

  @IsOptional()
  @IsDateString()
  pastWorkoutDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  pastWorkoutDuration?: number;
}
