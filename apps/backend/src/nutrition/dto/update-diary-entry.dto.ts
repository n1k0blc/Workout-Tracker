import { IsNumber, IsPositive, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Changes an Eintrag's quantity. The service rescales the stored kcal/macro snapshot by
 * newQuantity / oldQuantity -- it never recomputes them from a Food. `quantityLabel` is only
 * sent for a food-backed entry, whose editor works in real g/ml and portions and needs the
 * display label kept in sync (e.g. "2 Portionen (80 g)").
 */
export class UpdateDiaryEntryDto {
  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  quantityLabel?: string;
}
