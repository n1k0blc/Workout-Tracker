import { IsString, IsInt, IsNumber, IsOptional, Min, IsEnum } from 'class-validator';
import { SetType } from '../../common/types';

export class LogSetDto {
  @IsInt()
  @Min(1)
  setNumber: number;

  @IsInt()
  @Min(0)
  reps: number;

  @IsNumber()
  @Min(0)
  weight: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  rir?: number;

  @IsOptional()
  @IsEnum(SetType)
  setType?: SetType;

  @IsOptional()
  @IsInt()
  @Min(0)
  targetReps?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  targetWeight?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  targetRir?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  actualRestDuration?: number; // seconds
}

export class AddExerciseToWorkoutDto {
  @IsString()
  exerciseId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;
}

export class UpdateSetDto {
  @IsInt()
  @Min(0)
  reps: number;

  @IsNumber()
  @Min(0)
  weight: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  rir?: number;
}
