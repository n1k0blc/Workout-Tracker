import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsInt,
  IsNumber,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWorkoutTemplateSetDto {
  @IsInt()
  @Min(0)
  order: number;

  @IsBoolean()
  isWarmup: boolean;

  @IsInt()
  @Min(1)
  @Max(100)
  targetReps: number;

  @IsNumber()
  @Min(0)
  @Max(1000)
  targetWeight: number;

  @IsInt()
  @Min(0)
  @Max(10)
  targetRir: number;
}

export class CreateWorkoutTemplateExerciseDto {
  @IsString()
  exerciseId: string;

  @IsInt()
  @Min(0)
  order: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkoutTemplateSetDto)
  sets: CreateWorkoutTemplateSetDto[];
}

export class CreateWorkoutTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  recommendedGymId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkoutTemplateExerciseDto)
  exercises: CreateWorkoutTemplateExerciseDto[];
}
