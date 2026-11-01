import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsDateString,
  IsInt,
  IsNumber,
  Min,
  Max,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AGE_MAX,
  AGE_MIN,
  BaseText,
  BODY_WEIGHT_KG_MAX,
  BODY_WEIGHT_KG_MIN,
  EMAIL_MAX,
  HEIGHT_CM_MAX,
  HEIGHT_CM_MIN,
  HOME_GYMS_MAX,
  MaxAge,
  MinAge,
  NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  PersonName,
} from '../../common/validation/field-rules';

export class HomeGymInput {
  @BaseText(NAME_MAX)
  name: string;
}

export class RegisterDto {
  @IsEmail()
  @MaxLength(EMAIL_MAX)
  email: string;

  @IsString()
  @MinLength(PASSWORD_MIN)
  @MaxLength(PASSWORD_MAX)
  password: string;

  @PersonName()
  firstName: string;

  @PersonName()
  lastName: string;

  @IsDateString()
  @MinAge(AGE_MIN)
  @MaxAge(AGE_MAX)
  dateOfBirth: string;

  @IsInt()
  @Min(HEIGHT_CM_MIN)
  @Max(HEIGHT_CM_MAX)
  height: number;

  @IsNumber()
  @Min(BODY_WEIGHT_KG_MIN)
  @Max(BODY_WEIGHT_KG_MAX)
  weight: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(HOME_GYMS_MAX)
  @ValidateNested({ each: true })
  @Type(() => HomeGymInput)
  homeGyms: HomeGymInput[];
}
