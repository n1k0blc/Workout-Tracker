import {
  IsString,
  IsInt,
  IsNumber,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
  Max,
  ArrayMinSize,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SetType } from '../../common/types';

export class BlueprintSetDto {
  @IsInt()
  @Min(1)
  order: number;

  @IsEnum(SetType)
  setType: SetType;

  @IsInt()
  @Min(1)
  reps: number;

  @IsNumber()
  @Min(0)
  weight: number;

  @IsInt()
  @Min(0)
  @Max(10)
  rir: number;

  @IsInt()
  @Min(0)
  restAfterSet: number; // seconds, default 90
}

export class BlueprintExerciseDto {
  @IsString()
  exerciseId: string;

  @IsInt()
  @Min(1)
  order: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlueprintSetDto)
  @ArrayMinSize(1)
  sets: BlueprintSetDto[];
}

export class WorkoutDayDto {
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number; // 0 = Sunday, 6 = Saturday

  @IsString()
  name: string; // e.g., "Upper Body", "Leg Day"

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlueprintExerciseDto)
  @ArrayMinSize(1)
  exercises: BlueprintExerciseDto[];
}

export class CreateCycleDto {
  @IsString()
  name: string;

  @IsInt()
  @Min(1)
  @Max(52)
  duration: number; // weeks

  @IsDateString()
  startDate: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkoutDayDto)
  @ArrayMinSize(1)
  workoutDays: WorkoutDayDto[];
}
