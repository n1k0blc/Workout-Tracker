import { MuscleGroup, Equipment } from '@prisma/client';
import { IsString, IsEnum, IsBoolean, IsOptional, IsInt, Min, Max } from 'class-validator';

export class UpdateExerciseDto {
  @IsString()
  name: string;

  @IsEnum(MuscleGroup)
  muscleGroup: MuscleGroup;

  @IsEnum(Equipment)
  equipment: Equipment;

  @IsBoolean()
  @IsOptional()
  isUnilateral?: boolean;

  @IsBoolean()
  @IsOptional()
  isDoubleWeight?: boolean;

  // Muscle group distribution percentages (must sum to 100)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  abdomenPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  latissimusPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  trapeziusPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  lowerBackPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  hamstringsPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  glutesPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  shouldersPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  bicepsPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  chestPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  quadricepsPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  calvesPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  tricepsPercent?: number;
}
