import { IsString, IsInt, IsDateString, IsOptional, Min, Max } from 'class-validator';

export class UpdateCycleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(52)
  duration?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;
}
