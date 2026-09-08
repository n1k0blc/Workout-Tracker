import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

/** One named portion of a food ("1 Portion" = 40 g). `grams` is g or ml per the food's `isLiquid`. */
export class FoodPortionInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  label: string;

  @IsNumber()
  @Min(0.01)
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
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  // EAN-8, EAN-13, UPC-A, GTIN-14 -- 8 to 14 digits.
  @IsOptional()
  @IsString()
  @Matches(/^\d{8,14}$/, { message: 'Barcode muss 8 bis 14 Ziffern haben' })
  barcode?: string;

  @IsOptional()
  @IsBoolean()
  isLiquid?: boolean;

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FoodPortionInputDto)
  portions?: FoodPortionInputDto[];
}
