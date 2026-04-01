import { IsArray, IsOptional, IsDateString, ValidateNested, IsString, IsNumber, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

class UpdateSetDto {
  @IsString()
  id: string;

  @IsInt()
  @Min(1)
  reps: number;

  @IsNumber()
  @Min(0)
  weight: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  rir?: number;
}

class UpdateExerciseDto {
  @IsString()
  id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateSetDto)
  sets: UpdateSetDto[];
}

export class UpdateCompletedWorkoutDto {
  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateExerciseDto)
  exercises: UpdateExerciseDto[];
}
