import { IsString, IsNotEmpty, IsNumber, Min, Max, IsOptional, IsBoolean } from 'class-validator';
import { IsLocalDate } from '../../common/utils/local-date.util';
import {
  AMOUNT_MAX,
  AMOUNT_MIN,
  BaseText,
  FOOD_NAME_MAX,
  PORTION_LABEL_MAX,
  QUICK_ENTRY_KCAL_MAX,
  QUICK_ENTRY_MACRO_MAX,
} from '../../common/validation/field-rules';

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

  // Same rule as a Lebensmittel name, so "Als Lebensmittel speichern" cannot fail on it.
  @BaseText(FOOD_NAME_MAX)
  name: string;

  @IsNumber()
  @Min(0)
  @Max(QUICK_ENTRY_KCAL_MAX)
  kcal: number;

  @IsNumber()
  @Min(0)
  @Max(QUICK_ENTRY_MACRO_MAX)
  carbs: number;

  @IsNumber()
  @Min(0)
  @Max(QUICK_ENTRY_MACRO_MAX)
  protein: number;

  @IsNumber()
  @Min(0)
  @Max(QUICK_ENTRY_MACRO_MAX)
  fat: number;

  // How much was eaten, in the entry's own unit. Absent for a bare Schnelleintrag, where it
  // defaults to 1; the quantity editor later rescales the snapshot by newQuantity / this.
  @IsOptional()
  @IsNumber()
  @Min(AMOUNT_MIN)
  @Max(AMOUNT_MAX)
  quantity?: number;

  @IsOptional()
  @BaseText(PORTION_LABEL_MAX, { allowEmpty: true })
  quantityLabel?: string;

  // When true, the entered name and kcal/macros are also saved as a new USER Lebensmittel
  // (per-100 values), and this entry references it. The Schnelleintrag form's "Als
  // Lebensmittel speichern" toggle (#144).
  @IsOptional()
  @IsBoolean()
  saveAsFood?: boolean;
}
