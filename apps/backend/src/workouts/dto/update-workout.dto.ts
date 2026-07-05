import {
  IsString,
  IsInt,
  IsBoolean,
  IsOptional,
  IsArray,
  IsDateString,
  IsEnum,
  ValidateNested,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WorkoutExerciseInputDto } from '../../common/dto/workout-tree.dto';
import { SaveAsTemplateMode } from './create-workout.dto';

/** Editing a saved workout (history correction). Same side-effect flags as create (§3.4). */
export class UpdateWorkoutDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalDuration?: number;

  @IsOptional()
  @IsBoolean()
  isFreeWorkout?: boolean;

  @IsOptional()
  @IsString()
  homeGymId?: string;

  @IsOptional()
  @IsString()
  cycleId?: string;

  @IsOptional()
  @IsString()
  workoutDayId?: string;

  @IsOptional()
  @IsString()
  originTemplateId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkoutExerciseInputDto)
  @ArrayMinSize(1)
  exercises?: WorkoutExerciseInputDto[];

  @IsOptional()
  @IsBoolean()
  overwriteBlueprint?: boolean;

  @IsOptional()
  @IsEnum(SaveAsTemplateMode)
  saveAsTemplateMode?: SaveAsTemplateMode;

  @IsOptional()
  @IsString()
  saveAsTemplateName?: string;

  @IsOptional()
  @IsString()
  overwriteTemplateId?: string;
}
