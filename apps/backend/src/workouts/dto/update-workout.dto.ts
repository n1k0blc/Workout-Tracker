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
  Max,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WorkoutExerciseInputDto } from '../../common/dto/workout-tree.dto';
import { SaveAsTemplateMode } from './create-workout.dto';
import { IsLocalDate } from '../../common/utils/local-date.util';
import {
  BaseText,
  EXERCISES_PER_WORKOUT_MAX,
  INT_COLUMN_MAX,
  NAME_MAX,
  WorkoutDate,
} from '../../common/validation/field-rules';

/** Editing a saved workout (history correction). Same side-effect flags as create (§3.4). */
export class UpdateWorkoutDto {
  @IsOptional()
  @IsDateString()
  @WorkoutDate()
  date?: string;

  // Optional here: a history correction that does not touch the day leaves the stored
  // localDate as it was logged.
  @IsOptional()
  @IsLocalDate()
  localDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(INT_COLUMN_MAX)
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
  @ArrayMaxSize(EXERCISES_PER_WORKOUT_MAX)
  exercises?: WorkoutExerciseInputDto[];

  @IsOptional()
  @IsBoolean()
  overwriteBlueprint?: boolean;

  @IsOptional()
  @IsEnum(SaveAsTemplateMode)
  saveAsTemplateMode?: SaveAsTemplateMode;

  @IsOptional()
  @BaseText(NAME_MAX)
  saveAsTemplateName?: string;

  @IsOptional()
  @IsString()
  overwriteTemplateId?: string;
}
