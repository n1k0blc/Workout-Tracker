import { IsOptional, IsEnum, IsIn, IsDateString, IsArray, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { MuscleGroup } from '../muscle.util';
import { Equipment } from '../types';
import { Id } from '../validation/field-rules';

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
  @Id()
  gymId?: string;

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsEnum(MuscleGroup, { each: true })
  muscleGroup?: string[];

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsEnum(Equipment, { each: true })
  equipment?: string[];

  // Overrides muscleGroup/equipment entirely when set. Not @IsUUID: global/seeded
  // exercises carry non-UUID ids (e.g. "seed-bayesian-curl"), same as the write path's
  // WorkoutExerciseInputDto.exerciseId.
  @IsOptional()
  @Id()
  exerciseId?: string;

  @IsOptional()
  @IsIn(['day', 'week'])
  aggregation?: 'day' | 'week';

  // RIR-metric only, kept on the shared filter for simplicity.
  @IsOptional()
  @IsIn(['morning', 'afternoon', 'evening'])
  timeOfDay?: string;
}
