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
} from 'class-validator';
import { Type } from 'class-transformer';

export class HomeGymInput {
  @IsString()
  @MaxLength(100)
  name: string;
}

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @IsString()
  @MaxLength(50)
  firstName: string;

  @IsString()
  @MaxLength(50)
  lastName: string;

  @IsDateString()
  dateOfBirth: string;

  @IsInt()
  @Min(50)
  @Max(300)
  height: number;

  @IsNumber()
  @Min(20)
  @Max(500)
  weight: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => HomeGymInput)
  homeGyms: HomeGymInput[];
}
