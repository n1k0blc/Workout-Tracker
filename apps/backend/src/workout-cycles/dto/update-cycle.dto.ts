import { IsInt, IsDateString, IsOptional, Min, Max } from 'class-validator';
import { BaseText, CYCLE_DURATION_MAX, CYCLE_DURATION_MIN, NAME_MAX } from '../../common/validation/field-rules';

export class UpdateCycleDto {
  @IsOptional()
  @BaseText(NAME_MAX)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(CYCLE_DURATION_MIN)
  @Max(CYCLE_DURATION_MAX)
  duration?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;
}
