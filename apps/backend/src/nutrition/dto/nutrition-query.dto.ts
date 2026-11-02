import { IsOptional } from 'class-validator';
import { IsLocalDate } from '../../common/utils/local-date.util';

/**
 * `GET /nutrition/day`. `date` is optional (absent, the client's "today" from `X-Timezone`). A
 * malformed one keeps answering `NUTRITION_DAY_DATE_INVALID`: a constraint's `context.code` makes
 * the validation pipe answer that code instead of the generic field list.
 */
export class NutritionDayQueryDto {
  @IsOptional()
  @IsLocalDate({ context: { code: 'NUTRITION_DAY_DATE_INVALID' } })
  date?: string;
}

/** `GET /nutrition/analytics`: both ends are required calendar days; anything else is `NUTRITION_ANALYTICS_RANGE_INVALID`. */
export class NutritionAnalyticsQueryDto {
  @IsLocalDate({ context: { code: 'NUTRITION_ANALYTICS_RANGE_INVALID' } })
  start: string;

  @IsLocalDate({ context: { code: 'NUTRITION_ANALYTICS_RANGE_INVALID' } })
  end: string;
}

/** `GET /nutrition/copy/source-dates`: `exclude` drops the day the picker was opened on. */
export class CopySourceDatesQueryDto {
  @IsOptional()
  @IsLocalDate()
  exclude?: string;
}
