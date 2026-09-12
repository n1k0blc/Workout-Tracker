import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/** One Abschnitt, as returned to the client. */
export class MealSlotDto {
  id: string;
  name: string;
  order: number;
  archived: boolean;
}

/** The manage sheet's payload: active Abschnitte in display order, archived ones separately. */
export class MealSlotListDto {
  active: MealSlotDto[];
  archived: MealSlotDto[];
}

export class CreateMealSlotDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;
}

/** Rename and/or (un)archive an Abschnitt. At least one field is meaningful. */
export class UpdateMealSlotDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

class ReorderMealSlotItemDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  // 1-based, contiguous, and must restate the array position -- the same rule the workout
  // tree enforces. The service rejects a mismatch with a 400 rather than normalising it.
  @IsInt()
  @Min(1)
  order: number;
}

export class ReorderMealSlotsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderMealSlotItemDto)
  @ArrayMinSize(1)
  slots: ReorderMealSlotItemDto[];
}
