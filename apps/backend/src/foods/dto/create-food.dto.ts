import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AMOUNT_MAX,
  AMOUNT_MIN,
  BaseText,
  FOOD_NAME_MAX,
  KCAL_MAX_DECIMALS,
  KCAL_PER_100_MAX,
  MacroSum,
  MACRO_PER_100_MAX,
  MaxDecimals,
  PORTION_LABEL_MAX,
  PORTIONS_PER_FOOD_MAX,
} from '../../common/validation/field-rules';

/** One named portion of a food ("1 Portion" = 40 g). `grams` is g or ml per the food's `isLiquid`. */
export class FoodPortionInputDto {
  @BaseText(PORTION_LABEL_MAX)
  label: string;

  @IsNumber()
  @Min(AMOUNT_MIN)
  @Max(AMOUNT_MAX)
  grams: number;

  // Exactly one portion must carry this when a food has any portions (checked in the service).
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

/**
 * Creates a USER Lebensmittel. Nutrients are per 100 g (or 100 ml when `isLiquid`). `source`
 * and `createdById` are set by the service -- a client cannot create a SEED or Open-Food-Facts
 * row.
 */
export class CreateFoodDto {
  @BaseText(FOOD_NAME_MAX)
  name: string;

  @IsOptional()
  @BaseText(FOOD_NAME_MAX, { allowEmpty: true })
  brand?: string;

  // EAN-8, EAN-13, UPC-A, GTIN-14 -- 8 to 14 digits.
  @IsOptional()
  @IsString()
  @Matches(/^\d{8,14}$/)
  barcode?: string;

  @IsOptional()
  @IsBoolean()
  isLiquid?: boolean;

  @IsNumber()
  @Min(0)
  @Max(KCAL_PER_100_MAX)
  @MaxDecimals(KCAL_MAX_DECIMALS)
  kcal: number;

  @IsNumber()
  @Min(0)
  @Max(MACRO_PER_100_MAX)
  carbs: number;

  @IsNumber()
  @Min(0)
  @Max(MACRO_PER_100_MAX)
  protein: number;

  @IsNumber()
  @Min(0)
  @Max(MACRO_PER_100_MAX)
  @MacroSum(['carbs', 'protein'])
  fat: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(PORTIONS_PER_FOOD_MAX)
  @ValidateNested({ each: true })
  @Type(() => FoodPortionInputDto)
  portions?: FoodPortionInputDto[];
}
