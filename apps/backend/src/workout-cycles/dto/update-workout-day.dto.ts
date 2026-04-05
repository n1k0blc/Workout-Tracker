import { IsString, IsInt, Min, Max, IsOptional } from 'class-validator';

export class UpdateWorkoutDayDto {
  @IsString()
  name: string;

  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @IsOptional()
  @IsString()
  plannedHomeGymId?: string;
}
