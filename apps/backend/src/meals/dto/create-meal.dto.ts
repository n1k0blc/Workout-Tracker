import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AMOUNT_MAX, AMOUNT_MIN, BaseText, FOOD_NAME_MAX } from '../../common/validation/field-rules';

/** One ingredient line: a Food and how much of it, in grams or millilitres. */
export class MealItemInputDto {
  @IsString()
  @IsNotEmpty()
  foodId: string;

  // Always grams or millilitres -- the client resolves a chosen portion into this before
  // sending, exactly like the picker's basket items.
  @IsNumber()
  @Min(AMOUNT_MIN)
  @Max(AMOUNT_MAX)
  quantity: number;
}

/**
 * Creates a Mahlzeit. `createdById` is stamped by the service from the caller. The item list
 * is stored in the order sent -- `order` is written from array position, the client never
 * sends it (the same rule as FoodPortion and the workout tree). Duplicate names are allowed;
 * a meal cannot contain a meal (the payload only carries `foodId`s).
 */
export class CreateMealDto {
  @BaseText(FOOD_NAME_MAX)
  name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MealItemInputDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  items: MealItemInputDto[];
}
