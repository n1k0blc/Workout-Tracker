import { IsOptional, IsEnum, IsIn, IsDateString, IsString, IsArray, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export enum AnalyticsScope {
  ALL = 'all',
  NON_CYCLE = 'non-cycle',
}

function toArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return Array.isArray(value) ? value : [value as string];
}

/**
 * PR3 (§3.9): one shared filter for every consolidated analytics metric, driving
 * `AnalyticsService.loadWorkoutsForAnalytics`. Replaces the old per-metric `-by-cycle`
 * twins -- `cycleId` presence alone switches a metric into cycle-anchored mode (cycle-relative
 * weeks + `trainingDay`); its absence uses `period`/`startDate`/`endDate` instead, optionally
 * narrowed to non-cycle-only workouts via `scope`.
 */
export class AnalyticsFilterDto {
  @IsOptional()
  @IsUUID()
  cycleId?: string;

  @IsOptional()
  @IsEnum(AnalyticsScope)
  scope?: AnalyticsScope = AnalyticsScope.ALL;

  @IsOptional()
  @IsIn(['week', 'month', 'all'])
  period?: 'week' | 'month' | 'all' = 'month';

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  // 'alle' | 'andere' | a specific gym id | undefined (all three treated as "no filter" except 'andere')
  @IsOptional()
  @IsString()
  gymId?: string;

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsString({ each: true })
  muscleGroup?: string[];

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsString({ each: true })
  equipment?: string[];

  // Overrides muscleGroup/equipment entirely when set.
  @IsOptional()
  @IsUUID()
  exerciseId?: string;

  @IsOptional()
  @IsIn(['day', 'week'])
  aggregation?: 'day' | 'week';

  // RIR-metric only, kept on the shared filter for simplicity.
  @IsOptional()
  @IsIn(['morning', 'afternoon', 'evening'])
  timeOfDay?: string;
}
