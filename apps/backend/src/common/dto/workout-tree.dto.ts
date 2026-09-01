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
import { SetType, Equipment } from '../types';

/**
 * Shared exercise/set tree vocabulary (§4.1): one shape for blueprints, templates, and
 * performed workouts, instead of the old BlueprintSet/WorkoutTemplateSet/SetLog field-name
 * drift (setType vs isWarmup, order vs setNumber, reps/weight/rir vs target*).
 */
export class WorkoutSetInputDto {
  // 1-based, and must equal this set's position in `sets` -- see the WorkoutTreeService
  // docstring. `@Min(1)` only catches the 0-based case; the positional check lives in
  // `toExerciseInputs`, because it needs the whole array.
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

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  rir?: number;

  // Per-side values for unilateral sets (§4.1, issue #65). Optional here because a bilateral
  // set carries none; the write path then requires all four reps/weight sides for a unilateral
  // exercise, rejects any side data on a bilateral one, and derives reps/weight/rir from the
  // sides -- see `deriveSetAggregates` in the workout-tree service (issue #100).
  @IsOptional()
  @IsInt()
  @Min(1)
  repsLeft?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  repsRight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightLeft?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightRight?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  rirLeft?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  rirRight?: number;

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

  // 1-based, and must equal this exercise's position in `exercises` -- see WorkoutSetInputDto.
  @IsInt()
  @Min(1)
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
  repsLeft?: number;
  repsRight?: number;
  weightLeft?: number;
  weightRight?: number;
  rirLeft?: number;
  rirRight?: number;
  rest?: number;
  completedAt?: Date;
}

export class WorkoutExerciseResponseDto {
  id: string;
  exerciseId: string;
  exerciseName: string;
  // The catalogue equipment of the exercise -- carried so the active-workout UI can tell a
  // BODYWEIGHT movement (where a 0 kg set is a real load) from every other exercise (where it
  // is a mistake worth blocking). See the additional-set guard in exercise-card.
  equipment: Equipment;
  isUnilateral: boolean;
  isDoubleWeight: boolean;
  order: number;
  sets: WorkoutSetResponseDto[];
}
