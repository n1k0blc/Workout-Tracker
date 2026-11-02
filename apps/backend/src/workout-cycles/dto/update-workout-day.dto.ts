import { IsString, IsInt, Min, Max, IsOptional } from 'class-validator';
import { BaseText, TRAINING_DAY_NAME_MAX } from '../../common/validation/field-rules';

export class UpdateWorkoutDayDto {
  @BaseText(TRAINING_DAY_NAME_MAX)
  name: string;

  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @IsOptional()
  @IsString()
  plannedHomeGymId?: string;

  /**
   * Set to the id of the day currently holding `weekday` to confirm an atomic swap instead
   * of a plain move. Ignored when `weekday` isn't actually taken by another day.
   */
  @IsOptional()
  @IsString()
  swapWithWorkoutDayId?: string;
}
