import {
  IsString,
  IsInt,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
  Max,
  ArrayMinSize,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WorkoutExerciseInputDto } from '../../common/dto/workout-tree.dto';

export class WorkoutDayDto {
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number; // 0 = Sunday, 6 = Saturday; a date hint only, not the rotation order

  @IsString()
  name: string; // e.g., "Upper Body", "Leg Day"

  @IsOptional()
  @IsString()
  plannedHomeGymId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkoutExerciseInputDto)
  @ArrayMinSize(1)
  exercises: WorkoutExerciseInputDto[];
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

  // Array order defines the rotation order (WorkoutDay.order), per §3.6.
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkoutDayDto)
  @ArrayMinSize(1)
  workoutDays: WorkoutDayDto[];
}
