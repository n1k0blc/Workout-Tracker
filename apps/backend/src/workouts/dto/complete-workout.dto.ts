import { IsBoolean, IsOptional, IsInt, Min } from 'class-validator';

export class CompleteWorkoutDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  totalDuration?: number; // seconds

  @IsOptional()
  @IsBoolean()
  updateBlueprint?: boolean; // If true, update the blueprint with current workout data
}
