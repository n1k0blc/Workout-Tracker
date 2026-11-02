import {
  IsOptional,
  IsDateString,
  IsInt,
  IsIn,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiLocale, SUPPORTED_LOCALES } from '../../common/utils/locale.util';
import {
  AGE_MAX,
  AGE_MIN,
  BODY_WEIGHT_KG_MAX,
  BODY_WEIGHT_KG_MIN,
  Email,
  HEIGHT_CM_MAX,
  HEIGHT_CM_MIN,
  MaxAge,
  MinAge,
  PersonName,
  TARGET_KCAL_MAX,
  TARGET_KCAL_MIN,
  TARGET_MACRO_MAX,
  TARGET_MACRO_MIN,
} from '../../common/validation/field-rules';

export class UpdateUserDto {
  @IsOptional()
  @Email()
  email?: string;

  @IsOptional()
  @PersonName()
  firstName?: string;

  @IsOptional()
  @PersonName()
  lastName?: string;

  @IsOptional()
  @IsDateString()
  @MinAge(AGE_MIN)
  @MaxAge(AGE_MAX)
  dateOfBirth?: string;

  @IsOptional()
  @IsInt()
  @Min(HEIGHT_CM_MIN)
  @Max(HEIGHT_CM_MAX)
  height?: number;

  @IsOptional()
  @IsNumber()
  @Min(BODY_WEIGHT_KG_MIN)
  @Max(BODY_WEIGHT_KG_MAX)
  weight?: number;

  // Tagesziele (#152): each may be sent as a positive integer to set it, or as null to clear
  // it. `@IsOptional()` lets null through untouched, and the service writes it straight to the
  // column.
  @IsOptional()
  @IsInt()
  @Min(TARGET_KCAL_MIN)
  @Max(TARGET_KCAL_MAX)
  targetKcal?: number | null;

  @IsOptional()
  @IsInt()
  @Min(TARGET_MACRO_MIN)
  @Max(TARGET_MACRO_MAX)
  targetCarbs?: number | null;

  @IsOptional()
  @IsInt()
  @Min(TARGET_MACRO_MIN)
  @Max(TARGET_MACRO_MAX)
  targetProtein?: number | null;

  @IsOptional()
  @IsInt()
  @Min(TARGET_MACRO_MIN)
  @Max(TARGET_MACRO_MAX)
  targetFat?: number | null;

  // Locale tracer bullet (#179): the Profil language select. `@IsIn`, not `@IsEnum` --
  // ApiLocale is a lowercase string union on the DTO side, not a TS/Prisma enum.
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: ApiLocale;

  // Weight unit system (#186): independent of `locale`, never re-derived from it.
  @IsOptional()
  @IsIn(['METRIC', 'IMPERIAL'])
  unitSystem?: 'METRIC' | 'IMPERIAL';
}
