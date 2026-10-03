import { IsString, MaxLength } from 'class-validator';

export class CreateHomeGymDto {
  @IsString()
  @MaxLength(100)
  name: string;
}
