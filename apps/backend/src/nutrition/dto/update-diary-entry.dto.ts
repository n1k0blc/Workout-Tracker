import { IsNumber, Min, Max, IsOptional } from 'class-validator';
import {
  AMOUNT_MAX,
  AMOUNT_MIN,
  BaseText,
  PORTION_LABEL_MAX,
} from '../../common/validation/field-rules';

/**
 * Changes an Eintrag's quantity. The service rescales the stored kcal/macro snapshot by
 * newQuantity / oldQuantity -- it never recomputes them from a Food. `quantityLabel` is only
 * sent for a food-backed entry, whose editor works in real g/ml and portions and needs the
 * display label kept in sync (e.g. "2 Portionen (80 g)").
 */
export class UpdateDiaryEntryDto {
  @IsNumber()
  @Min(AMOUNT_MIN)
  @Max(AMOUNT_MAX)
  quantity: number;

  @IsOptional()
  @BaseText(PORTION_LABEL_MAX, { allowEmpty: true })
  quantityLabel?: string;
}
