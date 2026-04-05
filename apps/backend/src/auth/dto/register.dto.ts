import { IsEmail, IsString, MinLength, MaxLength, IsDateString, IsInt, IsNumber, Min, Max, IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class HomeGymInput {
  @IsString()
  @MaxLength(100)
  name: string;
}

export class RegisterDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(100, { message: 'Password must not exceed 100 characters' })
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
  @ArrayMinSize(1, { message: 'At least one home gym is required' })
  @ValidateNested({ each: true })
  @Type(() => HomeGymInput)
  homeGyms: HomeGymInput[];
}
