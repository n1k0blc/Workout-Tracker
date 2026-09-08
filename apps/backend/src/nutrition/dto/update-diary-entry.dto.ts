import { IsNumber, IsPositive } from 'class-validator';

/**
 * The only edit an Eintrag accepts in this ticket: a new quantity. The service rescales the
 * stored kcal/macro snapshot by newQuantity / oldQuantity -- it never recomputes them from a
 * Food.
 */
export class UpdateDiaryEntryDto {
  @IsNumber()
  @IsPositive()
  quantity: number;
}
