import {
  IsBoolean,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsInt,
  Min,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GymLocation } from './workout-response.dto';

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

  @IsEnum(GymLocation)
  gymLocation: GymLocation;

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
