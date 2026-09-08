import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsNumber,
  Min,
  IsOptional,
  IsPositive,
} from 'class-validator';
import { IsLocalDate } from '../../common/utils/local-date.util';

/**
 * Logs one Eintrag into an Abschnitt. In this ticket every entry is a Schnelleintrag: the
 * client supplies the name and the kcal/macros directly, there is no Food behind it. The
 * nutrients are stored as-is -- a snapshot -- and `foodId` / `mealId` are left null by the
 * service.
 */
export class CreateDiaryEntryDto {
  @IsString()
  @IsNotEmpty()
  mealSlotId: string;

  // Client-stamped calendar day, `YYYY-MM-DD` in the user's own timezone -- same rule as a
  // workout's `localDate`.
  @IsLocalDate()
  localDate: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsNumber()
  @Min(0)
  kcal: number;

  @IsNumber()
  @Min(0)
  carbs: number;

  @IsNumber()
  @Min(0)
  protein: number;

  @IsNumber()
  @Min(0)
  fat: number;

  // How much was eaten, in the entry's own unit. Absent for a bare Schnelleintrag, where it
  // defaults to 1; the quantity editor later rescales the snapshot by newQuantity / this.
  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  quantityLabel?: string;
}
