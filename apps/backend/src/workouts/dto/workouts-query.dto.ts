import { IsDateString, IsOptional } from 'class-validator';
import { EndNotBeforeStart, Id } from '../../common/validation/field-rules';

/** `GET /workouts`: the Verlauf list, optionally narrowed to a date range and a Zyklus. */
export class WorkoutsQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  @EndNotBeforeStart('startDate')
  endDate?: string;

  @IsOptional()
  @Id()
  cycleId?: string;
}

/**
 * `GET /workouts/exercise-last-performance`. `exerciseId` stays optional here so that leaving it
 * out keeps answering `EXERCISE_ID_REQUIRED` from the controller.
 */
export class LastPerformanceQueryDto {
  @IsOptional()
  @Id()
  exerciseId?: string;

  @IsOptional()
  @Id()
  gymId?: string;

  @IsOptional()
  @Id()
  excludeWorkoutId?: string;
}
