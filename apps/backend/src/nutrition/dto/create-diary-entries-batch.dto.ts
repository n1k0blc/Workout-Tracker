import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
  MaxLength,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsLocalDate } from '../../common/utils/local-date.util';

/** One food picked in the drawer, with how much of it (normalised to grams or ml). */
export class DiaryEntryFromFoodItemDto {
  @IsString()
  @IsNotEmpty()
  foodId: string;

  // Always grams or millilitres -- the client resolves a chosen portion into this before
  // sending. The server scales the food's per-100 values by `grams / 100`.
  @IsNumber()
  @IsPositive()
  grams: number;

  // How the amount was entered, kept verbatim for display ("1 Portion (40 g)", "150 g").
  @IsOptional()
  @IsString()
  @MaxLength(60)
  quantityLabel?: string;
}

/**
 * Commits the picker's basket: every collected food becomes one Eintrag in the same Abschnitt
 * on the same day, in a single request. Each entry snapshots its nutrients from the food at
 * commit time (ADR-0002) -- editing the food afterwards never touches it.
 */
export class CreateDiaryEntriesBatchDto {
  @IsString()
  @IsNotEmpty()
  mealSlotId: string;

  @IsLocalDate()
  localDate: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiaryEntryFromFoodItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  items: DiaryEntryFromFoodItemDto[];
}
