import {
  IsString,
  IsInt,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
  Max,
  ArrayMinSize,
  ArrayMaxSize,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WorkoutExerciseInputDto } from '../../common/dto/workout-tree.dto';
import {
  BaseText,
  CYCLE_DURATION_MAX,
  CYCLE_DURATION_MIN,
  EXERCISES_PER_WORKOUT_MAX,
  NAME_MAX,
  TRAINING_DAY_NAME_MAX,
  TRAINING_DAYS_PER_CYCLE_MAX,
} from '../../common/validation/field-rules';

export class WorkoutDayDto {
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number; // 0 = Sunday, 6 = Saturday; distance from the cycle's startDate weekday decides WorkoutDay.order (#74)

  @BaseText(TRAINING_DAY_NAME_MAX)
  name: string; // e.g., "Upper Body", "Leg Day"

  @IsOptional()
  @IsString()
  plannedHomeGymId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkoutExerciseInputDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(EXERCISES_PER_WORKOUT_MAX)
  exercises: WorkoutExerciseInputDto[];
}

export class CreateCycleDto {
  @BaseText(NAME_MAX)
  name: string;

  @IsInt()
  @Min(CYCLE_DURATION_MIN)
  @Max(CYCLE_DURATION_MAX)
  duration: number; // weeks

  @IsDateString()
  startDate: string;

  // Request array order is irrelevant to WorkoutDay.order -- each day's weekday distance
  // from startDate decides it (#74).
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkoutDayDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(TRAINING_DAYS_PER_CYCLE_MAX)
  workoutDays: WorkoutDayDto[];
}
