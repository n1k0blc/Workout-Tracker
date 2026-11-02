import { IsIn, IsOptional } from 'class-validator';
import { FoodDto } from '../../foods/dto';
import { MealListItemDto } from '../../meals/dto';

/**
 * One row of the picker's Favoriten / Zuletzt tab: a Lebensmittel or a Mahlzeit, tagged so
 * the client renders the right row. The two lists interleave foods and meals, so a plain
 * `{ foods, meals }` split would lose the ordering the tab is defined by -- this keeps it a
 * single ordered array.
 */
export type PickerItemDto =
  { kind: 'food'; food: FoodDto } | { kind: 'meal'; meal: MealListItemDto };

export class PickerListDto {
  items: PickerItemDto[];
}

/**
 * `scope=food` narrows the picker lists to Lebensmittel only (the Zutat search inside the
 * Mahlzeit editor, where a meal cannot be an ingredient); absent or `all` means foods and meals.
 */
export class PickerScopeQueryDto {
  @IsOptional()
  @IsIn(['food', 'all'])
  scope?: string;
}
