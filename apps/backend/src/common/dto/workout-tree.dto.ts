import {
  IsString,
  IsInt,
  IsNumber,
  IsEnum,
  IsOptional,
  IsArray,
  IsDateString,
  ValidateNested,
  Min,
  Max,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SetType } from '../types';

/**
 * Shared exercise/set tree vocabulary (§4.1): one shape for blueprints, templates, and
 * performed workouts, instead of the old BlueprintSet/WorkoutTemplateSet/SetLog field-name
 * drift (setType vs isWarmup, order vs setNumber, reps/weight/rir vs target*).
 */
export class WorkoutSetInputDto {
  @IsInt()
  @Min(0)
  order: number;

  @IsEnum(SetType)
  setType: SetType;

  @IsInt()
  @Min(1)
  reps: number;

  @IsNumber()
  @Min(0)
  weight: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  rir?: number;

  // Seconds rested after completing this set. Optional -- defaults to 90 when omitted
  // (manual blueprint/template creation with no rest input, per §3.5).
  @IsOptional()
  @IsInt()
  @Min(0)
  rest?: number;

  // Meaningful only when saving a performed workout; ignored for blueprint/template kinds.
  @IsOptional()
  @IsDateString()
  completedAt?: string;
}

export class WorkoutExerciseInputDto {
  @IsString()
  exerciseId: string;

  @IsInt()
  @Min(0)
  order: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkoutSetInputDto)
  @ArrayMinSize(1)
  sets: WorkoutSetInputDto[];
}

export class WorkoutSetResponseDto {
  id: string;
  order: number;
  setType: SetType;
  reps: number;
  weight: number;
  rir?: number;
  rest?: number;
  completedAt?: Date;
}

export class WorkoutExerciseResponseDto {
  id: string;
  exerciseId: string;
  exerciseName: string;
  isUnilateral: boolean;
  isDoubleWeight: boolean;
  order: number;
  sets: WorkoutSetResponseDto[];
}
