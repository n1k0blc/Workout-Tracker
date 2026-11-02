import { IsArray, IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { MuscleGroup } from '../../common/muscle.util';
import { Equipment } from '../../common/types';
import { Id } from '../../common/validation/field-rules';

function toArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return Array.isArray(value) ? value : [value as string];
}

/** `GET /analytics/prs`: the filters of the Bestleistungen list. */
export class PersonalRecordsQueryDto {
  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsEnum(MuscleGroup, { each: true })
  muscleGroup?: MuscleGroup[];

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsEnum(Equipment, { each: true })
  equipment?: Equipment[];

  // 'alle' | 'andere' | a specific gym id
  @IsOptional()
  @Id()
  gymId?: string;

  // Sent along by the client for a single exercise; the endpoint does not use it yet.
  @IsOptional()
  @Id()
  exerciseId?: string;
}
