import { IsEmail, IsOptional, IsString, MaxLength, IsDateString, IsInt, IsNumber, Min, Max } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(300)
  height?: number;

  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(500)
  weight?: number;

  // Tagesziele (#152): each may be sent as a positive integer to set it, or as null to clear
  // it. `@IsOptional()` lets null through untouched, and the service writes it straight to the
  // column.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20000)
  targetKcal?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2000)
  targetCarbs?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2000)
  targetProtein?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2000)
  targetFat?: number | null;
}
